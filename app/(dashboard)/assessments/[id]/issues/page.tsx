"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  generateIssuesFromReconciliation,
  type Issue,
  type IssueSeverity,
  type IssueStatus,
  type IssueType,
} from "@/lib/issues";
import {
  reconcileStudents,
  type ExpectedStudent,
  type ActualStudent,
} from "@/lib/reconciliation";

type Assessment = {
  id: string;
  name: string;
  module: string;
  level: string;
  cohort: string;
  assessmentType: string;
  dueDate: string;
  createdAt: string;
};

type Filter =
  | "all"
  | "critical"
  | "warning"
  | "info"
  | "open"
  | "resolved";

type StoredIssueStatus = {
  status: IssueStatus;
  resolvedAt?: string;
};

type StoredIssueStatuses = Record<string, StoredIssueStatus>;

function severityLabel(severity: IssueSeverity) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    case "info":
      return "Info";
  }
}

function typeLabel(type: IssueType) {
  switch (type) {
    case "missing_student":
      return "Student not found";
    case "missing_grade":
      return "Missing grade";
    case "unexpected_student":
      return "Unexpected student";
    case "name_mismatch":
      return "Name mismatch";
    case "duplicate_record":
      return "Duplicate record";
    case "missing_ncg_id":
      return "Missing NCG ID";
    default:
      return "Assessment issue";
  }
}

function severityClasses(severity: IssueSeverity) {
  switch (severity) {
    case "critical":
      return {
        badge: "bg-red-50 text-red-700 border-red-200",
        dot: "bg-red-500",
        icon: "text-red-600",
      };
    case "warning":
      return {
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
        icon: "text-amber-600",
      };
    case "info":
      return {
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
        icon: "text-blue-600",
      };
  }
}

function statusLabel(status: IssueStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "in_review":
      return "In review";
    case "resolved":
      return "Resolved";
    case "dismissed":
      return "Dismissed";
    default:
      return status;
  }
}

