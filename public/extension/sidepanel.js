/* Unified Gradezy workspace. Explicit, user-initiated reads only; no remote data transfer or writes. */
const $ = (id) => document.getElementById(id);
let tab = null;
let system = "other";
let exportRows = null;
let pendingGradePreview = null;
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
  const state = await chrome.storage.session.get(["gradezyMoodleRecords", "gradezyStaffSnapshot", "gradezyGradeData"]);
  const s = state.gradezyMoodleRecords;
  $("savedSummary").textContent = s?.records?.length
    ? s.records.length + " Turnitin records · " + s.assessment + " · " + (s.attempt === "resub" ? "Resubmission" : "First attempt")
    : "No Moodle records captured this browser session.";
  $("staffSummary").textContent = state.gradezyStaffSnapshot
    ? state.gradezyStaffSnapshot.count + " StaffAdvantage students read this session."
    : "";
  $("gradeSummary").textContent = state.gradezyGradeData
    ? state.gradezyGradeData.records.length + " grades staged · " + state.gradezyGradeData.assessment
    : "No grade file staged.";
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
  $("gradeSection").hidden = system !== "staff" && system !== "excel";
  pendingGradePreview = null;
  $("applyGrades").hidden = true;
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
/* Native XLSX reader: local ZIP/XML parsing; no network calls or remote code. */
async function readXlsx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const findEnd = () => { for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if(view.getUint32(i,true)===0x06054b50)return i; throw Error("Invalid XLSX: ZIP directory missing."); };
  const end=findEnd(), count=view.getUint16(end+10,true), offset=view.getUint32(end+16,true);
  if(count>10000 || bytes.length>15*1024*1024)throw Error("Workbook exceeds the safe local import limit.");
  const entries=new Map(); let p=offset;
  for(let i=0;i<count;i++){
    if(view.getUint32(p,true)!==0x02014b50)throw Error("Invalid XLSX ZIP entry.");
    const method=view.getUint16(p+10,true), packed=view.getUint32(p+20,true), size=view.getUint32(p+24,true);
    const len=view.getUint16(p+28,true), extra=view.getUint16(p+30,true), comment=view.getUint16(p+32,true);
    const name=decoder.decode(bytes.subarray(p+46,p+46+len));
    entries.set(name,{method,packed,size,offset:view.getUint32(p+42,true)});
    p+=46+len+extra+comment;
  }
  async function xmlFile(name){
    const e=entries.get(name);if(!e)return null;
    if(e.size>30*1024*1024)throw Error("Workbook XML is too large.");
    const o=e.offset;if(view.getUint32(o,true)!==0x04034b50)throw Error("Invalid workbook ZIP header.");
    const start=o+30+view.getUint16(o+26,true)+view.getUint16(o+28,true);
    const data=bytes.slice(start,start+e.packed);
    let raw;
    if(e.method===0)raw=data;
    else if(e.method===8){
      try{
        const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        raw=new Uint8Array(await new Response(stream).arrayBuffer());
      }catch{throw Error("This browser cannot unpack this XLSX file. Export CSV or update Chrome/Edge.");}
    }else throw Error("Unsupported XLSX compression method.");
    return new DOMParser().parseFromString(decoder.decode(raw),"application/xml");
  }
  const stringsDoc=await xmlFile("xl/sharedStrings.xml");
  const shared=stringsDoc?[...stringsDoc.getElementsByTagName("si")].map(si=>[...si.getElementsByTagName("t")].map(t=>t.textContent||"").join("")):[];
  const workbook=await xmlFile("xl/workbook.xml");
  const rels=await xmlFile("xl/_rels/workbook.xml.rels");
  let sheetName="xl/worksheets/sheet1.xml";
  if(workbook&&rels){
    const sheet=workbook.getElementsByTagName("sheet")[0];
    const id=sheet?.getAttribute("r:id");
    const rel=[...rels.getElementsByTagName("Relationship")].find(r=>r.getAttribute("Id")===id);
    const target=rel?.getAttribute("Target");
    if(target)sheetName=target.startsWith("/")?target.slice(1):target.startsWith("xl/")?target:"xl/"+target.replace(/^\.\.\//,"");
  }
  const sheet=await xmlFile(sheetName);
  if(!sheet)throw Error("Could not find the first worksheet in this XLSX file.");
  if(sheet.getElementsByTagName("parsererror").length)throw Error("Invalid worksheet XML.");
  const rows=[];
  for(const row of sheet.getElementsByTagName("row")){
    const values=[];
    for(const cell of row.getElementsByTagName("c")){
      const ref=cell.getAttribute("r")||"";
      const letters=ref.match(/^[A-Z]+/i)?.[0]||"";
      let col=0;for(const ch of letters.toUpperCase())col=col*26+ch.charCodeAt(0)-64;
      if(col<1||col>256)continue;
      const type=cell.getAttribute("t");
      const v=cell.getElementsByTagName("v")[0]?.textContent||"";
      const inline=cell.getElementsByTagName("is")[0];
      values[col-1]=type==="s"?(shared[Number(v)]??""):type==="inlineStr"?(inline?.textContent||""):v;
    }
    if(values.some(v=>String(v??"").trim()))rows.push(Array.from({length:values.length},(_,i)=>values[i]??""));
    if(rows.length>1002)throw Error("Workbook exceeds the 1000-grade-row limit.");
  }
  if(rows.length<2)throw Error("No grade data found in the first worksheet.");
  return {headers:rows[0],rows:rows.slice(1),allRows:rows};
}

