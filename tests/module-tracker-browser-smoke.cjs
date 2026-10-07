const assert = require('node:assert/strict');
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

const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const X=require('xlsx');
const f=load('lib/workflow.ts'),p=load('lib/student-examples.ts'),m=load('lib/module-tracker.ts');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
 const w=p.populateStudentExamples(f.emptyWorkflow()),rows=m.moduleRoster(w,'BM301'),row=rows[0],other=rows.find(r=>r.cohortId!==row.cohortId),s=w.students.find(s=>s.id===row.studentId),name=s.firstName+' '+s.lastName;
 await page.addInitScript(state=>{if(!localStorage.getItem('gradezy_workflow_v1')){localStorage.setItem('gradezy_workflow_v1',JSON.stringify(state));localStorage.setItem('gradezy_students_20_v1','true');}},w);
 await page.goto(base+'/progress');await page.getByLabel('Tracker module').selectOption('BM301');await page.getByLabel('Tracker cohort').selectOption(row.cohortId);
 await page.getByRole('button',{name,exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Task 1',{exact:true}).fill('Formative');await dialog.getByLabel('Progress 1 -W4',{exact:true}).fill('On Track');await dialog.getByRole('button',{name:'Save progress',exact:true}).click();await page.getByRole('cell',{name:/On Track.*Formative/}).waitFor();
 await page.getByLabel('Tracker cohort').selectOption(other.cohortId);assert.equal(await page.getByText('On Track',{exact:true}).count(),0);await page.getByLabel('Tracker cohort').selectOption(row.cohortId);
 await page.getByRole('button',{name,exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByText('Checkpoint history (1)',{exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Import Excel',exact:true}).click();dialog=page.getByRole('dialog');const book=X.utils.book_new();X.utils.book_append_sheet(book,X.utils.aoa_to_sheet([['NCG ID','Cohort','Programme','Task 2','Progress 2-W8','Comments Ret'],[s.ncgId,w.cohorts.find(c=>c.id===row.cohortId).name,row.subject,'Report','Attendance Issues','Contact student']]),'Progress');await dialog.getByLabel('Upload progress workbook').setInputFiles({name:'progress.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:X.write(book,{type:'buffer',bookType:'xlsx'})});await dialog.getByRole('button',{name:'Confirm progress import',exact:true}).click();await page.getByRole('cell',{name:/Attendance Issues.*Report/}).waitFor();
 await page.getByRole('button',{name:'Marking & Allocation',exact:true}).click();assert.equal(await page.getByLabel('Tracker cohort').inputValue(),row.cohortId);await page.getByText('Add an assessment for this module to begin grading.',{exact:false}).waitFor();
 await page.evaluate(({row,other})=>{const key='gradezy_workflow_v1',state=JSON.parse(localStorage.getItem(key));state.assessments=[row,other].map((r,i)=>({id:'module-browser-'+i,name:'Business report',module:'BM301',cohortId:r.cohortId,subject:r.subject,issueDate:'2026-10-07',createdAt:'2026-10-07',offsets:{allocation:3,resubmission:7,marking:10,moderation:21,release:30},records:[]}));localStorage.setItem(key,JSON.stringify(state));},{row,other});
 await page.goto(base+'/marking?module=BM301&cohort='+row.cohortId);await page.getByRole('button',{name,exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('1st Marker',{exact:true}).fill('Alex Marker');await dialog.getByLabel('Grade (out of 100%)',{exact:true}).fill('DNS');await dialog.getByRole('button',{name:'Save marking',exact:true}).click();await dialog.getByRole('alert').waitFor();await dialog.getByLabel('Grade (out of 100%)',{exact:true}).fill('65');await dialog.getByLabel('Final Grade',{exact:true}).fill('65');await dialog.getByLabel('Submission status',{exact:true}).selectOption('submitted');await dialog.getByRole('button',{name:'Save marking',exact:true}).click();await page.getByRole('cell',{name:'Alex Marker',exact:true}).waitFor();
 await page.getByRole('button',{name,exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Attempt',{exact:true}).selectOption('resubmission');await dialog.getByLabel('1st Marker',{exact:true}).fill('Alex Marker');await dialog.getByLabel('Grade (out of 100%)',{exact:true}).fill('72');await dialog.getByLabel('Final Grade',{exact:true}).fill('72');await dialog.getByRole('button',{name:'Save marking',exact:true}).click();await page.getByRole('cell',{name:'72',exact:true}).waitFor();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('gradezy_workflow_v1')));const record=saved.assessments[0].records[0];assert.equal(record.attempts.first.grade,'65');assert.equal(record.attempts.resubmission.grade,'72');assert.equal(saved.assessments[1].records.length,0);
 await page.getByRole('button',{name:'Progress Tracker',exact:true}).click();assert.equal(await page.getByLabel('Tracker cohort').inputValue(),row.cohortId);await page.getByRole('cell',{name:/Attendance Issues.*Report/}).waitFor();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name,exact:true}).click();await page.getByRole('dialog').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 console.log('Module tracker checks passed: independent progress, cohort isolation, history, Excel import, shared filters, grading, resubmissions and mobile dialogs.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
