"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  reconcileStudents,
  type ReconciliationResult,
  type ExpectedStudent,
  type ActualStudent,
} from "@/lib/reconciliation";
import {
  generateIssuesFromReconciliation,
  type Issue,
  type IssueStatus,
} from "@/lib/issues";
import {
  runReadinessChecks,
  type AssessmentReadiness,
  getReadinessStatusLabel,
  getReadinessStatusColor,
  getCheckIcon,
  getCheckColor,
} from "@/lib/readiness";

type Assessment = {
  id: string;
  name: string;
  module: string;
  level: string;
  cohort: string;
  assessmentType: string;
  dueDate: string;
  createdAt: string;
  status?: string;
  readyAt?: string;
};

type StoredIssueStatus = {
  status: IssueStatus;
  resolvedAt?: string;
};

type StoredIssueStatuses = Record<string, StoredIssueStatus>;

export default function ReadinessPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [readiness, setReadiness] =
    useState<AssessmentReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      /*
       * Load assessment directly from localStorage.
       *
       * We intentionally do not depend on the assessment React state
       * here. The previous implementation could run the readiness
       * calculation before assessment had been populated.
       */
      const storedAssessment = localStorage.getItem(
        "gradezy_current_assessment"
      );

      if (!storedAssessment) {
        setLoading(false);
        return;
      }

      const parsedAssessment =
        JSON.parse(storedAssessment) as Assessment;

      if (parsedAssessment.id !== assessmentId) {
        setLoading(false);
        return;
      }

      setAssessment(parsedAssessment);

      /*
       * Load expected students.
       */
      const expectedJson = localStorage.getItem(
        `gradezy_students_${assessmentId}`
      );

      if (!expectedJson) {
        setLoading(false);
        return;
      }

      const expected: ExpectedStudent[] =
        JSON.parse(expectedJson);

      /*
       * Actual data is allowed to be empty.
       *
       * This means the readiness page can still tell the user that
       * reconciliation/data completeness is not ready yet.
       */
      const actualJson = localStorage.getItem(
        `gradezy_actual_students_${assessmentId}`
      );

      const actual: ActualStudent[] = actualJson
        ? JSON.parse(actualJson)
        : [];

      /*
       * Run reconciliation.
       */
      const reconciliationResults: ReconciliationResult[] =
        reconcileStudents(expected, actual);

      /*
       * Generate the current issues from the current reconciliation
       * data.
       */
      const generatedIssues = generateIssuesFromReconciliation(
        assessmentId,
        reconciliationResults
      );

      /*
       * Load the workflow statuses saved on the Issues page.
       *
       * We persist statuses separately from generated issues so that
       * fresh reconciliation data can always regenerate the issues.
       */
      const issueStatusKey =
        `gradezy_issue_statuses_${assessmentId}`;

      const storedStatusesJson =
        localStorage.getItem(issueStatusKey);

      let storedStatuses: StoredIssueStatuses = {};

      if (storedStatusesJson) {
        try {
          storedStatuses = JSON.parse(
            storedStatusesJson
          ) as StoredIssueStatuses;
        } catch (error) {
          console.error(
            "Failed to parse saved issue statuses:",
            error
          );
        }
      }

      /*
       * Merge saved workflow state onto newly generated issues.
       *
       * This is important because readiness should understand that an
       * issue marked as resolved on the Issues page is resolved here too.
       */
      const issues: Issue[] = generatedIssues.map((issue) => {
        const savedStatus = storedStatuses[issue.id];

        if (!savedStatus) {
          return issue;
        }

        return {
          ...issue,
          status: savedStatus.status,
          resolvedAt: savedStatus.resolvedAt,
        };
      });

      /*
       * Run the actual readiness engine.
       */
      const result = runReadinessChecks(
        parsedAssessment,
        expected.length,
        actual.length,
        reconciliationResults.length,
        issues
      );

      setReadiness(result);
      setLoading(false);
    } catch (error) {
      console.error(
        "Failed to calculate assessment readiness:",
        error
      );

      setLoading(false);
    }
  }, [assessmentId]);

  function handlePublish() {
    if (!assessment || !readiness) {
      return;
    }

    if (readiness.overallStatus !== "ready") {
      return;
    }

    try {
      const storedAssessment = localStorage.getItem(
        "gradezy_current_assessment"
      );

      if (storedAssessment) {
        const updatedAssessment: Assessment = {
          ...JSON.parse(storedAssessment),
          status: "ready",
          readyAt: new Date().toISOString(),
        };

        localStorage.setItem(
          "gradezy_current_assessment",
          JSON.stringify(updatedAssessment)
        );

        setAssessment(updatedAssessment);
      }

      router.push("/assessments");
    } catch (error) {
      console.error(
        "Failed to publish assessment:",
        error
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b12] text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white" />

          <p className="mt-4 text-sm text-slate-500">
            Checking readiness...
          </p>
        </div>
      </main>
    );
  }

  if (!assessment) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <button
            onClick={() =>
              router.push("/assessments")
            }
            className="mb-6 text-sm text-slate-500 transition hover:text-white"
          >
            ← Back to assessments
          </button>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="text-3xl font-semibold">
              No assessment found
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
              We couldn't find the assessment associated
              with this page. Return to your assessments and
              try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!readiness) {
    return (
      <main className="min-h-screen bg-[#070b12] text-white">
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <button
            onClick={() =>
              router.push(
                `/assessments/${assessment.id}/reconciliation`
              )
            }
            className="mb-6 text-sm text-slate-500 transition hover:text-white"
          >
            ← Back to reconciliation
          </button>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="text-3xl font-semibold">
              Unable to load readiness data
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
              Gradezy could not calculate readiness for this
              assessment. Check that your expected student
              data has been uploaded and try again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#0a0f17] lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#070b12]">
              G
            </div>

            <span className="text-xl font-semibold tracking-tight">
              Gradezy
            </span>
          </div>

          <div className="border-b border-white/10 px-5 py-5">
            <button
              onClick={() =>
                router.push("/assessments")
              }
              className="text-sm text-slate-500 transition hover:text-white"
            >
              ← Dashboard
            </button>

            <p className="mt-5 text-xs uppercase tracking-[0.15em] text-slate-600">
              Assessment
            </p>

            <p className="mt-2 font-semibold">
              {assessment.module}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {assessment.name}
            </p>
          </div>

          <nav className="flex-1 px-4 py-6">
            <NavItem
              label="Overview"
              href={`/assessments/${assessment.id}`}
            />

            <NavItem
              label="Reconciliation"
              href={`/assessments/${assessment.id}/reconciliation`}
            />

            <NavItem
              label="Issues"
              href={`/assessments/${assessment.id}/issues`}
            />

            <NavItem
              active
              label="Readiness"
            />
          </nav>
        </div>
      </aside>

      {/* MAIN */}
      <div className="lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-white/10 px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">
              {assessment.module} · {assessment.level} ·{" "}
              {assessment.cohort}
            </p>

            <h1 className="mt-1 text-xl font-semibold">
              {assessment.name} — Readiness Check
            </h1>
          </div>

          <button
            onClick={() =>
              router.push(
                `/assessments/${assessment.id}/issues`
              )
            }
            className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white sm:block"
          >
            Review issues
          </button>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* HEADER */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
              Publication Ready
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
              Assessment Readiness
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              {readiness.overallStatus === "ready"
                ? "Your assessment is ready to publish. All required checks have passed."
                : readiness.overallStatus === "at_risk"
                ? "Your assessment is close to ready. Review the remaining warnings before publishing."
                : "Your assessment is not yet ready. Resolve the outstanding requirements below before publishing."}
            </p>
          </div>

          {/* STATUS CARD */}
          <section className="mt-8">
            <div
              className={`rounded-3xl border p-8 ${getReadinessStatusColor(
                readiness.overallStatus
              )}`}
            >
              <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] opacity-75">
                    Overall Status
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {getReadinessStatusLabel(
                      readiness.overallStatus
                    )}
                  </p>

                  <p className="mt-2 text-sm opacity-75">
                    {readiness.percentComplete}% requirements met
                  </p>
                </div>

                {/* SCORE */}
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-8 border-current/20 opacity-75">
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {readiness.percentComplete}
                    </p>

                    <p className="text-xs">
                      complete
                    </p>
                  </div>
                </div>
              </div>

              {/* LINEAR PROGRESS */}
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-current/20">
                <div
                  className="h-full rounded-full bg-current transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        readiness.percentComplete
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          </section>

          {/* READINESS CHECKS */}
          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h3 className="font-semibold">
                  Requirements
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Gradezy checks these conditions before an
                  assessment can be considered ready.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {readiness.checks.map((check) => (
                <div
                  key={check.type}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`mt-0.5 text-2xl ${getCheckColor(
                        check.status
                      )}`}
                    >
                      {getCheckIcon(check.status)}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h4 className="font-semibold">
                          {check.title}
                        </h4>
                      </div>

                      <p className="mt-1 text-sm text-slate-400">
                        {check.description}
                      </p>

                      {check.failureReason && (
                        <div className="mt-3 rounded-xl border border-red-400/10 bg-red-400/5 px-4 py-3">
                          <p className="text-xs leading-5 text-red-300">
                            {check.failureReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CRITICAL ISSUES ALERT */}
          {readiness.criticalIssuesRemaining > 0 && (
            <section className="mt-10">
              <div className="rounded-3xl border border-red-400/20 bg-red-400/5 p-7">
                <div className="flex items-start gap-4">
                  <div className="text-2xl text-red-400">
                    ⚠
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-red-300">
                      {readiness.criticalIssuesRemaining}{" "}
                      Critical Issue
                      {readiness.criticalIssuesRemaining === 1
                        ? ""
                        : "s"}{" "}
                      Remaining
                    </h3>

                    <p className="mt-2 text-sm text-red-300/75">
                      Critical issues must be resolved before
                      this assessment can be considered ready
                      for publication.
                    </p>

                    <button
                      onClick={() =>
                        router.push(
                          `/assessments/${assessment.id}/issues`
                        )
                      }
                      className="mt-4 rounded-full border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/15"
                    >
                      Review critical issues →
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* NEXT STEPS — READY */}
          {readiness.overallStatus === "ready" && (
            <section className="mt-10">
              <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-7">
                <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-semibold text-emerald-300">
                      Ready to publish
                    </h3>

                    <p className="mt-2 max-w-xl text-sm text-emerald-300/75">
                      This assessment has passed the required
                      readiness checks and can now be published
                      to instructors.
                    </p>
                  </div>

                  <button
                    onClick={handlePublish}
                    className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                  >
                    Publish →
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* NEXT STEPS — NOT READY */}
          {readiness.overallStatus !== "ready" && (
            <section className="mt-10 flex flex-col justify-between gap-5 rounded-3xl border border-indigo-400/15 bg-indigo-400/[0.04] p-7 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold">
                  {readiness.overallStatus === "at_risk"
                    ? "Almost there"
                    : "Keep going"}
                </p>

                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Review the outstanding requirements and
                  resolve the issues preventing this assessment
                  from being ready.
                </p>
              </div>

              <button
                onClick={() =>
                  router.push(
                    `/assessments/${assessment.id}/issues`
                  )
                }
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#070b12] transition hover:bg-slate-200"
              >
                Review issues →
              </button>
            </section>
          )}

          {/* FOOTER CONTEXT */}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
            <span>
              Assessment: {assessment.name}
            </span>

            <span>
              {assessment.level}
            </span>

            <span>
              {assessment.cohort}
            </span>

            {assessment.status === "ready" &&
              assessment.readyAt && (
                <span>
                  Marked ready{" "}
                  {new Date(
                    assessment.readyAt
                  ).toLocaleDateString()}
                </span>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}

function NavItem({
  label,
  href,
  active = false,
}: {
  label: string;
  href?: string;
  active?: boolean;
}) {
  if (active) {
    return (
      <button
        className="mb-1 w-full rounded-xl bg-white/10 px-3 py-2.5 text-left text-sm text-white transition"
      >
        {label}
      </button>
    );
  }

  return (
    <a
      href={href}
      className="mb-1 block rounded-xl px-3 py-2.5 text-left text-sm text-slate-500 transition hover:bg-white/5 hover:text-white"
    >
      {label}
    </a>
  );
}