async function fileTable(inputId) {
  const file = $(inputId).files?.[0];
  if (!file) throw Error("Choose an Excel, CSV or TSV file first.");
  if (/\.xlsx$/i.test(file.name)) return readXlsx(file);
  if (!/\.(csv|tsv)$/i.test(file.name)) throw Error("Choose a .xlsx, .csv or .tsv file.");
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
    // Never allow the first-attempt workflow to select a resubmission column.
    const headers = t.headers.map(key);
    const paper = source.attempt === "resub"
      ? headers.findIndex(h => h.includes("resub") && h.includes("paperid"))
      : headers.findIndex(h => !h.includes("resub") && h.includes("paperid"));
    const sim = source.attempt === "resub"
      ? headers.findIndex(h => h.includes("resub") && h.includes("similarity"))
      : headers.findIndex(h => !h.includes("resub") && h.includes("similarity"));
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
  if (!students.length) {
    const diagnostics = await chrome.tabs.sendMessage(tab.id, {action:"diagnoseStaffAdvantageScan"});
    const d = diagnostics?.data || {};
    setPreview([
      "No StaffAdvantage students detected — diagnostic scan",
      "Tables found: " + (d.tableCount ?? "unknown"),
      "Assessment table recognised: " + (d.matchedTable ? "yes" : "no"),
      "Rows in assessment table: " + (d.matchedRows ?? 0),
      "Frames on page: " + (d.frameCount ?? "unknown"),
      "Table headers: " + (d.headers || []).map(h => h.join(" | ")).filter(Boolean).join(" / "),
      "",
      "Open the assessment's student grid (not the class landing page), wait for the rows to load, then scan again.",
      "If the rows are visible but still not detected, share only the diagnostic text above (no student records)."
    ].join("\n"));
    status("No students found. See the diagnostic details below.", true);
    await refreshSummary();
    return;
  }
  setPreview("StaffAdvantage assessment table\nStudents detected: " + students.length + "\nRead-only extraction completed.\nNo grades were entered or submitted.");
  status("Read " + students.length + " student records from the active StaffAdvantage page.");
  await refreshSummary();
}
async function action(work) {
  try { status("Working…"); await work(); }
  catch (error) { status(error?.message || String(error), true); }
}

