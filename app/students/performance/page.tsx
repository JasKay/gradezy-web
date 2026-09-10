"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getAllStudentProfiles,
  type StudentProfile,
} from "@/lib/student-analytics";

export default function StudentPerformancePage() {
  const [students, setStudents] = useState<
    StudentProfile[]
  >([]);

  useEffect(() => {
    setStudents(getAllStudentProfiles());
  }, []);

  const stats = useMemo(() => {
    const graded = students.filter(
      (student) =>
        student.averageGrade !== undefined
    );

    const average =
      graded.length > 0
        ? graded.reduce(
            (sum, student) =>
              sum +
              (student.averageGrade || 0),
            0
          ) / graded.length
        : undefined;

    return {
      average,
      improving: students.filter(
        (student) =>
          student.trend === "improving"
      ).length,
      stable: students.filter(
        (student) =>
          student.trend === "stable"
      ).length,
      declining: students.filter(
        (student) =>
          student.trend === "declining"
      ).length,
    };
  }, [students]);

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <div>
        <header className="flex min-h-20 items-center border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">
              Students
            </p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Performance
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">

          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Student analytics
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Performance
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              See how student performance is changing across
              your assessment data.
            </p>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Average grade"
              value={
                stats.average !== undefined
                  ? `${stats.average.toFixed(1)}%`
                  : "—"
              }
              detail="Across recorded student grades"
            />

            <Metric
              label="Improving"
              value={stats.improving.toLocaleString()}
              detail="Positive performance trend"
              valueClass="text-emerald-600"
            />

            <Metric
              label="Stable"
              value={stats.stable.toLocaleString()}
              detail="No significant movement"
            />

            <Metric
              label="Declining"
              value={stats.declining.toLocaleString()}
              detail="Performance trending down"
              valueClass={
                stats.declining > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />
          </section>

          <section className="mt-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                Student performance
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Performance overview
              </h3>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Student
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Average
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Latest
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Assessments
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Trend
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map((student) => (
                      <tr
                        key={student.ncgId}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/students/${encodeURIComponent(
                              student.ncgId
                            )}`}
                            className="font-medium text-slate-950 hover:text-indigo-600"
                          >
                            {student.firstName}{" "}
                            {student.lastName}
                          </Link>

                          <p className="mt-1 text-xs text-slate-400">
                            {student.ncgId}
                          </p>
                        </td>

                        <td className="px-6 py-4 text-sm font-medium text-slate-950">
                          {student.averageGrade !==
                          undefined
                            ? `${student.averageGrade.toFixed(1)}%`
                            : "—"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {student.latestGrade !==
                          undefined
                            ? `${student.latestGrade}%`
                            : "—"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {student.completedAssessments}
                        </td>

                        <td className="px-6 py-4">
                          <TrendBadge
                            trend={student.trend}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {students.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-slate-400">
                  No student performance data available.
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}

function TrendBadge({
  trend,
}: {
  trend: StudentProfile["trend"];
}) {
  const classes =
    trend === "improving"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : trend === "declining"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : trend === "stable"
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-slate-200 bg-slate-50 text-slate-400";

  const label =
    trend === "improving"
      ? "Improving"
      : trend === "declining"
        ? "Declining"
        : trend === "stable"
          ? "Stable"
          : "Insufficient data";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
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
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        {detail}
      </p>
    </div>
  );
}