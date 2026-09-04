"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  getAssessments,
  type StoredAssessment,
} from "@/lib/assessment-store";

export default function Dashboard() {
  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAssessments();

    const handleFocus = () => loadAssessments();

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  function loadAssessments() {
    const stored = getAssessments();

    setAssessments(stored);
    setIsLoading(false);
  }

  const stats = getStats(assessments);

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      {/* SIDEBAR */}
      <AppSidebar />

      {/* MAIN */}
      <div>
        {/* TOP BAR */}
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">
              Workspace
            </p>

            <h1 className="mt-1 text-xl font-semibold text-slate-950">
              Assessment Dashboard
            </h1>
          </div>

          <Link
            href="/assessments/new"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + New assessment
          </Link>
        </header>

        {/* CONTENT */}
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* GREETING */}
          <section>
            <p className="text-sm text-slate-500">
              Good morning
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              What needs your attention?
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Here&apos;s the current health of your assessment
              workflows.
            </p>
          </section>

          {/* STATS */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total assessments"
              value={isLoading ? "—" : String(stats.total)}
              detail={
                stats.total === 0
                  ? "No assessments created"
                  : "Across your workspace"
              }
            />

            <StatCard
              label="Ready"
              value={isLoading ? "—" : String(stats.ready)}
              detail={
                stats.ready === 0
                  ? "No assessments ready"
                  : "Ready for review"
              }
              valueClass="text-emerald-600"
            />

            <StatCard
              label="Needs review"
              value={
                isLoading
                  ? "—"
                  : String(stats.needsReview)
              }
              detail={
                stats.needsReview === 0
                  ? "Nothing needs attention"
                  : "Requires attention"
              }
              valueClass="text-amber-600"
            />

            <StatCard
              label="At risk"
              value={
                isLoading
                  ? "—"
                  : String(stats.atRisk)
              }
              detail={
                stats.atRisk === 0
                  ? "No assessments at risk"
                  : "Significant exceptions"
              }
              valueClass="text-red-600"
            />
          </section>

          {/* ASSESSMENTS */}
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Assessments
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your current assessment workflows
                </p>
              </div>

              {assessments.length > 0 && (
                <Link
                  href="/assessments"
                  className="text-sm font-medium text-slate-500 transition hover:text-indigo-600"
                >
                  View all →
                </Link>
              )}
            </div>

            {/* LOADING */}
            {isLoading && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

                  <p className="text-sm text-slate-500">
                    Loading assessments...
                  </p>
                </div>
              </div>
            )}

            {/* EMPTY STATE */}
            {!isLoading && assessments.length === 0 && (
              <EmptyAssessments />
            )}

            {/* REAL ASSESSMENTS */}
            {!isLoading && assessments.length > 0 && (
              <div className="mt-5 space-y-3">
                {assessments
                  .slice(0, 5)
                  .map((assessment) => (
                    <AssessmentCard
                      key={assessment.id}
                      assessment={assessment}
                    />
                  ))}
              </div>
            )}
          </section>

          {/* QUICK ACTION */}
          <section className="mt-12">
            <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                Start an assessment
              </p>

              <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                Bring your assessment data into Gradezy.
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-slate-500">
                Create an assessment, upload your Progress Tracker
                and let Gradezy reconcile the expected students
                against your assessment system.
              </p>

              <Link
                href="/assessments/new"
                className="mt-7 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Create assessment →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------
   STATS
------------------------------------------------------- */

function getStats(assessments: StoredAssessment[]) {
  return {
    total: assessments.length,

    ready: assessments.filter(
      (assessment) =>
        assessment.status?.toLowerCase() === "ready"
    ).length,

    needsReview: assessments.filter((assessment) => {
      const status = assessment.status?.toLowerCase();

      return (
        status === "needs review" ||
        status === "review" ||
        status === "pending"
      );
    }).length,

    atRisk: assessments.filter((assessment) => {
      const status = assessment.status?.toLowerCase();

      return (
        status === "at risk" ||
        status === "risk"
      );
    }).length,
  };
}

/* -------------------------------------------------------
   STAT CARD
------------------------------------------------------- */

function StatCard({
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
        className={`mt-3 text-3xl font-semibold ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        {detail}
      </p>
    </div>
  );
}

/* -------------------------------------------------------
   EMPTY STATE
------------------------------------------------------- */

function EmptyAssessments() {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
        <AssessmentEmptyIcon />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-slate-950">
        No assessments yet
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Create your first assessment to start bringing your
        assessment data into Gradezy and tracking its status.
      </p>

      <Link
        href="/assessments/new"
        className="mt-6 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Create your first assessment →
      </Link>
    </div>
  );
}

/* -------------------------------------------------------
   ASSESSMENT CARD
------------------------------------------------------- */

function AssessmentCard({
  assessment,
}: {
  assessment: StoredAssessment;
}) {
  const status = getAssessmentStatus(assessment);

  const statusClasses = {
    ready:
      "bg-emerald-50 text-emerald-700 border-emerald-200",

    warning:
      "bg-amber-50 text-amber-700 border-amber-200",

    danger:
      "bg-red-50 text-red-700 border-red-200",

    neutral:
      "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* INFO */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold text-slate-950">
              {assessment.name}
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[status.type]}`}
            >
              {status.label}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            {assessment.module} · {assessment.level} ·{" "}
            {assessment.cohort}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
            <span>
              Assessment type:{" "}
              <span className="text-slate-600">
                {assessment.assessmentType}
              </span>
            </span>

            <span>
              Due:{" "}
              <span className="text-slate-600">
                {formatDate(assessment.dueDate)}
              </span>
            </span>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            {getStatusDescription(assessment)}
          </p>
        </div>

        {/* ACTION */}
        <Link
          href={`/assessments/${assessment.id}`}
          className="w-full rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          {status.type === "ready"
            ? "View assessment →"
            : "Open assessment →"}
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   STATUS
------------------------------------------------------- */

function getAssessmentStatus(
  assessment: StoredAssessment
): {
  label: string;
  type: "ready" | "warning" | "danger" | "neutral";
} {
  const status = assessment.status?.toLowerCase();

  if (status === "ready") {
    return {
      label: "Ready",
      type: "ready",
    };
  }

  if (
    status === "needs review" ||
    status === "review" ||
    status === "pending"
  ) {
    return {
      label: "Needs review",
      type: "warning",
    };
  }

  if (
    status === "at risk" ||
    status === "risk"
  ) {
    return {
      label: "At risk",
      type: "danger",
    };
  }

  if (assessment.status) {
    return {
      label: assessment.status,
      type: "neutral",
    };
  }

  return {
    label: "Created",
    type: "neutral",
  };
}

/* -------------------------------------------------------
   STATUS DESCRIPTION
------------------------------------------------------- */

function getStatusDescription(
  assessment: StoredAssessment
) {
  const status = assessment.status?.toLowerCase();

  if (status === "ready") {
    return "This assessment is ready for review.";
  }

  if (
    status === "needs review" ||
    status === "review"
  ) {
    return "This assessment requires your attention.";
  }

  if (
    status === "at risk" ||
    status === "risk"
  ) {
    return "This assessment has significant exceptions.";
  }

  return "Assessment created in Gradezy.";
}

/* -------------------------------------------------------
   DATE FORMAT
------------------------------------------------------- */

function formatDate(date: string) {
  if (!date) {
    return "Not set";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------------
   EMPTY STATE ICON
------------------------------------------------------- */

function AssessmentEmptyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}