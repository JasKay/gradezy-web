const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
 try {
 const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3001';await page.goto(base+'/students');await page.getByRole('button',{name:'Download cohort workbook',exact:true}).waitFor();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gradezy_workflow_v1')));
 let w=await saved();assert.equal(w.students.length,54);assert.equal(w.assessments.length,18);assert.equal(w.cohorts[5].startMonth,'2026-02');
 await page.getByRole('button',{name:'View student',exact:false}).first().click();await page.getByRole('button',{name:'Save student details',exact:true}).waitFor();await page.getByRole('button',{name:'Close student',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download cohort workbook',exact:true}).click();const file=await pending;const X=require('xlsx');const book=X.readFile(await file.path());assert.equal(book.SheetNames.length,4);const mark=X.utils.sheet_to_json(book.Sheets[book.SheetNames[3]],{header:1});assert.equal(mark[0].filter(h=>h==='Final Grade').length,2);
 await page.goto(base+'/progress');await page.getByRole('button',{name:'Update checkpoints',exact:false}).first().click();await page.getByLabel('Progress 1 -W4',{exact:true}).fill('Browser check');await page.getByRole('button',{name:'Save learning progress',exact:true}).click();w=await saved();assert.equal(w.learningProgress[0].values.progress1,'Browser check');
 await page.goto(base+'/marking');await page.getByRole('heading',{name:'Marking Allocation',exact:true}).first().waitFor();
 await page.goto(base+'/sources');await page.getByRole('heading',{name:'Data sources',exact:true}).first().waitFor();assert.deepEqual(errors,[]);console.log('Tracker browser checks passed: sample cohorts, student profiles, four-sheet download, duplicate grade headers, independent learning updates, marking and sources.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
