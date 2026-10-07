const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});try{
 const page=await browser.newPage();const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3001';
 await page.goto(base+'/students');await page.getByRole('heading',{name:'Students',exact:true}).waitFor();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gradezy_workflow_v1')));
 assert.equal((await saved()).students.length,120);
 for(let i=1;i<=6;i++){await page.getByLabel('Directory cohort').selectOption('cohort-'+i);assert.equal(await page.locator('tbody tr').count(),20);}
 await page.getByLabel('Directory programme').selectOption('Business Management');assert.equal(await page.locator('tbody tr').count(),10);
 assert.equal(await page.getByText(/\bsubjects?\b/i).count(),0);
 await page.getByLabel('Directory programme').selectOption('');
 await page.locator('tbody tr').first().getByRole('button').first().click();
 await page.getByRole('dialog').waitFor();assert.ok((await page.getByRole('dialog').innerText()).includes('Cohort 6'));
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.reload();await page.getByRole('heading',{name:'Students',exact:true}).waitFor();assert.equal((await saved()).students.length,120);
 console.log('Student population checks passed: 120 fictional students, 20 per cohort, programme filtering, cohort-aware modals and no duplicate records after reload.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
