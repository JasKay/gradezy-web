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

const f=load('lib/workflow.ts'),m=load('lib/module-tracker.ts'),p=load('lib/student-examples.ts');
const fixture=()=>p.populateStudentExamples(f.emptyWorkflow());
test('module rosters exist without assessments and preserve individual cohort enrolments',()=>{const w=fixture();assert.equal(w.assessments.length,0);const rows=m.moduleRoster(w,'BM301');assert.ok(rows.length>0);for(const r of rows)assert.ok(w.students.find(s=>s.id===r.studentId).enrolments.some(e=>e.cohortId===r.cohortId&&e.subject===r.subject));assert.equal(new Set(rows.map(r=>r.studentId+':'+r.cohortId+':'+r.subject)).size,rows.length);});
test('module checkpoints retain history and cannot spill between students or cohorts',()=>{let w=fixture();const rows=m.moduleRoster(w,'BM301'),row=rows[0],other=rows.find(r=>r.cohortId!==row.cohortId);w=m.saveModuleLearning(w,'BM301',row,{progress1:'On Track'},'2026-10-07T10:00:00Z');w=m.saveModuleLearning(w,'BM301',row,{progress1:'Needs support',retentionComment1:'Follow up'},'2026-10-07T11:00:00Z');assert.equal(m.moduleLearning(w,'BM301',row).history.length,2);assert.equal(m.moduleLearning(w,'BM301',row).history[1].values.progress1,'On Track');assert.deepEqual(m.moduleLearning(w,'BM301',other).values,{});assert.throws(()=>m.saveModuleLearning(w,'BM301',{...row,studentId:'unknown'},{}),/not enrolled/);});
test('grading separates outcomes and attempts, rejects invalid grades and preserves cohort boundaries',()=>{let w=fixture();const row=m.moduleRoster(w,'BM301')[0];w.assessments.push({id:'a',name:'Report',module:'BM301',cohortId:row.cohortId,subject:row.subject,issueDate:'2026-10-07',createdAt:'2026-10-07',offsets:f.defaultOffsets(),records:[]});w=m.saveModuleMarking(w,'a',row.studentId,{first:{marker:'Alex Marker',grade:'65',outcome:'Late'},resubmission:{}},'first','submitted');let r=w.assessments[0].records[0];assert.equal(r.grade,'65');assert.equal(w.markers.length,1);r.reviewedAt='2026-10-07';r.reviewer='Reviewer';r.releasedAt='2026-10-07';w=m.saveModuleMarking(w,'a',row.studentId,{first:{marker:'Alex Marker',grade:'65',outcome:'Late'},resubmission:{marker:'Alex Marker',grade:'72'}},'resubmission','submitted');r=w.assessments[0].records[0];assert.equal(r.grade,'72');assert.equal(r.attempts.first.grade,'65');assert.equal(r.reviewedAt,undefined);assert.equal(r.releasedAt,undefined);assert.throws(()=>m.saveModuleMarking(w,'a',row.studentId,{first:{grade:'DNS'},resubmission:{}},'first','awaiting'),/Outcome/);assert.throws(()=>m.saveModuleMarking(w,'a','unknown',{first:{},resubmission:{}},'first','awaiting'),/cohort/);w=m.saveModuleMarking(w,'a',row.studentId,{first:{outcome:'DNS'},resubmission:{}},'first','awaiting');assert.equal(w.assessments[0].records[0].grade,'');assert.equal(w.assessments[0].records[0].attempts.first.outcome,'DNS');});

test('assistant finds cohort-specific module progress before any assessment exists',()=>{let w=fixture();const row=m.moduleRoster(w,'BM301')[0];w=m.saveModuleLearning(w,'BM301',row,{progress2:'Attendance Issues'});const search=load('lib/workspace-assistant.ts').searchWorkspace;const answer=search(w,'Who needs progress support for BM301 '+w.cohorts.find(c=>c.id===row.cohortId).name+'?');assert.match(answer.answer,/1 students need/);assert.ok(answer.links.some(l=>l.href.includes('/progress?module=BM301')));});
