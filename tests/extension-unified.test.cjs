const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const extension = path.join(__dirname, "..", "public", "extension");
const read = (name) => fs.readFileSync(path.join(extension, name), "utf8");

function isolated(source, begin, end, exported, prefix = "") {
  const from = source.indexOf(begin), to = source.indexOf(end, from + begin.length);
  assert.ok(from >= 0 && to > from, "Expected standalone helper exists");
  return vm.runInNewContext("(function(){" + prefix + source.slice(from, to) + ";return " + exported + ";})()");
}

test("unified manifest points to existing extension resources", () => {
  const m = JSON.parse(read("manifest.json"));
  assert.equal(m.manifest_version, 3);
  assert.equal(m.side_panel.default_path, "sidepanel.html");
  assert.equal(m.action.default_popup, undefined);
  assert.equal(m.externally_connectable.matches.includes("https://gradezy-website.vercel.app/*"), true);
  assert.equal(m.host_permissions.includes("https://staffadv.ncgrp.co.uk/*"), true);
  for (const name of ["background.js", "content.js", "sidepanel.js", "sidepanel.html"]) {
    assert.equal(fs.existsSync(path.join(extension, name)), true);
  }
});

test("extension scripts parse as valid JavaScript", () => {
  for (const name of ["background.js", "content.js", "sidepanel.js"]) {
    assert.doesNotThrow(() => new vm.Script(read(name), { filename: name }));
  }
});

