"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { saveAssessment } from "@/lib/assessment-store";

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

    saveAssessment(assessment);

    setTimeout(() => {
      router.push(`/assessments/${assessment.id}`);
    }, 300);
  }

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar />

      <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
        <div>
          <p className="text-sm text-slate-500">
            Workspace
          </p>

          <h1 className="mt-1 text-xl font-semibold text-slate-950">
            New assessment
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push("/assessments")}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
        <div className="mb-10">
          <button
            onClick={() => router.push("/dashboard")}
            className="mb-6 text-sm text-slate-500 transition hover:text-slate-950"
          >
            ← Back to dashboard
          </button>

          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Assessment setup
          </p>

          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em] text-slate-950">
            Create an assessment
          </h2>

          <p className="mt-3 max-w-xl leading-7 text-slate-500">
            Set up your assessment before bringing in your student
            and assessment data.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-7">

            <FormField label="Assessment name" required>
              <input
                value={assessmentName}
                onChange={(e) =>
                  setAssessmentName(e.target.value)
                }
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
                  onChange={(e) =>
                    setAssessmentType(e.target.value)
                  }
                  className="input"
                >
                  <option value="">Select type</option>
                  <option value="Coursework">Coursework</option>
                  <option value="Final Assessment">
                    Final Assessment
                  </option>
                  <option value="Exam">Exam</option>
                  <option value="Presentation">
                    Presentation
                  </option>
                  <option value="Project">Project</option>
                </select>
              </FormField>

              <FormField label="Due date" required>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) =>
                    setDueDate(e.target.value)
                  }
                  className="input"
                />
              </FormField>
            </div>
          </div>

          <div className="my-8 border-t border-slate-200" />

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium text-slate-950">
                Next: bring in your data
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Upload your Progress Tracker after creating the
                assessment.
              </p>
            </div>

            <button
              onClick={handleCreate}
              disabled={!isComplete || creating}
              className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
                isComplete && !creating
                  ? "bg-slate-950 text-white hover:bg-slate-800"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              {creating
                ? "Creating..."
                : "Create assessment →"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-medium text-slate-950">
            Why does Gradezy need this?
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            These details give Gradezy the context it needs to
            understand the data you upload and determine what
            should be present in the assessment.
          </p>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0.8rem 1rem;
          font-size: 0.875rem;
          color: rgb(15 23 42);
          outline: none;
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease;
        }

        .input::placeholder {
          color: rgb(148 163 184);
        }

        .input:focus {
          border-color: rgb(129 140 248);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        select.input {
          color-scheme: light;
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
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-indigo-600">
            *
          </span>
        )}
      </label>

      {children}
    </div>
  );
}