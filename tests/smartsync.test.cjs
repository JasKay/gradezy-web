const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
function load(file, mocks = {}) {
  const m = new Module(file, module); m.filename = file; m.paths = module.paths;
  const original = m.require.bind(m);
  m.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id);
  m._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return m.exports;
}
const { planChanges, column } = load("lib/smartsync.ts");
const mapping = { email: 0, studentId: 1, userId: 2, similarity: 3 };
const record = (patch = {}) => ({ email: "ada@example.edu", studentId: "00123", userId: "1001", similarity: "12%", assessment: "Essay", attempt: "1", ...patch });
const sheet = (rows = [["ada@example.edu", "00123", "", "", "=SUM(A1:A2)"]]) => ({ values: [["Email", "Student ID", "User ID", "Similarity", "Total"], ...rows], formulas: [[], ...rows.map(() => ["", "", "", "", "=SUM(A1:A2)"])], rowIndex: 4, columnIndex: 2 });
const plan = (s, data, m = mapping, attempt = "1") => planChanges(s, data, m, "Essay", attempt);
test("matches normalized email, retains zeroes in IDs, uses absolute cell addresses", () => {
  const p = plan(sheet(), [record({ email: " ADA@EXAMPLE.EDU " })]);
  assert.deepEqual(p.changes.map(c => [c.address, c.after]), [["E6", "1001"], ["F6", 12]]);
  assert.equal(p.issues.length, 0);
  assert.equal(column(26), "AA");
});
test("flags missing, duplicate and conflicting identities", () => {
  assert.match(plan(sheet(), [record({ email: "other@example.edu", studentId: "999" })]).issues[0], /missing/);
  assert.match(plan(sheet(), [record(), record()]).issues[0], /duplicate source/);
  assert.match(plan(sheet([["ada@example.edu", "00123"], ["ada@example.edu", "00124"]]), [record()]).issues[0], /duplicate or conflicting/);
  assert.match(plan(sheet(), [record({ studentId: "999" })]).issues[0], /disagree/);
  assert.equal(plan(sheet(), [record({ studentId: "999" })]).changes.length, 0);
});
test("protects output formulas and unrelated cells", () => {
  const s = sheet(); s.formulas[1][2] = "=A1";
  assert.equal(plan(s, [record()]).changes.length, 0);
  assert.match(plan(s, [record()]).issues[0], /formula/);
  const before = JSON.stringify(s); plan(s, [record()]); assert.equal(JSON.stringify(s), before);
});
test("scopes assessments and resubmissions and skips unchanged values", () => {
  const records = [record(), record({ attempt: "2", userId: "2002" }), record({ assessment: "Report" })];
  assert.equal(plan(sheet(), records).changes[0].after, "1001");
  assert.equal(plan(sheet(), records, mapping, "2").changes[0].after, "2002");
  const p = plan(sheet([["ada@example.edu", "00123", "1001", 12]]), [record()]);
  assert.equal(p.changes.length, 0); assert.equal(p.unchanged, 2);
});
test("rejects dangerous IDs, invalid scores and unsafe mappings", () => {
  for (const patch of [{ userId: " =HYPERLINK(A1)" }, { similarity: "" }, { similarity: "101" }, { similarity: "-1" }]) assert.equal(plan(sheet(), [record(patch)]).changes.length, 0);
  assert.throws(() => plan(sheet(), [record()], { ...mapping, similarity: 2 }), /different/);
  assert.throws(() => plan(sheet(), [record()], { ...mapping, userId: 0 }), /distinct/);
});
test("supports student-ID-only matching without converting identifiers to numbers", () => {
  assert.equal(plan(sheet(), [record({ email: "" })], { ...mapping, email: -1 }).changes.length, 2);
  assert.equal(plan(sheet(), [record({ email: "", studentId: "123" })], { ...mapping, email: -1 }).changes.length, 0);
});
function writer({ changed = false, issues = [], failAt = -1 } = {}) {
  const crypto = require("node:crypto"), calls = [];
  const ticket = { base: "/drives/d/items/i/workbook", sheet: "s", fingerprint: "original", owner: crypto.createHash("sha256").update("access").digest("hex"), expires: Date.now() + 60000, plan: { changes: [{ address: "E6", after: "1001" }, { address: "F6", after: 12 }], issues } };
  let patches = 0;
  const mocks = { token: async () => "access", sameOrigin() {}, unseal: () => ticket, readSheet: async () => ({}), fingerprint: () => changed ? "changed" : "original", worksheet: (base,id) => base + "/worksheets/" + id, failure: e => Response.json({ error: e.message }, { status: 400 }),
    graph: async (path, access, init, session) => {
      calls.push({ path, init, session });
      if (init.method === "PATCH" && patches++ === failAt) throw new Error("network error");
      return path.endsWith("/createSession") ? { id: "session" } : {};
    } };
  return { route: load("app/api/smartsync/sync/route.ts", { "@/lib/smartsync-server": mocks }), calls };
}
const request = () => new Request("https://gradezy.test/api/smartsync/sync", { method: "POST", body: JSON.stringify({ ticket: "signed" }) });
test("writes only exact previewed cell values in a workbook session", async () => {
  const { route, calls } = writer(), response = await route.POST(request());
  assert.equal(response.status, 200); assert.equal((await response.json()).completed, 2);
  const writes = calls.filter(c => c.init.method === "PATCH");
  assert.equal(writes.length, 2); assert.ok(writes[0].path.endsWith("range(address='E6')"));
  assert.deepEqual(JSON.parse(writes[0].init.body), { values: [["1001"]] });
  assert.equal(writes[0].session, "session"); assert.ok(calls.at(-1).path.endsWith("/closeSession"));
});
test("stale preview and flagged records produce zero writes", async () => {
  for (const options of [{ changed: true }, { issues: ["missing"] }]) {
    const { route, calls } = writer(options); assert.equal((await route.POST(request())).status, 400);
    assert.equal(calls.filter(c => c.init.method === "PATCH").length, 0);
  }
});
test("partial write errors report confirmed count and close the session", async () => {
  const { route, calls } = writer({ failAt: 1 }), response = await route.POST(request());
  assert.equal(response.status, 409); assert.equal((await response.json()).completed, 1);
  assert.ok(calls.at(-1).path.endsWith("/closeSession"));
});

