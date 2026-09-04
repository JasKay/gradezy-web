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

import { saveAssessment } from "@/lib/assessment-store";
import { AppSidebar } from "@/components/app-sidebar";

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

type StoredIssueStatuses = Record<
  string,
  StoredIssueStatus
>;

export default function ReadinessPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);

  const [assessment, setAssessment] =
    useState<Assessment | null>(null);

  const [readiness, setReadiness] =
    useState<AssessmentReadiness | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      /*
       * Load assessment directly from localStorage.
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
       * Load actual students.
       *
       * Actual data can be empty. Readiness will then
       * correctly report that reconciliation is incomplete.
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
       * Generate issues from current reconciliation data.
       */
      const generatedIssues =
        generateIssuesFromReconciliation(
          assessmentId,
          reconciliationResults
        );

      /*
       * Load saved issue workflow statuses.
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
       * Merge saved statuses onto generated issues.
       */
      const issues: Issue[] = generatedIssues.map(
        (issue) => {
          const savedStatus = storedStatuses[issue.id];

          if (!savedStatus) {
            return issue;
          }

          return {
            ...issue,
            status: savedStatus.status,
            resolvedAt: savedStatus.resolvedAt,
          };
        }
      );

      /*
       * Run readiness engine.
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

    /*
     * Do not allow publishing unless readiness is ready.
     */
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

        saveAssessment(updatedAssessment);

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

  /*
   * Loading state
   */
  if (loading) {
    return (
      <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
        <AppSidebar />

        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

            <p className="text-sm text-slate-500">
              Checking readiness...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * No assessment found
   */
  if (!assessment) {
    return (
      <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
        <AppSidebar />

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <button
            type="button"
            onClick={() =>
              router.push("/assessments")
            }
            className="mb-6 text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            ← Back to assessments
          </button>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <WarningIcon />
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
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

  /*
   * Readiness calculation failed
   */
  if (!readiness) {
    return (
      <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
        <AppSidebar
          assessment={{
            id: assessment.id,
            name: assessment.name,
            module: assessment.module,
          }}
        />

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <button
            type="button"
            onClick={() =>
              router.push(
                `/assessments/${assessment.id}/reconciliation`
              )
            }
            className="mb-6 text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            ← Back to reconciliation
          </button>

          <div className="rounded-3xl border border-red-200 bg-red-50 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <WarningIcon />
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
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

  const isReady =
    readiness.overallStatus === "ready";

  const isAtRisk =
    readiness.overallStatus === "at_risk";

  const statusLabel = getReadinessStatusLabel(
    readiness.overallStatus
  );

  /*
   * Use the readiness engine's existing status colour
   * information only for determining semantic state.
   *
   * The visual styling below follows the dashboard design.
   */
  const statusTone = isReady
    ? {
        border: "border-emerald-200",
        background: "bg-emerald-50",
        text: "text-emerald-700",
        progress: "bg-emerald-600",
        soft: "bg-emerald-100",
      }
    : isAtRisk
      ? {
          border: "border-amber-200",
          background: "bg-amber-50",
          text: "text-amber-700",
          progress: "bg-amber-500",
          soft: "bg-amber-100",
        }
      : {
          border: "border-red-200",
          background: "bg-red-50",
          text: "text-red-700",
          progress: "bg-red-600",
          soft: "bg-red-100",
        };

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar
        assessment={{
          id: assessment.id,
          name: assessment.name,
          module: assessment.module,
        }}
      />

      <div>
        {/* Header */}
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              {assessment.module} · {assessment.level} ·{" "}
              {assessment.cohort}
            </p>

            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950">
              {assessment.name}
            </h1>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/assessments/${assessment.id}/issues`
              )
            }
            className="hidden shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:block"
          >
            Review issues
          </button>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* Page heading */}
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Publication ready
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Assessment Readiness
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              {isReady
                ? "Your assessment is ready to publish. All required checks have passed."
                : isAtRisk
                  ? "Your assessment is close to ready. Review the remaining warnings before publishing."
                  : "Your assessment is not yet ready. Resolve the outstanding requirements below before publishing."}
            </p>
          </section>

          {/* Overall status */}
          <section className="mt-10">
            <div
              className={`rounded-3xl border p-7 shadow-sm ${statusTone.border} ${statusTone.background}`}
            >
              <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ${statusTone.text}`}
                    >
                      {isReady ? (
                        <CheckIcon />
                      ) : (
                        <WarningIcon />
                      )}
                    </span>

                    <p
                      className={`text-sm font-semibold uppercase tracking-[0.15em] ${statusTone.text}`}
                    >
                      Overall status
                    </p>
                  </div>

                  <p className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                    {statusLabel}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    {readiness.percentComplete}% of
                    requirements met
                  </p>
                </div>

                {/* Percentage */}
                <div
                  className={`flex h-32 w-32 shrink-0 items-center justify-center rounded-full border-8 ${statusTone.border} bg-white shadow-sm`}
                >
                  <div className="text-center">
                    <p className="text-3xl font-bold tracking-tight text-slate-950">
                      {readiness.percentComplete}
                    </p>

                    <p className="mt-1 text-xs font-medium text-slate-400">
                      complete
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-8">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-500">
                    Readiness progress
                  </span>

                  <span className={statusTone.text}>
                    {readiness.percentComplete}%
                  </span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${statusTone.progress}`}
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
            </div>
          </section>

          {/* Requirements */}
          <section className="mt-12">
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                Readiness checks
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Requirements
              </h3>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Gradezy checks these conditions before an
                assessment can be considered ready.
              </p>
            </div>

            <div className="space-y-3">
              {readiness.checks.map((check) => {
                const checkPassed =
                  check.status === "passed" ||
                  check.status === "complete" ||
                  check.status === "ready";

                const checkFailed =
                  check.status === "failed" ||
                  check.status === "blocked";

                return (
                  <div
                    key={check.type}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          checkPassed
                            ? "bg-emerald-50 text-emerald-600"
                            : checkFailed
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        <span className="text-lg">
                          {getCheckIcon(check.status)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h4 className="font-semibold text-slate-950">
                            {check.title}
                          </h4>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${
                              checkPassed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : checkFailed
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-amber-200 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {getCheckStatusLabel(
                              check.status
                            )}
                          </span>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {check.description}
                        </p>

                        {check.failureReason && (
                          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <div className="flex gap-2">
                              <span className="mt-0.5 text-red-600">
                                <WarningIcon />
                              </span>

                              <p className="text-xs leading-5 text-red-700">
                                {check.failureReason}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Critical issues */}
          {readiness.criticalIssuesRemaining > 0 && (
            <section className="mt-10">
              <div className="rounded-3xl border border-red-200 bg-red-50 p-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                    <WarningIcon />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-950">
                      {readiness.criticalIssuesRemaining}{" "}
                      Critical Issue
                      {readiness.criticalIssuesRemaining ===
                      1
                        ? ""
                        : "s"}{" "}
                      Remaining
                    </h3>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Critical issues must be resolved before
                      this assessment can be considered ready
                      for publication.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/assessments/${assessment.id}/issues`
                        )
                      }
                      className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Review critical issues →
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Ready to publish */}
          {isReady && (
            <section className="mt-10">
              <div className="flex flex-col justify-between gap-6 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-7 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckIcon />
                    </span>

                    <h3 className="font-semibold text-slate-950">
                      Ready to publish
                    </h3>
                  </div>

                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    This assessment has passed the required
                    readiness checks and can now be published
                    to instructors.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePublish}
                  className="shrink-0 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Publish assessment →
                </button>
              </div>
            </section>
          )}

          {/* Not ready */}
          {!isReady && (
            <section className="mt-10">
              <div className="flex flex-col justify-between gap-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-7 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold text-slate-950">
                    {isAtRisk
                      ? "Almost there"
                      : "Keep going"}
                  </p>

                  <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                    Review the outstanding requirements and
                    resolve the issues preventing this
                    assessment from being ready.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/assessments/${assessment.id}/issues`
                    )
                  }
                  className="shrink-0 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Review issues →
                </button>
              </div>
            </section>
          )}

          {/* Assessment context */}
          <section className="mt-12 pb-10">
            <div className="mb-5">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
                Assessment context
              </p>

              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                Assessment details
              </h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailCard
                label="Module"
                value={assessment.module}
              />

              <DetailCard
                label="Level"
                value={assessment.level}
              />

              <DetailCard
                label="Cohort"
                value={assessment.cohort}
              />

              <DetailCard
                label="Status"
                value={
                  assessment.status === "ready"
                    ? "Ready"
                    : statusLabel
                }
              />
            </div>

            {assessment.status === "ready" &&
              assessment.readyAt && (
                <p className="mt-5 text-xs text-slate-400">
                  Marked ready on{" "}
                  {new Date(
                    assessment.readyAt
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
          </section>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper components                                                          */
/* -------------------------------------------------------------------------- */

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-950">
        {value || "Not set"}
      </p>
    </div>
  );
}

function getCheckStatusLabel(
  status: string
): string {
  switch (status) {
    case "passed":
    case "complete":
    case "ready":
      return "Passed";

    case "failed":
    case "blocked":
      return "Failed";

    case "warning":
    case "at_risk":
      return "Warning";

    default:
      return "Review";
  }
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10.3 3.6-7.7 13.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7 3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
