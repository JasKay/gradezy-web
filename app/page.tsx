const issues = [
  {
    label: "Students missing",
    value: "18",
    type: "danger",
  },
  {
    label: "Grade mismatches",
    value: "7",
    type: "warning",
  },
  {
    label: "Missing grades",
    value: "12",
    type: "warning",
  },
  {
    label: "Duplicate records",
    value: "3",
    type: "info",
  },
];

const workflow = [
  {
    number: "01",
    title: "Bring in your data",
    description:
      "Upload your Progress Tracker, spreadsheet or assessment data. Gradezy understands the student and assessment information inside it.",
  },
  {
    number: "02",
    title: "Reconcile everything",
    description:
      "Gradezy compares what you expect to see with what actually exists in your assessment system.",
  },
  {
    number: "03",
    title: "Find the exceptions",
    description:
      "Missing students, mismatched grades, duplicates, blank marks and other issues are surfaced automatically.",
  },
  {
    number: "04",
    title: "Take action",
    description:
      "Review the exceptions, populate data where appropriate and create a clear record of what needs attention.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* NAV */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#070b12]">
            G
          </div>
          <span className="text-xl font-semibold tracking-tight">Gradezy</span>
        </div>

        <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#product" className="transition hover:text-white">
            Product
          </a>
          <a href="#how-it-works" className="transition hover:text-white">
            How it works
          </a>
          <a href="#vision" className="transition hover:text-white">
            Vision
          </a>
        </div>

        <a
          href="#early-access"
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10"
        >
          Get early access
        </a>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-24 text-center lg:pt-32">
          <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Built for assessment teams
          </div>

          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-8xl">
            Assessment operations,
            <br />
            <span className="text-slate-500">without the chaos.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
            Gradezy helps assessment teams reconcile data, catch errors and
            manage exceptions across the systems they already use.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#early-access"
              className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#070b12] transition hover:bg-slate-200"
            >
              Get early access →
            </a>

            <a
              href="#product"
              className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-xs text-slate-600">
            Starting with grade reconciliation and assessment workflows.
          </p>
        </div>
      </section>

      {/* DASHBOARD */}
      <section id="product" className="mx-auto max-w-7xl px-6 pb-28 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d131d] shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
            <div>
              <p className="text-sm font-medium text-slate-400">
                Assessment Health
              </p>
              <h2 className="mt-1 text-xl font-semibold">
                BUS101 — Final Assessment
              </h2>
            </div>

            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
              94% ready
            </div>
          </div>

          <div className="grid gap-px bg-white/10 md:grid-cols-4">
            <div className="bg-[#0d131d] p-6">
              <p className="text-sm text-slate-500">Students expected</p>
              <p className="mt-3 text-3xl font-semibold">2,481</p>
            </div>

            <div className="bg-[#0d131d] p-6">
              <p className="text-sm text-slate-500">Students matched</p>
              <p className="mt-3 text-3xl font-semibold">2,463</p>
            </div>

            <div className="bg-[#0d131d] p-6">
              <p className="text-sm text-slate-500">Grades checked</p>
              <p className="mt-3 text-3xl font-semibold">2,456</p>
            </div>

            <div className="bg-[#0d131d] p-6">
              <p className="text-sm text-slate-500">Exceptions</p>
              <p className="mt-3 text-3xl font-semibold text-amber-300">40</p>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-semibold">Issues requiring attention</h3>
              <span className="text-sm text-slate-500">40 total</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {issues.map((issue) => (
                <div
                  key={issue.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        issue.type === "danger"
                          ? "bg-red-400"
                          : issue.type === "warning"
                            ? "bg-amber-400"
                            : "bg-blue-400"
                      }`}
                    />
                    <span className="text-2xl font-semibold">
                      {issue.value}
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-slate-400">
                    {issue.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/[0.02] px-6 py-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-medium">
                  Assessment is not ready for release.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  40 exceptions require review before results can be finalised.
                </p>
              </div>

              <button className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10">
                Review exceptions →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CORE IDEA */}
      <section className="border-y border-white/10 bg-[#0a0f17]">
        <div className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
              The idea
            </p>

            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Your systems have the data.
              <br />
              <span className="text-slate-500">
                Gradezy makes sense of it.
              </span>
            </h2>

            <p className="mt-6 text-lg leading-8 text-slate-400">
              Assessment information rarely lives in one place. Gradezy is
              being built to sit across that complexity and help teams
              understand what is complete, what is wrong and what needs to
              happen next.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            <FeatureCard
              icon="↔"
              title="Reconcile"
              text="Compare expected and actual students, grades, submissions and assessment data."
            />

            <FeatureCard
              icon="!"
              title="Detect"
              text="Surface missing, mismatched, duplicate, blank and unexpected records."
            />

            <FeatureCard
              icon="✓"
              title="Act"
              text="Turn exceptions into clear actions instead of another spreadsheet investigation."
            />
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
            How it works
          </p>

          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            From assessment data
            <br />
            <span className="text-slate-500">to a clear picture.</span>
          </h2>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-2">
          {workflow.map((item) => (
            <div
              key={item.number}
              className="group rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <span className="text-sm font-medium text-slate-600">
                {item.number}
              </span>

              <h3 className="mt-8 text-2xl font-semibold">{item.title}</h3>

              <p className="mt-4 max-w-lg leading-7 text-slate-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* READY */}
      <section className="mx-auto max-w-5xl px-6 pb-28 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-white/[0.03] to-transparent p-8 sm:p-12">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
              Before you release results
            </p>

            <h2 className="mt-5 max-w-2xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Ask Gradezy:
              <br />
              <span className="text-slate-500">Are we ready?</span>
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              The long-term vision is an assessment companion that checks the
              entire workflow — from student lists and submissions to grades,
              moderation and final results.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {[
                "Student records",
                "Submissions",
                "Grades",
                "Moderation",
                "Assessment rules",
                "Results",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* VISION */}
      <section id="vision" className="border-y border-white/10 bg-[#0a0f17]">
        <div className="mx-auto max-w-7xl px-6 py-28 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                Built beyond one system
              </p>

              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
                Not another system
                <br />
                <span className="text-slate-500">to replace.</span>
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
                Universities already have LMSs, student records systems,
                assessment platforms and spreadsheets. Gradezy is being built
                to work alongside them.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                "Excel",
                "Moodle",
                "Canvas",
                "Blackboard",
                "Student Records",
                "Assessment Systems",
              ].map((system) => (
                <div
                  key={system}
                  className="flex min-h-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-center text-sm text-slate-400"
                >
                  {system}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* EARLY ACCESS */}
      <section id="early-access" className="mx-auto max-w-4xl px-6 py-32 text-center lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
          Early access
        </p>

        <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">
          Assessment data shouldn't
          <br />
          <span className="text-slate-500">require detective work.</span>
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
          Gradezy is starting with grade reconciliation and growing toward a
          complete assessment operations companion.
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row">
          <input
            type="email"
            placeholder="Your work email"
            className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-white/25"
          />

          <button className="rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#070b12] transition hover:bg-slate-200">
            Join early access
          </button>
        </div>

        <p className="mt-4 text-xs text-slate-600">
          No spam. Just updates as Gradezy develops.
        </p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 px-6 py-8 text-sm text-slate-500 sm:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-black text-[#070b12]">
              G
            </div>
            <span>Gradezy</span>
          </div>

          <p>Assessment intelligence, built for the teams behind education.</p>

          <p>© {new Date().getFullYear()} Gradezy</p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-8">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-semibold">
        {icon}
      </div>

      <h3 className="mt-7 text-2xl font-semibold">{title}</h3>

      <p className="mt-4 leading-7 text-slate-400">{text}</p>
    </div>
  );
}