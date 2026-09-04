"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  getAssessments,
  type StoredAssessment,
} from "@/lib/assessment-store";

export default function WorkspaceIssuesPage() {
  const [assessments, setAssessments] = useState<
    StoredAssessment[]
  >([]);

  useEffect(() => {
    setAssessments(getAssessments());
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
            Issues
          </h1>
        </div>

        <Link
          href="/assessments"
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View assessments
        </Link>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Exception queue
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          Review assessment issues
        </h2>

        <p className="mt-2 text-slate-500">
          Choose an assessment to inspect and resolve its
          reconciliation exceptions.
        </p>

        <div className="mt-8 space-y-3">
          {assessments.length ? (
            assessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`/assessments/${assessment.id}/issues`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {assessment.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {assessment.module} · {assessment.cohort}
                  </p>
                </div>

                <span className="text-sm font-medium text-indigo-600">
                  Review →
                </span>
              </Link>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
              <p className="text-sm text-slate-500">
                No assessment issues yet.
              </p>

              <Link
                href="/assessments/new"
                className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Create assessment
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}