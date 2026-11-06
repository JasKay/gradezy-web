/* Unified Gradezy workspace. Explicit, user-initiated reads only; no remote data transfer or writes. */
const $ = (id) => document.getElementById(id);
let tab = null;
let system = "other";
let exportRows = null;
let pendingGradePreview = null;
let gradeWorkbook = null;
let gradeFlowStep = "upload";
let gradezySelectedWorkflow = null;
function setGradeStep(step) {
  gradeFlowStep = step;
  const active = gradezySelectedWorkflow === "staff";
  $("gradeFlowSteps").hidden = !active;
  $("gradeSection").hidden = !active || step !== "upload";
  $("staffSection").hidden = !active || step === "upload";
  $("staffMatchPane").hidden = step !== "match";
  $("staffLivePane").hidden = step !== "live";
  for (const name of ["Upload", "Match", "Live"]) $("step" + name).classList.toggle("active", name.toLowerCase() === step);
}
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
  if (gradezySelectedWorkflow) gradezyShowWorkflow(gradezySelectedWorkflow, true);
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
  let sheetNames=[{name:"Sheet 1",path:"xl/worksheets/sheet1.xml"}];
  if(workbook&&rels){
    sheetNames=[...workbook.getElementsByTagName("sheet")].map((sheet,i)=>{
      const id=sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
      const rel=[...rels.getElementsByTagName("Relationship")].find(r=>r.getAttribute("Id")===id);
      const target=rel?.getAttribute("Target") || `worksheets/sheet${i+1}.xml`;
      const parts=(target.startsWith("/")?target.slice(1):target.startsWith("xl/")?target:"xl/"+target).split("/");
      const safe=[];for(const part of parts){if(part==="..")safe.pop();else if(part!==".")safe.push(part);}
      return {name:sheet.getAttribute("name")||`Sheet ${i+1}`,path:safe.join("/")};
    });
  }
  const sheets=[];
  for(const spec of sheetNames){
  const sheet=await xmlFile(spec.path);
  if(!sheet)continue;
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
    if(rows.length>10005)throw Error("Worksheet exceeds the 10000-row inspection limit.");
  }
  sheets.push({name:spec.name,allRows:rows});
  }
  if(!sheets.some(s=>s.allRows.length>=2))throw Error("No data rows found in this workbook.");
  return {sheets};
}

