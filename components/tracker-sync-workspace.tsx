"use client";
import { useState } from "react";
import { GradeCheckTool } from "./gradecheck-tool";
import { SmartSyncWorkspace } from "./smartsync-workspace";
import * as XLSX from "xlsx";

type Cell = string | number | boolean | null | undefined;
type Issue = { row: number; reason: string };
type Preview = { workbook: XLSX.WorkBook; matched: number; unchanged: number; issues: Issue[]; changed: number };
const norm = (v: Cell) => String(v ?? "").trim().toLowerCase();
const studentId = (v: Cell) => {
  const s = norm(v);
  const m = s.match(/^[^-@]+-([0-9]+)@/);
  return m?.[1] || (/^[0-9]+$/.test(s) ? s : "");
};
const header = (row: Cell[], candidates: string[]) => row.findIndex(c => candidates.includes(norm(c).replace(/[^a-z0-9]/g, "")));
const idKeys = ["studentid", "studentnumber", "ncgid", "id"];
const emailKeys = ["email", "emailaddress", "studentemail"];
const turnitinKeys = ["turnitinid", "turnitinuserid", "turnitinuser", "turnitin"];
function readSheet(file: File): Promise<XLSX.WorkBook> {
  return file.arrayBuffer().then(buffer => XLSX.read(buffer, { type: "array", cellDates: false }));
}
function makePreview(sources: {name: string; book: XLSX.WorkBook}[], tracker: XLSX.WorkBook): Preview {
  const records = new Map<string, Set<string>>();
  const issues: Issue[] = [];
  for (const source of sources) {
    const sheet = source.book.Sheets[source.book.SheetNames[0]];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: "", raw: false });
    const h = rows[0] || [];
    const email = header(h, emailKeys), id = header(h, idKeys), turnitin = header(h, turnitinKeys);
    if (turnitin < 0 || (email < 0 && id < 0)) {
      issues.push({row: 0, reason: source.name + ": missing student identity or Turnitin ID column"}); continue;
    }
    rows.slice(1).forEach((row, index) => {
      const key = (id >= 0 ? studentId(row[id]) : "") || (email >= 0 ? studentId(row[email]) : "");
      const value = String(row[turnitin] ?? "").trim();
      if (!key || !value) { issues.push({row: index + 2, reason: source.name + ": missing student ID or Turnitin ID"}); return; }
      const set = records.get(key) || new Set<string>();
      set.add(value); records.set(key, set);
    });
  }
  const sheet = tracker.Sheets[tracker.SheetNames[0]];
  if (!sheet) throw new Error("Progress Tracker has no worksheet.");
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, {header: 1, defval: "", raw: false});
  const h = rows[0] || [];
  const email = header(h, emailKeys), id = header(h, idKeys), turnitin = header(h, turnitinKeys);
  if (turnitin < 0 || (email < 0 && id < 0)) throw new Error("Progress Tracker needs a student ID/email and a Turnitin ID column.");
  const seen = new Set<string>();
  let matched = 0, changed = 0, unchanged = 0;
  rows.slice(1).forEach((row, index) => {
    const key = (id >= 0 ? studentId(row[id]) : "") || (email >= 0 ? studentId(row[email]) : "");
    if (!key) return;
    if (seen.has(key)) { issues.push({row:index + 2, reason:"Duplicate student in tracker: " + key}); return; }
    seen.add(key);
    const values = records.get(key);
    if (!values) return;
    if (values.size !== 1) { issues.push({row:index + 2, reason:"Conflicting Turnitin IDs for student " + key}); return; }
    const next = [...values][0];
    const before = String(row[turnitin] ?? "").trim();
    if (before && before !== next) { issues.push({row:index + 2, reason:"Existing Turnitin ID differs for student " + key}); return; }
    matched++;
    if (before === next) { unchanged++; return; }
    const addr = XLSX.utils.encode_cell({r:index + 1, c:turnitin});
    const cell = sheet[addr];
    if (cell?.f) { issues.push({row:index + 2, reason:"Protected formula at " + addr}); return; }
    sheet[addr] = {t:"s", v:next};
    changed++;
  });
  return {workbook:tracker, matched, unchanged, changed, issues};
}
export function TrackerSyncWorkspace() {
  const [active, setActive] = useState<"tracker"|"grades"|"review"|"extension">("tracker");
  const [exports, setExports] = useState<File[]>([]);
  const [tracker, setTracker] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function process() {
    if (!exports.length || !tracker) return;
    setBusy(true); setError(""); setPreview(null);
    try {
      const sources = await Promise.all(exports.map(async file => ({name:file.name, book:await readSheet(file)})));
      setPreview(makePreview(sources, await readSheet(tracker)));
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to process files"); }
    finally { setBusy(false); }
  }
  function download() {
    if (!preview) return;
    XLSX.writeFile(preview.workbook, "gradezy-progress-tracker-reviewed.xlsx");
  }
  const items = [
    { id:"tracker", label:"Match student IDs", number:"01" },
    { id:"grades", label:"Reconcile grades", number:"02" },
    { id:"review", label:"Review & apply", number:"03" },
    { id:"extension", label:"Browser extension", number:"04" },
  ] as const;
  const titles = {tracker:"Match student IDs",grades:"Reconcile grades",review:"Review & apply",extension:"Browser extension"};
  const descriptions = {tracker:"Bring together Moodle exports and identify the right student records.",grades:"Compare marks across attempts and surface discrepancies.",review:"Review approved changes before updating the SharePoint workbook.",extension:"Bring Gradezy into Moodle and StaffAdvantage without switching tabs."};
  return <main className="min-h-screen bg-[#f7f8fa] text-[#1d2935]">
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-[#e6e9ed] bg-white px-6 py-7 lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-r lg:px-5">
        <div className="flex items-center gap-3 px-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173d33] text-xl font-semibold text-white">g</span><div><div className="text-[19px] font-bold tracking-[-.05em]">gradezy<span className="text-[#2c8a6b]">.</span></div><div className="text-[10px] font-medium uppercase tracking-[.14em] text-[#8b98a3]">Assessment operations</div></div></div>
        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#98a2ad]">Workspace</div>
        <nav className="mt-3 flex flex-wrap gap-1 lg:flex-col" aria-label="Workspace navigation">
          {items.map(item=><button key={item.id} onClick={()=>setActive(item.id)} className={\`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors \${active===item.id?"bg-[#eaf3ef] text-[#175743]":"text-[#647180] hover:bg-[#f4f6f7] hover:text-[#273a42]"}\`}><span className={\`text-[11px] tabular-nums \${active===item.id?"text-[#2b8064]":"text-[#a3adb6]"}\`}>{item.number}</span>{item.label}</button>)}
        </nav>
        <div className="mt-10 hidden border-t border-[#edf0f2] px-3 pt-6 lg:block"><div className="text-xs font-semibold text-[#344252]">Microsoft 365</div><p className="mt-2 text-xs leading-5 text-[#82909c]">Institutional access required to connect your SharePoint workbook.</p><span className="mt-3 inline-flex items-center gap-2 text-xs text-[#8a6a32]"><span className="h-1.5 w-1.5 rounded-full bg-[#c59b52]"/>Awaiting IT approval</span></div>
      </aside>
      <div className="min-w-0 flex-1 px-5 pb-16 pt-9 sm:px-10 lg:px-14 lg:pt-12">
        <div className="mx-auto max-w-[960px]">
          <header className="mb-9 border-b border-[#e7ebee] pb-8"><div className="mb-3 text-[11px] font-semibold uppercase tracking-[.17em] text-[#7a968b]">ASSESSMENT WORKSPACE / {items.find(i=>i.id===active)?.number}</div><h1 className="text-[30px] font-semibold tracking-[-.045em] text-[#1c302c] sm:text-[38px]">{titles[active]}</h1><p className="mt-2 max-w-[640px] text-sm leading-6 text-[#73818c]">{descriptions[active]}</p></header>
          {active==="extension" ? <section className="overflow-hidden rounded-2xl border border-[#e5e9ec] bg-white"><div className="border-b border-[#edf0f2] px-7 py-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight">Gradezy for your browser</h2><span className="rounded-full bg-[#f4f5f6] px-3 py-1 text-[11px] font-semibold text-[#687684]">Not installed</span></div><p className="mt-2 max-w-xl text-sm leading-6 text-[#7b8995]">The extension will bring matching and reconciliation actions into authorised Moodle and StaffAdvantage pages. Browser permissions and institutional approval are required before enabling live capture or grade entry.</p></div><div className="grid gap-0 md:grid-cols-3">{[{n:"01",title:"Capture",body:"Read selected Moodle grade exports and identifiers."},{n:"02",title:"Reconcile",body:"Send selected records into Gradezy for review."},{n:"03",title:"Apply",body:"Prepare verified results for authorised entry into StaffAdvantage."}].map(x=><div key={x.n} className="border-b border-[#edf0f2] px-7 py-7 last:border-0 md:border-b-0 md:border-r"><span className="text-xs font-semibold text-[#3e876f]">{x.n}</span><h3 className="mt-3 text-sm font-semibold">{x.title}</h3><p className="mt-2 text-xs leading-5 text-[#82909b]">{x.body}</p></div>)}</div><p className="border-t border-[#edf0f2] px-7 py-5 text-xs text-[#7b8995]">Extension installation and direct browser integration are not available yet.</p></section> :

