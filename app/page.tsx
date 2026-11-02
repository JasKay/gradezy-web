import Link from "next/link";

const systems = [
  { number: "01", name: "Moodle", role: "Collect assessment grades", description: "Bring module-by-campus exports into one workflow." },
  { number: "02", name: "Excel", role: "Match and reconcile", description: "Replace repetitive Flash Fill and XLOOKUP with reviewable matching." },
  { number: "03", name: "SharePoint", role: "Prepare tracker updates", description: "Review changes to your Progress Tracker before applying them." },
  { number: "04", name: "StaffAdvantage", role: "Prepare final grade entry", description: "Get validated records ready for partnership reporting." },
];
const steps = [
  { title: "Bring in your files", detail: "Upload Moodle exports and the latest Progress Tracker." },
  { title: "Match the records", detail: "Extract student IDs, reconcile Turnitin IDs and detect duplicates." },
  { title: "Review exceptions", detail: "Resolve mismatches before any tracker is changed." },
  { title: "Export with confidence", detail: "Download a reviewed workbook for your existing workflow." },
];
export default function Home() {
  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#070b12]">G</span>
          <span className="text-xl font-semibold tracking-tight">Gradezy</span>
        </Link>
        <div className="hidden gap-8 text-sm text-slate-400 md:flex">
          <a href="#workflow" className="hover:text-white">Workflow</a>
          <a href="#integrations" className="hover:text-white">Four systems</a>
          <a href="#principles" className="hover:text-white">How it works</a>
        </div>
        <Link href="/tools/tracker-sync" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white/10">Open Gradezy →</Link>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute left-1/2 top-10 h-96 w-[850px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center lg:pb-32 lg:pt-32">
          <p className="mx-auto mb-8 w-fit rounded-full border border-emerald-400/20 bg-emerald-400/5 px-4 py-2 text-sm text-emerald-300">Built for assessment operations teams</p>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-.05em] sm:text-6xl lg:text-8xl">Four systems.<br /><span className="text-slate-500">One workflow.</span></h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">Stop copying, matching and checking assessment data across Moodle, Excel, SharePoint and StaffAdvantage. Gradezy brings the repetitive work into one place.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/tools/tracker-sync" className="rounded-full bg-white px-7 py-4 text-sm font-semibold text-[#070b12] hover:bg-slate-200">Try Progress Tracker Sync →</Link>
            <a href="#workflow" className="rounded-full border border-white/15 px-7 py-4 text-sm font-semibold hover:bg-white/10">Explore the workflow</a>
          </div>
          <p className="mt-5 text-xs text-slate-500">Prototype workflow. Use anonymised test data until matching and safeguards are fully validated.</p>
        </div>
      </section>

      <section id="integrations" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="mb-12 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">Your existing stack</p><h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">No replacement LMS.<br /><span className="text-slate-500">Just less manual work.</span></h2><p className="mt-5 leading-7 text-slate-400">Keep using the systems your institution already relies on. Gradezy focuses on the work between them.</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{systems.map(system => <div key={system.name} className="rounded-3xl border border-white/10 bg-white/[.035] p-7"><span className="text-xs font-semibold text-indigo-300">{system.number}</span><h3 className="mt-7 text-2xl font-semibold">{system.name}</h3><p className="mt-2 text-sm font-medium text-emerald-300">{system.role}</p><p className="mt-4 text-sm leading-6 text-slate-400">{system.description}</p></div>)}</div>
      </section>

      <section id="workflow" className="border-y border-white/10 bg-white/[.025]"><div className="mx-auto max-w-7xl px-6 py-24 lg:px-8"><div className="mb-12"><p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">From exports to answers</p><h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">A faster assessment workflow.</h2></div><div className="grid gap-4 md:grid-cols-4">{steps.map((step,index) => <div key={step.title} className="rounded-2xl border border-white/10 p-6"><span className="text-3xl font-semibold text-slate-600">0{index+1}</span><h3 className="mt-8 text-lg font-semibold">{step.title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{step.detail}</p></div>)}</div></div></section>

      <section id="principles" className="mx-auto max-w-5xl px-6 py-28 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-indigo-300">Designed for accuracy</p><h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">Automate the repetition.<br /><span className="text-slate-500">Keep the human review.</span></h2><p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-400">Gradezy flags conflicting identifiers and uncertain matches instead of guessing. Direct integrations are a future step; the first workflow uses files and produces a reviewed export.</p><Link href="/tools/tracker-sync" className="mt-9 inline-flex rounded-full bg-white px-7 py-4 text-sm font-semibold text-[#070b12]">Open the automation workspace →</Link></section>
      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Gradezy · Assessment operations automation</footer>
    </main>
  );
}
