const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
// Load pure domain modules without a bundler or extra test dependency.
function load(relative) {
  const filename = path.resolve(relative);
  const source = fs.readFileSync(filename, "utf8");
  const out = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = module.paths;
  m._compile(out.outputText, filename);
  return m.exports;
}
const f = load("lib/workflow.ts");
const reconciliation = load("lib/reconciliation.ts");
function fixture() {
  let w = f.emptyWorkflow();
  w = f.importEnrolments(w, [
    {
      ncgId: "NCG001",
      firstName: "Test",
      lastName: "Student",
      cohort: "Cohort 1",
      subject: "Business Management",
    },
  ]);
  w.markers.push({ id: "marker-1", name: "Test Marker" });
  const a = f.syncRoster(
    {
      id: "assessment-1",
      name: "Test assessment",
      module: "BUS-A1",
      cohortId: "cohort-1",
      subject: "Business Management",
      issueDate: "2026-09-10",
      offsets: f.defaultOffsets(),
      records: [],
      createdAt: "2026-09-10T12:00:00Z",
    },
    w,
  );
  w.assessments.push(a);
  return { w, a };
}
function reviewed() {
  const { w, a } = fixture();
  a.records[0] = f.updateProgress(
    a.records[0],
    { markerId: "marker-1", submission: "submitted", grade: "0" },
    w,
    "2026-09-20T12:00:00Z",
  );
  a.records[0] = f.updateProgress(
    a.records[0],
    { reviewer: "Test Reviewer", reviewedAt: "2026-10-01T12:00:00Z" },
    w,
  );
  return { w, a };
}
test("six cohorts with only known dates seeded", () => {
  const w = f.emptyWorkflow();
  assert.equal(w.cohorts.length, 6);
  assert.equal(w.cohorts[0].startMonth, "2023-10");
  assert.equal(w.cohorts[1].startMonth, "2024-02");
  assert.equal(w.cohorts[2].startMonth, "");
});
test("calendar-day timelines cross month and year boundaries", () => {
  assert.equal(f.targetDate("2026-09-10", 3), "2026-09-13");
  assert.equal(f.targetDate("2026-09-10", 21), "2026-10-01");
  assert.equal(f.targetDate("2026-09-10", 30), "2026-10-10");
  assert.equal(f.targetDate("2024-02-28", 1), "2024-02-29");
  assert.equal(f.targetDate("2026-12-30", 3), "2027-01-02");
});
test("invalid and fractional dates are rejected", () => {
  for (const [date, offset] of [
    ["2026-02-30", 3],
    ["", 3],
    ["2026-09-10", -1],
    ["2026-09-10", 1.5],
  ])
    assert.equal(f.targetDate(date, offset), "");
});
test("multi-subject enrolment retains one student identity", () => {
  const { w } = fixture();
  const next = f.importEnrolments(w, [
    {
      ncgId: " ncg001 ",
      firstName: "Test",
      lastName: "Student",
      cohort: "Cohort 1",
      subject: "Computer Science",
    },
  ]);
  assert.equal(next.students.length, 1);
  assert.equal(next.students[0].enrolments.length, 2);
  assert.equal(w.students[0].enrolments.length, 1);
});
test("conflicting student identity prevents entire import", () => {
  const { w } = fixture();
  assert.throws(
    () =>
      f.importEnrolments(w, [
        {
          ncgId: "NCG002",
          firstName: "Other",
          lastName: "Student",
          cohort: "Cohort 1",
          subject: "Business Management",
        },
        {
          ncgId: "NCG001",
          firstName: "Wrong",
          lastName: "Name",
          cohort: "Cohort 1",
          subject: "Business Management",
        },
      ]),
    /different name/,
  );
  assert.equal(w.students.length, 1);
});
test("rosters include only matching cohort and subject, and sync is idempotent", () => {
  const { w, a } = fixture();
  assert.equal(a.records.length, 1);
  assert.equal(f.syncRoster(a, w).records.length, 1);
  assert.equal(
    f.syncRoster({ ...a, cohortId: "cohort-2", records: [] }, w).records.length,
    0,
  );
});
test("new enrolments add records without replacing existing progress", () => {
  const { w, a } = reviewed();
  const next = f.importEnrolments(w, [
    {
      ncgId: "NCG002",
      firstName: "Second",
      lastName: "Student",
      cohort: "Cohort 1",
      subject: "Business Management",
    },
  ]);
  const synced = f.syncRoster(a, next);
  assert.equal(synced.records.length, 2);
  assert.equal(synced.records[0].reviewer, "Test Reviewer");
});
test("milestones must remain in order", () => {
  const { a } = fixture();
  a.offsets.marking = 2;
  assert.match(f.validateSchedule(a).join(" "), /timeline order/);
});
test("unallocated, unsubmitted and unreviewed records block export", () => {
  const { w, a } = fixture();
  assert.throws(() => f.prepareBatch(a, w), /allocations missing/);
  assert.equal(f.isReviewed(a.records[0], w), false);
});
test("approval requires marker, submitted work, grade and reviewer", () => {
  const { w, a } = fixture();
  assert.throws(
    () =>
      f.updateProgress(
        a.records[0],
        { reviewer: "Test", reviewedAt: "2026-10-01T12:00:00Z" },
        w,
      ),
    /required/,
  );
});
test("zero grade is valid and exports after review", () => {
  const { w, a } = reviewed();
  assert.equal(f.blockers(a, w).length, 0);
  assert.equal(f.prepareBatch(a, w).rows[0].grade, "0");
});
test("changing a reviewed grade invalidates review, release and previous batch", () => {
  const { w, a } = reviewed();
  const batch = f.prepareBatch(a, w);
  assert.equal(f.batchCurrent(batch, w), true);
  a.records[0] = f.updateProgress(
    a.records[0],
    { releasedAt: "2026-10-10T12:00:00Z" },
    w,
  );
  a.records[0] = f.updateProgress(a.records[0], { grade: "70" }, w);
  assert.equal(a.records[0].reviewedAt, undefined);
  assert.equal(a.records[0].releasedAt, undefined);
  assert.equal(f.batchCurrent(batch, w), false);
  assert.equal(batch.rows[0].grade, "0");
});
test("changing marker or submission also invalidates approval", () => {
  for (const patch of [{ markerId: "" }, { submission: "resubmission" }]) {
    const { w, a } = reviewed();
    const result = f.updateProgress(a.records[0], patch, w);
    assert.equal(result.reviewedAt, undefined);
  }
});
test("notes preserve an existing review", () => {
  const { w, a } = reviewed();
  const result = f.updateProgress(
    a.records[0],
    { notes: "Follow-up logged" },
    w,
  );
  assert.equal(result.reviewedAt, a.records[0].reviewedAt);
});
test("release cannot precede approval", () => {
  const { w, a } = fixture();
  assert.throws(
    () =>
      f.updateProgress(
        a.records[0],
        { releasedAt: new Date().toISOString() },
        w,
      ),
    /Review the grade/,
  );
});
test("delays remain visible downstream and late completion is recorded", () => {
  const { w, a } = fixture();
  assert.equal(f.stageProgress(a, w, "marking", "2026-09-21").overdue, true);
  assert.equal(f.stageProgress(a, w, "moderation", "2026-10-02").overdue, true);
  a.records[0] = f.updateProgress(
    a.records[0],
    { markerId: "marker-1", submission: "submitted", grade: "Merit" },
    w,
    "2026-09-22T12:00:00Z",
  );
  assert.equal(
    f.stageProgress(a, w, "marking", "2026-09-23").completedLate,
    true,
  );
  assert.equal(f.stageProgress(a, w, "moderation", "2026-10-02").overdue, true);
});
test("template mapping changes make existing batches stale", () => {
  const { w, a } = reviewed();
  const b = f.prepareBatch(a, w);
  w.mapping.grade = "Percentage";
  assert.equal(f.batchCurrent(b, w), false);
});
test("duplicate column names and student IDs block preparation", () => {
  const { w, a } = reviewed();
  w.mapping.grade = w.mapping.ncgId;
  assert.throws(() => f.prepareBatch(a, w), /unique/);
});
test("CSV quotes special characters and neutralises spreadsheet formulas", () => {
  assert.equal(f.csvCell('a,"b"'), '"a,""b"""');
  assert.equal(f.csvCell(" =SUM(A1)"), '"\' =SUM(A1)"');
  assert.equal(f.csvCell("0"), '"0"');
});
test("grade import preserves leading zero IDs and never approves results", () => {
  const { w, a } = fixture();
  const next = f.importGrades(w, a.id, [
    { ncgId: "NCG001", grade: "Merit", marker: "Test Marker" },
  ]);
  assert.equal(next.assessments[0].records[0].grade, "Merit");
  assert.equal(next.assessments[0].records[0].reviewedAt, undefined);
  assert.equal(next.assessments[0].records[0].submission, "awaiting");
});
test("duplicate and out-of-roster grades abort import", () => {
  const { w, a } = fixture();
  assert.throws(
    () =>
      f.importGrades(w, a.id, [
        { ncgId: "NCG001", grade: "50" },
        { ncgId: "NCG001", grade: "60" },
      ]),
    /duplicate/,
  );
  assert.throws(
    () => f.importGrades(w, a.id, [{ ncgId: "other", grade: "50" }]),
    /outside/,
  );
  assert.equal(a.records[0].grade, "");
});
test("assistant context excludes identities, grades, notes and staff names", () => {
  const { w, a } = reviewed();
  a.records[0].notes = "private note";
  const summary = JSON.stringify(f.assistantContext(w, "2026-10-06"));
  for (const text of [
    "NCG001",
    "Test Student",
    "Test Marker",
    "Test Reviewer",
    "private note",
    "Test assessment",
  ])
    assert.equal(summary.includes(text), false);
  assert.ok(summary.includes("A1"));
});
test("corrupt browser storage is never silently replaced", () => {
  const storage = {
    getItem: () => "{broken",
    setItem: () => assert.fail("must not write"),
  };
  assert.throws(() => f.readWorkflow(storage));
});
test("revision guard rejects stale writes from another tab", () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
  const w = f.emptyWorkflow();
  const next = f.saveWorkflow(w, storage);
  assert.equal(next.revision, 1);
  assert.throws(() => f.saveWorkflow(w, storage), /Another tab/);
});
test("legacy migration preserves source data and requires enrolment confirmation", () => {
  const data = {
    gradezy_assessments: JSON.stringify([
      {
        id: "old",
        name: "Legacy",
        module: "BUS",
        cohort: "Cohort 1",
        createdAt: "2026-01-01",
      },
    ]),
    gradezy_students_old: JSON.stringify([
      { ncgId: "NCG1", firstName: "Legacy", lastName: "Student" },
    ]),
    gradezy_actual_students_old: JSON.stringify([
      { ncgId: "NCG1", grade: "72" },
    ]),
  };
  const before = JSON.stringify(data);
  const w = f.readWorkflow({ getItem: (k) => data[k] || null });
  assert.equal(w.assessments[0].records[0].grade, "72");
  assert.equal(w.assessments[0].subject, "");
  assert.equal(w.students[0].enrolments.length, 0);
  assert.equal(JSON.stringify(data), before);
});
test("duplicate actual matches are not also counted as unexpected", () => {
  const s = {
    ncgId: "N1",
    firstName: "Test",
    lastName: "Student",
    grade: "50",
  };
  const result = reconciliation.reconcileStudents([s], [s, s]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "duplicate");
});
test("grade mismatches are identified separately from identity matches", () => {
  const s = {
    ncgId: "N1",
    firstName: "Test",
    lastName: "Student",
    grade: "50",
  };
  const result = reconciliation.reconcileStudents([s], [{ ...s, grade: "60" }]);
  assert.equal(result[0].status, "grade_mismatch");
  assert.equal(reconciliation.calculateSummary(result).gradeMismatch, 1);
});
test("stable reconciliation record IDs survive row reordering", () => {
  const a = { ncgId: "N1", firstName: "One", lastName: "Student", grade: "" };
  const b = { ...a, ncgId: "N2" };
  const first = reconciliation.reconcileStudents([a, b], [a, b]);
  const second = reconciliation.reconcileStudents([b, a], [a, b]);
  assert.equal(first[0].id, second[1].id);
});
