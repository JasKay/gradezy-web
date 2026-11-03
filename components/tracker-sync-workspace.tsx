"use client";
import { useState } from "react";
import { GradeCheckTool } from "./gradecheck-tool";
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
const paperKeys = ["paperid", "turnitinpaperid", "submissionpaperid"];
function readSheet(file: File): Promise<XLSX.WorkBook> {
  return file.arrayBuffer().then(buffer => XLSX.read(buffer, { type: "array", cellDates: false }));
}
function makePreview(sources: {name: string; book: XLSX.WorkBook}[], tracker: XLSX.WorkBook): Preview {
  const issues: Issue[] = [];
  // The export's Paper ID identifies a submission, not a Turnitin user.
  // Never infer resubmission status from a grade or a filename.
  type RecordValue = { paper: string; email: string; source: string; row: number };
  const records = new Map<string, RecordValue[]>();
  const normalizeEmail = (value: Cell) => String(value ?? "").trim().toLowerCase();
  for (const source of sources) {
    const sheet = source.book.Sheets[source.book.SheetNames[0]];
    if (!sheet) { issues.push({row:0,reason:source.name + ": empty workbook"}); continue; }
    const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, {header:1,defval:"",raw:false});
    const h = rows[0] || [];
    const email = header(h,emailKeys), paper = header(h,paperKeys);
    if (email < 0 || paper < 0) {
      issues.push({row:0,reason:source.name + ": requires Email and Paper ID columns"}); continue;
    }
    rows.slice(1).forEach((row,index)=>{
      if (!row.some(v=>String(v??"").trim())) return;
      const key = normalizeEmail(row[email]), value = String(row[paper]??"").trim();
      if (!key || !value) {issues.push({row:index+2,reason:source.name + ": missing email or Paper ID"});return;}
      const list = records.get(key)||[];
      list.push({paper:value,email:key,source:source.name,row:index+2});
      records.set(key,list);
    });
  }
  const sheet = tracker.Sheets[tracker.SheetNames[0]];
  if (!sheet) throw new Error("Progress Tracker has no worksheet.");
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet,{header:1,defval:"",raw:false});
  // Ignore blank trailing columns. Require exact target headers to prevent writing to the wrong field.
  const h = rows[0] || [];
  const email = header(h,emailKeys), id = header(h,idKeys);
  const firstPaper = header(h,["tiipaperid"]);
  const resubPaper = header(h,["resubmissiontiipaperid"]);
  if (email < 0 || firstPaper < 0) throw new Error("Tracker must contain ESL Email and TII Paper ID columns.");
  const seen = new Set<string>();
  let matched=0,changed=0,unchanged=0;
  rows.slice(1).forEach((row,index)=>{
    const key = normalizeEmail(row[email]);
    if (!key) return;
    if (seen.has(key)) {issues.push({row:index+2,reason:"Duplicate ESL Email in tracker: "+key});return;}
    seen.add(key);
    const submissions = records.get(key);
    if (!submissions?.length) return;
    const unique = [...new Set(submissions.map(r=>r.paper))];
    if (unique.length !== 1) {
      issues.push({row:index+2,reason:"Multiple Paper IDs for "+key+". Confirm attempt and assessment before updating."});return;
    }
    const next = unique[0];
    const before = String(row[firstPaper]??"").trim();
    const resub = resubPaper>=0 ? String(row[resubPaper]??"").trim() : "";
    if (resub === next) {
      issues.push({row:index+2,reason:"Paper ID already appears in resubmission field; no first-attempt update."});return;
    }
    if (before && before !== next) {
      issues.push({row:index+2,reason:"Existing first-attempt Paper ID differs for "+key+"; review manually."});return;
    }
    // One workbook can contain several modules/attempts. Without a verified
    // assessment scope we cannot safely distinguish those submissions.
    if (id>=0 && !String(row[id]??"").trim()) {
      issues.push({row:index+2,reason:"Tracker NCG ID missing; verify student identity before use."});return;
    }
    matched++;
    if (before===next) {unchanged++;return;}
    const addr = XLSX.utils.encode_cell({r:index+1,c:firstPaper});
    if (sheet[addr]?.f) {issues.push({row:index+2,reason:"Formula protected at "+addr});return;}
    sheet[addr]={t:"s",v:next};
    changed++;
  });
  for (const [emailKey] of records) {
    if (!seen.has(emailKey)) issues.push({row:0,reason:"No Progress Tracker match for "+emailKey});
  }
  return {workbook:tracker,matched,unchanged,changed,issues};
}
export function TrackerSyncWorkspace() {
  const [active, setActive] = useState<"tracker"|"grades"|"extension">("tracker");
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
    { id:"tracker", label:"Match ID & Tracker", number:"01" },
    { id:"grades", label:"Reconcile grades", number:"02" },
    { id:"extension", label:"Browser extension", number:"03" },
  ] as const;
  const titles = {tracker:"Match student IDs",grades:"Reconcile grades",extension:"Browser extension"};
  const descriptions = {tracker:"Bring together Moodle exports and match Paper IDs to the correct Progress Tracker records.",grades:"Compare marks across attempts and surface discrepancies.",extension:"Bring Gradezy into Moodle and StaffAdvantage without switching tabs."};
  return <main className="min-h-screen bg-[#f7f8fa] text-[#1d2935]">
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
      <aside className="w-full shrink-0 border-b border-[#e6e9ed] bg-white px-6 py-7 lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-r lg:px-5">
        <div className="flex items-center gap-3 px-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173d33] text-xl font-semibold text-white">g</span><div><div className="text-[19px] font-bold tracking-[-.05em]">gradezy<span className="text-[#2c8a6b]">.</span></div><div className="text-[10px] font-medium uppercase tracking-[.14em] text-[#8b98a3]">Assessment operations</div></div></div>
        <div className="mt-10 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-[#98a2ad]">Workspace</div>
        <nav className="mt-3 flex flex-wrap gap-1 lg:flex-col" aria-label="Workspace navigation">
          {items.map(item=><button key={item.id} onClick={()=>setActive(item.id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium transition-colors ${active===item.id?"bg-[#eaf3ef] text-[#175743]":"text-[#647180] hover:bg-[#f4f6f7] hover:text-[#273a42]"}`}><span className={`text-[11px] tabular-nums ${active===item.id?"text-[#2b8064]":"text-[#a3adb6]"}`}>{item.number}</span>{item.label}</button>)}
        </nav>

      </aside>
      <div className="min-w-0 flex-1 px-5 pb-16 pt-9 sm:px-10 lg:px-14 lg:pt-12">
        <div className="mx-auto max-w-[960px]">
          <header className="mb-9 border-b border-[#e7ebee] pb-8"><div className="mb-3 text-[11px] font-semibold uppercase tracking-[.17em] text-[#7a968b]">ASSESSMENT WORKSPACE / {items.find(i=>i.id===active)?.number}</div><h1 className="text-[30px] font-semibold tracking-[-.045em] text-[#1c302c] sm:text-[38px]">{titles[active]}</h1><p className="mt-2 max-w-[640px] text-sm leading-6 text-[#73818c]">{descriptions[active]}</p></header>
          {active==="extension" ? <section className="overflow-hidden rounded-2xl border border-[#e5e9ec] bg-white"><div className="border-b border-[#edf0f2] px-7 py-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight">Gradezy for your browser</h2><span className="rounded-full bg-[#f4f5f6] px-3 py-1 text-[11px] font-semibold text-[#687684]">Not installed</span></div><p className="mt-2 max-w-xl text-sm leading-6 text-[#7b8995]">The extension will bring matching and reconciliation actions into authorised Moodle and StaffAdvantage pages. Browser permissions and institutional approval are required before enabling live capture or grade entry.</p></div><div className="grid gap-0 md:grid-cols-3">{[{n:"01",title:"Capture",body:"Read selected Moodle grade exports and identifiers."},{n:"02",title:"Reconcile",body:"Send selected records into Gradezy for review."},{n:"03",title:"Apply",body:"Prepare verified results for authorised entry into StaffAdvantage."}].map(x=><div key={x.n} className="border-b border-[#edf0f2] px-7 py-7 last:border-0 md:border-b-0 md:border-r"><span className="text-xs font-semibold text-[#3e876f]">{x.n}</span><h3 className="mt-3 text-sm font-semibold">{x.title}</h3><p className="mt-2 text-xs leading-5 text-[#82909b]">{x.body}</p></div>)}</div><p className="border-t border-[#edf0f2] px-7 py-5 text-xs text-[#7b8995]">Extension installation and direct browser integration are not available yet.</p></section> :
      {active==="grades" ? <GradeCheckTool/> : <section className="space-y-5">
      <div><h2 className="text-2xl font-semibold tracking-tight">Match IDs & update tracker</h2><p className="mt-2 text-sm text-slate-500">Upload the Turnitin export and matching Progress Tracker for the same assessment and attempt. Gradezy matches by ESL Email and proposes first-attempt Paper IDs. Review the updated workbook before applying changes in SharePoint. Direct browser updates are planned, not yet available.</p></div>
      <section className="grid gap-4 rounded-xl border bg-white p-6 md:grid-cols-2">
        <label className="space-y-2"><span className="block font-medium">1. Moodle Excel exports</span><input className="w-full text-sm" type="file" accept=".xlsx,.xls,.csv" multiple onChange={e=>{setExports(Array.from(e.target.files||[]));setPreview(null);}}/><small className="text-slate-500">{exports.length} selected</small></label>
        <label className="space-y-2"><span className="block font-medium">2. Progress Tracker</span><input className="w-full text-sm" type="file" accept=".xlsx,.xls" onChange={e=>{setTracker(e.target.files?.[0]||null);setPreview(null);}}/><small className="text-slate-500">{tracker?.name || "No file selected"}</small></label>
        <div className="md:col-span-2"><button className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={busy||!exports.length||!tracker} onClick={process}>{busy?"Processing…":"Preview matches"}</button></div>
      </section>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {preview && <section className="space-y-4 rounded-xl border bg-white p-6">
        <h2 className="text-xl font-semibold">Review results</h2>
        <div className="grid grid-cols-3 gap-3 text-center"><div><strong className="block text-2xl">{preview.matched}</strong>Matched</div><div><strong className="block text-2xl">{preview.changed}</strong>Proposed updates</div><div><strong className="block text-2xl">{preview.issues.length}</strong>Exceptions</div></div>
        <p className="text-sm text-slate-600">Existing conflicting Paper IDs are never overwritten. Matches use student ID derived from NCG identifiers or institutional email patterns. Confirm module, campus and attempt before applying any updates.</p>
        <button className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white" onClick={download}>Export reviewed workbook</button>
        {preview.issues.length>0 && <div><h3 className="font-semibold">Exceptions</h3><ul className="mt-2 max-h-72 space-y-1 overflow-auto text-sm">{preview.issues.map((x,i)=><li key={i}>Row {x.row}: {x.reason}</li>)}</ul></div>}
      </section>}
      <p className="text-sm text-amber-800">First-attempt Paper IDs only. Verify campus, module, assessment and attempt before using the reviewed workbook. Resubmissions are deliberately held for manual review.</p>
    </section>}
          }
        </div>
      </div>
    </div>
  </main>;
}