test("panel includes explicit approval and session controls", () => {
  const html = read("sidepanel.html");
  for (const id of ["captureMoodle", "importMoodle", "previewPage", "previewCsv",
    "stageGrades", "staffReview", "previewGrades", "applyGrades", "clearData"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(read("sidepanel.js"), /chrome\.storage\.session/);
});

test("first submission never selects a resubmission-only Paper ID column", () => {
  const src = read("sidepanel.js");
  const prefix = "const norm=v=>String(v??'').trim().toLowerCase();" +
    "const key=v=>norm(v).replace(/[^a-z0-9]/g,'');" +
    "const text=v=>String(v??'').replace(/\\s+/g,' ').trim();" +
    "const findIndex=(headers,candidates)=>headers.map(key).findIndex(h=>candidates.includes(h));";
  const match = isolated(src, "function matchTracker(", "async function previewTracker(", "matchTracker", prefix);
  const batch = { attempt: "first", assessment: "A1", records: [{email:"a@example.edu",paper:"123",similarity:"9%"}] };
  assert.throws(() => match(batch, [{headers:["ESL Email","Resubmission - TII Paper ID"],rows:[["a@example.edu",""]]}]), /Cannot find/);
  const rows = [{headers:["ESL Email","TII Paper ID","Resubmission - TII Paper ID"],rows:[["a@example.edu","",""]]}];
  const result = match(batch, rows);
  assert.equal(result.count, 1);
  assert.equal(result.output[1][1], "123");
  assert.equal(result.output[1][2], "");
});

test("existing conflicting Paper IDs are never overwritten", () => {
  const src = read("sidepanel.js");
  const prefix = "const norm=v=>String(v??'').trim().toLowerCase();" +
    "const key=v=>norm(v).replace(/[^a-z0-9]/g,'');" +
    "const text=v=>String(v??'').replace(/\\s+/g,' ').trim();" +
    "const findIndex=(headers,candidates)=>headers.map(key).findIndex(h=>candidates.includes(h));";
  const match = isolated(src, "function matchTracker(", "async function previewTracker(", "matchTracker", prefix);
  const batch = { attempt:"first", assessment:"A1", records:[{email:"a@example.edu",paper:"123",similarity:"9%"}] };
  const output = match(batch,[{headers:["ESL Email","TII Paper ID"],rows:[["a@example.edu","999"]]}]);
  assert.equal(output.count, 0);
  assert.equal(output.output[1][1], "999");
  assert.match(output.summary,/Exceptions: 1/);
});

test("grade parser enforces 0 through 100 and two decimals", () => {
  const g = isolated(read("content.js"), "function gradezyGrade(", "function gradezyBuildFillPlan(", "gradezyGrade");
  assert.equal(g(0), "0.00");
  assert.equal(g("97.25%"), "97.25");
  assert.equal(g(100), "100.00");
  assert.equal(g(101), null);
  assert.equal(g("-3"), null);
  assert.equal(g("90abc"), null);
});

test("CSV parser supports quoted commas and rejects unclosed quotes", () => {
  const parser = isolated(read("sidepanel.js"), "function parseDelimited(", "async function fileTable(", "parseDelimited");
  const rows = parser('Email,Paper ID\n"a@example.edu","123,456"\n', ",");
  assert.equal(rows[1][1], "123,456");
  assert.throws(()=>parser('"unclosed', ","), /Malformed CSV/);
});

test("grade import exposes sheet, header and column review before staging", () => {
  const html = read("sidepanel.html");
  for (const id of ["gradeSheet", "gradeHeaderRow", "gradeIdColumn", "gradeValueColumn", "gradeFirstColumn", "gradeLastColumn", "gradeFilePreview"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(read("sidepanel.js"), /gradeWorkbook\.sheets/);
  assert.match(read("sidepanel.js"), /rows\.slice\(0,\$\("showAllGrades"\)\.checked\?1000:30\)/);
  assert.match(html,/id="showAllGrades"/);
  assert.match(read("sidepanel.js"),/\$\("showAllGrades"\)\.checked\?1000:30/);
});

test("every scored Excel row reaches Match, including entries after preview row 30", () => {
  const extract=isolated(read("sidepanel.js"),"function gradezyExtractScoredRows(","function gradeHeaderIndex(","gradezyExtractScoredRows",
    'const text=v=>String(v??"").replace(/\\s+/g," ").trim();');
  const rows=Array.from({length:144},(_,i)=>[String(2341000+i),`Student${i}`,`Surname${i}`,""]);
  rows[70]=["2341580","Iulian-Silviu","Bunda","68"];
  rows[90]=["2341520","Chanelle Catherine","Adams","40"];
  rows[110]=["2341584","Eduard-Florian","Baetasu","57"];
  const staged=extract(rows,0,3,1,2);
  assert.equal(staged.length,3);
  assert.deepEqual([...staged.map(r=>r.ncgId)], ["2341580","2341520","2341584"]);
  assert.equal(staged[0].grade,"68");
  assert.equal(staged[0].lastName,"Bunda");
});

test("grade fill checks supplied student names and preserves them through approval", () => {
  const src = read("content.js");
  assert.match(src, /reason="nameMismatch"/);
  assert.match(src, /firstName:clean\(r\.firstName\),lastName:clean\(r\.lastName\)/);
  assert.match(src, /gradezyPendingFill = null; \/\/ one-time authorisation/);
});

test("StaffAdvantage surname-first rows retain the NCG ID beneath the name", () => {
  const src=read("content.js");
  const parser=isolated(src,"function parseStudentDetails(","function isChecked(","parseStudentDetails",
    'const clean=v=>String(v??"").replace(/\\s+/g," ").trim();const normaliseId=v=>clean(v).replace(/\\s+/g,"");');
  const row={getAttribute:()=>null,dataset:{}};
  const student=parser("Adams, Chanelle...\n2341520",row);
  assert.equal(student.ncgId,"2341520");
  assert.equal(student.lastName,"Adams");
  assert.equal(student.firstName,"Chanelle...");
  const bunda=parser("Bunda, Iulian-Silviu\n2341580",row);
  assert.equal(bunda.ncgId,"2341580");
  assert.equal(bunda.lastName,"Bunda");
  assert.equal(bunda.firstName,"Iulian-Silviu");
});

test("StaffAdvantage blue header is recognised without a THEAD", () => {
  const src=read("content.js");
  const helpers=isolated(src,"function headerKey(","function parseStudentDetails(","({findStaffAdvantageTable,columnMap,gradezyStudentRows})",
    `const clean=v=>String(v??"").replace(/\\s+/g," ").trim();
const cellDetails=cell=>cell?.innerText||"";
const headerCells=["Student Details","Attempt Number","Percentage","True Zero"].map(text=>({innerText:text,colSpan:1}));
const studentCells=["Bunda, Iulian-Silviu\\n2341580","1","0.00",""] .map((text,index)=>({innerText:text,colSpan:1,querySelector:()=>index===2?{}:null}));
const header={querySelectorAll:()=>headerCells};
const student={querySelectorAll:()=>studentCells};
const table={querySelectorAll:selector=>selector==="tr"?[header,student]:[]};
const document={querySelectorAll:selector=>selector==="table"?[table]:[]};`);
  const table=helpers.findStaffAdvantageTable();
  assert.ok(table);
  assert.equal(helpers.columnMap(table).details,0);
  assert.equal(helpers.columnMap(table).grade,2);
  assert.equal(helpers.gradezyStudentRows(table).length,1);
});

test("StaffAdvantage headerless grid is found by NCG ID and adjacent grade input", () => {
  const src=read("content.js");
  const helpers=isolated(src,"function headerKey(","function parseStudentDetails(","({findStaffAdvantageTable,columnMap,gradezyStudentRows})",
    `const clean=v=>String(v??"").replace(/\\s+/g," ").trim();
const cellDetails=cell=>cell?.innerText||"";
const headerCells=["Student Details","Attempt Number","Percentage"].map(text=>({innerText:text,colSpan:1,querySelector:()=>null}));
const cells=["Bunda, Iulian-Silviu\\n2341580","1","0.00"].map((text,index)=>({innerText:text,colSpan:1,querySelector:()=>index===2?{}:null}));
const header={querySelectorAll:()=>headerCells};
const student={querySelectorAll:()=>cells};
const headerOnly={querySelectorAll:selector=>selector==="tr"?[header]:[]};
const grid={querySelectorAll:selector=>selector==="tr"?[student]:[]};
const document={querySelectorAll:selector=>selector==="table"?[headerOnly,grid]:[]};`);
  const table=helpers.findStaffAdvantageTable();
  assert.ok(table);
  assert.equal(helpers.columnMap(table).details,0);
  assert.equal(helpers.columnMap(table).grade,2);
  assert.equal(helpers.gradezyStudentRows(table).length,1);
});

test("Visual WebGUI spans match Percentage inputs by on-screen row", () => {
  const src=read("content.js");
  const scan=isolated(src,"function gradezyVisualEntries(","function gradezyGridEntries(","gradezyVisualEntries",
    `const clean=v=>String(v??"").replace(/\\s+/g," ").trim();
const parseStudentDetails=(value)=>({ncgId:value.match(/2341580/)?.[0],firstName:"Iulian-Silviu",lastName:"Bunda"});
const span={textContent:"2341580",getBoundingClientRect:()=>({left:110,right:170,top:310,bottom:325,width:60,height:15})};
const input={id:"UDB_Input_951",value:"0.00",disabled:false,getBoundingClientRect:()=>({left:405,right:530,top:272,bottom:298,width:125,height:26})};
const name={textContent:"Bunda, Iulian-Silviu",getBoundingClientRect:()=>({left:108,right:260,top:275,bottom:292,width:152,height:17})};
const document={querySelectorAll:selector=>selector==="span"?[span,name]:selector.startsWith("input")?[input]:[]};`);
  const result=scan();
  assert.equal(result.length,1);
  assert.equal(result[0].student.ncgId,"2341580");
  assert.equal(result[0].grade,"0.00");
});

test("truncated StaffAdvantage names are checked as prefixes after ID matching", () => {
  const src=read("content.js");
  const matches=isolated(src,"function gradezyName(","function gradezyBuildFillPlan(","gradezyNameMatches",
    'const clean=v=>String(v??"").replace(/\\s+/g," ").trim();');
  assert.equal(matches("Chanelle","Chanelle..."),true);
  assert.equal(matches("Chanelle","Charlotte..."),false);
  assert.equal(matches("Adams","Adams"),true);
});

test("Bunda's NCG ID and score match a 0.00 StaffAdvantage row before fill approval", () => {
  const source=read("content.js");
  const prefix=`const clean=v=>String(v??"").replace(/\\s+/g," ").trim();
const normaliseId=v=>clean(v).replace(/\\s+/g,"");
const gradezyGrade=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=100?n.toFixed(2):null;};
const gradezyName=v=>clean(v).toLowerCase().replace(/[^a-z0-9]/g,"");
const gradezyNameMatches=(a,b)=>!a||gradezyName(a)===gradezyName(b);
const parseStudentDetails=()=>({ncgId:"2341580",firstName:"Iulian-Silviu",lastName:"Bunda"});
const input={value:"0.00",disabled:false,readOnly:false};
const gradezyGridEntries=()=>[{student:{ncgId:"2341580",firstName:"Iulian-Silviu",lastName:"Bunda"},input,row:null}];
const cells=[{innerText:"Bunda, Iulian-Silviu\\n2341580"},{querySelector:()=>input}];
const row={querySelectorAll:()=>cells};
const table={querySelectorAll:()=>[row]};
const gradezyStudentRows=()=>[row];
const gradezyRowCells=r=>r.querySelectorAll();
const findStaffAdvantageTable=()=>table;
const columnMap=()=>({details:0,grade:1});
const cellDetails=c=>c.innerText;
const location={href:"https://staffadv.ncgrp.co.uk/test"};
const document={title:"Sample assessment"};`;
  const build=isolated(source,"function gradezyBuildFillPlan(","function gradezyPreviewFill(","gradezyBuildFillPlan",prefix);
  // The mocked DOM is supplied as the lexical table binding in the isolated function.
  const records=[{ncgId:"2341580",firstName:"Iulian-Silviu",lastName:"Bunda",grade:"68"}];
  const result=build(records,false);
  assert.equal(result.outcome.zeroReview,1);
  assert.equal(result.outcome.missing,0);
  assert.equal(result.details[0].grade,"68");
  assert.match(result.details[0].status,/ID matched/);
  const approved=build(records,true);
  assert.equal(approved.outcome.ready,1);
  assert.equal(approved.approved[0].grade,"68.00");
});

test("0.00 replacement is separately reviewed and never assumed blank", () => {
  const src=read("content.js");
  assert.match(src,/allowDefaultZero=false/);
  assert.match(src,/reason="zeroReview"/);
  assert.match(src,/rec\.prior==="0\.00"/);
  assert.match(read("sidepanel.html"),/id="staffZeroReview"/);
});

test("grade matching uses NCG ID without an attempt selector", () => {
  assert.doesNotMatch(read("sidepanel.html"),/id="staffAttempt"/);
  const content=read("content.js");
  assert.doesNotMatch(content,/if\(attemptNumber &&/);
  assert.match(content,/ID matched · 0\.00 needs approval/);
  assert.match(read("sidepanel.html"),/id="matchSearch"/);
  assert.match(read("sidepanel.js"),/matchDetails=records\.map\(record=>/);
  assert.match(read("sidepanel.js"),/for\(const match of filtered\)/);
  assert.doesNotMatch(content,/attemptNumber/);
});

test("Stage 2 automatically checks the active StaffAdvantage page", () => {
  const src=read("sidepanel.js");
  assert.match(src,/await autoMatchStaffPage\(\);/);
  assert.match(src,/async function autoMatchStaffPage\(\)/);
  assert.match(src,/await runStaffMatch\(\);/);
  assert.match(src,/if\(gradezySelectedWorkflow!=="staff" \|\| gradeFlowStep!=="match"/);
});

test("match failures are visible and a missing StaffAdvantage scanner is reattached", () => {
  const html=read("sidepanel.html"), src=read("sidepanel.js");
  assert.match(html,/id="matchFeedback"/);
  assert.match(src,/feedback\.textContent=message/);
  assert.match(src,/Receiving end does not exist/);
  assert.match(src,/chrome\.scripting\.executeScript\(\{target:\{tabId:tab\.id,frameIds:\[options\.frameId\]\},files:\["content\.js"\]\}\)/);
  assert.match(src,/await sendStaffMessage\(\{action:"previewStaffAdvantageFill"/);
});

test("StaffAdvantage scanner finds assessment grids in embedded frames", () => {
  const src=read("sidepanel.js");
  assert.match(src,/async function findStaffGridFrame\(\)/);
  assert.match(src,/allFrames:true/);
  assert.match(src,/staffFrameId=frame/);
  assert.match(src,/frameId:staffFrameTabId===tab\.id\?staffFrameId:0/);
});
