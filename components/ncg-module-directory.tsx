"use client";

import Link from "next/link";
import { useState } from "react";
import { NCG_MODULES, PROGRAMMES, normalizeModuleCode, programmeForSubject, type ProgrammeCode } from "@/lib/ncg-modules";
import type { Workflow } from "@/lib/workflow";

export function NcgModuleDirectory({ w }: { w: Workflow }) {
  const [search, setSearch] = useState("");
  const [programme, setProgramme] = useState<ProgrammeCode | "">("");
  const modules = NCG_MODULES.filter((m) => (!programme || m.programmes.includes(programme)) && (m.code + " " + m.name + " " + (m.aliases || []).join(" ")).toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section className="wf-panel wf-module-directory">
      <div className="wf-panel-head"><h2>NCG modules</h2><span className="wf-muted">{modules.length} modules</span></div>
      <div className="wf-filters">
        <input aria-label="Search NCG modules" placeholder="Search module code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter NCG programme" value={programme} onChange={(e) => setProgramme(e.target.value as ProgrammeCode | "")}>
          <option value="">All programmes</option>
          {(Object.keys(PROGRAMMES) as ProgrammeCode[]).map((code) => <option key={code} value={code}>{code} - {PROGRAMMES[code].name}</option>)}
        </select>
      </div>
      <div className="wf-table-wrap">
        <table>
          <thead><tr><th>Module code</th><th>Module name</th><th>Programme</th><th>Assessments</th><th /></tr></thead>
          <tbody>
            {modules.map((m) => {
              const assessments = w.assessments.filter((a) => normalizeModuleCode(a.module) === m.code && (!programme || programmeForSubject(a.subject) === programme));
              const selectedProgramme = programme || (m.programmes.length === 1 ? m.programmes[0] : "");
              return <tr key={m.code}>
                <td><strong>{m.code}</strong>{m.aliases?.map((alias) => <small key={alias}>Also listed as {alias}</small>)}</td><td>{m.name}</td>
                <td>{(programme ? [programme] : m.programmes).map((code) => <small key={code}>{code} - {PROGRAMMES[code].name}</small>)}</td>
                <td>{assessments.length ? <details className="wf-module-assessments"><summary>{assessments.length} scheduled</summary>{assessments.map((a) => <Link key={a.id} href={"/workflow/" + a.id}>{a.name}<small>{w.cohorts.find((c) => c.id === a.cohortId)?.name}</small></Link>)}</details> : <span className="wf-muted">Not scheduled</span>}</td>
                <td><Link className="wf-text-button" href={"/assessments/new?module=" + m.code + (selectedProgramme ? "&programme=" + selectedProgramme : "")}>Add assessment &rarr;</Link></td>
              </tr>;
            })}
            {!modules.length && <tr><td colSpan={5}>No modules match this selection.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
