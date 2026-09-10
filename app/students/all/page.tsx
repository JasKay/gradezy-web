"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getAllStudentProfiles,
  type StudentProfile,
} from "@/lib/student-analytics";

type Filter = "all" | "attention" | "risk" | "missing";

export default function AllStudentsPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<Filter>("all");

  useEffect(() => {
    setStudents(getAllStudentProfiles());
  }, []);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        `${student.firstName} ${student.lastName}`
          .toLowerCase()
          .includes(query) ||
        student.ncgId
          .toLowerCase()
          .includes(query);

      if (!matchesSearch) return false;

      if (filter === "attention") {
        return student.indicators.length > 0;
      }

      if (filter === "risk") {
        return student.indicators.some(
          (indicator) =>
            indicator.severity === "critical"
        );
      }

      if (filter === "missing") {
        return student.missingGrades > 0;
      }

      return true;
    });
  }, [students, search, filter]);

  const attentionCount = students.filter(
    (student) => student.indicators.length > 0
  ).length;

  const riskCount = students.filter((student) =>
    student.indicators.some(
      (indicator) =>
        indicator.severity === "critical"
    )
  ).length;

  const missingCount = students.filter(
    (student) => student.missingGrades > 0
  ).length;

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <div>
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">
              Students
            </p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              All students
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">

          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Student directory
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              All students
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Search and review individual student records
              across your assessment data.
            </p>
          </section>

          {/* Stats */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Students"
              value={students.length.toLocaleString()}
              detail="All student records"
            />

            <Metric
              label="Need attention"
              value={attentionCount.toLocaleString()}
              detail="One or more indicators"
              valueClass={
                attentionCount > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />

            <Metric
              label="At risk"
              value={riskCount.toLocaleString()}
              detail="Critical indicators"
              valueClass={
                riskCount > 0
                  ? "text-red-600"
                  : "text-emerald-600"
              }
            />

            <Metric
              label="Missing grades"
              value={missingCount.toLocaleString()}
              detail="Students with missing grades"
              valueClass={
                missingCount > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />
          </section>

          {/* Directory */}
          <section className="mt-12">

            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                  Directory
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Student records
                </h3>
              </div>

              <div className="relative w-full md:max-w-sm">
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search name or student ID..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="mt-5 flex flex-wrap gap-2">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </FilterButton>

              <FilterButton
                active={filter === "attention"}
                onClick={() => setFilter("attention")}
              >
                Need attention
              </FilterButton>

              <FilterButton
                active={filter === "risk"}
                onClick={() => setFilter("risk")}
              >
                At risk
              </FilterButton>

              <FilterButton
                active={filter === "missing"}
                onClick={() => setFilter("missing")}
              >
                Missing grades
              </FilterButton>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
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
                        Missing
                      </th>

                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Status
                      </th>

                      <th className="px-6 py-4" />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStudents.map(
                      (student) => (
                        <StudentRow
                          key={student.ncgId}
                          student={student}
                        />
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {filteredStudents.length === 0 && (
                <div className="px-6 py-14 text-center">
                  <h4 className="text-sm font-semibold text-slate-950">
                    No students found
                  </h4>

                  <p className="mt-1 text-sm text-slate-500">
                    Try changing your search or filter.
                  </p>
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
}: {
  student: StudentProfile;
}) {
  const critical = student.indicators.some(
    (indicator) =>
      indicator.severity === "critical"
  );

  const needsAttention =
    student.indicators.length > 0;

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">

      <td className="px-6 py-4">
        <Link
          href={`/students/${encodeURIComponent(
            student.ncgId
          )}`}
          className="font-medium text-slate-950 hover:text-indigo-600"
        >
          {student.firstName} {student.lastName}
        </Link>
      </td>

      <td className="px-6 py-4 text-sm text-slate-500">
        {student.ncgId}
      </td>

      <td className="px-6 py-4 text-sm text-slate-600">
        {student.completedAssessments}
      </td>

      <td className="px-6 py-4 text-sm font-medium text-slate-950">
        {student.averageGrade !== undefined
          ? `${student.averageGrade.toFixed(1)}%`
          : "—"}
      </td>

      <td className="px-6 py-4 text-sm text-slate-600">
        {student.missingGrades || "—"}
      </td>

      <td className="px-6 py-4">
        {critical ? (
          <StatusBadge
            label="At risk"
            type="risk"
          />
        ) : needsAttention ? (
          <StatusBadge
            label="Needs attention"
            type="attention"
          />
        ) : (
          <StatusBadge
            label="On track"
            type="good"
          />
        )}
      </td>

      <td className="px-6 py-4 text-right">
        <Link
          href={`/students/${encodeURIComponent(
            student.ncgId
          )}`}
          className="text-sm font-semibold text-slate-950 hover:text-indigo-600"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({
  label,
  type,
}: {
  label: string;
  type: "good" | "attention" | "risk";
}) {
  const classes =
    type === "risk"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "attention"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
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