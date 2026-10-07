"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { compareCohorts, PROGRAMMES, ncgModuleEntries, updateNcgModuleEntry, type ProgrammeCode } from "@/lib/ncg-modules";
import type { Workflow } from "@/lib/workflow";

type Commit = (change: (w: Workflow) => Workflow, message: string) => boolean;
export function NcgModuleDirectory({ w, commit }: { w: Workflow; commit: Commit }) {
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState<ProgrammeCode | "">("");
  const [cohort, setCohort] = useState("");
  const [descending, setDescending] = useState(false);
  const [editing, setEditing] = useState("");
  const [name, setName] = useState("");
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const entries = ncgModuleEntries(w).flatMap(m => (m.cohortIds.length ? m.cohortIds : [""]).map(cohortId => ({ ...m, cohortId, rowKey: m.key + ":" + cohortId })));
  const modules = entries.filter(m => (!programme || m.programme === programme) && (!cohort || m.cohortId === cohort) && (m.code + " " + m.name + " " + (m.aliases || []).join(" ")).toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => compareCohorts(w, a.cohortId, b.cohortId, descending));
  return (
    <section className="wf-panel wf-module-directory">
      <div className="wf-panel-head"><h2>NCG modules</h2><span className="wf-muted">{modules.length} entries</span></div>
      <div className="wf-filters">
        <input aria-label="Search NCG modules" placeholder="Search module code or name" value={search} onChange={e => { setSearch(e.target.value); setEditing(""); }} />
        <select aria-label="Filter NCG programme" value={programme} onChange={e => { setProgramme(e.target.value as ProgrammeCode | ""); setEditing(""); }}>
          <option value="">All programmes</option>
          {(Object.keys(PROGRAMMES) as ProgrammeCode[]).map(code => <option key={code} value={code}>{code} - {PROGRAMMES[code].name}</option>)}
        </select>
        <select aria-label="Filter NCG cohort" value={cohort} onChange={e => { setCohort(e.target.value); setEditing(""); }}>
          <option value="">All cohorts</option>
          {w.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="wf-table-wrap"><table>
        <thead><tr><th>Module code</th><th>Module name</th><th>Programme</th><th aria-sort={descending ? "descending" : "ascending"}><button className="wf-cohort-sort" onClick={() => setDescending(!descending)} aria-label={descending ? "Sort cohorts ascending" : "Sort cohorts descending"}>Cohort <span aria-hidden="true">{descending ? "\u2304" : "\u2303"}</span></button></th><th>Assessments</th><th /></tr></thead>
        <tbody>
          {modules.map(m => {
            const assessments = m.assessments.filter(a => a.cohortId === m.cohortId);
            const scheduledCohorts = m.assessments.map(a => a.cohortId);
            return <Fragment key={m.rowKey}><tr>
              <td><strong>{m.code}</strong>{m.aliases?.map(alias => <small key={alias}>Also listed as {alias}</small>)}</td>
              <td>{m.name}</td><td><strong>{m.programme}</strong><small>{PROGRAMMES[m.programme].name}</small></td>
              <td>{w.cohorts.find(c => c.id === m.cohortId)?.name || "Not assigned"}</td>
              <td>{assessments.length ? <details className="wf-module-assessments"><summary>{assessments.length} scheduled</summary>{assessments.map(a => <Link key={a.id} href={"/workflow/" + a.id}>{a.name}</Link>)}</details> : <span className="wf-muted">Not scheduled</span>}</td>
              <td><button className="wf-text-button" aria-label={"Edit " + m.code + " " + m.programme + (m.cohortId ? " " + w.cohorts.find(c => c.id === m.cohortId)?.name : "")} aria-expanded={editing === m.rowKey} onClick={() => { setEditing(editing === m.rowKey ? "" : m.rowKey); setName(m.name); setCohortIds(m.cohortIds); }}>Edit</button></td>
            </tr>{editing === m.rowKey && <tr><td colSpan={6}>
              <form className="wf-module-editor" onSubmit={e => { e.preventDefault(); if (commit(next => updateNcgModuleEntry(next, m.key, name, cohortIds), "Updated " + m.code + " (" + m.programme + ")")) setEditing(""); }}>
                <label>Module name<input aria-label="Edit module name" required value={name} onChange={e => setName(e.target.value)} /></label>
                <fieldset><legend>Cohorts</legend>{w.cohorts.map(c => <label key={c.id}><input type="checkbox" checked={cohortIds.includes(c.id)} disabled={scheduledCohorts.includes(c.id)} onChange={e => setCohortIds(e.target.checked ? [...cohortIds, c.id] : cohortIds.filter(id => id !== c.id))} />{c.name}</label>)}</fieldset>
                {scheduledCohorts.length > 0 && <small className="wf-muted">Cohorts with scheduled assessments stay assigned.</small>}
                <div className="wf-module-editor-actions"><button className="wf-button primary" type="submit">Save changes</button><button className="wf-button" type="button" onClick={() => setEditing("")}>Cancel</button></div>
              </form>
            </td></tr>}</Fragment>;
          })}
          {!modules.length && <tr><td colSpan={6}>No modules match this selection.</td></tr>}
        </tbody>
      </table></div>
    </section>
  );
}
