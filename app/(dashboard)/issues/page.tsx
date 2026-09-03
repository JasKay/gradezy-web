"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getAssessments, type StoredAssessment } from "@/lib/assessment-store";

export default function WorkspaceIssuesPage() {
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);
  useEffect(() => setAssessments(getAssessments()), []);
  return <main className="min-h-screen bg-[#070b12] text-white lg:pl-64"><AppSidebar /><header className="flex min-h-20 items-center justify-between border-b border-white/10 px-6 py-5 lg:px-10"><div><p className="text-sm text-slate-500">Workspace</p><h1 className="mt-1 text-xl font-semibold">Issues</h1></div><Link href="/assessments" className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">View assessments</Link></header><div className="mx-auto max-w-5xl px-6 py-10"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Exception queue</p><h2 className="mt-3 text-3xl font-semibold">Review assessment issues</h2><p className="mt-2 text-slate-500">Choose an assessment to inspect and resolve its reconciliation exceptions.</p><div className="mt-8 space-y-3">{assessments.length ? assessments.map((assessment) => <Link key={assessment.id} href={`/assessments/${assessment.id}/issues`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0d131d] p-5 transition hover:border-white/20"><div><p className="font-semibold">{assessment.name}</p><p className="mt-1 text-sm text-slate-500">{assessment.module} · {assessment.cohort}</p></div><span className="text-sm text-indigo-300">Review →</span></Link>) : <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-500">No assessment issues yet.</div>}</div></div></main>;
}
