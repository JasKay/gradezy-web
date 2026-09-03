/* Gradezy StaffAdvantage content script. */
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function normaliseId(value) { return clean(value).replace(/\s+/g, ""); }
function cellValue(cell) {
  if (!cell) return "";
  const field = cell.querySelector("input, select, textarea");
  return clean(field ? field.value : cell.innerText || cell.textContent);
}
function headerKey(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " "); }
function findStaffAdvantageTable() {
  return [...document.querySelectorAll("table")].find((table) => {
    const headings = headerKey(table.querySelector("thead")?.innerText || "");
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
  const ncgId = normaliseId(labelledId?.[1] || numericId || row.getAttribute("data-student-id") || row.dataset.studentId);
  const nameLine = lines.find((line) => line !== numericId && !/^(?:ncg\s*)?(?:id|number)\b/i.test(line)) || "";
  const commaName = nameLine.split(",").map(clean);
  const nameParts = (commaName.length >= 2 ? `${commaName.slice(1).join(" ")} ${commaName[0]}` : nameLine)
    .replace(/\b(?:ncg\s*)?(?:id|number)\b.*$/i, "").split(" ").filter(Boolean);
  return { ncgId, firstName: nameParts.shift() || "", lastName: nameParts.join(" ") };
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
    const student = parseStudentDetails(cellValue(cells[columns.details]), row);
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
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