async function stageGradeFile() {
  const assessment = text($("staffScope").value);
  if (!assessment) throw Error("Enter the module and assessment label first.");
  const t = await fileTable("staffFile");
  const idCol = findIndex(t.headers, ["ncgid", "ncgstudentid", "studentid", "studentnumber", "ncgnumber"]);
  const gradeCol = findIndex(t.headers, ["grade", "grades", "finalgrade", "finalmark", "percentage", "mark", "marks", "score"]);
  if (idCol < 0 || gradeCol < 0) throw Error("Grade file needs NCG ID and Grade (or Percentage) columns.");
  if (t.rows.length > 1000) throw Error("Maximum 1000 rows per reviewed grade batch.");
  const records = t.rows.map(row => ({ ncgId: text(row[idCol]).replace(/\.0$/, ""), grade: text(row[gradeCol]) }));
  if (!records.some(record => record.ncgId && record.grade)) throw Error("No valid NCG ID/Grade pairs found.");
  await chrome.storage.session.set({gradezyGradeData:{assessment,records,savedAt:Date.now()}});
  pendingGradePreview = null;
  $("applyGrades").hidden = true;
  status("Staged " + records.length + " grade rows locally. Open the appropriate StaffAdvantage assessment to preview exact NCG ID matches.");
  await refreshSummary();
}
async function previewGradeFill() {
  if (system !== "staff" || !tab?.id) throw Error("Open StaffAdvantage first.");
  if (!$("staffReview").checked) throw Error("Confirm the assessment and student list before previewing grades.");
  const state = await chrome.storage.session.get("gradezyGradeData");
  const batch = state.gradezyGradeData;
  if (!batch?.records?.length) throw Error("Stage an Excel/CSV grade file first.");
  if (text($("staffScope").value) !== batch.assessment) throw Error("The assessment label differs from the staged file. Set it to the same assessment.");
  const result = await chrome.tabs.sendMessage(tab.id, {action:"previewStaffAdvantageFill",records:batch.records});
  if (!result?.success) throw Error(result?.error || "Could not preview grade matches.");
  const counts = result.data.summary;
  pendingGradePreview = {token:result.data.token,tabId:tab.id};
  const lines = ["StaffAdvantage grade preview", "Assessment: " + batch.assessment, "Ready to populate: " + counts.ready, "Already identical: " + counts.identical, "Conflicting existing grades: " + counts.conflict, "Missing NCG IDs: " + counts.missing, "Duplicate IDs: " + counts.duplicate, "Invalid grades/IDs: " + counts.invalid, "No editable grade field: " + counts.readonly, "", ...(result.data.exceptions || []).slice(0,20)];
  setPreview(lines.join("\n"));
  $("applyGrades").hidden = !counts.ready;
  status("Review complete. Nothing has been changed. Populate only if the matches and assessment scope are correct.");
}
async function applyGradeFill() {
  if (system !== "staff" || !tab?.id || tab.id !== pendingGradePreview?.tabId) throw Error("The preview is no longer valid.");
  if (!$("staffReview").checked) throw Error("Reconfirm the assessment before populating.");
  const result = await chrome.tabs.sendMessage(tab.id, {action:"applyStaffAdvantageFill",token:pendingGradePreview.token});
  pendingGradePreview = null;
  $("applyGrades").hidden = true;
  if (!result?.success) throw Error(result?.error || "Could not populate grade fields.");
  const counts = result.data;
  setPreview("Grade population results\nFields populated: " + counts.populated + "\nSkipped: " + counts.skipped + "\nFailed: " + counts.failed + "\n\nReview the visible StaffAdvantage form carefully. Gradezy did not click Save or Submit. The website itself may autosave changes.");
  status("Grade entry finished. Check the page before taking any final action.");
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
$("stageGrades").addEventListener("click", () => action(stageGradeFile));
$("previewGrades").addEventListener("click", () => action(previewGradeFill));
$("applyGrades").addEventListener("click", () => action(applyGradeFill));
$("downloadCsv").addEventListener("click", downloadCsv);
$("clearData").addEventListener("click", () => action(async () => {
  await chrome.storage.session.remove(["gradezyMoodleRecords", "gradezyStaffSnapshot", "gradezyGradeData"]);
  hidePreview(); await refreshSummary(); status("All saved assessment session data cleared.");
}));
chrome.tabs.onActivated.addListener(() => { refreshTab().catch(e => status(e.message, true)); });
chrome.tabs.onUpdated.addListener((_id, change, updated) => {
  if (updated.active && (change.url || change.status === "complete")) refreshTab().catch(e => status(e.message, true));
});
refreshTab().catch(e => status(e.message, true));

/* User-selected workflow navigation. Site detection still controls access to live pages. */
let gradezySelectedWorkflow = null;
function gradezyShowWorkflow(which) {
  gradezySelectedWorkflow = which;
  for (const [id, value] of [["chooseMoodle","moodle"],["chooseStaff","staff"],["chooseTracker","tracker"]]) {
    $(id)?.classList.toggle("selected", value === which);
  }
  $("moodleSection").hidden = which !== "moodle";
  $("trackerSection").hidden = which !== "tracker";
  $("gradeSection").hidden = which !== "staff";
  $("staffSection").hidden = which !== "staff";
  $("otherSection").hidden = false;
  $("otherSection").querySelector("h2").textContent = "Page connection";
  $("otherSection").querySelector("p").textContent = system === which || (which === "tracker" && system === "excel") ? "This workflow matches your current browser page. Use the tools above." : "Open the matching " + ({moodle:"Moodle",staff:"StaffAdvantage",tracker:"SharePoint"}[which]) + " page in a browser tab to use the live page tools.";
  if (system === which || (which === "tracker" && system === "excel")) $("otherSection").hidden = true;
  status("Selected " + ({moodle:"Moodle · Download Scores",staff:"StaffAdvantage · Grade Fill",tracker:"SharePoint · Progress Tracker"}[which]) + ".");
}
for (const [id, systemName] of [["chooseMoodle","moodle"],["chooseStaff","staff"],["chooseTracker","tracker"]]) {
  $(id)?.addEventListener("click", () => gradezyShowWorkflow(systemName));
}
