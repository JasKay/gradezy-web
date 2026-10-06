"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  getStudentsNeedingAttention,
  type StudentProfile,
} from "@/lib/student-analytics";

export default function StudentSupportPage() {
  const [students, setStudents] = useState<StudentProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStudents(getStudentsNeedingAttention());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const critical = useMemo(
    () =>
      students.filter((student) =>
        student.indicators.some(
          (indicator) => indicator.severity === "critical",
        ),
      ),
    [students],
  );

  const missingGrades = useMemo(
    () => students.filter((student) => student.missingGrades > 0),
    [students],
  );

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <div>
        <header className="flex min-h-20 items-center border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Students</p>

            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Support
            </h1>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">
              Student support
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Students needing attention
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Focus on students with performance indicators, missing grades or
              other signals that may require follow-up.
            </p>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Need attention"
              value={students.length.toLocaleString()}
              detail="Students with indicators"
              valueClass={
                students.length > 0 ? "text-amber-600" : "text-emerald-600"
              }
            />

            <Metric
              label="At risk"
              value={critical.length.toLocaleString()}
              detail="Critical indicators"
              valueClass={
                critical.length > 0 ? "text-red-600" : "text-emerald-600"
              }
            />

            <Metric
              label="Missing grades"
              value={missingGrades.length.toLocaleString()}
              detail="Students with missing grades"
              valueClass={
                missingGrades.length > 0 ? "text-amber-600" : "text-emerald-600"
              }
            />
          </section>

          <section className="mt-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-600">
                Action queue
              </p>

              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                Students to review
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Open a student profile to understand the underlying signals.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {students.map((student) => (
                <SupportStudent key={student.ncgId} student={student} />
              ))}
            </div>

            {students.length === 0 && (
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-8">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    ✓
                  </span>

                  <div>
                    <p className="font-semibold text-slate-950">
                      No students currently flagged
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      There are no student indicators requiring attention.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SupportStudent({ student }: { student: StudentProfile }) {
  const critical = student.indicators.some(
    (indicator) => indicator.severity === "critical",
  );

  return (
    <Link
      href={`/students/${encodeURIComponent(student.ncgId)}`}
      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h4 className="font-semibold text-slate-950">
              {student.firstName} {student.lastName}
            </h4>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                critical
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {critical ? "At risk" : "Needs attention"}
            </span>
          </div>

          <p className="mt-1 text-xs text-slate-400">{student.ncgId}</p>
        </div>

        <div className="grid grid-cols-3 gap-5">
          <MiniMetric
            label="Average"
            value={
              student.averageGrade !== undefined
                ? `${student.averageGrade.toFixed(1)}%`
                : "—"
            }
          />

          <MiniMetric label="Missing" value={student.missingGrades} />

          <MiniMetric label="Indicators" value={student.indicators.length} />
        </div>

        <span className="text-sm font-semibold text-slate-950">Review →</span>
      </div>
    </Link>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>

      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
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
