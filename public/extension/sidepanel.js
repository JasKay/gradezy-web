/* Unified Gradezy workspace. Explicit, user-initiated reads only; no remote data transfer or writes. */
const $ = (id) => document.getElementById(id);
let tab = null;
let system = "other";
let exportRows = null;
const norm = (v) => String(v ?? "").trim().toLowerCase();
const key = (v) => norm(v).replace(/[^a-z0-9]/g, "");
const text = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function hidePreview() {
  $("preview").hidden = true;
  $("preview").textContent = "";
  $("downloadCsv").hidden = true;
  exportRows = null;
}
function setPreview(message) {
  $("preview").hidden = false;
  $("preview").textContent = message;
}
function detect(t) {
  if (!t?.url) return "other";
  let u; try { u = new URL(t.url); } catch { return "other"; }
  const host = u.hostname.toLowerCase(), path = u.pathname.toLowerCase(), title = norm(t.title);
  if (host === "staffadv.ncgrp.co.uk") return "staff";
  if (host.includes("excel.") || host === "excel.cloud.microsoft" || (host.includes("office.com") && (path.includes("excel") || title.includes("excel")))) return "excel";
  if (host.endsWith(".sharepoint.com")) return path.includes("/_layouts/15/doc.aspx") || title.includes("excel") ? "excel" : "tracker";
  if (host.includes("moodle") || path.includes("/mod/turnitintool") || path.includes("/mod/assign/") || path.includes("/grade/report/") || title.includes("moodle")) return "moodle";
  return "other";
}
async function refreshSummary() {
  const state = await chrome.storage.session.get(["gradezyMoodleRecords", "gradezyStaffSnapshot"]);
  const s = state.gradezyMoodleRecords;
  $("savedSummary").textContent = s?.records?.length
    ? s.records.length + " Turnitin records · " + s.assessment + " · " + (s.attempt === "resub" ? "Resubmission" : "First attempt")
    : "No Moodle records captured this browser session.";
  $("staffSummary").textContent = state.gradezyStaffSnapshot
    ? state.gradezyStaffSnapshot.count + " StaffAdvantage students read this session."
    : "";
}
async function refreshTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  tab = tabs[0] || null;
  system = detect(tab);
  const labels = { moodle: "Moodle", tracker: "SharePoint", excel: "Excel Online", staff: "StaffAdvantage", other: "Other page" };
  $("siteLabel").textContent = labels[system];
  $("siteType").textContent = system === "other" ? "Unsupported" : "Recognised";
  $("pageTitle").textContent = tab?.title || "No active page";
  $("accessStatus").textContent = "No automatic writes";
  $("moodleSection").hidden = system !== "moodle";
  $("trackerSection").hidden = system !== "tracker" && system !== "excel";
  $("staffSection").hidden = system !== "staff";
  $("otherSection").hidden = system !== "other";
  await refreshSummary();
}
async function requestSiteAccess() {
  if (!tab?.id || !tab.url) throw Error("Open a supported browser tab first.");
  let url; try { url = new URL(tab.url); } catch { throw Error("This page cannot be accessed."); }
  if (url.protocol !== "https:") throw Error("Only HTTPS assessment pages are supported.");
  const pattern = url.origin + "/*";
  const allowed = await chrome.permissions.contains({ origins: [pattern] });
  if (!allowed) {
    const granted = await chrome.permissions.request({ origins: [pattern] });
    if (!granted) throw Error("Page access was not granted. Gradezy cannot inspect this site.");
  }
  return tab.id;
}
/* Isolated-world DOM scanner. It reads only visible document tables and does not make requests or modify content. */
function scanVisibleTables() {
  const compact = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const nodes = [...document.querySelectorAll("table,[role='grid']")].slice(0, 15);
  return nodes.map((node) => {
    const headers = [...node.querySelectorAll("thead th, thead td, [role='columnheader']")].slice(0, 45).map(el => compact(el.innerText || el.textContent));
    const rowNodes = node.matches("table") ? [...node.querySelectorAll("tbody tr")] : [...node.querySelectorAll("[role='row']")].filter(el => !el.querySelector("[role='columnheader']"));
    const rows = rowNodes.slice(0, 500).map((row) => {
      const cells = row.matches("tr") ? [...row.querySelectorAll(":scope > th, :scope > td")] : [...row.querySelectorAll(":scope > [role='gridcell'], :scope > [role='rowheader']")];
      return cells.slice(0, 45).map(cell => compact(cell.innerText || cell.textContent));
    }).filter(row => row.some(Boolean));
    if (!headers.length && node.matches("table")) {
      const firstRow = node.querySelector("tr");
      if (firstRow) headers.push(...[...firstRow.querySelectorAll("th,td")].map(el => compact(el.innerText || el.textContent)));
    }
    return { headers, rows };
  }).filter(t => t.headers.length && t.rows.length);
}
async function visibleTables() {
  const id = await requestSiteAccess();
  const result = await chrome.scripting.executeScript({ target: { tabId: id }, func: scanVisibleTables });
  return result?.[0]?.result || [];
}
function findIndex(headers, candidates) {
  const h = headers.map(key);
  for (const option of candidates) {
    const exact = h.indexOf(option);
    if (exact !== -1) return exact;
  }
  return h.findIndex(value => candidates.some(option => value.includes(option)));
}
function findMoodleRecords(tables) {
  for (const t of tables) {
    const e = findIndex(t.headers, ["email", "emailaddress", "studentemail"]);
    const p = findIndex(t.headers, ["paperid", "turnitinpaperid", "tiipaperid"]);
    const sim = findIndex(t.headers, ["similarity", "similarityscore"]);
    if (e < 0 || p < 0) continue;
    const records = t.rows.map((row) => ({
      email: norm(row[e]), paper: text(row[p]), similarity: sim >= 0 ? text(row[sim]) : ""
    })).filter(record => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email) && record.paper);
    if (records.length) return records;
  }
  return [];
}
function parseDelimited(content, delimiter) {
  const rows = []; let field = "", row = [], quoted = false;
  const value = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"') {
      if (quoted && value[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(field); field = "";
    } else if (!quoted && (char === "\r" || char === "\n")) {
      if (char === "\r" && value[i + 1] === "\n") i++;
      row.push(field); if (row.some(v => v.trim())) rows.push(row);
      field = ""; row = [];
    } else field += char;
  }
  if (quoted) throw Error("Malformed CSV: unmatched quote.");
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
async function fileTable(inputId) {
  const file = $(inputId).files?.[0];
  if (!file) throw Error("Choose a CSV or TSV file first.");
  if (!/\.(csv|tsv)$/i.test(file.name)) throw Error("Only CSV/TSV is supported. Save the XLSX export as CSV first.");
  if (file.size > 15 * 1024 * 1024) throw Error("File is larger than the 15 MB local import limit.");
  const rows = parseDelimited(await file.text(), /\.tsv$/i.test(file.name) ? "\t" : ",");
  if (rows.length < 2) throw Error("No data rows found.");
  return { headers: rows[0], rows: rows.slice(1), allRows: rows };
}
function validateScope() {
  const assessment = text($("assessment").value), attempt = $("attempt").value;
  if (!assessment || !attempt) throw Error("Enter an assessment/module label and choose the attempt.");
  return { assessment, attempt };
}
async function saveMoodle(records, source) {
  const { assessment, attempt } = validateScope();
  if (!records.length) throw Error("No valid Email and Paper ID records were detected. Use the Turnitin CSV export if this page doesn't display them.");
  const seen = new Map(), conflicts = [];
  for (const record of records) {
    const before = seen.get(record.email);
    if (before && (before.paper !== record.paper || before.similarity !== record.similarity)) conflicts.push(record.email);
    else seen.set(record.email, record);
  }
  if (conflicts.length) throw Error("Capture cancelled: " + conflicts.length + " duplicate emails have conflicting Paper IDs or similarity values.");
  await chrome.storage.session.set({ gradezyMoodleRecords: { records: [...seen.values()], assessment, attempt, source, savedAt: Date.now() } });
  hidePreview();
  status("Saved " + seen.size + " Moodle records in temporary browser session storage. Switch to the SharePoint/Excel Tracker tab.");
  await refreshSummary();
}
function matchTracker(source, tables) {
  const updates = [], exceptions = [], messages = [];
  const candidates = tables.map(t => {
    const e = findIndex(t.headers, ["eslemail", "email", "studentemail"]);
    const paper = source.attempt === "resub"
      ? findIndex(t.headers, ["resubmissiontiipaperid", "resubtiipaperid", "resubmissionpaperid"])
      : findIndex(t.headers, ["tiipaperid", "turnitinpaperid", "paperid"]);
    const sim = source.attempt === "resub"
      ? findIndex(t.headers, ["resubsimilarity", "resubmissionsimilarity"])
      : findIndex(t.headers, ["similarity"]);
    return { t, e, paper, sim };
  }).filter(t => t.e >= 0 && t.paper >= 0);
  if (!candidates.length) throw Error("Cannot find a visible table with ESL Email and the selected attempt's Paper ID column. Use a Tracker CSV export.");
  const chosen = candidates[0], table = chosen.t;
  const counts = new Map();
  for (const row of table.rows) { const email = norm(row[chosen.e]); if (email) counts.set(email, (counts.get(email) || 0) + 1); }
  const records = new Map(source.records.map(r => [r.email, r]));
  let unchanged = 0;
  const output = [table.headers, ...table.rows.map(r => [...r])];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i], email = norm(row[chosen.e]), record = records.get(email);
    if (!record) continue;
    if (counts.get(email) !== 1) { exceptions.push("Row " + (i + 2) + ": duplicated tracker email"); continue; }
    const existing = text(row[chosen.paper]);
    if (existing && existing !== record.paper) { exceptions.push("Row " + (i + 2) + ": existing Paper ID differs"); continue; }
    if (existing === record.paper) { unchanged++; continue; }
    output[i + 1][chosen.paper] = record.paper;
    if (chosen.sim >= 0 && !text(row[chosen.sim]) && record.similarity) output[i + 1][chosen.sim] = record.similarity;
    updates.push("Row " + (i + 2) + ": blank Paper ID → proposed update");
  }
  messages.push("Assessment: " + source.assessment);
  messages.push("Attempt: " + (source.attempt === "resub" ? "Resubmission" : "First attempt"));
  messages.push("Proposed updates: " + updates.length);
  messages.push("Already identical: " + unchanged);
  messages.push("Exceptions: " + exceptions.length);
  messages.push("", ...updates.slice(0, 18), ...exceptions.slice(0, 18));
  return { summary: messages.join("\n"), output, count: updates.length };
}
async function previewTracker(fromCsv) {
  if (!$("reviewedScope").checked) throw Error("Confirm that you checked module, assessment and attempt first.");
  const state = await chrome.storage.session.get("gradezyMoodleRecords"), source = state.gradezyMoodleRecords;
  if (!source?.records?.length) throw Error("Capture Moodle submissions first.");
  const tables = fromCsv ? [await fileTable("trackerFile")] : await visibleTables();
  const result = matchTracker(source, tables);
  hidePreview(); setPreview(result.summary);
  if (fromCsv && result.count) {
    exportRows = result.output;
    $("downloadCsv").hidden = false;
  }
  status("Preview complete. No live SharePoint, Excel or StaffAdvantage records were changed.");
}
function csvEncode(rows) {
  return rows.map(row => row.map(value => '"' + String(value ?? "").replace(/"/g, '""') + '"').join(",")).join("\r\n");
}
function downloadCsv() {
  if (!exportRows) return;
  const blob = new Blob(["\uFEFF" + csvEncode(exportRows)], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "gradezy-reviewed-tracker.csv";
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function readStaff() {
  if (system !== "staff" || !tab?.id) throw Error("Open StaffAdvantage first.");
  const response = await chrome.tabs.sendMessage(tab.id, { action: "readStaffAdvantageStudents" });
  if (!response?.success) throw Error(response?.error || "Could not read StaffAdvantage. Refresh the page and try again.");
  const students = response.data?.students || [];
  await chrome.storage.session.set({gradezyStaffSnapshot:{count:students.length,savedAt:Date.now()}});
  setPreview("StaffAdvantage assessment table\nStudents detected: " + students.length + "\nRead-only extraction completed.\nNo grades were entered or submitted.");
  status("Read " + students.length + " student records from the active StaffAdvantage page.");
  await refreshSummary();
}
async function action(work) {
  try { status("Working…"); await work(); }
  catch (error) { status(error?.message || String(error), true); }
}
$("refresh").addEventListener("click", () => action(refreshTab));
$("captureMoodle").addEventListener("click", () => action(async () => {
  if (system !== "moodle") throw Error("Open a Moodle tab.");
  validateScope();
  const tables = await visibleTables();
  await saveMoodle(findMoodleRecords(tables), tab?.url);
}));
$("importMoodle").addEventListener("click", () => action(async () => {
  validateScope();
  const table = await fileTable("moodleFile");
  await saveMoodle(findMoodleRecords([table]), "local Turnitin export");
}));
$("previewPage").addEventListener("click", () => action(() => previewTracker(false)));
$("previewCsv").addEventListener("click", () => action(() => previewTracker(true)));
$("readStaff").addEventListener("click", () => action(readStaff));
$("downloadCsv").addEventListener("click", downloadCsv);
$("clearData").addEventListener("click", () => action(async () => {
  await chrome.storage.session.remove(["gradezyMoodleRecords", "gradezyStaffSnapshot"]);
  hidePreview(); await refreshSummary(); status("All saved assessment session data cleared.");
}));
chrome.tabs.onActivated.addListener(() => { refreshTab().catch(e => status(e.message, true)); });
chrome.tabs.onUpdated.addListener((_id, change, updated) => {
  if (updated.active && (change.url || change.status === "complete")) refreshTab().catch(e => status(e.message, true));
});
refreshTab().catch(e => status(e.message, true));
