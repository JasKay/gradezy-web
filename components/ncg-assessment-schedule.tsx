"use client";

import Link from "next/link";
import { useState } from "react";
import { compareCohorts, ncgScheduleRows, PROGRAMMES, type ProgrammeCode } from "@/lib/ncg-modules";
import { assessmentStatus, type Workflow } from "@/lib/workflow";

export function NcgAssessmentSchedule({ w, date }: { w: Workflow; date: string }) {
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState("");
  const [cohort, setCohort] = useState("");
  const [descending, setDescending] = useState(false);
  const rows = ncgScheduleRows(w).filter(row => (!programme || row.programme === programme) && (!cohort || row.cohortId === cohort) && `${row.code} ${row.name} ${row.assessment?.name || ""}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => compareCohorts(w, a.cohortId, b.cohortId, descending));
  return <section className="wf-panel wf-module-directory">
    <div className="wf-panel-head"><h2>Assessment schedule</h2><span className="wf-muted">{rows.length} entries</span></div>
    <div className="wf-filters">
      <input aria-label="Search assessments" placeholder="Search assessment or module" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter programme" value={programme} onChange={e => setProgramme(e.target.value)}><option value="">All programmes</option>{(Object.keys(PROGRAMMES) as ProgrammeCode[]).map(code => <option key={code} value={code}>{PROGRAMMES[code].name}</option>)}</select>
      <select aria-label="Filter cohort" value={cohort} onChange={e => setCohort(e.target.value)}><option value="">All cohorts</option>{w.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </div>
    <div className="wf-table-wrap"><table><thead><tr><th>Module</th><th>Programme</th><th aria-sort={descending ? "descending" : "ascending"}><button className="wf-cohort-sort" onClick={() => setDescending(!descending)} aria-label={descending ? "Sort cohorts ascending" : "Sort cohorts descending"}>Cohort <span aria-hidden="true">{descending ? "\u2304" : "\u2303"}</span></button></th><th>Assessment</th><th>Issue date</th><th>Status</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.key}>
        <td><strong>{row.code}</strong><span className="wf-module-line">{row.name}</span>{row.term && <small>{row.term}</small>}</td>
        <td>{row.programme ? <><strong>{row.programme}</strong><small>{PROGRAMMES[row.programme].name}</small></> : "To confirm"}</td>
        <td>{w.cohorts.find(c => c.id === row.cohortId)?.name || "Not assigned"}</td>
        <td>{row.assessment ? <Link className="wf-text-button" href={"/workflow/" + row.assessment.id}>{row.assessment.name}</Link> : <span className="wf-muted">Awaiting assessment</span>}</td>
        <td>{row.assessment?.issueDate || "Not set"}</td>
        <td>{row.assessment ? assessmentStatus(row.assessment, w, date) : "Not scheduled"}</td>
      </tr>)}
      {!rows.length && <tr><td colSpan={6}>No modules or assessments match this selection.</td></tr>}
    </tbody></table></div>
  </section>;
}
