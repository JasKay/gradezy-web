"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getAllStudentProfiles,
  type StudentProfile,
} from "@/lib/student-analytics";

export default function CohortPage() {
  const params = useParams();

  const cohort = decodeURIComponent(String(params.cohort));

  const [profiles, setProfiles] = useState<StudentProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setProfiles(getAllStudentProfiles());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const students = useMemo(
    () =>
      profiles.filter((student) =>
        student.assessments.some((assessment) => assessment.cohort === cohort),
      ),
    [profiles, cohort],
  );

  const assessments = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        module: string;
        level: string;
        dueDate: string;
        grades: number[];
      }
    >();

    students.forEach((student) => {
      student.assessments
        .filter((assessment) => assessment.cohort === cohort)
        .forEach((assessment) => {
          const existing = map.get(assessment.assessmentId);

          if (existing) {
            if (assessment.grade !== undefined) {
              existing.grades.push(assessment.grade);
            }
          } else {
            map.set(assessment.assessmentId, {
              id: assessment.assessmentId,
              name: assessment.assessmentName,
              module: assessment.module,
              level: assessment.level,
              dueDate: assessment.dueDate,
              grades: assessment.grade !== undefined ? [assessment.grade] : [],
            });
          }
        });
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    );
  }, [students, cohort]);

  const gradeRecords = students.flatMap((student) =>
    student.assessments
      .filter(
        (assessment) =>
          assessment.cohort === cohort && assessment.grade !== undefined,
      )
      .map((assessment) => assessment.grade as number),
  );

  const average =
    gradeRecords.length > 0
      ? gradeRecords.reduce((sum, grade) => sum + grade, 0) /
        gradeRecords.length
      : undefined;

  const needingAttention = students.filter(
    (student) => student.indicators.length > 0,
  );

  const missingGrades = students.reduce(
    (sum, student) =>
      sum +
      student.assessments.filter(
        (assessment) =>
          assessment.cohort === cohort && assessment.gradeStatus === "missing",
      ).length,
    0,
  );

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <div>
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Students · Cohorts</p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {cohort}
            </h1>
          </div>

          <Link
            href="/students"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            All cohorts
          </Link>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* Heading */}
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Cohort overview
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              {cohort}
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Understand how this cohort is performing across its assessment
              history.
            </p>
          </section>

          {/* Health */}
          <section className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-slate-500">Cohort health</p>

                <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                  {average !== undefined
                    ? `${average.toFixed(1)}% average`
                    : "No grades yet"}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {students.length} students across {assessments.length}{" "}
                  assessment
                  {assessments.length === 1 ? "" : "s"}.
                </p>
              </div>

              <div className="max-w-sm rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                <p className="text-sm font-semibold text-indigo-700">
                  Student attention
                </p>

                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {needingAttention.length}
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-500">
                  students currently have one or more performance indicators.
                </p>
              </div>
            </div>
          </section>

          {/* Metrics */}
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Students"
              value={students.length.toLocaleString()}
              detail="Students in this cohort"
            />

            <Metric
              label="Average grade"
              value={average !== undefined ? `${average.toFixed(1)}%` : "—"}
              detail="Recorded grades"
            />

            <Metric
              label="Assessments"
              value={assessments.length.toLocaleString()}
              detail="Linked assessment records"
            />

            <Metric
              label="Missing grades"
              value={missingGrades.toLocaleString()}
              detail="Across this cohort"
              valueClass={
                missingGrades > 0 ? "text-amber-600" : "text-emerald-600"
              }
            />
          </section>

          {/* Assessment history */}
          <section className="mt-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                Assessment history
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Cohort performance
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Assessments associated with this cohort.
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
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
                        Average
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Due
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {assessments.map((assessment) => (
                      <tr
                        key={assessment.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/assessments/${assessment.id}`}
                            className="font-medium text-slate-950 hover:text-indigo-600"
                          >
                            {assessment.name}
                          </Link>
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {assessment.module}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-600">
                          {assessment.level}
                        </td>

                        <td className="px-6 py-4 text-sm font-medium text-slate-950">
                          {assessment.grades.length > 0
                            ? `${(
                                assessment.grades.reduce(
                                  (sum, grade) => sum + grade,
                                  0,
                                ) / assessment.grades.length
                              ).toFixed(1)}%`
                            : "—"}
                        </td>

                        <td className="px-6 py-4 text-sm text-slate-500">
                          {formatDate(assessment.dueDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {assessments.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-slate-400">
                  No assessment records found for this cohort.
                </div>
              )}
            </div>
          </section>

          {/* Students */}
          <section className="mt-12 pb-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                  Student records
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Students in {cohort}
                </h3>
              </div>

              <Link
                href="/students/all"
                className="text-sm font-semibold text-slate-950 hover:text-indigo-600"
              >
                View directory →
              </Link>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Student
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Student ID
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Assessments
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Average
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {students
                      .sort((a, b) =>
                        `${a.firstName} ${a.lastName}`.localeCompare(
                          `${b.firstName} ${b.lastName}`,
                        ),
                      )
                      .slice(0, 100)
                      .map((student) => (
                        <StudentRow
                          key={student.ncgId}
                          student={student}
                          cohort={cohort}
                        />
                      ))}
                  </tbody>
                </table>
              </div>

              {students.length > 100 && (
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-400">
                  Showing first 100 students.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StudentRow({
  student,
  cohort,
}: {
  student: StudentProfile;
  cohort: string;
}) {
  const records = student.assessments.filter(
    (assessment) => assessment.cohort === cohort,
  );

  const grades = records
    .filter((assessment) => assessment.grade !== undefined)
    .map((assessment) => assessment.grade as number);

  const average =
    grades.length > 0
      ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length
      : undefined;

  const critical = student.indicators.some(
    (indicator) => indicator.severity === "critical",
  );

  const attention = student.indicators.length > 0;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
      <td className="px-6 py-4">
        <Link
          href={`/students/${encodeURIComponent(student.ncgId)}`}
          className="font-medium text-slate-950 hover:text-indigo-600"
        >
          {student.firstName} {student.lastName}
        </Link>
      </td>

      <td className="px-6 py-4 text-sm text-slate-500">{student.ncgId}</td>

      <td className="px-6 py-4 text-sm text-slate-600">{records.length}</td>

      <td className="px-6 py-4 text-sm font-medium text-slate-950">
        {average !== undefined ? `${average.toFixed(1)}%` : "—"}
      </td>

      <td className="px-6 py-4">
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            critical
              ? "border-red-200 bg-red-50 text-red-700"
              : attention
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {critical ? "At risk" : attention ? "Needs attention" : "On track"}
        </span>
      </td>
    </tr>
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

function formatDate(date: string) {
  if (!date) return "Not set";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
