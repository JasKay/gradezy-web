"use client";
import { useState } from "react";
import Link from "next/link";
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
  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/dashboard" className="text-sm text-emerald-700">← Back to Gradezy</Link>
      <header><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Assessment tools</p><h1 className="text-3xl font-semibold">Moodle → Progress Tracker</h1><p className="mt-2 text-slate-600">Upload Moodle exports and a tracker. Review changes before downloading. Files are processed in your browser.</p></header>
      <section className="grid gap-4 rounded-xl border bg-white p-6 md:grid-cols-2">
        <label className="space-y-2"><span className="block font-medium">1. Moodle Excel exports</span><input className="w-full text-sm" type="file" accept=".xlsx,.xls,.csv" multiple onChange={e=>{setExports(Array.from(e.target.files||[]));setPreview(null);}}/><small className="text-slate-500">{exports.length} selected</small></label>
        <label className="space-y-2"><span className="block font-medium">2. Progress Tracker</span><input className="w-full text-sm" type="file" accept=".xlsx,.xls" onChange={e=>{setTracker(e.target.files?.[0]||null);setPreview(null);}}/><small className="text-slate-500">{tracker?.name || "No file selected"}</small></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busy||!exports.length||!tracker} onClick={process}>{busy?"Processing…":"Preview matches"}</button></div>
      </section>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {preview && <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Review results</h2>
        <div className="grid grid-cols-3 gap-3 text-center"><div><strong className="block text-2xl">{preview.matched}</strong>Matched</div><div><strong className="block text-2xl">{preview.changed}</strong>Updated</div><div><strong className="block text-2xl">{preview.issues.length}</strong>Exceptions</div></div>
        <p className="text-sm text-slate-600">Existing conflicting IDs are never overwritten. This prototype matches by student ID only; confirm module, campus and attempt before using any output operationally.</p>
        <button className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white" onClick={download}>Download reviewed tracker</button>
        {preview.issues.length>0 && <div><h3 className="font-semibold">Exceptions</h3><ul className="mt-2 max-h-72 space-y-1 overflow-auto text-sm">{preview.issues.map((x,i)=><li key={i}>Row {x.row}: {x.reason}</li>)}</ul></div>}
      </section>}
      <p className="text-sm text-amber-800">Prototype: use anonymised sample data only. Multiple modules, campuses and attempts require scoped matching before production use.</p>
    </div>
  </main>;
}
