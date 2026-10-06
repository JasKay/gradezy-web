const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(relative);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = module.paths;
  cache.set(filename, m.exports);
  const original = m.require.bind(m);
  m.require = (id) =>
    id.startsWith(".") &&
    fs.existsSync(path.resolve(path.dirname(filename), `${id}.ts`))
      ? load(path.resolve(path.dirname(filename), `${id}.ts`))
      : original(id);
  m._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
  cache.set(filename, m.exports);
  return m.exports;
}
const f = load("lib/workflow.ts");
const t = load("lib/tracker-sheets.ts");
function fixture() {
  let w = f.emptyWorkflow();
  w = f.importEnrolments(w, [
    {
      ncgId: "00123",
      firstName: "Test",
      lastName: "Student",
      cohort: "Cohort 1",
      subject: "Computer Science",
    },
  ]);
  const a = {
    id: "A1",
    name: "Portfolio",
    module: "COM101",
    cohortId: "cohort-1",
    subject: "Computer Science",
    issueDate: "2026-09-10",
    offsets: f.defaultOffsets(),
    createdAt: "2026-09-10",
    records: [f.emptyProgress(w.students[0].id)],
  };
  w.assessments.push(a);
  return w;
}
const selection = {
  cohortId: "cohort-1",
  subject: "Computer Science",
  assessmentId: "A1",
  fileName: "sample.xlsx",
  sheetName: "Tracker",
  system: "SharePoint export",
};
test("sample workspace contains 54 labelled students, 18 assessments and 6 accurate cohort dates", () => {
  const w = t.populateSamples(f.emptyWorkflow());
  assert.equal(w.students.length, 54);
  assert.equal(w.assessments.length, 18);
  assert.ok(w.students.every((s) => s.sample && s.ncgId.startsWith("DEMO-")));
  assert.equal(w.cohorts[5].startMonth, "2026-02");
  assert.equal(t.populateSamples(w).students.length, 54);
});
test("sample removal preserves real student records", () => {
  const real = fixture();
  const mixed = t.populateSamples(real);
  const next = t.removeSamples(mixed);
  assert.equal(next.students.length, 1);
  assert.equal(next.assessments.length, 1);
  assert.equal(next.students[0].ncgId, "00123");
});
test("C1 shorthand and full cohort labels match the same cohort", () => {
  const w = f.emptyWorkflow();
  assert.equal(t.cohortFor(w, "C1").id, "cohort-1");
  assert.equal(t.cohortFor(w, "Cohort 6").id, "cohort-6");
});
test("programme aliases correctly map Computing, Business and care", () => {
  assert.equal(t.subjectFor("FdSc Computing"), "Computer Science");
  assert.equal(
    t.subjectFor("Certificate of Higher Education Computing"),
    "Computer Science",
  );
  assert.equal(t.subjectFor("Business Management"), "Business Management");
  assert.equal(
    t.subjectFor("Health and Social Care"),
    "Health and Social Care",
  );
});
test("learning comments with duplicate headers keep Week 4 and Week 8 values", () => {
  const headers = t.LEARNING_COLUMNS.map(([, label]) => label);
  const values = [
    "Task A",
    "Excellent",
    "Week 4 lecturer",
    "Week 4 retention",
    "Task B",
    "Good",
    "Week 8 lecturer",
    "Week 8 retention",
  ];
  const parsed = t.readFields(headers, values, t.LEARNING_COLUMNS);
  assert.equal(parsed.lecturerComment1, "Week 4 lecturer");
  assert.equal(parsed.lecturerComment2, "Week 8 lecturer");
  assert.equal(parsed.retentionComment2, "Week 8 retention");
});
test("duplicate marking headers are split at the resubmission paper ID", () => {
  const headers = [
    ...t.ATTEMPT_COLUMNS.map(([, label]) => label),
    ...t.RESUB_COLUMNS.map(([, label]) => label),
  ];
  const first = t.ATTEMPT_COLUMNS.map(
    ([key]) =>
      ({
        paperId: "P1",
        grade: "63",
        marker: "First Marker",
        imGrade: "63",
        finalGrade: "63",
      })[key] || "",
  );
  const resub = t.RESUB_COLUMNS.map(
    ([key]) =>
      ({
        paperId: "P2",
        grade: "72",
        marker: "Resub Marker",
        imGrade: "72",
        finalGrade: "72",
      })[key] || "",
  );
  const parsed = t.attemptValues(headers, [...first, ...resub]);
  assert.equal(parsed.first.grade, "63");
  assert.equal(parsed.resubmission.grade, "72");
  assert.equal(parsed.resubmission.marker, "Resub Marker");
  assert.equal(parsed.resubmission.finalGrade, "72");
});
test("IM Garde misspelling is recognised without losing IM Grade", () => {
  assert.equal(
    t.readFields(["IM Garde"], ["63"], t.ATTEMPT_COLUMNS).imGrade,
    "63",
  );
});
test("header detection skips a workbook title row", () => {
  const p = t.parseSpreadsheet(
    [
      ["Cohort 1 Progress Tracker"],
      ["NCG ID", "First Name"],
      ["00123", "Test"],
    ],
    "learning",
  );
  assert.equal(p.rows[0][0], "00123");
});
test("marking imports retain all attempts and provenance but do not approve results", () => {
  const w = fixture();
  const headers = [
    "NCG ID",
    "First Name",
    "Last Name",
    "Campus",
    ...t.ATTEMPT_COLUMNS.map(([, label]) => label),
    ...t.RESUB_COLUMNS.map(([, label]) => label),
  ];
  const row = [
    "00123",
    "Test",
    "Student",
    "Leeds",
    ...t.ATTEMPT_COLUMNS.map(
      ([key]) =>
        ({
          paperId: "P1",
          grade: "63",
          marker: "Test Marker",
          finalGrade: "63",
        })[key] || "",
    ),
    ...t.RESUB_COLUMNS.map(
      ([key]) =>
        ({
          paperId: "P2",
          grade: "72",
          marker: "Other Marker",
          finalGrade: "72",
        })[key] || "",
    ),
  ];
  const next = t.applySpreadsheet(w, "marking", headers, [row], selection);
  const r = next.assessments[0].records[0];
  assert.equal(r.grade, "63");
  assert.equal(r.attempts.resubmission.finalGrade, "72");
  assert.equal(r.reviewedAt, undefined);
  assert.equal(r.submission, "awaiting");
  assert.equal(next.students[0].profile.campus, "Leeds");
  assert.equal(next.imports[0].system, "SharePoint export");
  assert.equal(w.assessments[0].records[0].grade, "");
});
test("choosing a resubmission updates the active result and reopens review", () => {
  const w = fixture();
  w.markers.push({ id: "m", name: "Marker" });
  w.assessments[0].records[0].attempts = {
    first: { grade: "60", marker: "Marker" },
    resubmission: { finalGrade: "72", marker: "Marker" },
  };
  const next = t.activateAttempt(w, "A1", w.students[0].id, "resubmission");
  assert.equal(next.assessments[0].records[0].grade, "72");
  assert.equal(next.assessments[0].records[0].activeAttempt, "resubmission");
  assert.equal(next.assessments[0].records[0].reviewedAt, undefined);
});
test("assessment import preserves operational fields and never guesses the timeline", () => {
  const w = fixture();
  const headers = [
    "Cohort",
    "Module Code",
    "Assessment",
    "Programme",
    "Submission Date",
    "SAM Form A Y/N",
    "NCG Staff Advantage Leeds",
  ];
  const next = t.applySpreadsheet(
    w,
    "assessments",
    headers,
    [["C1", "COM102", "Report", "FdSc Computing", "2026-09-10", "Y", "Done"]],
    selection,
  );
  const a = next.assessments.find((a) => a.module === "COM102");
  assert.equal(a.operations.samA, "Y");
  assert.equal(a.operations.uploadLeeds, "Done");
  assert.equal(a.issueDate, "");
  assert.equal(a.records[0].reviewedAt, undefined);
});
test("learning imports change learning checkpoints without affecting marking grades", () => {
  const w = fixture();
  const headers = [
    "NCG ID",
    "First Name",
    "Last Name",
    ...t.LEARNING_COLUMNS.map(([, label]) => label),
  ];
  const row = [
    "00123",
    "Test",
    "Student",
    "Task A",
    "Excellent",
    "Lecturer 4",
    "Retention 4",
    "Task B",
    "Good",
    "Lecturer 8",
    "Retention 8",
  ];
  const next = t.applySpreadsheet(w, "learning", headers, [row], selection);
  assert.equal(next.learningProgress[0].values.lecturerComment2, "Lecturer 8");
  assert.equal(next.assessments[0].records[0].grade, "");
});
test("invalid marking rows abort the entire import", () => {
  const w = fixture();
  assert.throws(
    () =>
      t.applySpreadsheet(
        w,
        "marking",
        ["NCG ID", "First Name", "Last Name", "Grade"],
        [["00123", "Test", "Student", "120"]],
        selection,
      ),
    /0 to 100/,
  );
  assert.equal(w.assessments[0].records[0].grade, "");
});
