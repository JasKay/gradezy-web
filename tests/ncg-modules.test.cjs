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
const c = load('lib/ncg-modules.ts');
const f = load('lib/workflow.ts');
const t = load('lib/tracker-sheets.ts');
const p = load('lib/practice-workspace.ts');
const { searchWorkspace } = load('lib/workspace-assistant.ts');

test('catalogue includes every supplied distinct module once and retains shared programmes', () => {
  const expected = 'ACS100 BM101 BM102 BM103 BM104 CMP111 CMP114 IHS101 IHS102 IHS103 IHS104 NCS401 NCS402 PRD100 WRL100 BM201 BM202 BM203 BM204 CMP211 CMP212 CMP213 CMP214 IHS201 IHS202 IHS203 IHS204 PFD200 WKL200 BM300 BM301 BM302 BM303 BM304 BM305 CMP600 CMP604 CMP609 CMP610 CMP611 IHS301 IHS302 IHS303 IHS304 IHS305'.split(' ').sort();
  assert.deepEqual(c.NCG_MODULES.map(m => m.code).sort(), expected);
  assert.equal(c.NCG_MODULES.length, 45);
  for (const code of ['ACS100', 'PRD100', 'WRL100', 'PFD200', 'WKL200']) assert.deepEqual(c.findNcgModule(code).programmes, ['BM', 'COMP', 'HSC']);
  assert.deepEqual(['BM','COMP','HSC'].map(code => c.NCG_MODULES.filter(m => m.programmes.includes(code)).length), [19,18,18]);
});

test('201, 202, 203 and 204 remain separate courses, with supplied prefix variants searchable', () => {
  for (const code of ['201','202','203','204']) assert.equal(c.findNcgModule('IH' + code).code, 'IHS' + code);
  assert.equal(new Set(['201','202','203','204'].map(code => c.findNcgModule('IH' + code).name)).size, 4);
  assert.equal(c.findNcgModule(' bm101\u00a0 ').name, 'The Business Environment');
});

test('BM, COMP, CMP and HSC imports resolve to the correct programme', () => {
  assert.equal(t.subjectFor('BM'), 'Business Management');
  assert.equal(t.subjectFor(' Comp\u00a0'), 'Computer Science');
  assert.equal(t.subjectFor('CMP'), 'Computer Science');
  assert.equal(t.subjectFor('HSC<br>'), 'Health and Social Care');
  assert.equal(c.subjectLabel('Computer Science'), 'Computing');
});

test('shared module assessments in different programmes remain distinct without duplicating catalogue entries', () => {
  const selection = { cohortId: 'cohort-1', subject: 'Business Management', fileName: 'NCG.xlsx', sheetName: 'Tracker', system: 'Excel upload' };
  const w = t.applySpreadsheet(f.emptyWorkflow(), 'assessments', ['Cohort','Module Code','Assessment','Programme'], [['Cohort 1','ACS100','Study skills','BM'],['Cohort 1','ACS100','Study skills','COMP']], selection);
  assert.equal(w.assessments.length, 2);
  assert.deepEqual(w.assessments.map(a => a.subject), ['Business Management', 'Computer Science']);
  assert.equal(w.assessments[0].operations.moduleName, 'Academic Study Skills');
  assert.equal(c.NCG_MODULES.filter(m => m.code === 'ACS100').length, 1);
  assert.throws(() => t.applySpreadsheet(w, 'assessments', ['Cohort','Module Code','Assessment','Programme'], [['Cohort 1','BM101','Report','HSC']], selection), /does not offer/);
});

test('starter code migration preserves entered assessments and progress', () => {
  let w = p.populatePracticeData(f.emptyWorkflow(), '2026-10-06');
  w.assessments[0].module = 'BUS101';
  w.assessments[0].records[0].notes = 'Keep this edit';
  w.assessments.push({ ...structuredClone(w.assessments[0]), id: 'entered-assessment' });
  const aligned = c.alignPracticeModules(w);
  assert.equal(aligned.assessments[0].module, 'BM301');
  assert.equal(aligned.assessments[0].records[0].notes, 'Keep this edit');
  assert.equal(aligned.assessments.at(-1).module, 'BUS101');
  assert.equal(c.alignPracticeModules(aligned), aligned);
});

