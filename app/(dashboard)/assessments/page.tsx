"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getAssessments, type StoredAssessment } from "@/lib/assessment-store";
import { calculateSummary, reconcileStudents, type ActualStudent, type ExpectedStudent } from "@/lib/reconciliation";
import { generateIssuesFromReconciliation } from "@/lib/issues";

type Health = StoredAssessment & { expected: number; actual: number; matched: number; issues: number };

function getHealth(assessment: StoredAssessment): Health {
  const expected = JSON.parse(localStorage.getItem(`gradezy_students_${assessment.id}`) || "[]") as ExpectedStudent[];
  const actual = JSON.parse(localStorage.getItem(`gradezy_actual_students_${assessment.id}`) || "[]") as ActualStudent[];
  const results = reconcileStudents(expected, actual);
  const statuses = JSON.parse(localStorage.getItem(`gradezy_issue_statuses_${assessment.id}`) || "{}") as Record<string, { status: string }>;
  const issues = generateIssuesFromReconciliation(assessment.id, results).filter((issue) => !["resolved", "dismissed"].includes(statuses[issue.id]?.status)).length;
  return { ...assessment, expected: expected.length, actual: actual.length, matched: calculateSummary(results).matched, issues };
}

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Health[]>([]);
  useEffect(() => setAssessments(getAssessments().map(getHealth)), []);

  return (
    <main className="min-h-screen bg-[#070b12] text-white lg:pl-64">
      <AppSidebar />
      <header className="flex min-h-20 items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10">
        <div><p className="text-sm text-slate-500">Workspace</p><h1 className="mt-1 text-xl font-semibold">Assessments</h1></div>
        <Link href="/assessments/new" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#070b12] hover:bg-slate-200">+ New assessment</Link>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Assessment operations</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Your active assessments</h2>
        <p className="mt-2 text-slate-500">Review data completeness, exceptions and release readiness.</p>
        {assessments.length === 0 ? <EmptyState /> : <AssessmentTable assessments={assessments} />}
      </div>
    </main>
  );
}

function EmptyState() {
  return <div className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center"><h3 className="text-xl font-semibold">No assessments yet</h3><p className="mt-2 text-sm text-slate-500">Create an assessment to begin reconciling student records.</p><Link href="/assessments/new" className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#070b12]">Create assessment</Link></div>;
}

function AssessmentTable({ assessments }: { assessments: Health[] }) {
  return <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0d131d]"><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-[0.12em] text-slate-600"><tr><th className="px-6 py-4">Assessment</th><th className="px-6 py-4">Students</th><th className="px-6 py-4">Matched</th><th className="px-6 py-4">Issues</th><th className="px-6 py-4">Readiness</th><th className="px-6 py-4" /></tr></thead><tbody className="divide-y divide-white/10">{assessments.map((assessment) => <tr key={assessment.id} className="hover:bg-white/[0.025]"><td className="px-6 py-5"><p className="font-semibold">{assessment.name}</p><p className="mt-1 text-sm text-slate-500">{assessment.module} · {assessment.cohort}</p></td><td className="px-6 py-5 text-sm text-slate-300">{assessment.expected || "—"} expected<br /><span className="text-slate-600">{assessment.actual} actual</span></td><td className="px-6 py-5 text-sm text-emerald-300">{assessment.matched}</td><td className="px-6 py-5 text-sm text-amber-300">{assessment.issues}</td><td className="px-6 py-5"><span className={`rounded-full border px-3 py-1 text-xs font-medium ${assessment.status === "ready" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{assessment.status === "ready" ? "Ready" : "In progress"}</span></td><td className="px-6 py-5 text-right"><Link href={`/assessments/${assessment.id}`} className="text-sm font-medium hover:text-indigo-300">Open →</Link></td></tr>)}</tbody></table></div></div>;
}
