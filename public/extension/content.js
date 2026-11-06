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
function findStaffAdvantageTable() {
  return [...document.querySelectorAll("table")].find((table) => {
    const headings = headerKey(table.querySelector("thead")?.innerText || table.querySelector("thead")?.textContent ||
      [...table.querySelectorAll("tr")].slice(0, 2).map(row => row.textContent).join(" "));
    return headings.includes("attempt") && headings.includes("percentage") && (headings.includes("student") || headings.includes("details"));
  }) || null;
}
function columnMap(table) {
  const map = {};
  [...table.querySelectorAll("thead th, thead td")].forEach((header, index) => {
    const label = headerKey(header.innerText || header.textContent);
    if (label.includes("student") || label.includes("details")) map.details = index;
    if (label.includes("attempt")) map.attempt = index;
    if (label.includes("percentage") || label.includes("percent")) map.grade = index;
    if (label.includes("true zero")) map.trueZero = index;
    if (label === "late" || label.includes(" late")) map.late = index;
    if (label.includes("dns")) map.dns = index;
    if (label.includes("aap")) map.aap = index;
    if (label.includes("mit")) map.mit = index;
    if (label.includes("rpl")) map.rpl = index;
  });
  return map;
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
  const table = findStaffAdvantageTable();
  if (!table) return [];
  const columns = columnMap(table);
  if (columns.details === undefined || columns.grade === undefined) return [];
  const seen = new Set();
  return [...table.querySelectorAll("tbody tr")].map((row) => {
    const cells = [...row.querySelectorAll(":scope > td")];
    if (cells.length <= Math.max(columns.details, columns.grade)) return null;
    const student = parseStudentDetails(cellDetails(cells[columns.details]), row);
    const key = `${student.ncgId}|${student.firstName}|${student.lastName}|${cellValue(cells[columns.attempt])}`.toLowerCase();
    if ((!student.ncgId && !student.firstName && !student.lastName) || seen.has(key)) return null;
    seen.add(key);
    return {
      ...student, grade: cellValue(cells[columns.grade]), source: "StaffAdvantage",
      attemptNumber: cellValue(cells[columns.attempt]),
      flags: {
        trueZero: isChecked(cells, columns.trueZero), late: isChecked(cells, columns.late),
        dns: isChecked(cells, columns.dns), aap: isChecked(cells, columns.aap),
        mit: isChecked(cells, columns.mit), rpl: isChecked(cells, columns.rpl),
      },
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
    matchedRows: table?.querySelectorAll("tbody tr").length || 0,
    // Header labels only. Never expose student names/IDs in diagnostics.
    headers: tables.slice(0, 8).map(t => [...t.querySelectorAll("thead th, thead td")]
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
function gradezyGrade(value) {
  const raw = String(value ?? "").trim().replace(/%$/, "");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw)) return null;
  const number = Number(raw);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number.toFixed(2) : null;
}
function gradezyName(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]/g, ""); }
function gradezyNameMatches(excelName, staffName) {
  if (!excelName) return true;
  const expected=gradezyName(excelName), displayed=gradezyName(staffName);
  if (!expected || !displayed) return false;
  // A visibly truncated label is acceptable only as a prefix after exact NCG ID match.
  return /\.{2,}|…/.test(staffName) ? displayed.length>=3 && expected.startsWith(displayed) : expected===displayed;
}
function gradezyBuildFillPlan(records, allowDefaultZero=false) {
  const table = findStaffAdvantageTable();
  if (!table) throw Error("StaffAdvantage assessment table is not visible.");
  const columns = columnMap(table);
  if (columns.details === undefined || columns.grade === undefined) throw Error("Could not identify student and percentage columns.");
  const targetRows = new Map();
  for (const [index, row] of [...table.querySelectorAll("tbody tr")].entries()) {
    const cells = [...row.querySelectorAll(":scope > td")];
    const id = parseStudentDetails(cellDetails(cells[columns.details]), row).ncgId;
    if (!id) continue;
    const existing = targetRows.get(id) || [];
    existing.push({ index, row, cells, student:parseStudentDetails(cellDetails(cells[columns.details]),row) });
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
      const match = matches[0], cell = match.cells[columns.grade];
      const input = cell?.querySelector("input[type='number'],input[type='text'],input:not([type]),textarea");
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
    details.push({ncgId:id,firstName:clean(rec.firstName),lastName:clean(rec.lastName),grade:clean(rec.grade),status:reason||"ready",staffName:matches.length===1?clean(`${matches[0].student.firstName} ${matches[0].student.lastName}`):""});
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
  for (const rec of updatedPlan.approved) {
    try {
      const current=String(rec.input.value??"").trim();
      if (!rec.input.isConnected || (rec.prior==="0.00" ? gradezyGrade(current)!=="0.00" : Boolean(current))) { results.skipped++; continue; }
      const setter = Object.getOwnPropertyDescriptor(rec.input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(rec.input, rec.grade);
      else rec.input.value = rec.grade;
      rec.input.dispatchEvent(new Event("input", { bubbles: true }));
      rec.input.dispatchEvent(new Event("change", { bubbles: true }));
      if (gradezyGrade(rec.input.value) === rec.grade) results.populated++;
      else results.failed++;
    } catch { results.failed++; }
  }
  return results;
}
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "previewStaffAdvantageFill" && request.action !== "applyStaffAdvantageFill") return;
  try {
    const data = request.action === "previewStaffAdvantageFill"
      ? gradezyPreviewFill(request.records,Boolean(request.allowDefaultZero))
      : gradezyApplyFill(request.token);
    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({ success: false, error: String(error?.message || error) });
  }
});
