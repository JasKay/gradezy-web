"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";

export default function SettingsPage() {
  const [email, setEmail] = useState("Assessment Team");

  useEffect(() => {
    const session = JSON.parse(
      localStorage.getItem("gradezy_session") || "{}"
    );

    if (session.email) {
      setEmail(session.email);
    }
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <header className="min-h-20 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
        <p className="text-sm text-slate-500">
          Workspace
        </p>

        <h1 className="mt-1 text-xl font-semibold text-slate-950">
          Settings
        </h1>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Workspace settings
        </p>

        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          Assessment Team
        </h2>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
              AT
            </div>

            <div>
              <p className="font-semibold text-slate-950">
                Signed-in workspace
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {email}
              </p>
            </div>
          </div>

          <div className="mt-7 border-t border-slate-200 pt-6">
            <p className="text-sm leading-6 text-slate-600">
              Authentication, team members, and integrations will
              be managed here as Gradezy moves beyond the MVP.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}