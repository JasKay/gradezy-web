const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(relative);
  if (cache.has(filename)) return cache.get(filename);
  const m = new Module(filename, module);
  m.filename = filename; m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = id => id.startsWith('.') ? load(path.resolve(path.dirname(filename), id + '.ts')) : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  cache.set(filename, m.exports);
  return m.exports;
}
const f = load('lib/workflow.ts');
const p = load('lib/practice-workspace.ts');
const { searchWorkspace } = load('lib/workspace-assistant.ts');
const date = '2026-10-06';
const fixture = () => p.populatePracticeData(f.emptyWorkflow(), date);

test('practice workbooks have connected, varied records and are idempotent', () => {
  const w = fixture();
  assert.equal(w.students.length, 36); assert.equal(w.assessments.length, 18);
  assert.equal(w.markers.length, 3); assert.equal(w.learningProgress.length, 36);
  assert.equal(w.imports.length, 4);
  assert.deepEqual(p.populatePracticeData(w, date), w);
  assert.ok(w.assessments.some(a => a.records.some(r => r.submission === 'resubmission')));
  assert.ok(w.assessments.some(a => a.records.some(r => r.submission === 'submitted' && !r.grade)));
  assert.ok(w.assessments.some(a => a.records.some(r => f.isReviewed(r, w))));
  for (const a of w.assessments) {
    assert.deepEqual(f.validateSchedule(a), []);
    for (const r of a.records) assert.ok(w.students.find(s => s.id === r.studentId).enrolments.some(e => e.cohortId === a.cohortId && e.subject === a.subject));
  }
});

test('loading and removing practice records preserves user records and avoids ID clashes', () => {
  let w = f.importEnrolments(f.emptyWorkflow(), [{ ncgId: 'NCG260001', firstName: 'Real', lastName: 'Person', cohort: 'Cohort 1', subject: 'Business Management' }]);
  const original = structuredClone(w);
  w = p.populatePracticeData(w, date);
  assert.equal(new Set(w.students.map(s => s.ncgId)).size, w.students.length);
  assert.deepEqual(p.removePracticeData(w).students, original.students);
});

test('missing submissions search respects module and cohort and links the source', () => {
  const w = fixture();
  const answer = searchWorkspace(w, "Who hasn't submitted BUS101 in Cohort 1?", date);
  const expected = w.assessments.filter(a => a.module === 'BUS101' && a.cohortId === 'cohort-1').flatMap(a => a.records).filter(r => r.submission !== 'submitted').length;
  assert.ok(answer.answer.startsWith(expected + ' outstanding submissions.'));
  assert.ok(answer.links.length > 0);
  assert.ok(!answer.answer.includes('COM102'));
});

test('support search returns only flagged students in the selected cohort', () => {
  const w = fixture();
  const answer = searchWorkspace(w, 'Which students in Cohort 1 need a progress follow-up?', date);
  const expected = w.learningProgress.filter(p => w.assessments.find(a => a.id === p.assessmentId).cohortId === 'cohort-1' && /behind|support|not started/i.test(p.values.progress1 + ' ' + p.values.progress2)).length;
  assert.ok(answer.answer.startsWith(expected + ' students need a progress follow-up.'));
  assert.ok(!answer.answer.includes('Week 8 On track'));
});

test('marker workload does not count missing submissions as awaiting marking', () => {
  const w = fixture();
  const marker = w.markers[0];
  const records = w.assessments.flatMap(a => a.records).filter(r => r.markerId === marker.id);
  const awaiting = records.filter(r => r.submission === 'submitted' && !r.grade.trim()).length;
  const answer = searchWorkspace(w, 'How much work is allocated to Rachel Adams?', date);
  assert.ok(answer.answer.includes(awaiting + ' submitted and awaiting marking'));
  assert.ok(!answer.answer.includes('Daniel Brooks:'));
});

test('unknown references and unsupported questions never invent a result', () => {
  const w = fixture();
  for (const q of ['Who has submitted BUS999?', 'Which students are in Cohort 99?', 'Find NCG999999']) assert.ok(searchWorkspace(w, q, date).answer.includes("couldn't find"));
  assert.ok(searchWorkspace(w, 'What is the weather?', date).answer.includes("couldn't identify"));
});

test('zero grades are marked and ready for review', () => {
  const w = fixture();
  const a = w.assessments[0];
  a.records[0] = f.updateProgress(a.records[0], { grade: '0', submission: 'submitted', markerId: w.markers[0].id }, w);
  const answer = searchWorkspace(w, 'Who is marked in BUS101?', date);
  assert.ok(answer.answer.includes('grade 0.'));
});

test('assessment title narrows results independently of the module', () => {
  const w = fixture();
  const answer = searchWorkspace(w, "Who hasn't submitted the Strategy report in Cohort 1?", date);
  const a = w.assessments.find(a => a.name === 'Strategy report' && a.cohortId === 'cohort-1');
  const expected = a.records.filter(r => r.submission !== 'submitted').length;
  assert.ok(answer.answer.startsWith(expected + ' outstanding submissions.'));
  assert.ok(!answer.answer.includes('Reflective presentation'));
});

test('ready-for-review and needs-marking queries select outstanding work', () => {
  const w = fixture();
  const reviews = w.assessments.flatMap(a => a.records).filter(r => f.canReview(r, w) && !f.isReviewed(r, w)).length;
  const awaiting = w.assessments.flatMap(a => a.records).filter(r => r.submission === 'submitted' && !r.grade).length;
  assert.ok(searchWorkspace(w, 'Who needs to be reviewed?', date).answer.startsWith(reviews + ' results ready for review.'));
  assert.ok(searchWorkspace(w, 'Who needs marking?', date).answer.startsWith(awaiting + ' submitted records awaiting marking.'));
});
