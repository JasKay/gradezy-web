import Link from "next/link";

const assessments = [
  {
    code: "BUS101",
    name: "Final Assessment",
    level: "Level 4",
    cohort: "Cohort 6",
    progress: 94,
    status: "Needs review",
    issues: "18 students missing · 7 grade mismatches",
    statusType: "warning",
  },
  {
    code: "COMP202",
    name: "Coursework 2",
    level: "Level 5",
    cohort: "Cohort 5",
    progress: 100,
    status: "Ready",
    issues: "No issues detected",
    statusType: "ready",
  },
  {
    code: "HSC301",
    name: "Final Assessment",
    level: "Level 6",
    cohort: "Cohort 6",
    progress: 71,
    status: "At risk",
    issues: "12 missing grades · 4 submissions missing",
    statusType: "danger",
  },
];

const stats = [
  {
    label: "Total assessments",
    value: "12",
    detail: "Across all active assessments",
  },
  {
    label: "Ready",
    value: "8",
    detail: "No outstanding issues",
  },
  {
    label: "Needs review",
    value: "3",
    detail: "Issues require attention",
  },
  {
    label: "At risk",
    value: "1",
    detail: "Significant exceptions",
  },
];

export default function Dashboard() {
  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#0a0f17] lg:block">
        <div className="flex h-full flex-col">
          {/* LOGO */}
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#070b12]">
              G
            </div>

            <span className="text-xl font-semibold tracking-tight">
              Gradezy
            </span>
          </div>

          {/* NAV */}
          <nav className="flex-1 px-4 py-6">
            <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              Workspace
            </p>

            <div className="space-y-1">
              <NavItem active label="Dashboard" icon="▦" />
              <NavItem label="Assessments" icon="□" />
              <NavItem label="Issues" icon="!" />
            </div>

            <p className="mt-10 px-3 pb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              Manage
            </p>

            <div className="space-y-1">
              <NavItem label="Settings" icon="⚙" />
            </div>
          </nav>

          {/* USER */}
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3 rounded-2xl p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-400/15 text-sm font-semibold text-indigo-300">
                K
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Assessment Team
                </p>
                <p className="truncate text-xs text-slate-600">
                  Gradezy workspace
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="lg:pl-64">
        {/* TOP BAR */}
        <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">Workspace</p>
            <h1 className="text-lg font-semibold">Assessment Dashboard</h1>
          </div>

          <Link
            href="/assessments/new"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#070b12] transition hover:bg-slate-200"
          >
            + New assessment
          </Link>
        </header>

        {/* CONTENT */}
        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* GREETING */}
          <section>
            <p className="text-sm text-slate-500">Good morning</p>

            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              What needs your attention?
            </h2>

            <p className="mt-3 max-w-2xl text-slate-400">
              Here's the current health of your assessment workflows.
            </p>
          </section>

          {/* STATS */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-[#0d131d] p-6"
              >
                <p className="text-sm text-slate-500">{stat.label}</p>

                <p className="mt-3 text-3xl font-semibold">{stat.value}</p>

                <p className="mt-2 text-xs text-slate-600">{stat.detail}</p>
              </div>
            ))}
          </section>

          {/* ASSESSMENTS */}
          <section className="mt-12">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Assessments</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Your current assessment workflows
                </p>
              </div>

              <button className="text-sm font-medium text-slate-400 transition hover:text-white">
                View all →
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {assessments.map((assessment) => (
                <AssessmentCard
                  key={assessment.code}
                  assessment={assessment}
                />
              ))}
            </div>
          </section>

          {/* QUICK ACTION */}
          <section className="mt-12">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-white/[0.025] to-transparent p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
                Start an assessment
              </p>

              <h2 className="mt-4 text-2xl font-semibold">
                Bring your assessment data into Gradezy.
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-slate-400">
                Create an assessment, upload your Progress Tracker and let
                Gradezy reconcile the expected students against your
                assessment system.
              </p>

              <Link
                href="/assessments/new"
                className="mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#070b12] transition hover:bg-slate-200"
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

function NavItem({
  label,
  icon,
  active = false,
}: {
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-500 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center text-sm">
        {icon}
      </span>

      {label}
    </button>
  );
}

function AssessmentCard({
  assessment,
}: {
  assessment: (typeof assessments)[number];
}) {
  const statusClasses = {
    ready: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    warning: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    danger: "bg-red-400/10 text-red-300 border-red-400/20",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d131d] p-6 transition hover:border-white/20">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* INFO */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold">{assessment.code}</span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                statusClasses[
                  assessment.statusType as keyof typeof statusClasses
                ]
              }`}
            >
              {assessment.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            {assessment.name} · {assessment.level} · {assessment.cohort}
          </p>

          {/* PROGRESS */}
          <div className="mt-5 max-w-xl">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Assessment health</span>

              <span className="font-medium text-slate-400">
                {assessment.progress}%
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-indigo-400"
                style={{ width: `${assessment.progress}%` }}
              />
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500">{assessment.issues}</p>
        </div>

        {/* ACTION */}
        <button className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10 sm:w-auto">
          {assessment.statusType === "ready"
            ? "View assessment →"
            : "Review →"}
        </button>
      </div>
    </div>
  );
}