async function fileTable(inputId) {
  const file = $(inputId).files?.[0];
  if (!file) throw Error("Choose an Excel, CSV or TSV file first.");
  if (/\.xlsx$/i.test(file.name)) {
    const workbook=await readXlsx(file);
    const first=workbook.sheets.find(s=>s.allRows.length>=2);
    return {headers:first.allRows[0],rows:first.allRows.slice(1),allRows:first.allRows};
  }
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
    return 0;
  }
  setPreview("StaffAdvantage assessment table\nStudents detected: " + students.length + "\nRead-only extraction completed.\nNo grades were entered or submitted.");
  status("Read " + students.length + " student records from the active StaffAdvantage page.");
  await refreshSummary();
  return students.length;
}
function selectedGradeSheet() { return gradeWorkbook?.sheets[Number($("gradeSheet").value)]; }
function selectedGradeRows(){const sheet=selectedGradeSheet();const index=Number($("gradeHeaderRow").value)||0;return {headers:sheet?.allRows[index]||[],rows:sheet?.allRows.slice(index+1)||[]};}
function gradeHeaderIndex(headers, candidates) {
  const values=headers.map(key);
  for(const candidate of candidates){const index=values.indexOf(candidate);if(index>=0)return index;}
  return -1;
}
function populateColumnSelect(id, headers, preferred) {
  const select=$(id);select.replaceChildren();
  const none=document.createElement("option");none.value="-1";none.textContent="Choose column";select.append(none);
  headers.forEach((header,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=`${i+1}. ${text(header)||"Untitled"}`;select.append(option);});
  select.value=String(gradeHeaderIndex(headers,preferred));
}
function renderGradeFile() {
  const sheet=selectedGradeSheet(); if(!sheet)return;
  const headerSelect=$("gradeHeaderRow");headerSelect.replaceChildren();
  sheet.allRows.slice(0,20).forEach((row,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=`Row ${i+1}: ${row.slice(0,3).map(text).join(" · ").slice(0,70)}`;headerSelect.append(option);});
  const best=sheet.allRows.slice(0,20).findIndex(row=>gradeHeaderIndex(row,["ncgid","ncgstudentid","studentid","studentnumber"])>=0);
  headerSelect.value=String(best>=0?best:0);
  renderGradeColumns();
}
function renderGradeColumns(){
  const headers=selectedGradeRows().headers;
  populateColumnSelect("gradeIdColumn",headers,["ncgid","ncgstudentid","studentid","studentnumber","ncgnumber"]);
  populateColumnSelect("gradeValueColumn",headers,["finalgrade","grade","grades","finalmark","percentage","mark","score"]);
  populateColumnSelect("gradeFirstColumn",headers,["firstname","forename","givenname"]);
  populateColumnSelect("gradeLastColumn",headers,["lastname","surname","familyname"]);
  refreshGradePreview();
}
function refreshGradePreview() {
  const sheet=selectedGradeSheet();if(!sheet)return;
  const {headers,rows}=selectedGradeRows();
  const indices=["gradeIdColumn","gradeFirstColumn","gradeLastColumn","gradeValueColumn"].map(id=>Number($(id).value));
  const eligible=rows.filter(row=>indices[0]>=0&&indices[3]>=0&&text(row[indices[0]])&&text(row[indices[3]])).length;
  $("gradeFileInfo").textContent=`${rows.length} students · ${eligible} grades`;
  const wrapper=$("gradeFilePreview");wrapper.replaceChildren();
  const table=document.createElement("table"),head=document.createElement("tr");
  ["NCG ID","First name","Last name","Grade"].forEach(label=>{const th=document.createElement("th");th.textContent=label;head.append(th);});
  const thead=document.createElement("thead");thead.append(head);table.append(thead);
  const body=document.createElement("tbody");
  rows.slice(0,30).forEach(row=>{const tr=document.createElement("tr");indices.forEach(i=>{const td=document.createElement("td");td.textContent=i>=0?text(row[i]):"—";tr.append(td);});body.append(tr);});
  table.append(body);wrapper.append(table);
  $("stageGrades").disabled=indices[0]<0||indices[3]<0||indices[0]===indices[3]||rows.length===0||rows.length>1000;
}
async function inspectGradeFile() {
  const file=$("staffFile").files?.[0];
  gradeWorkbook=null;$("gradeImportOptions").hidden=true;$("stageGrades").disabled=true;
  if(!file)return;
  if(file.size>15*1024*1024)throw Error("File is larger than the 15 MB local import limit.");
  if(/\.xlsx$/i.test(file.name))gradeWorkbook=await readXlsx(file);
  else if(/\.(csv|tsv)$/i.test(file.name)){
    const rows=parseDelimited(await file.text(),/\.tsv$/i.test(file.name)?"\t":",");
    gradeWorkbook={sheets:[{name:"Imported file",allRows:rows}]};
  }else throw Error("Choose an Excel .xlsx, CSV or TSV file.");
  const select=$("gradeSheet");select.replaceChildren();
  gradeWorkbook.sheets.forEach((sheet,i)=>{const option=document.createElement("option");option.value=String(i);option.textContent=`${sheet.name} (${Math.max(0,sheet.allRows.length-1)} rows)`;select.append(option);});
  const best=gradeWorkbook.sheets.findIndex(s=>gradeHeaderIndex(s.allRows[0]||[],["ncgid","ncgstudentid","studentid","studentnumber"])>=0);
  select.value=String(best>=0?best:0);
  $("gradeImportOptions").hidden=false;renderGradeFile();
  status("");
}
async function action(work) {
  try { status("Working…"); await work(); }
  catch (error) { status(error?.message || String(error), true); }
}