test('assistant distinguishes catalogue modules from scheduled assessments', () => {
  const w = f.emptyWorkflow();
  const answer = searchWorkspace(w, 'What is BM101?', '2026-10-06');
  assert.ok(answer.answer.includes('The Business Environment'));
  assert.ok(answer.answer.includes('No assessments have been scheduled'));
  assert.equal(answer.links[0].href, '/assessments/new?module=BM101');
  assert.ok(searchWorkspace(w, 'List COMP modules', '2026-10-06').answer.startsWith('18 NCG modules.'));
});

test('directory separates shared programmes and saves cohort assignments without changing schedules', () => {
  let w = f.emptyWorkflow();
  assert.equal(c.ncgModuleEntries(w).length, 55);
  assert.deepEqual(c.ncgModuleEntries(w).filter(m => m.code === 'ACS100').map(m => m.programme), ['BM', 'COMP', 'HSC']);
  const original = w;
  w = c.updateNcgModuleEntry(w, 'ACS100:HSC', 'Updated skills', ['cohort-2', 'cohort-2']);
  assert.equal(original.moduleEntries, undefined);
  const row = c.ncgModuleEntries(w).find(m => m.key === 'ACS100:HSC');
  assert.equal(row.name, 'Updated skills');
  assert.deepEqual(row.cohortIds, ['cohort-2']);
  assert.equal(c.ncgModuleEntries(w).find(m => m.key === 'ACS100:BM').name, 'Academic Study Skills');
  assert.strictEqual(w.assessments, original.assessments);
  assert.throws(() => c.updateNcgModuleEntry(w, row.key, ' ', []));
  assert.throws(() => c.updateNcgModuleEntry(w, row.key, 'Valid', ['missing']));
  assert.throws(() => c.updateNcgModuleEntry(w, 'missing', 'Valid', []));
  w.assessments.push({ module: 'ACS100', subject: 'Health and Social Care', cohortId: 'cohort-1' });
  w = c.updateNcgModuleEntry(w, row.key, 'Valid', []);
  assert.deepEqual(c.ncgModuleEntries(w).find(m => m.key === row.key).cohortIds, ['cohort-1']);
});

test('schedule derives unscheduled entries and edited names from the directory, preserving actual and imported records', () => {
  let w = f.emptyWorkflow();
  assert.equal(c.ncgScheduleRows(w).length, 55);
  w = c.updateNcgModuleEntry(w, 'ACS100:HSC', 'HSC study skills', ['cohort-2']);
  const assessment = { id: 'scheduled', module: 'ACS100', subject: 'Health and Social Care', cohortId: 'cohort-1', name: 'Essay', issueDate: '2026-10-01' };
  const imported = { ...assessment, id: 'external', module: 'EXT101' };
  w.assessments.push(assessment, imported);
  const rows = c.ncgScheduleRows(w);
  assert.equal(rows.filter(r => r.code === 'ACS100').length, 4);
  const scheduled = rows.find(r => r.key === 'scheduled');
  assert.equal(scheduled.name, 'HSC study skills');
  assert.strictEqual(scheduled.assessment, assessment);
  assert.ok(rows.some(r => r.code === 'ACS100' && r.cohortId === 'cohort-2' && !r.assessment));
  assert.strictEqual(rows.find(r => r.key === 'external').assessment, imported);
});

test('cohort sort is numeric, reversible and keeps unassigned rows last', () => {
  const w = f.emptyWorkflow();
  w.cohorts.push({ id: 'cohort-10', name: 'Cohort 10', startMonth: '' });
  const ids = ['cohort-6', '', 'cohort-2', 'cohort-1', 'cohort-10'];
  assert.deepEqual([...ids].sort((a,b) => c.compareCohorts(w,a,b)), ['cohort-1','cohort-2','cohort-6','cohort-10','']);
  assert.deepEqual([...ids].sort((a,b) => c.compareCohorts(w,a,b,true)), ['cohort-10','cohort-6','cohort-2','cohort-1','']);
});
