"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export default function SettingsPage() {
  const [email, setEmail] = useState("Assessment Team");
  useEffect(() => { const session = JSON.parse(localStorage.getItem("gradezy_session") || "{}"); if (session.email) setEmail(session.email); }, []);
  return <main className="min-h-screen bg-[#070b12] text-white lg:pl-64"><AppSidebar /><header className="min-h-20 border-b border-white/10 px-6 py-5 lg:px-10"><p className="text-sm text-slate-500">Workspace</p><h1 className="mt-1 text-xl font-semibold">Settings</h1></header><div className="mx-auto max-w-3xl px-6 py-10"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Workspace settings</p><h2 className="mt-3 text-3xl font-semibold">Assessment Team</h2><div className="mt-8 rounded-3xl border border-white/10 bg-[#0d131d] p-7"><p className="font-semibold">Signed-in workspace</p><p className="mt-2 text-sm text-slate-500">{email}</p><p className="mt-6 border-t border-white/10 pt-6 text-sm leading-6 text-slate-400">Authentication, team members, and integrations will be managed here as Gradezy moves beyond the MVP.</p></div></div></main>;
}
