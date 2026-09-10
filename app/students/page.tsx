"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getAllStudentProfiles,
  type StudentProfile,
} from "@/lib/student-analytics";

type CohortSummary = {
  cohort: string;
  students: StudentProfile[];
  assessmentCount: number;
  averageGrade?: number;
  needingAttention: number;
  missingGrades: number;
  latestAssessmentDate?: string;
};

export default function StudentsPage() {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfiles(getAllStudentProfiles());
    setLoading(false);
  }, []);

  const cohorts = useMemo(
    () => buildCohortSummaries(profiles),
    [profiles]
  );

  const totalStudents = profiles.length;

  const studentsNeedingAttention = profiles.filter(
    (student) => student.indicators.length > 0
  ).length;

  const studentsWithGrades = profiles.filter(
    (student) => student.averageGrade !== undefined
  );

  const overallAverage =
    studentsWithGrades.length > 0
      ? studentsWithGrades.reduce(
          (sum, student) =>
            sum + (student.averageGrade || 0),
          0
        ) / studentsWithGrades.length
      : undefined;

  const totalMissingGrades = profiles.reduce(
    (sum, student) => sum + student.missingGrades,
    0
  );

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <div>
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">
              Students
            </p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Cohorts
            </h1>
          </div>

          <Link
            href="/students/all"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View all students
          </Link>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">

          {/* Heading */}
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Student overview
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Student cohorts
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Start with a cohort to understand student
              performance, identify students needing
              attention and explore assessment outcomes.
            </p>
          </section>

          {/* Summary */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Students"
              value={
                loading
                  ? "—"
                  : totalStudents.toLocaleString()
              }
              detail="Across all available cohorts"
            />

            <Metric
              label="Cohorts"
              value={
                loading
                  ? "—"
                  : cohorts.length.toLocaleString()
              }
              detail="Detected from assessment data"
            />

            <Metric
              label="Average grade"
              value={
                overallAverage !== undefined
                  ? `${overallAverage.toFixed(1)}%`
                  : "—"
              }
              detail="Across recorded grades"
            />

            <Metric
              label="Need attention"
              value={
                loading
                  ? "—"
                  : studentsNeedingAttention.toLocaleString()
              }
              detail={`${totalMissingGrades} missing grades`}
              valueClass={
                studentsNeedingAttention > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />
          </section>

          {/* Cohorts */}
          <section className="mt-12">

            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                  Cohort workspace
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Your cohorts
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Select a cohort to explore its students and
                  performance.
                </p>
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : cohorts.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {cohorts.map((cohort) => (
                  <CohortCard
                    key={cohort.cohort}
                    cohort={cohort}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Quick actions */}
          <section className="mt-12 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-8 shadow-sm">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                  Student workspace
                </p>

                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  Explore students beyond cohorts
                </h3>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Use the student directory for individual
                  records, performance for cross-cohort
                  analysis, or support for students requiring
                  attention.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/students/all"
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  All students
                </Link>

                <Link
                  href="/students/support"
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Student support
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Cohort helpers                                                             */
/* -------------------------------------------------------------------------- */

function buildCohortSummaries(
  profiles: StudentProfile[]
): CohortSummary[] {
  const map = new Map<
    string,
    StudentProfile[]
  >();

  profiles.forEach((student) => {
    const cohorts = new Set(
      student.assessments
        .map((assessment) =>
          assessment.cohort.trim()
        )
        .filter(Boolean)
    );

    cohorts.forEach((cohort) => {
      const existing = map.get(cohort) || [];
      existing.push(student);
      map.set(cohort, existing);
    });
  });

  return Array.from(map.entries())
    .map(([cohort, students]) => {
      const assessmentIds = new Set<string>();

      let latestAssessmentDate:
        | string
        | undefined;

      let gradeTotal = 0;
      let gradeCount = 0;

      students.forEach((student) => {
        student.assessments
          .filter(
            (assessment) =>
              assessment.cohort === cohort
          )
          .forEach((assessment) => {
            assessmentIds.add(
              assessment.assessmentId
            );

            if (
              assessment.dueDate &&
              (!latestAssessmentDate ||
                new Date(assessment.dueDate) >
                  new Date(latestAssessmentDate))
            ) {
              latestAssessmentDate =
                assessment.dueDate;
            }

            if (assessment.grade !== undefined) {
              gradeTotal += assessment.grade;
              gradeCount += 1;
            }
          });
      });

      return {
        cohort,
        students,
        assessmentCount: assessmentIds.size,
        averageGrade:
          gradeCount > 0
            ? gradeTotal / gradeCount
            : undefined,
        needingAttention: students.filter(
          (student) =>
            student.indicators.length > 0
        ).length,
        missingGrades: students.reduce(
          (sum, student) =>
            sum +
            student.assessments.filter(
              (assessment) =>
                assessment.cohort === cohort &&
                assessment.gradeStatus === "missing"
            ).length,
          0
        ),
        latestAssessmentDate,
      };
    })
    .sort((a, b) => {
      if (
        a.latestAssessmentDate &&
        b.latestAssessmentDate
      ) {
        return (
          new Date(b.latestAssessmentDate).getTime() -
          new Date(a.latestAssessmentDate).getTime()
        );
      }

      return a.cohort.localeCompare(b.cohort);
    });
}

/* -------------------------------------------------------------------------- */
/* UI                                                                         */
/* -------------------------------------------------------------------------- */

function CohortCard({
  cohort,
}: {
  cohort: CohortSummary;
}) {
  return (
    <Link
      href={`/students/cohorts/${encodeURIComponent(
        cohort.cohort
      )}`}
      className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600">
            Cohort
          </p>

          <h4 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {cohort.cohort}
          </h4>
        </div>

        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition group-hover:bg-slate-100">
          →
        </span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <SmallStat
          label="Students"
          value={cohort.students.length}
        />

        <SmallStat
          label="Assessments"
          value={cohort.assessmentCount}
        />

        <SmallStat
          label="Average"
          value={
            cohort.averageGrade !== undefined
              ? `${cohort.averageGrade.toFixed(1)}%`
              : "—"
          }
        />

        <SmallStat
          label="Attention"
          value={cohort.needingAttention}
          warning={
            cohort.needingAttention > 0
          }
        />
      </div>

      {cohort.missingGrades > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800">
            {cohort.missingGrades} missing grade
            {cohort.missingGrades === 1
              ? ""
              : "s"}
          </p>
        </div>
      )}

      <p className="mt-6 text-sm font-semibold text-slate-950">
        Open cohort →
      </p>
    </Link>
  );
}

function SmallStat({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string | number;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-lg font-semibold ${
          warning
            ? "text-amber-600"
            : "text-slate-950"
        }`}
      >
        {value}
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

function LoadingState() {
  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

      <p className="mt-4 text-sm text-slate-500">
        Loading student data...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <span className="text-xl">○</span>
      </div>

      <h4 className="mt-5 text-lg font-semibold text-slate-950">
        No student cohorts yet
      </h4>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Cohorts will appear here once student data has
        been imported through an assessment.
      </p>

      <Link
        href="/assessments"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        View assessments
      </Link>
    </div>
  );
}