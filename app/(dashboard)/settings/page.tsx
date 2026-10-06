"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { readWorkflow, saveWorkflow, recordActivity } from "@/lib/workflow";
import { populatePracticeData, removePracticeData } from "@/lib/practice-workspace";

export default function SettingsPage() {
  const [email, setEmail] = useState("Assessment Team");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const session = JSON.parse(localStorage.getItem("gradezy_session") || "{}");
      if (session.email) setEmail(session.email);
    });
    return () => { cancelled = true; };
  }, []);

  function practice(remove: boolean) {
    try {
      const current = readWorkflow(localStorage);
      const next = remove ? removePracticeData(current) : populatePracticeData(current);
      recordActivity(next, remove ? "Removed practice workbook records." : "Loaded practice workbook records.");
      saveWorkflow(next, localStorage);
      localStorage.setItem("gradezy_practice_opt_out", remove ? "true" : "false");
      setNotice(remove ? "Practice records removed. Your own records are preserved." : "Practice records are ready. Open Overview or the trackers to explore them.");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the workspace.");
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />
      <header className="min-h-20 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
        <p className="text-sm text-slate-500">Workspace</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-950">Settings</h1>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="text-2xl font-semibold">Assessment Team</h2>
        <p className="mt-2 text-sm text-slate-500">{email}</p>
        <section className="mt-6 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold">Practice workbooks</h2>
          <p className="mt-2 text-sm text-slate-600">Explore fictional students, module trackers and marking records. Your own entries stay intact.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="wf-button primary" onClick={() => practice(false)}>Load practice records</button>
            <button className="wf-button" onClick={() => practice(true)}>Remove practice records</button>
          </div>
          {notice && <p role="status" className="mt-4 text-sm text-green-700">{notice}</p>}
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </section>
      </div>
    </main>
  );
}
