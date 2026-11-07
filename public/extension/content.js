/* Gradezy StaffAdvantage content script. */
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function normaliseId(value) { return clean(value).replace(/\s+/g, ""); }
function cellValue(cell) {
  if (!cell) return "";
  const field = cell.querySelector("input, select, textarea");
  return clean(field ? field.value : cell.innerText || cell.textContent);
}
function cellDetails(cell) {
  if (!cell) return "";
  // Preserve line boundaries: StaffAdvantage often puts the name and NCG ID
  // on separate lines inside the same Student Details cell.
  return cell.innerText || cell.textContent || "";
}
function headerKey(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " "); }
function gradezyRowCells(row) {
  return [...row.querySelectorAll(":scope > th, :scope > td")];
}
function gradezyHeaderRow(table) {
  // UNITe/StaffAdvantage sometimes renders the blue header using TDs in TBODY,
  // without a THEAD. Find it by the two visible column names.
  return [...table.querySelectorAll("tr")].slice(0,12).find(row => {
    const labels=gradezyRowCells(row).map(cell=>headerKey(cell.innerText||cell.textContent));
    return labels.some(label=>label.includes("student")&&label.includes("detail")) &&
      labels.some(label=>label.includes("percentage")||label.includes("percent"));
  }) || null;
}
function gradezyInferColumns(table) {
  // Headerless grid fallback: the NCG ID is printed below the name in one cell,
  // and an editable numeric Percentage input sits farther right in the same row.
  for (const row of [...table.querySelectorAll("tr")].slice(0,500)) {
    const cells=gradezyRowCells(row);
    const details=cells.findIndex(cell=>/\b\d{6,12}\b/.test(cellDetails(cell)));
    if(details<0)continue;
    const grade=cells.findIndex((cell,index)=>index>details && Boolean(cell.querySelector("input[type='number'],input[type='text'],input:not([type])")));
    if(grade>=0)return {details,grade};
  }
  return null;
}
function findStaffAdvantageTable() {
  const tables=[...document.querySelectorAll("table")];
  // On some UNITe screens the blue header and data rows are in different tables.
  // Prefer the table with the most NCG-ID-plus-editable-grade rows, rather
  // than a decorative/header-only table that happens to contain both labels.
  let best=null,score=0;
  for(const table of tables){
    const map=gradezyInferColumns(table);
    if(!map)continue;
    const count=[...table.querySelectorAll("tr")].filter(row=>{
      const cells=gradezyRowCells(row);
      return /\b\d{6,12}\b/.test(cellDetails(cells[map.details])) &&
        Boolean(cells[map.grade]?.querySelector("input[type='number'],input[type='text'],input:not([type])"));
    }).length;
    if(count>score){best=table;score=count;}
  }
  return best||tables.find(gradezyHeaderRow)||null;
}
function columnMap(table) {
  const map = {};
  const headerRow=gradezyHeaderRow(table);
  if(!headerRow)return gradezyInferColumns(table)||map;
  let index=0;
  for (const header of headerRow ? gradezyRowCells(headerRow) : []) {
    const label = headerKey(header.innerText || header.textContent);
    if (label.includes("student") || label.includes("details")) map.details = index;
    if (label.includes("percentage") || label.includes("percent")) map.grade = index;
    if (label.includes("true zero")) map.trueZero = index;
    if (label === "late" || label.includes(" late")) map.late = index;
    if (label.includes("dns")) map.dns = index;
    if (label.includes("aap")) map.aap = index;
    if (label.includes("mit")) map.mit = index;
    if (label.includes("rpl")) map.rpl = index;
    index += Math.max(1,Number(header.colSpan)||1);
  }
  return map;
}
function gradezyStudentRows(table) {
  const header=gradezyHeaderRow(table);
  const columns=columnMap(table);
  return [...table.querySelectorAll("tr")].filter(row=>{
    if(row===header)return false;
    const cells=gradezyRowCells(row);
    return columns.details!==undefined && columns.grade!==undefined &&
      cells.length>Math.max(columns.details,columns.grade) &&
      /\b\d{6,12}\b/.test(cellDetails(cells[columns.details]));
  });
}
function gradezyVisualEntries() {
  // Visual WebGUI renders each student ID as an independent label (SPAN) and
  // their Percentage as a separate input. They need not share a TABLE/TR.
  const spans=[...document.querySelectorAll("span")].filter(el=>/^\d{6,12}$/.test(clean(el.textContent)));
  const inputs=[...document.querySelectorAll("input[type='text'],input[type='number']")].filter(el=>
    /^(?:\d{1,3}(?:\.\d{1,2})?)?$/.test(String(el.value||"").trim()) &&
    el.id!=="VWG_LabelEditorInput" && !el.disabled);
  const used=new Set(), entries=[];
  for(const span of spans){
    const idRect=span.getBoundingClientRect();
    if(!idRect.width||!idRect.height)continue;
    const candidates=inputs.map(input=>{
      const box=input.getBoundingClientRect();
      // ID is underneath the name; the percentage box is above/right of ID.
      const vertical=(box.top+box.bottom)/2-(idRect.top+idRect.bottom)/2;
      const horizontal=box.left-idRect.right;
      return {input,box,vertical,horizontal,distance:Math.abs(vertical)*3+horizontal*.12};
    }).filter(c=>c.box.width>20 && c.box.height>8 && c.horizontal>15 &&
      c.horizontal<900 && c.vertical>-90 && c.vertical<18).sort((a,b)=>a.distance-b.distance);
    if(!candidates.length)continue;
    const candidate=candidates[0];
    // Equally plausible neighbouring inputs are unsafe to assign automatically.
    if(candidates[1] && Math.abs(candidates[1].distance-candidate.distance)<8)continue;
    if(used.has(candidate.input))continue;
    used.add(candidate.input);
    const ncgId=clean(span.textContent);
    const nearby=[...document.querySelectorAll("span")].filter(el=>{
      if(el===span||!clean(el.textContent)||/\d{6,12}/.test(el.textContent))return false;
      const b=el.getBoundingClientRect();
      return b.width>0 && Math.abs(b.left-idRect.left)<45 && b.bottom<=idRect.top+8 && b.bottom>=idRect.top-70;
    }).sort((a,b)=>b.getBoundingClientRect().bottom-a.getBoundingClientRect().bottom);
    const name=clean(nearby[0]?.textContent||"");
    const student=parseStudentDetails(name?`${name}\n${ncgId}`:ncgId,{getAttribute:()=>null,dataset:{}});
    entries.push({student,input:candidate.input,grade:candidate.input.value,row:null});
  }
  return entries;
}
function gradezyGridEntries(){
  const visual=gradezyVisualEntries();
  const table=findStaffAdvantageTable();
  if(table){
    const columns=columnMap(table);
    if(columns.details!==undefined && columns.grade!==undefined){
      const rows=gradezyStudentRows(table).map(row=>{
        const cells=gradezyRowCells(row);
        return {student:parseStudentDetails(cellDetails(cells[columns.details]),row),
          input:cells[columns.grade]?.querySelector("input[type='number'],input[type='text'],input:not([type]),textarea"),
          grade:cellValue(cells[columns.grade]),row};
      });
      if(rows.length>=visual.length && rows.some(entry=>entry.input))return rows;
    }
  }
  return visual;
}
function parseStudentDetails(value, row) {
  const text = clean(value);
  const lines = String(value ?? "").split(/\n+/).map(clean).filter(Boolean);
  const labelledId = text.match(/(?:ncg\s*(?:id|number)?|student\s*id)\s*[:#-]?\s*([a-z0-9-]{4,})/i);
  const numericId = lines.find((line) => /^\d{4,}$/.test(line));
  const inlineId = text.match(/\b\d{6,12}\b/);
  const ncgId = normaliseId(labelledId?.[1] || numericId || inlineId?.[0] || row.getAttribute("data-student-id") || row.dataset.studentId);
  const nameLine = lines.find((line) => line !== numericId && !/^(?:ncg\s*)?(?:id|number)\b/i.test(line) && !/^\d{6,12}$/.test(line)) || "";
  const commaName = nameLine.split(",").map(clean);
  const stripIds = part => part.replace(/\b(?:ncg\s*)?(?:id|number)\b.*$/i, "").replace(/\b\d{6,12}\b/g, "").trim();
  // StaffAdvantage renders "Adams, Chanelle..." then the NCG ID beneath it.
  if (commaName.length >= 2) return {ncgId, firstName:stripIds(commaName.slice(1).join(" ")),lastName:stripIds(commaName[0])};
  const nameParts=stripIds(nameLine).split(/\s+/).filter(Boolean);
  return {ncgId,firstName:nameParts.shift()||"",lastName:nameParts.join(" ")};
}
function isChecked(cells, index) {
  const cell = cells[index];
  if (!cell) return false;
  const control = cell.querySelector("input[type=checkbox]");
  return Boolean(control?.checked || /^(?:yes|true|y|1)$/i.test(cellValue(cell)));
}
function extractStaffAdvantageStudents() {
  const seen = new Set();
  return gradezyGridEntries().map(({student,grade}) => {
    const key = `${student.ncgId}|${student.firstName}|${student.lastName}`.toLowerCase();
    if ((!student.ncgId && !student.firstName && !student.lastName) || seen.has(key)) return null;
    seen.add(key);
    return {
      ...student, grade, source: "StaffAdvantage", flags: {},
    };
  }).filter(Boolean);
}
function getPageInfo() {
  const students = extractStaffAdvantageStudents();
  return { url: location.href, title: document.title, hostname: location.hostname, source: "StaffAdvantage", studentCount: students.length };
}
function gradezyScanDiagnostics() {
  const tables = [...document.querySelectorAll("table")];
  const table = findStaffAdvantageTable();
  return {
    tableCount: tables.length,
    matchedTable: Boolean(table),
    matchedRows: table?gradezyStudentRows(table).length:0,
    visualRows: gradezyVisualEntries().length,
    // Header labels only. Never expose student names/IDs in diagnostics.
    headers: tables.slice(0, 8).map(t => gradezyRowCells(gradezyHeaderRow(t)||t.querySelector("tr")||t)
      .slice(0, 15).map(h => clean(h.innerText || h.textContent))),
    frameCount: document.querySelectorAll("iframe").length,
    urlPath: location.pathname,
  };
}
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "diagnoseStaffAdvantageScan") {
    sendResponse({ success: true, data: gradezyScanDiagnostics() }); return;
  }
  if (request.action === "readStaffAdvantageStudents" || request.action === "extractStudents") {
    const students = extractStaffAdvantageStudents();
    sendResponse({ success: true, data: { students, count: students.length } }); return;
  }
  if (request.action === "extractGrades") {
    const grades = extractStaffAdvantageStudents().map((student) => ({ name: clean(`${student.firstName} ${student.lastName}`), grade: Number.parseFloat(student.grade), source: "StaffAdvantage" })).filter((student) => Number.isFinite(student.grade));
    sendResponse({ success: true, data: grades }); return;
  }
  if (request.action === "getStaffAdvantagePageInfo" || request.action === "getPageInfo") sendResponse({ success: true, data: getPageInfo() });
});


