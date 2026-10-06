const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.resolve("app/api/assessment-assistant/route.ts");
const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const compiled = new Module(filename, module);
compiled.filename = filename;
compiled.paths = module.paths;
compiled._compile(out.outputText, filename);
const { POST } = compiled.exports;
const context = {
  asOf: "2026-10-06",
  assessments: [
    {
      reference: "A1",
      subject: "Business Management",
      cohort: "Cohort 1",
      status: "Overdue",
      blockers: ["1 marker allocations missing."],
      timeline: [
        {
          milestone: "Marking",
          done: 0,
          total: 1,
          target: "2026-09-20",
          complete: false,
          overdue: true,
        },
      ],
      studentName: "PRIVATE STUDENT",
    },
  ],
  markerWorkload: [
    {
      reference: "M1",
      assigned: 1,
      awaitingMarking: 1,
      name: "PRIVATE MARKER",
    },
  ],
  batches: [],
  gaps: {
    cohortStartDatesMissing: 4,
    studentsWithoutEnrolment: 0,
    uploadTemplateConfirmed: false,
  },
  students: [{ ncgId: "PRIVATE-ID", grade: "PRIVATE-GRADE" }],
};
const request = (
  body,
  token = "test-access",
  origin = "http://localhost:3000",
) =>
  new Request("http://localhost:3000/api/assessment-assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Origin: origin,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
function configure() {
  process.env.OPENAI_API_KEY = "test-provider-key";
  process.env.OPENAI_MODEL = "test-model";
  process.env.ASSESSMENT_ASSISTANT_TOKEN = "test-access";
}
test("missing configuration returns a clear setup response without a provider call", async () => {
  delete process.env.OPENAI_API_KEY;
  const response = await POST(
    request({ question: "What is blocked?", context }),
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/);
});
test("access token and origin are checked before provider requests", async () => {
  configure();
  assert.equal(
    (await POST(request({ question: "What is blocked?", context }, "wrong")))
      .status,
    401,
  );
  assert.equal(
    (
      await POST(
        request(
          { question: "What is blocked?", context },
          "test-access",
          "https://other.test",
        ),
      )
    ).status,
    403,
  );
});
test("malformed questions and contexts are rejected", async () => {
  configure();
  for (const body of [
    { question: "", context },
    { question: "x".repeat(2001), context },
    { question: "What is blocked?", context: {} },
    "{bad",
  ])
    assert.equal((await POST(request(body))).status, 400);
});
test("request body is bounded by actual byte count", async () => {
  configure();
  assert.equal((await POST(request("x".repeat(80001)))).status, 413);
});
test("Responses request uses server credentials, anonymous aggregates and store false", async () => {
  configure();
  const original = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return Response.json({
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "A1 needs allocation." }],
        },
      ],
    });
  };
  try {
    const response = await POST(
      request({ question: "What is blocked?", context }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).answer, "A1 needs allocation.");
    const body = JSON.parse(captured.options.body);
    assert.equal(body.store, false);
    assert.equal(body.model, "test-model");
    assert.equal(
      captured.options.headers.Authorization,
      "Bearer test-provider-key",
    );
    for (const privateText of [
      "PRIVATE STUDENT",
      "PRIVATE MARKER",
      "PRIVATE-ID",
      "PRIVATE-GRADE",
    ])
      assert.equal(body.input.includes(privateText), false);
  } finally {
    global.fetch = original;
  }
});
test("provider errors return a useful message without exposing its response", async () => {
  configure();
  const original = global.fetch;
  global.fetch = async () =>
    Response.json({ error: "private provider details" }, { status: 429 });
  try {
    const response = await POST(
      request({ question: "What is blocked?", context }),
    );
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.error, /quota/);
    assert.equal(body.error.includes("private provider details"), false);
  } finally {
    global.fetch = original;
  }
});
test("per-process request limit prevents unbounded calls", async () => {
  configure();
  const original = global.fetch;
  global.fetch = async () =>
    Response.json({
      output: [{ content: [{ type: "output_text", text: "Test response" }] }],
    });
  try {
    let limited = false;
    for (let i = 0; i < 11; i++) {
      const response = await POST(
        request({ question: "What is blocked?", context }),
      );
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    assert.equal(limited, true);
  } finally {
    global.fetch = original;
  }
});
