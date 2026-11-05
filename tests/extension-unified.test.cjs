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