/* Reviewed grade-entry adapter. Exact NCG ID only, never clicks Save or Submit. */
let gradezyPendingFill = null;
let gradezyLastFill = null;
function gradezyGrade(value) {
  const raw = String(value ?? "").trim().replace(/%$/, "");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number.toFixed(2) : null;
}
function gradezyName(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]/g, ""); }
function gradezyNameMatches(excelName, staffName) {
  if (!excelName) return true;
  // If VWG exposes only the NCG ID label, exact ID still establishes identity.
  if (!staffName) return true;
  const expected=gradezyName(excelName), displayed=gradezyName(staffName);
  if (!expected || !displayed) return false;
  // A visibly truncated label is acceptable only as a prefix after exact NCG ID match.
  return /\.{2,}|…/.test(staffName) ? displayed.length>=3 && expected.startsWith(displayed) : expected===displayed;
}
function gradezyBuildFillPlan(records, allowDefaultZero=false) {
  const entries=gradezyGridEntries();
  if(!entries.length)throw Error("StaffAdvantage student rows not detected.");
  const targetRows = new Map();
  for (const [index, entry] of entries.entries()) {
    const id=entry.student.ncgId;
    if (!id) continue;
    const existing = targetRows.get(id) || [];
    existing.push({ index, row:entry.row, input:entry.input, student:entry.student });
    targetRows.set(id, existing);
  }
  const sourceCounts = new Map();
  for (const rec of records) {
    const id = normaliseId(rec.ncgId);
    sourceCounts.set(id, (sourceCounts.get(id) || 0) + 1);
  }
  const outcome = { ready: 0, readyZero: 0, zeroReview: 0, identical: 0, conflict: 0, missing: 0, duplicate: 0, invalid: 0, readonly: 0, nameMismatch: 0 };
  const approved = [];
  const exceptions = [];
  const details=[];
  for (const rec of records) {
    const id = normaliseId(rec.ncgId), grade = gradezyGrade(rec.grade);
    const matches = targetRows.get(id) || [];
    let reason = "";
    if (!id || grade === null) reason = "invalid";
    else if (sourceCounts.get(id) !== 1 || matches.length > 1) reason = "duplicate";
    else if (!matches.length) reason = "missing";
    else if (!gradezyNameMatches(rec.firstName,matches[0].student.firstName) ||
             !gradezyNameMatches(rec.lastName,matches[0].student.lastName)) reason="nameMismatch";
    else {
      const match = matches[0], input=match.input;
      if (!input || input.disabled || input.readOnly) reason = "readonly";
      else {
        const existing = String(input.value ?? "").trim();
        if (existing && gradezyGrade(existing) === grade) reason="identical";
        else if (existing && gradezyGrade(existing)==="0.00") {
          if (allowDefaultZero) { approved.push({id,grade,row:match.row,input,prior:"0.00"});outcome.readyZero++; }
          else reason="zeroReview";
        } else if (existing) reason="conflict";
        else approved.push({ id, grade, row: match.row, input, prior:"" });
      }
    }
    if (reason) {
      outcome[reason]++;
      if (exceptions.length < 25) exceptions.push("NCG ID " + id + ": " + reason);
    }
    const labels={ready:"Ready",zeroReview:"ID matched · 0.00 needs approval",identical:"Already entered",conflict:"Existing grade differs",missing:"NCG ID not on this page",duplicate:"Duplicate NCG ID",invalid:"Invalid grade or NCG ID",readonly:"Field unavailable",nameMismatch:"ID matched · name differs"};
    details.push({ncgId:id,firstName:clean(rec.firstName),lastName:clean(rec.lastName),grade:clean(rec.grade),status:labels[reason||"ready"],staffName:matches.length===1?clean(`${matches[0].student.firstName} ${matches[0].student.lastName}`):""});
  }
  outcome.ready = approved.length;
  return { outcome, approved, exceptions, details, page: location.href, title: document.title };
}
function gradezyPreviewFill(records,allowDefaultZero=false) {
  if (!Array.isArray(records) || !records.length || records.length > 1000) throw Error("Provide 1–1000 grade records.");
  const plan = gradezyBuildFillPlan(records,allowDefaultZero);
  const token = crypto.randomUUID();
  gradezyPendingFill = { token, allowDefaultZero, source: records.map(r => ({ ncgId: normaliseId(r.ncgId), grade: gradezyGrade(r.grade),firstName:clean(r.firstName),lastName:clean(r.lastName) })), timestamp: Date.now(), page: plan.page, title: plan.title };
  return { token, summary: plan.outcome, exceptions: plan.exceptions, details:plan.details, count: records.length };
}
function gradezyApplyFill(token) {
  if (!gradezyPendingFill || gradezyPendingFill.token !== token) throw Error("Preview is missing or out of date. Preview again.");
  if (Date.now() - gradezyPendingFill.timestamp > 5 * 60 * 1000 || location.href !== gradezyPendingFill.page || document.title !== gradezyPendingFill.title) throw Error("Page or preview changed. Preview again.");
  const records = gradezyPendingFill.source;
  const allowDefaultZero=gradezyPendingFill.allowDefaultZero;
  gradezyPendingFill = null; // one-time authorisation
  const updatedPlan = gradezyBuildFillPlan(records,allowDefaultZero);
  const results = { populated: 0, skipped: records.length - updatedPlan.approved.length, failed: 0 };
  const applied=[];
  for (const rec of updatedPlan.approved) {
    try {
      const current=String(rec.input.value??"").trim();
      if (!rec.input.isConnected || (rec.prior==="0.00" ? gradezyGrade(current)!=="0.00" : Boolean(current))) { results.skipped++; continue; }
      const setter = Object.getOwnPropertyDescriptor(rec.input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(rec.input, rec.grade);
      else rec.input.value = rec.grade;
      rec.input.dispatchEvent(new Event("input", { bubbles: true }));
      rec.input.dispatchEvent(new Event("change", { bubbles: true }));
      if (gradezyGrade(rec.input.value) === rec.grade) {
        results.populated++;
        applied.push({input:rec.input,before:current,after:rec.grade});
      }
      else results.failed++;
    } catch { results.failed++; }
  }
  gradezyLastFill=applied.length?{page:location.href,items:applied}:null;
  return results;
}
function gradezyUndoLastFill(){
  if(!gradezyLastFill || gradezyLastFill.page!==location.href)throw Error("No fill from this page is available to undo.");
  const {items}=gradezyLastFill;gradezyLastFill=null;
  const result={restored:0,skipped:0};
  for(const {input,before,after} of items){
    if(!input.isConnected || gradezyGrade(input.value)!==after){result.skipped++;continue;}
    try{
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
      if(setter)setter.call(input,before);else input.value=before;
      input.dispatchEvent(new Event("input",{bubbles:true}));
      input.dispatchEvent(new Event("change",{bubbles:true}));
      if(String(input.value)===before)result.restored++;else result.skipped++;
    }catch{result.skipped++;}
  }
  return result;
}
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!["previewStaffAdvantageFill","applyStaffAdvantageFill","undoStaffAdvantageFill"].includes(request.action)) return;
  try {
    const data = request.action === "previewStaffAdvantageFill"
      ? gradezyPreviewFill(request.records,Boolean(request.allowDefaultZero))
      : request.action === "applyStaffAdvantageFill" ? gradezyApplyFill(request.token) : gradezyUndoLastFill();
    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({ success: false, error: String(error?.message || error) });
  }
});
