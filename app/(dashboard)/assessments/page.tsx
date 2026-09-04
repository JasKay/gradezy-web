"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  getAssessments,
  type StoredAssessment,
} from "@/lib/assessment-store";
import {
  calculateSummary,
  reconcileStudents,
  type ActualStudent,
  type ExpectedStudent,
} from "@/lib/reconciliation";
import { generateIssuesFromReconciliation } from "@/lib/issues";

type Health = StoredAssessment & {
  expected: number;
  actual: number;
  matched: number;
  issues: number;
};

function getHealth(assessment: StoredAssessment): Health {
  const expected = JSON.parse(
    localStorage.getItem(`gradezy_students_${assessment.id}`) || "[]"
  ) as ExpectedStudent[];

  const actual = JSON.parse(
    localStorage.getItem(
      `gradezy_actual_students_${assessment.id}`
    ) || "[]"
  ) as ActualStudent[];

  const results = reconcileStudents(expected, actual);

  const statuses = JSON.parse(
    localStorage.getItem(
      `gradezy_issue_statuses_${assessment.id}`
    ) || "{}"
  ) as Record<string, { status: string }>;

  const issues = generateIssuesFromReconciliation(
    assessment.id,
    results
  ).filter(
    (issue) =>
      !["resolved", "dismissed"].includes(
        statuses[issue.id]?.status
      )
  ).length;

  return {
    ...assessment,
    expected: expected.length,
    actual: actual.length,
    matched: calculateSummary(results).matched,
    issues,
  };
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Health[]>([]);

  useEffect(() => {
    setAssessments(getAssessments().map(getHealth));
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
        <div>
          <p className="text-sm text-slate-500">
            Workspace
          </p>

          <h1 className="mt-1 text-xl font-semibold text-slate-950">
            Assessments
          </h1>
        </div>

        <Link
          href="/assessments/new"
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          + New assessment
        </Link>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Assessment operations
        </p>

        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
          Your active assessments
        </h2>

        <p className="mt-2 text-slate-500">
          Review data completeness, exceptions and release readiness.
        </p>

        {assessments.length === 0 ? (
          <EmptyState />
        ) : (
          <AssessmentTable assessments={assessments} />
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400">
        <AssessmentEmptyIcon />
      </div>

      <h3 className="mt-5 text-xl font-semibold text-slate-950">
        No assessments yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Create an assessment to begin reconciling student records.
      </p>

      <Link
        href="/assessments/new"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Create assessment
      </Link>
    </div>
  );
}

function AssessmentTable({
  assessments,
}: {
  assessments: Health[];
}) {
  return (
    <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-6 py-4">Assessment</th>
              <th className="px-6 py-4">Students</th>
              <th className="px-6 py-4">Matched</th>
              <th className="px-6 py-4">Issues</th>
              <th className="px-6 py-4">Readiness</th>
              <th className="px-6 py-4" />
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {assessments.map((assessment) => (
              <tr
                key={assessment.id}
                className="transition hover:bg-slate-50"
              >
                <td className="px-6 py-5">
                  <p className="font-semibold text-slate-950">
                    {assessment.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {assessment.module} · {assessment.cohort}
                  </p>
                </td>

                <td className="px-6 py-5 text-sm text-slate-700">
                  {assessment.expected || "—"} expected
                  <br />
                  <span className="text-slate-400">
                    {assessment.actual} actual
                  </span>
                </td>

                <td className="px-6 py-5 text-sm font-medium text-emerald-600">
                  {assessment.matched}
                </td>

                <td className="px-6 py-5 text-sm font-medium text-amber-600">
                  {assessment.issues}
                </td>

                <td className="px-6 py-5">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      assessment.status === "ready"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {assessment.status === "ready"
                      ? "Ready"
                      : "In progress"}
                  </span>
                </td>

                <td className="px-6 py-5 text-right">
                  <Link
                    href={`/assessments/${assessment.id}`}
                    className="text-sm font-semibold text-slate-700 transition hover:text-indigo-600"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AssessmentEmptyIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}