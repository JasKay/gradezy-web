"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getStudentProfile,
  type StudentProfile,
  type StudentIndicator,
} from "@/lib/student-analytics";

export default function StudentProfilePage() {
  const params = useParams();

  const ncgId = decodeURIComponent(String(params.ncgId));

  const [student, setStudent] = useState<StudentProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStudent(getStudentProfile(ncgId));
    });
    return () => {
      cancelled = true;
    };
  }, [ncgId]);

  if (!student) {
    return (
      <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
        <AppSidebar />

        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-950">
              Student not found
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              No student record exists for this student ID.
            </p>

            <Link
              href="/students/all"
              className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              Back to students
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const latestCohort =
    student.assessments.length > 0
      ? student.assessments[student.assessments.length - 1]?.cohort
      : "";

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <div>
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Students · Student profile</p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {student.firstName} {student.lastName}
            </h1>
          </div>

          <Link
            href="/students/all"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to students
          </Link>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* Profile header */}
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="p-7">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="flex items-center gap-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-xl font-semibold text-white">
                    {student.firstName?.charAt(0).toUpperCase()}
                    {student.lastName?.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Student</p>

                    <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                      {student.firstName} {student.lastName}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      {student.ncgId}
                      {latestCohort ? ` · ${latestCohort}` : ""}
                    </p>
                  </div>
                </div>

                <Status student={student} />
              </div>
            </div>
          </section>

          {/* Metrics */}
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Average grade"
              value={
                student.averageGrade !== undefined
                  ? `${student.averageGrade.toFixed(1)}%`
                  : "—"
              }
              detail="Across recorded assessments"
            />

            <Metric
              label="Latest grade"
              value={
                student.latestGrade !== undefined
                  ? `${student.latestGrade}%`
                  : "—"
              }
              detail="Most recent recorded grade"
            />

            <Metric
              label="Completed"
              value={student.completedAssessments.toLocaleString()}
              detail="Assessments with grades"
            />

            <Metric
              label="Missing grades"
              value={student.missingGrades.toLocaleString()}
              detail="Assessments without grades"
              valueClass={
                student.missingGrades > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />
          </section>

          {/* Indicators */}
          {student.indicators.length > 0 && (
            <section className="mt-12">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-600">
                  Student attention
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Indicators
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Signals generated from the student&apos;s assessment history.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {student.indicators.map((indicator, index) => (
                  <IndicatorCard
                    key={`${indicator.type}-${index}`}
                    indicator={indicator}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Performance */}
          <section className="mt-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                Assessment history
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Performance
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                A complete view of the student&apos;s assessment records.
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Assessment
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Module
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Level
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Cohort
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Grade
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {student.assessments
                      .slice()
                      .reverse()
                      .map((assessment) => (
                        <tr
                          key={assessment.assessmentId}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4">
                            <Link
                              href={`/assessments/${assessment.assessmentId}`}
                              className="font-medium text-slate-950 hover:text-indigo-600"
                            >
                              {assessment.assessmentName}
                            </Link>
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {assessment.module}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {assessment.level}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {assessment.cohort}
                          </td>

                          <td className="px-6 py-4 text-sm font-medium text-slate-950">
                            {assessment.grade !== undefined
                              ? `${assessment.grade}%`
                              : "—"}
                          </td>

                          <td className="px-6 py-4">
                            {assessment.gradeStatus === "recorded" ? (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                Recorded
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                                Missing
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Trend */}
          <section className="mt-12 pb-10">
            <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                Performance trend
              </p>

              <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {formatTrend(student.trend)}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Based on the student&apos;s recorded assessment grades.
                  </p>
                </div>

                <Link
                  href="/students/performance"
                  className="shrink-0 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  View performance
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Status({ student }: { student: StudentProfile }) {
  const critical = student.indicators.some(
    (indicator) => indicator.severity === "critical",
  );

  if (critical) {
    return (
      <span className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
        At risk
      </span>
    );
  }

  if (student.indicators.length > 0) {
    return (
      <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
        Needs attention
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
      On track
    </span>
  );
}

function IndicatorCard({ indicator }: { indicator: StudentIndicator }) {
  const critical = indicator.severity === "critical";

  return (
    <div
      className={`rounded-2xl border p-5 ${
        critical ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          critical ? "text-red-800" : "text-amber-800"
        }`}
      >
        {indicator.title}
      </p>

      <p
        className={`mt-1 text-sm leading-6 ${
          critical ? "text-red-700/80" : "text-amber-700/80"
        }`}
      >
        {indicator.description}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  valueClass = "text-slate-950",
}: {
  label: string;
  value: string;
  detail: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>

      <p className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function formatTrend(trend: StudentProfile["trend"]) {
  switch (trend) {
    case "improving":
      return "Performance improving";

    case "declining":
      return "Performance declining";

    case "stable":
      return "Performance stable";

    default:
      return "Not enough data";
  }
}