async function stageGradeFile() {
  const sheet=selectedGradeSheet();if(!sheet)throw Error("Choose and inspect an Excel/CSV file first.");
  const [idCol,firstCol,lastCol,gradeCol]=["gradeIdColumn","gradeFirstColumn","gradeLastColumn","gradeValueColumn"].map(id=>Number($(id).value));
  if(idCol<0||gradeCol<0||idCol===gradeCol)throw Error("Select distinct NCG ID and Grade columns.");
  const rows=selectedGradeRows().rows;
  if(rows.length>1000)throw Error("Maximum 1000 grade rows per reviewed batch.");
  const records=rows.map(row=>({ncgId:text(row[idCol]).replace(/\.0$/, ""),grade:text(row[gradeCol]),firstName:firstCol>=0?text(row[firstCol]):"",lastName:lastCol>=0?text(row[lastCol]):""})).filter(record=>record.ncgId&&record.grade);
  if (!records.length) throw Error("No NCG IDs with grades found.");
  await chrome.storage.session.set({gradezyGradeData:{worksheet:sheet.name,records,savedAt:Date.now()}});
  pendingGradePreview = null;
  $("matchSourceSummary").textContent=`${records.length} grades from ${sheet.name}`;
  $("matchResults").hidden=true;
  $("staffReview").checked=false;
  setGradeStep("match");
  status("");
  await refreshSummary();
}
async function previewGradeFill() {
  if (system !== "staff" || !tab?.id) throw Error("Open StaffAdvantage first.");
  if(!$("staffAttempt").value)throw Error("Choose the assessment attempt first.");
  const state = await chrome.storage.session.get("gradezyGradeData");
  const batch = state.gradezyGradeData;
  if (!batch?.records?.length) throw Error("Stage an Excel/CSV grade file first.");
  const result = await chrome.tabs.sendMessage(tab.id, {action:"previewStaffAdvantageFill",records:batch.records,allowDefaultZero:$("staffZeroReview").checked,attemptNumber:$("staffAttempt").value});
  if (!result?.success) throw Error(result?.error || "Could not preview grade matches.");
  const counts = result.data.summary;
  pendingGradePreview = {token:result.data.token,tabId:tab.id};
  const exceptions=counts.missing+counts.duplicate+counts.nameMismatch+counts.conflict+counts.readonly+counts.invalid+counts.zeroReview;
  $("matchSummary").textContent=`${counts.ready} ready · ${counts.identical} already entered · ${exceptions} need attention`;
  const wrapper=$("matchPreview");wrapper.replaceChildren();
  const table=document.createElement("table");const head=document.createElement("thead");const row=document.createElement("tr");
  ["NCG ID","Student","Grade","Status"].forEach(value=>{const cell=document.createElement("th");cell.textContent=value;row.append(cell);});head.append(row);table.append(head);
  const body=document.createElement("tbody");
  for(const match of (result.data.details||[]).slice(0,80)){
    const tr=document.createElement("tr");
    [match.ncgId,match.staffName||`${match.firstName||""} ${match.lastName||""}`.trim(),match.grade,match.status].forEach(value=>{const td=document.createElement("td");td.textContent=text(value);tr.append(td);});body.append(tr);
  }
  table.append(body);wrapper.append(table);
  $("matchResults").hidden=false;
  $("toLive").disabled=counts.ready===0;
  $("liveSummary").textContent=`${counts.ready} grades ready to fill · Attempt ${$("staffAttempt").value}`;
  hidePreview();
  $("applyGrades").dataset.hasReady=counts.ready>0?"yes":"no";
  $("applyGrades").hidden = !counts.ready || !$("staffReview").checked;
  status("");
}
async function applyGradeFill() {
  if (system !== "staff" || !tab?.id || tab.id !== pendingGradePreview?.tabId) throw Error("The preview is no longer valid.");
  if (!$("staffReview").checked) throw Error("Reconfirm the assessment before populating.");
  const result = await chrome.tabs.sendMessage(tab.id, {action:"applyStaffAdvantageFill",token:pendingGradePreview.token});
  pendingGradePreview = null;
  $("applyGrades").hidden = true;
  if (!result?.success) throw Error(result?.error || "Could not populate grade fields.");
  const counts = result.data;
  $("liveSummary").textContent=`${counts.populated} filled · ${counts.skipped} skipped · ${counts.failed} failed. Check StaffAdvantage.`;
  status("");
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
$("staffFile").addEventListener("change", () => action(inspectGradeFile));
$("gradeSheet").addEventListener("change", renderGradeFile);
$("gradeHeaderRow").addEventListener("change",renderGradeColumns);
for(const id of ["gradeIdColumn","gradeValueColumn","gradeFirstColumn","gradeLastColumn"])$(id).addEventListener("change",refreshGradePreview);
$("stageGrades").addEventListener("click", () => action(stageGradeFile));
$("startMatch").addEventListener("click", () => action(async () => {
  $("matchResults").hidden=true;
  await refreshTab();
  if(system!=="staff")throw Error("Open the StaffAdvantage grade page, then Start Match.");
  const found=await readStaff();
  if(!found)throw Error("No students found in the StaffAdvantage grade table.");
  await previewGradeFill();
}));
$("toLive").addEventListener("click",()=>{if(!pendingGradePreview)return status("Start Match again.",true);$("staffReview").checked=false;$("applyGrades").hidden=true;setGradeStep("live");});
$("backToUpload").addEventListener("click",()=>setGradeStep("upload"));
$("backToMatch").addEventListener("click",()=>setGradeStep("match"));
$("previewGrades").addEventListener("click", () => action(previewGradeFill));
$("staffReview").addEventListener("change", () => {$("applyGrades").hidden=!pendingGradePreview || !$("staffReview").checked || $("applyGrades").dataset.hasReady!=="yes";});
$("staffZeroReview").addEventListener("change", () => {pendingGradePreview=null;$("matchResults").hidden=true;$("applyGrades").hidden=true;status("");});
$("staffAttempt").addEventListener("change", () => {pendingGradePreview=null;$("matchResults").hidden=true;$("applyGrades").hidden=true;status("");});
$("applyGrades").addEventListener("click", () => action(applyGradeFill));
$("downloadCsv").addEventListener("click", downloadCsv);
$("clearData").addEventListener("click", () => action(async () => {
  await chrome.storage.session.remove(["gradezyMoodleRecords", "gradezyStaffSnapshot", "gradezyGradeData"]);
  gradeWorkbook=null;$("staffFile").value="";$("gradeImportOptions").hidden=true;$("stageGrades").disabled=true;
  if(gradezySelectedWorkflow==="staff")setGradeStep("upload");
  hidePreview(); await refreshSummary(); status("All saved assessment session data cleared.");
}));
chrome.tabs.onActivated.addListener(() => { refreshTab().catch(e => status(e.message, true)); });
chrome.tabs.onUpdated.addListener((_id, change, updated) => {
  if (updated.active && (change.url || change.status === "complete")) refreshTab().catch(e => status(e.message, true));
});
refreshTab().catch(e => status(e.message, true));

/* User-selected workflow navigation. Site detection still controls access to live pages. */
function gradezyShowWorkflow(which, preserveStep = false) {
  gradezySelectedWorkflow = which;
  document.body.classList.toggle("grade-flow",which==="staff");
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
  if(which==="staff")setGradeStep(preserveStep?gradeFlowStep:"upload");
  else $("gradeFlowSteps").hidden=true;
  if(!preserveStep)status("");
}
for (const [id, systemName] of [["chooseMoodle","moodle"],["chooseStaff","staff"],["chooseTracker","tracker"]]) {
  $(id)?.addEventListener("click", () => gradezyShowWorkflow(systemName));
}
