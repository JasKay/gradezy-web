"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type AssessmentInfo = {
  id: string;
  name: string;
  module: string;
};

export function AppSidebar({
  assessment,
}: {
  assessment?: AssessmentInfo;
}) {
  const pathname = usePathname();

  const isDashboard =
    pathname === "/" || pathname === "/dashboard";

  const isAssessments =
    pathname === "/assessments" ||
    pathname === "/assessments/new" ||
    pathname.startsWith("/assessments/");

  const isSettings = pathname === "/settings";

  const isCurrentAssessment =
    assessment &&
    pathname.startsWith(`/assessments/${assessment.id}`);

  const [assessmentExpanded, setAssessmentExpanded] =
    useState(isAssessments);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
      <div className="flex h-full flex-col">

        {/* LOGO */}
        <Link
          href="/dashboard"
          className="flex h-20 items-center gap-3 border-b border-slate-200 px-6"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
            G
          </span>

          <span className="text-xl font-semibold tracking-tight text-slate-950">
            Gradezy
          </span>
        </Link>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto px-4 py-6">

          {/* WORKSPACE */}
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>

          <div className="space-y-1">

            {/* DASHBOARD */}
            <SidebarLink
              href="/dashboard"
              active={isDashboard}
              icon={<DashboardIcon />}
            >
              Dashboard
            </SidebarLink>

            {/* ASSESSMENTS */}
            <div>
              <button
                type="button"
                onClick={() =>
                  setAssessmentExpanded(
                    (value) => !value
                  )
                }
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isAssessments
                    ? "bg-slate-100 text-slate-950"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center">
                  <AssessmentIcon />
                </span>

                <span className="flex-1 text-left">
                  Assessments
                </span>

                <ChevronIcon
                  open={assessmentExpanded}
                />
              </button>

              {assessmentExpanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-3">

                  <SidebarLink
                    href="/assessments"
                    active={
                      pathname === "/assessments"
                    }
                    icon={<ListIcon />}
                    compact
                  >
                    All assessments
                  </SidebarLink>

                  <SidebarLink
                    href="/assessments/new"
                    active={
                      pathname === "/assessments/new"
                    }
                    icon={<PlusIcon />}
                    compact
                  >
                    New assessment
                  </SidebarLink>

                </div>
              )}
            </div>

            {/* SETTINGS */}
            <SidebarLink
              href="/settings"
              active={isSettings}
              icon={<SettingsIcon />}
            >
              Settings
            </SidebarLink>

          </div>

          {/* CURRENT ASSESSMENT */}
          {assessment && isCurrentAssessment && (
            <div className="mt-9">

              <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Current assessment
              </p>

              {/* ASSESSMENT NAME */}
              <div className="mx-3 mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {assessment.name}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {assessment.module}
                </p>
              </div>

              {/* ASSESSMENT NAV */}
              <div className="space-y-1">

                <SidebarLink
                  href={`/assessments/${assessment.id}`}
                  active={
                    pathname ===
                    `/assessments/${assessment.id}`
                  }
                  icon={<OverviewIcon />}
                  compact
                >
                  Overview
                </SidebarLink>

                <SidebarLink
                  href={`/assessments/${assessment.id}/reconciliation`}
                  active={
                    pathname ===
                    `/assessments/${assessment.id}/reconciliation`
                  }
                  icon={<ReconciliationIcon />}
                  compact
                >
                  Reconciliation
                </SidebarLink>

                <SidebarLink
                  href={`/assessments/${assessment.id}/issues`}
                  active={
                    pathname ===
                    `/assessments/${assessment.id}/issues`
                  }
                  icon={<IssuesIcon />}
                  compact
                >
                  Issues
                </SidebarLink>

                <SidebarLink
                  href={`/assessments/${assessment.id}/readiness`}
                  active={
                    pathname ===
                    `/assessments/${assessment.id}/readiness`
                  }
                  icon={<ReadinessIcon />}
                  compact
                >
                  Readiness
                </SidebarLink>

              </div>
            </div>
          )}

        </nav>

        {/* FOOTER */}
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-xl px-3 py-2">
            <p className="text-xs font-medium text-slate-700">
              Assessment Team
            </p>

            <p className="mt-1 text-[11px] text-slate-400">
              Gradezy workspace
            </p>
          </div>
        </div>

      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  children,
  compact = false,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl text-sm transition ${
        compact
          ? "px-3 py-2"
          : "px-3 py-2.5"
      } ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>

      <span>{children}</span>
    </Link>
  );
}

/* ---------------- Icons ---------------- */

function DashboardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AssessmentIcon() {
  return (
    <svg
      width="18"
      height="18"
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
      <path d="M9 16h6" />
    </svg>
  );
}

function IssuesIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.6 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.6-1H6v-2.6h.4A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V5h2.6v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.4V14h-.4a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function OverviewIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function ReconciliationIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h13" />
      <path d="m12 3 4 4-4 4" />
      <path d="M21 17H8" />
      <path d="m12 13-4 4 4 4" />
    </svg>
  );
}

function ReadinessIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function ChevronIcon({
  open,
}: {
  open: boolean;
}) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}