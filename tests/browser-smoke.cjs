const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    if (!localStorage.getItem("gradezy_workflow_v1"))
      localStorage.setItem(
        "gradezy_workflow_v1",
        JSON.stringify({
          version: 1,
          revision: 0,
          cohorts: Array.from({ length: 6 }, (_, i) => ({
            id: `cohort-${i + 1}`,
            name: `Cohort ${i + 1}`,
            startMonth: [
              "2023-10",
              "2024-02",
              "2024-10",
              "2025-02",
              "2025-10",
              "2026-02",
            ][i],
          })),
          students: [],
          markers: [],
          assessments: [],
          batches: [],
          mapping: Object.fromEntries(
            [
              "ncgId",
              "firstName",
              "lastName",
              "assessment",
              "module",
              "subject",
              "cohort",
              "grade",
              "reviewer",
              "reviewedAt",
            ].map((f) => [f, f]),
          ),
          templateConfirmed: false,
          activity: [],
        }),
      );
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  console.log("Navigating workflow page");
  await page.goto(`${base}/dashboard`);
  await page.getByRole("heading", { name: "Every assessment." }).waitFor();
  console.log("Dashboard ready");
  await page.goto(`${base}/students`);
  await page.getByRole("heading", { name: "Start with the people" }).waitFor();
  await page.getByLabel("Student / NCG ID", { exact: true }).fill("SMOKE001");
  await page.getByLabel("First name", { exact: true }).fill("Smoke");
  await page.getByLabel("Last name", { exact: true }).fill("Student");
  await page
    .getByRole("button", { name: "Add enrolment", exact: true })
    .click();
  await page
    .getByRole("cell", { name: "SMOKE001", exact: true })
    .first()
    .waitFor();
  await page.getByLabel("Student / NCG ID", { exact: true }).fill("SMOKE001");
  await page.getByLabel("First name", { exact: true }).fill("Smoke");
  await page.getByLabel("Last name", { exact: true }).fill("Student");
  await page
    .getByLabel("Subject", { exact: true })
    .selectOption("Computer Science");
  await page
    .getByRole("button", { name: "Add enrolment", exact: true })
    .click();
  let saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gradezy_workflow_v1")),
  );
  assert.equal(saved.students.length, 1);
  assert.equal(saved.students[0].enrolments.length, 2);
  await page.goto(`${base}/markers`);
  await page.getByLabel("Marker name", { exact: true }).fill("Smoke Marker");
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await page
    .getByRole("cell", { name: "Smoke Marker Assistant reference M1" })
    .waitFor();
  await page.goto(`${base}/assessments/new`);
  await page
    .getByLabel("Assessment name", { exact: true })
    .fill("Smoke assessment");
  await page
    .getByLabel("Module / assessment code", { exact: true })
    .fill("SMOKE-A1");
  await page.getByLabel("Issue date", { exact: true }).fill("2026-09-10");
  await page
    .getByRole("button", { name: "Create assessment", exact: true })
    .click();
  await page.waitForURL("**/workflow/**");
  await page
    .getByRole("heading", { name: "Smoke assessment", exact: true })
    .waitFor();
  const detail = page.url();
  assert.ok(await page.getByText("1 Oct 2026", { exact: true }).count());
  await page.getByRole("button", { name: "Update →", exact: true }).click();
  await page
    .getByLabel("Assigned marker", { exact: true })
    .selectOption({ label: "Smoke Marker" });
  await page
    .getByLabel("Submission state", { exact: true })
    .selectOption("submitted");
  await page
    .getByLabel("Marker grade (number or grade code)", { exact: true })
    .fill("0");
  await page
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await page.getByRole("button", { name: "Update →", exact: true }).click();
  await page
    .getByLabel("Reviewer name", { exact: true })
    .fill("Smoke Reviewer");
  await page
    .getByRole("button", { name: "Approve reviewed grade", exact: true })
    .click();
  await page.getByText("Reviewed", { exact: true }).first().waitFor();
  await page.goto(`${base}/uploads`);
  await page
    .getByRole("button", { name: "Prepare batch for preview", exact: true })
    .click();
  await page.getByText("Prepared", { exact: true }).waitFor();
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download preparation CSV", exact: true })
    .click();
  const downloaded = await event;
  const file = await downloaded.path();
  const csv = fs.readFileSync(file, "utf8");
  assert.ok(csv.includes('"SMOKE001"'));
  assert.ok(csv.includes('"0"'));
  assert.ok(csv.includes('"Smoke Reviewer"'));
  saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("gradezy_workflow_v1")),
  );
  assert.equal(saved.batches.length, 1);
  assert.ok(saved.batches[0].downloadedAt);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save mapping", exact: true }).click();
  await page
    .getByLabel(/Upload confirmation reference/)
    .fill("SMOKE-ACCEPTANCE");
  await page
    .getByRole("button", { name: "Confirm accepted upload", exact: true })
    .click();
  await page.getByText("Upload confirmed", { exact: true }).waitFor();
  await page.goto(detail);
  await page.getByRole("button", { name: "Update →", exact: true }).click();
  await page
    .getByRole("button", { name: "Record grade release", exact: true })
    .click();
  await page.getByRole("button", { name: "Update →", exact: true }).click();
  await page
    .getByLabel("Marker grade (number or grade code)", { exact: true })
    .fill("70");
  await page
    .getByRole("button", { name: "Save progress", exact: true })
    .click();
  await page.goto(`${base}/uploads`);
  await page.getByText("Stale · prepare again", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Download upload file", exact: true })
      .isDisabled(),
    true,
  );
  await page.reload();
  await page.getByText("Stale · prepare again", { exact: true }).waitFor();
  await page.goto(`${base}/assistant`);
  await page
    .getByLabel("Assistant access token", { exact: true })
    .fill("not-configured");
  await page
    .getByRole("button", { name: "Ask assistant ✦", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "AI assistant is not configured" })
    .waitFor();
  await page.goto(`${base}/dashboard`);
  await page.getByRole("heading", { name: "Every assessment." }).waitFor();
  if (process.env.SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, "dashboard.png"),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(detail);
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({
      path: path.join(process.env.SCREENSHOT_DIR, "mobile.png"),
      fullPage: true,
    });
  assert.deepEqual(errors, []);
  await context.close();
  await browser.close();
  console.log(
    "Browser smoke passed: enrolment, multi-subject identity, allocation, review, CSV export, upload confirmation, release, stale batches, persistence, AI setup state and mobile layout.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
