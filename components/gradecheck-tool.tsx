"use client";
import {useState} from "react";
import * as XLSX from "xlsx";
type Row = string[];
type Result = {student:string; grade:string; status:string; detail:string};
const norm=(v:string)=>String(v||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
async function rows(file:File):Promise<Row[]> {
 const data=await file.arrayBuffer();
 const wb=XLSX.read(data,{type:"array"});
 return XLSX.utils.sheet_to_json<(string|number)[]>(wb.Sheets[wb.SheetNames[0]],{header:1,defval:"",raw:false}).map(r=>r.map(v=>String(v??"")));
}
function reconcile(a:Row[],b:Row[]):Result[] {
 const index=new Map<string,{score:number|null;attempt:number}[]>();
 for(const r of b){if(r.length<3||!r[0]||!r[1]||norm(r[0])==="last name")continue;
  const key=norm(r[0])+","+norm(r[1]);const list=index.get(key)||[];
  list.push({score:r[2].trim()!==""&&Number.isFinite(Number(r[2]))?Number(r[2]):null,attempt:/resub/i.test(r[3]||"")?2:1});index.set(key,list);
 }
 return a.flatMap(r=>{const name=(r[0]||"").trim(),raw=(r[1]||"").trim();
  if(!name.includes(",")||!/\([12]\)/.test(raw))return [];
  const m=raw.match(/(-?\d+(?:\.\d+)?)\s*(?:-[^(]*)?\(\s*([12])\s*\)/);
  const parts=name.split(",");const key=norm(parts[0])+","+norm(parts.slice(1).join(","));
  const all=index.get(key)||[];const attempt=m?Number(m[2]):null;const grade=m?Number(m[1]):null;
  const same=all.filter(x=>x.attempt===attempt);const scores=[...new Set(same.map(x=>x.score).filter(x=>x!==null))];
  let status="Review",detail="Check source data";
  if(!all.length){status="Not found";detail="Student not found in comparison";}
  else if(!same.length){status="Missing attempt";detail="No matching first attempt / resubmission record";}
  else if(scores.length>1){detail="Conflicting grades for the same attempt";}
  else if(!scores.length){detail="Comparison grade is blank";}
  else if(grade===null){detail="Could not read reference grade";}
  else if(scores[0]===grade){status="Match";detail="Grade and attempt match";}
  else{status="Mismatch";detail="Reference: "+grade+"; comparison: "+scores[0];}
  return [{student:name,grade:raw,status,detail}];
 });
}
export function GradeCheckTool(){
 const [a,setA]=useState<File|null>(null),[b,setB]=useState<File|null>(null);
 const [results,setResults]=useState<Result[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function run(){if(!a||!b)return;setBusy(true);setError("");try{setResults(reconcile(await rows(a),await rows(b)));}catch(e){setError(e instanceof Error?e.message:"Unable to read files");}finally{setBusy(false);}}
 function exportReport(){const sheet=XLSX.utils.json_to_sheet(results);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet,"Reconciliation");XLSX.writeFile(wb,"gradezy-gradecheck-results.xlsx");}
 return <section className="space-y-6">
  <div><h2 className="text-2xl font-semibold tracking-tight">Grade reconciliation</h2><p className="mt-2 text-sm text-slate-500">GradeCheck workflow: compare reference grades against first attempts and resubmissions.</p></div>
  <div className="grid gap-4 md:grid-cols-2">
   <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-6"><span className="block font-semibold">Reference (D1)</span><span className="mt-1 block text-xs text-slate-500">Student Name, Grade e.g. 67 (1)</span><input type="file" accept=".xlsx,.xls,.csv" className="mt-5 block w-full text-sm" onChange={e=>{setA(e.target.files?.[0]||null);setResults([]);}}/></label>
   <label className="block rounded-2xl border border-dashed border-slate-300 bg-white p-6"><span className="block font-semibold">Comparison (D2)</span><span className="mt-1 block text-xs text-slate-500">Last Name, First Name, Grade, Resub marker</span><input type="file" accept=".xlsx,.xls,.csv" className="mt-5 block w-full text-sm" onChange={e=>{setB(e.target.files?.[0]||null);setResults([]);}}/></label>
  </div>
  <button onClick={run} disabled={!a||!b||busy} className="rounded-xl bg-[#225c4b] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy?"Comparing…":"Compare grades"}</button>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {results.length>0&&<div className="rounded-2xl border border-slate-200 bg-white p-5">
   <div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold">Results</h3><p className="text-sm text-slate-500">{results.length} students · {results.filter(r=>r.status==="Match").length} matched · {results.filter(r=>r.status!=="Match").length} exceptions</p></div><button onClick={exportReport} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Export Excel report</button></div>
   <div className="mt-5 max-h-[480px] overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">Student</th><th className="p-3">D1 grade</th><th className="p-3">Status</th><th className="p-3">Detail</th></tr></thead><tbody>{results.map((r,i)=><tr key={i} className="border-t border-slate-100"><td className="p-3">{r.student}</td><td className="p-3">{r.grade}</td><td className="p-3 font-semibold">{r.status}</td><td className="p-3 text-slate-500">{r.detail}</td></tr>)}</tbody></table></div>
  </div>}
  <p className="text-xs text-slate-500">Runs locally in your browser. This first version uses exact normalised names and attempt markers; review ambiguous cases before operational use.</p>
 </section>;
}