export default function IssuesPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);
  const issueStatusStorageKey = `gradezy_issue_statuses_${assessmentId}`;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedAssessment = localStorage.getItem(
        "gradezy_current_assessment"
      );

      if (storedAssessment) {
        const parsedAssessment = JSON.parse(
          storedAssessment
        ) as Assessment;

        if (parsedAssessment.id === assessmentId) {
          setAssessment(parsedAssessment);
        }
      }

      const expectedRaw = localStorage.getItem(
        `gradezy_students_${assessmentId}`
      );

      const actualRaw = localStorage.getItem(
        `gradezy_actual_students_${assessmentId}`
      );

      if (!expectedRaw) {
        setLoading(false);
        return;
      }

      const expectedStudents = JSON.parse(
        expectedRaw
      ) as ExpectedStudent[];

      const actualStudents = actualRaw
        ? (JSON.parse(actualRaw) as ActualStudent[])
        : [];

      const reconciliationResults = reconcileStudents(
        expectedStudents,
        actualStudents
      );

      const generatedIssues = generateIssuesFromReconciliation(
        assessmentId,
        reconciliationResults
      );

      /*
       * Load previously saved workflow statuses.
       *
       * We only persist mutable workflow state here rather than the
       * generated issues themselves. That means the issues can always
       * be regenerated from the latest reconciliation data.
       */
      const storedStatusesRaw = localStorage.getItem(
        issueStatusStorageKey
      );

      let storedStatuses: StoredIssueStatuses = {};

      if (storedStatusesRaw) {
        try {
          storedStatuses = JSON.parse(
            storedStatusesRaw
          ) as StoredIssueStatuses;
        } catch (statusError) {
          console.error(
            "Failed to parse saved issue statuses:",
            statusError
          );
        }
      }

      const issuesWithSavedStatuses = generatedIssues.map((issue) => {
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

      setIssues(issuesWithSavedStatuses);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load issues:", error);
      setLoading(false);
    }
  }, [assessmentId, issueStatusStorageKey]);

  const filteredIssues = useMemo(() => {
    switch (filter) {
      case "critical":
        return issues.filter(
          (issue) => issue.severity === "critical"
        );

      case "warning":
        return issues.filter(
          (issue) => issue.severity === "warning"
        );

      case "info":
        return issues.filter(
          (issue) => issue.severity === "info"
        );

      case "open":
        return issues.filter(
          (issue) =>
            issue.status === "open" ||
            issue.status === "in_review"
        );

      case "resolved":
        return issues.filter(
          (issue) =>
            issue.status === "resolved" ||
            issue.status === "dismissed"
        );

      default:
        return issues;
    }
  }, [issues, filter]);

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical"
  ).length;

  const warningCount = issues.filter(
    (issue) => issue.severity === "warning"
  ).length;

  const infoCount = issues.filter(
    (issue) => issue.severity === "info"
  ).length;

  const openCount = issues.filter(
    (issue) =>
      issue.status === "open" ||
      issue.status === "in_review"
  ).length;

  function persistIssueStatuses(updatedIssues: Issue[]) {
    const statuses: StoredIssueStatuses = {};

    updatedIssues.forEach((issue) => {
      statuses[issue.id] = {
        status: issue.status,
        ...(issue.resolvedAt
          ? { resolvedAt: issue.resolvedAt }
          : {}),
      };
    });

    try {
      localStorage.setItem(
        issueStatusStorageKey,
        JSON.stringify(statuses)
      );
    } catch (error) {
      console.error(
        "Failed to save issue statuses:",
        error
      );
    }
  }

  function updateIssueStatus(
    issueId: string,
    status: IssueStatus
  ) {
    const updatedAt =
      status === "resolved"
        ? new Date().toISOString()
        : undefined;

    setIssues((currentIssues) => {
      const updatedIssues = currentIssues.map((issue) => {
        if (issue.id !== issueId) {
          return issue;
        }

        return {
          ...issue,
          status,
          ...(updatedAt
            ? { resolvedAt: updatedAt }
            : { resolvedAt: undefined }),
        };
      });

      persistIssueStatuses(updatedIssues);

      return updatedIssues;
    });

    setSelectedIssue((currentIssue) => {
      if (!currentIssue || currentIssue.id !== issueId) {
        return currentIssue;
      }

      return {
        ...currentIssue,
        status,
        ...(updatedAt
          ? { resolvedAt: updatedAt }
          : { resolvedAt: undefined }),
      };
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8fafc] p-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse">
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-6 h-10 w-48 rounded bg-slate-200" />
            <div className="mt-3 h-5 w-80 rounded bg-slate-200" />
          </div>
        </div>
      </main>
    );
  }

  if (!assessment) {
    return (
      <main className="min-h-screen bg-[#f8fafc] p-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => router.push("/app/assessments")}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to assessments
          </button>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold text-slate-900">
              Assessment not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              We couldn't find the assessment associated with this page.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <button
              onClick={() =>
                router.push(
                  `/app/assessments/${assessmentId}/reconciliation`
                )
              }
              className="mb-5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              ← Back to reconciliation
            </button>

            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Issues
              </h1>

              {issues.length > 0 && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                  {issues.length}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Review the exceptions Gradezy found in{" "}
              <span className="font-medium text-slate-700">
                {assessment.name}
              </span>
              .
            </p>
          </div>

          <button
            onClick={() =>
              router.push(
                `/app/assessments/${assessmentId}/readiness`
              )
            }
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            View readiness →
          </button>
        </div>

        {/* Summary */}
        <section className="mt-8 grid gap-4 sm:grid-cols-4">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
              filter === "all"
                ? "border-slate-400 ring-1 ring-slate-200"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm text-slate-500">All issues</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {issues.length}
            </p>
          </button>

          <button
            onClick={() => setFilter("critical")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
              filter === "critical"
                ? "border-red-300 ring-1 ring-red-100"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm text-slate-500">Critical</p>
            <p className="mt-2 text-3xl font-semibold text-red-600">
              {criticalCount}
            </p>
          </button>

          <button
            onClick={() => setFilter("warning")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
              filter === "warning"
                ? "border-amber-300 ring-1 ring-amber-100"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm text-slate-500">Warnings</p>
            <p className="mt-2 text-3xl font-semibold text-amber-600">
              {warningCount}
            </p>
          </button>

          <button
            onClick={() => setFilter("open")}
            className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${
              filter === "open"
                ? "border-slate-400 ring-1 ring-slate-200"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm text-slate-500">Needs attention</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {openCount}
            </p>
          </button>
        </section>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap items-center gap-2">
          {[
            ["all", "All"],
            ["critical", "Critical"],
            ["warning", "Warnings"],
            ["info", "Info"],
            ["open", "Open"],
            ["resolved", "Resolved"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value as Filter)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                filter === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Issues */}
        <section className="mt-5">
          {filteredIssues.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
                ✓
              </div>

              <h2 className="mt-4 text-lg font-semibold text-slate-900">
                No issues here
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                There are no issues matching the current filter.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredIssues.map((issue) => {
                const styles = severityClasses(issue.severity);

                return (
                  <button
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex min-w-0 gap-4">
                        <div
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`}
                        />

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold text-slate-900">
                              {issue.title || typeLabel(issue.type)}
                            </h2>

                            <span
                              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles.badge}`}
                            >
                              {severityLabel(issue.severity)}
                            </span>

                            {issue.status !== "open" && (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {statusLabel(issue.status)}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm font-medium text-slate-600">
                            {typeLabel(issue.type)}
                          </p>

                          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                            {issue.description}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
                            {issue.expectedStudentNcgId && (
                              <span>
                                NCG ID:{" "}
                                <span className="font-medium text-slate-600">
                                  {issue.expectedStudentNcgId}
                                </span>
                              </span>
                            )}

                            <span>
                              Created{" "}
                              {new Date(
                                issue.createdAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="shrink-0 text-sm font-medium text-slate-500">
                        Review →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Info */}
        {infoCount > 0 && filter === "all" && (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {infoCount} informational{" "}
            {infoCount === 1 ? "issue was" : "issues were"} found.
            These do not currently prevent the assessment from being
            considered ready.
          </div>
        )}
      </div>

      {/* Issue detail drawer */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close issue details"
            onClick={() => setSelectedIssue(null)}
            className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-400">
                    Issue
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {selectedIssue.title ||
                      typeLabel(selectedIssue.type)}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedIssue(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    severityClasses(selectedIssue.severity).badge
                  }`}
                >
                  {severityLabel(selectedIssue.severity)}
                </span>

                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {statusLabel(selectedIssue.status)}
                </span>
              </div>

              {/* Student */}
              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Student
                </p>

                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {selectedIssue.description
                    .split(" · ")[0]
                    .replace("Student not found:", "")
                    .trim() ||
                    selectedIssue.expectedStudentNcgId ||
                    "Student record"}
                </p>

                {selectedIssue.expectedStudentNcgId && (
                  <p className="mt-1 text-sm text-slate-500">
                    NCG ID:{" "}
                    <span className="font-medium text-slate-700">
                      {selectedIssue.expectedStudentNcgId}
                    </span>
                  </p>
                )}
              </div>

              {/* What happened */}
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-900">
                  What happened
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedIssue.description}
                </p>
              </div>

              {/* Issue type */}
              <div className="mt-6">
                <p className="text-sm font-semibold text-slate-900">
                  Issue type
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  {typeLabel(selectedIssue.type)}
                </p>
              </div>

              {/* Recommended action */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">
                  Recommended action
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedIssue.type === "missing_student" &&
                    "Check whether the student is enrolled in the assessment system and confirm that the correct assessment or cohort is being viewed."}

                  {selectedIssue.type === "name_mismatch" &&
                    "Confirm that the student is the same person in both systems and correct the name or student identifier if necessary."}

                  {selectedIssue.type === "duplicate_record" &&
                    "Check the assessment system for duplicate student records and confirm which record should be used."}

                  {selectedIssue.type === "unexpected_student" &&
                    "Confirm whether this student should be included in the assessment. If not, check the assessment enrolment."}

                  {selectedIssue.type === "missing_grade" &&
                    "Check whether the student's grade has been entered and whether the assessment system has saved the grade correctly."}

                  {selectedIssue.type === "missing_ncg_id" &&
                    "Add or correct the student's NCG ID so Gradezy can reliably reconcile the record."}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-col gap-3">
                {selectedIssue.status !== "resolved" && (
                  <button
                    onClick={() =>
                      updateIssueStatus(
                        selectedIssue.id,
                        "resolved"
                      )
                    }
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Mark as resolved
                  </button>
                )}

                {selectedIssue.status === "open" && (
                  <button
                    onClick={() =>
                      updateIssueStatus(
                        selectedIssue.id,
                        "in_review"
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Mark as in review
                  </button>
                )}

                {selectedIssue.status !== "dismissed" && (
                  <button
                    onClick={() =>
                      updateIssueStatus(
                        selectedIssue.id,
                        "dismissed"
                      )
                    }
                    className="w-full rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    Dismiss issue
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}