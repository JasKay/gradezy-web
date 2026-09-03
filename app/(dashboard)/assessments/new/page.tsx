"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAssessmentPage() {
  const router = useRouter();

  const [assessmentName, setAssessmentName] = useState("");
  const [module, setModule] = useState("");
  const [level, setLevel] = useState("");
  const [cohort, setCohort] = useState("");
  const [assessmentType, setAssessmentType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const isComplete =
    assessmentName &&
    module &&
    level &&
    cohort &&
    assessmentType &&
    dueDate;

  function handleCreate() {
    if (!isComplete) return;

    setCreating(true);

    const assessment = {
      id: crypto.randomUUID(),
      name: assessmentName,
      module,
      level,
      cohort,
      assessmentType,
      dueDate,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(
      "gradezy_current_assessment",
      JSON.stringify(assessment)
    );

    setTimeout(() => {
      router.push(`/assessments/${assessment.id}`);
    }, 300);
  }

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
        {/* HEADER */}
        <div className="mb-10">
          <button
            onClick={() => router.push("/")}
            className="mb-6 text-sm text-slate-500 transition hover:text-white"
          >
            ← Back to dashboard
          </button>

          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
            New assessment
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">
            Create an assessment
          </h1>

          <p className="mt-3 max-w-xl leading-7 text-slate-400">
            Set up your assessment before bringing in your student and
            assessment data.
          </p>
        </div>

        {/* FORM */}
        <div className="rounded-3xl border border-white/10 bg-[#0d131d] p-6 sm:p-8">
          <div className="space-y-7">
            <FormField label="Assessment name" required>
              <input
                value={assessmentName}
                onChange={(e) => setAssessmentName(e.target.value)}
                placeholder="e.g. Final Assessment"
                className="input"
              />
            </FormField>

            <FormField label="Module / Course" required>
              <input
                value={module}
                onChange={(e) => setModule(e.target.value)}
                placeholder="e.g. BUS101"
                className="input"
              />
            </FormField>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField label="Level" required>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="input"
                >
                  <option value="">Select level</option>
                  <option value="Level 4">Level 4</option>
                  <option value="Level 5">Level 5</option>
                  <option value="Level 6">Level 6</option>
                </select>
              </FormField>

              <FormField label="Cohort" required>
                <select
                  value={cohort}
                  onChange={(e) => setCohort(e.target.value)}
                  className="input"
                >
                  <option value="">Select cohort</option>
                  <option value="Cohort 4">Cohort 4</option>
                  <option value="Cohort 5">Cohort 5</option>
                  <option value="Cohort 6">Cohort 6</option>
                </select>
              </FormField>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField label="Assessment type" required>
                <select
                  value={assessmentType}
                  onChange={(e) => setAssessmentType(e.target.value)}
                  className="input"
                >
                  <option value="">Select type</option>
                  <option value="Coursework">Coursework</option>
                  <option value="Final Assessment">Final Assessment</option>
                  <option value="Exam">Exam</option>
                  <option value="Presentation">Presentation</option>
                  <option value="Project">Project</option>
                </select>
              </FormField>

              <FormField label="Due date" required>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="input"
                />
              </FormField>
            </div>
          </div>

          <div className="my-8 border-t border-white/10" />

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">Next: bring in your data</p>

              <p className="mt-1 text-sm text-slate-500">
                Upload your Progress Tracker after creating the assessment.
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={!isComplete || creating}
              className={`rounded-full px-6 py-3 text-sm font-semibold transition ${
                isComplete && !creating
                  ? "bg-white text-[#070b12] hover:bg-slate-200"
                  : "cursor-not-allowed bg-white/10 text-slate-600"
              }`}
            >
              {creating ? "Creating..." : "Create assessment →"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-sm font-medium">Why does Gradezy need this?</p>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            These details give Gradezy the context it needs to understand the
            data you upload and determine what should be present in the
            assessment.
          </p>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          padding: 0.8rem 1rem;
          font-size: 0.875rem;
          color: white;
          outline: none;
          transition:
            border-color 150ms ease,
            background 150ms ease;
        }

        .input::placeholder {
          color: rgb(71 85 105);
        }

        .input:focus {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.06);
        }

        select.input {
          color-scheme: dark;
        }
      `}</style>
    </main>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label}
        {required && <span className="ml-1 text-indigo-300">*</span>}
      </label>

      {children}
    </div>
  );
}