test("sample CSV feeds the real matching algorithm and flags its missing student", () => {
  const XLSX = require("xlsx");
  const text = fs.readFileSync("public/samples/smartsync-turnitin.csv", "utf8");
  const workbook = XLSX.read(text, { type: "string", raw: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: true });
  const records = rows.slice(1).map(v => ({ email: v[0], studentId: v[1], userId: v[2], similarity: v[3], assessment: v[4], attempt: v[5] }));
  const p = plan(sheet([["ada@example.edu", "00123", "", ""], ["ben@example.edu", "00124", "", ""]]), records);
  assert.equal(records[0].studentId, "00123");
  assert.equal(p.changes.length, 4);
  assert.equal(p.issues.length, 1);
  assert.match(p.issues[0], /missing@example.edu: student missing/);
});
test("encrypted preview payload rejects tampering and origin checks reject cross-site writes", () => {
  const oldSecret = process.env.SMARTSYNC_SECRET, oldOrigin = process.env.SMARTSYNC_ORIGIN;
  process.env.SMARTSYNC_SECRET = "test-secret-32-characters-minimum-for-smartsync";
  process.env.SMARTSYNC_ORIGIN = "https://gradezy.test";
  try {
    const server = load("lib/smartsync-server.ts", { "next/headers": { cookies: async () => ({}) } });
    const sealed = server.seal({ private: "preview" });
    assert.deepEqual(server.unseal(sealed), { private: "preview" });
    const bytes = Buffer.from(sealed, "base64url"); bytes[30] ^= 1;
    assert.throws(() => server.unseal(bytes.toString("base64url")));
    assert.throws(() => server.sameOrigin(new Request("https://gradezy.test", { headers: { origin: "https://other.test" } })), /origin rejected/);
    server.sameOrigin(new Request("https://gradezy.test", { headers: { origin: "https://gradezy.test" } }));
  } finally {
    if (oldSecret === undefined) delete process.env.SMARTSYNC_SECRET; else process.env.SMARTSYNC_SECRET = oldSecret;
    if (oldOrigin === undefined) delete process.env.SMARTSYNC_ORIGIN; else process.env.SMARTSYNC_ORIGIN = oldOrigin;
  }
});
test("Moodle retrieval rejects unlisted Microsoft accounts before contacting Moodle", async () => {
  const old = process.env.SMARTSYNC_MOODLE_ALLOWED_USER_IDS;
  process.env.SMARTSYNC_MOODLE_ALLOWED_USER_IDS = "authorized-staff";
  try {
    const route = load("app/api/smartsync/results/route.ts", { "@/lib/smartsync-server": {
      sameOrigin() {}, token: async () => "access",
      graph: async () => ({ id: "other-account" }),
      failure: e => Response.json({ error: e.message }, { status: 400 })
    } });
    const response = await route.POST(request());
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /not authorized/);
  } finally {
    if (old === undefined) delete process.env.SMARTSYNC_MOODLE_ALLOWED_USER_IDS; else process.env.SMARTSYNC_MOODLE_ALLOWED_USER_IDS = old;
  }
});