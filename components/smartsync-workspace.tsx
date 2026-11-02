"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { column, planChanges, type Mapping, type Plan, type Result, type Sheet } from "@/lib/smartsync";
import type { Workflow } from "@/lib/workflow";
type Profile = { id: string; module: string; assessment: string; attempt: string; link: string; sheet: string; mapping: Mapping };
type Preview = Plan & { ticket?: string };
const blank = (): Profile => ({ id: "", module: "", assessment: "", attempt: "1", link: "", sheet: "", mapping: { email: -1, studentId: -1, userId: -1, similarity: -1 } });
async function api(path: string, body?: unknown, method = "POST") {
  const res = await fetch("/api/smartsync/" + path, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await res.json(); if (!res.ok) throw new Error(value.error || "Request failed."); return value;
}
function parseCsv(text: string): Result[] {
  const book = XLSX.read(text, { type: "string", raw: true }), rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, raw: true });
  const headers = rows[0]?.map(h => String(h).trim().toLowerCase()) ?? [];
  const fields = ["Email", "Student ID", "Turnitin User ID", "Similarity Score", "Assessment", "Attempt"];
  const indices = fields.map(f => headers.indexOf(f.toLowerCase()));
  if (indices.some(i => i < 0)) throw new Error("CSV must contain: " + fields.join(", ") + ".");
  return rows.slice(1).filter(row => row.some(v => String(v ?? "").trim())).map(row => {
    const v = indices.map(i => String(row[i] ?? "").trim());
    return { email: v[0], studentId: v[1], userId: v[2], similarity: v[3], assessment: v[4], attempt: v[5] };
  });
}
export function SmartSyncWorkspace({ w }: { w?: Workflow }) {
  const [profile, setProfile] = useState<Profile>(blank);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [status, setStatus] = useState({ configured: false, connected: false, automated: false });
  const [sheets, setSheets] = useState<{ id: string; name: string }[]>([]);
  const [sheet, setSheet] = useState<Sheet>();
  const [results, setResults] = useState<Result[]>([]);
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  useEffect(() => {
    try { setProfiles(JSON.parse(localStorage.getItem("gradezy_smartsync_profiles") || "[]")); } catch { setError("Saved SmartSync profiles could not be read."); }
    api("auth", undefined, "GET").then(setStatus).catch(e => setError(e.message));
    if (new URLSearchParams(window.location.search).get("smartsync") === "failed") setError("Microsoft sign-in failed or was cancelled. Please reconnect.");
  }, []);
  function change(patch: Partial<Profile>) { setProfile(p => ({ ...p, ...patch })); setPreview(undefined); }
  async function run(task: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await task(); } catch (e) { setError(e instanceof Error ? e.message : "SmartSync failed."); } finally { setBusy(false); } }
  async function loadBook(id?: string) {
    const data = await api("workbook", { link: profile.link, sheet: id || profile.sheet });
    setSheets(data.sheets); setSheet(data.sheet); setPreview(undefined);
    setMessage("Opened " + data.name + ". Select a worksheet and map its columns.");
  }
  const modules = [...new Set((w?.assessments ?? []).map(a => a.module).filter(Boolean))];
  const assessments = (w?.assessments ?? []).filter(a => a.module === profile.module);
  const valid = !!(sheet && results.length && profile.assessment && profile.attempt);
  return <section className="ss-panel" aria-labelledby="smartsync-title">
    <div className="ss-heading"><div><p className="wf-eyebrow">MICROSOFT 365</p><h2 id="smartsync-title">SmartSync</h2><p>Match Turnitin records, review changes and update your existing Microsoft 365 gradebook.</p></div><span className="ss-badge">{status.connected ? "Microsoft connected" : "Microsoft not connected"}</span></div>
    {error && <div role="alert" className="wf-message error">{error}</div>}
    {message && <div role="status" className="wf-message success">{message}</div>}
    <div className="ss-actions"><button className="wf-button primary" disabled={busy || !status.configured} onClick={() => run(async () => { const data = await api("auth", {}); window.location.assign(data.url); })}>{status.connected ? "Reconnect Microsoft 365" : "Connect Microsoft 365"}</button>
    {status.connected && <button className="wf-button" disabled={busy} onClick={() => run(async () => { await api("auth", undefined, "DELETE"); setStatus(s => ({ ...s, connected: false })); setPreview(undefined); setSheet(undefined); })}>Disconnect</button>}
</div>
    {!status.configured && <p className="ss-note">Microsoft 365 connection is not configured. An administrator must configure the application registration and permissions before SharePoint editing can be enabled.</p>}
    <div className="ss-grid">
      <div className="ss-step"><h3>1. Module & assessment</h3>
        <label>Saved setup<select disabled={busy} value={profile.id} onChange={e => { setProfile(profiles.find(p => p.id === e.target.value) || blank()); setSheet(undefined); setResults([]); setSheets([]); setPreview(undefined); }}><option value="">New setup</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.module} · {p.assessment} · attempt {p.attempt}</option>)}</select></label>
        {profile.id && <button className="wf-button primary" disabled={busy || !status.connected || !status.automated} onClick={() => run(async () => {
          setPreview(undefined);
          await loadBook(profile.sheet);
          const data = await api("results", profile);
          setResults(data.results);
          setPreview(await api("preview", { ...profile, results: data.results }));
          setMessage("Saved setup loaded and authorized results retrieved. Review changes before syncing.");
        })}>Load saved setup & preview</button>}
        <label>Module<input list="ss-modules" disabled={busy} value={profile.module} onChange={e => { change({ module: e.target.value, assessment: "" }); setResults([]); }} placeholder="e.g. COM101" /></label><datalist id="ss-modules">{modules.map(m => <option key={m} value={m} />)}</datalist>
        <label>Assessment<input list="ss-assessments" disabled={busy} value={profile.assessment} onChange={e => { change({ assessment: e.target.value }); setResults([]); }} placeholder="Exact source assessment name" /></label><datalist id="ss-assessments">{assessments.map(a => <option key={a.id} value={a.name} />)}</datalist>
        <label>Submission attempt<input disabled={busy} type="number" min="1" value={profile.attempt} onChange={e => { change({ attempt: e.target.value }); setResults([]); }} /></label>
      </div>
      <div className="ss-step"><h3>2. Excel workbook</h3>
        <label>SharePoint / OneDrive sharing link<input disabled={busy} type="url" value={profile.link} onChange={e => { change({ link: e.target.value, sheet: "" }); setSheet(undefined); setSheets([]); }} placeholder="https://yourinstitution.sharepoint.com/…" /></label>
        <button className="wf-button" disabled={busy || !status.connected || !profile.link} onClick={() => run(() => loadBook())}>Open workbook</button>
        <label>Worksheet<select disabled={busy || !sheets.length} value={profile.sheet} onChange={e => { const id = e.target.value; change({ sheet: id || profile.sheet }); setSheet(undefined); if (id) run(() => loadBook(id)); }}><option value="">Select worksheet</option>{sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <p className="ss-note">The first used row must contain column headers. Only approved mapped cells are updated; formulas are protected.</p>
      </div>
      <div className="ss-step"><h3>3. Turnitin results</h3>
        <label>Results CSV<input disabled={busy} type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => { if (file.size > 5000000) throw new Error("CSV must be below 5 MB."); const parsed = parseCsv(await file.text()); if (parsed.length > 10000) throw new Error("CSV exceeds 10,000 records."); setResults(parsed); setPreview(undefined); setMessage(parsed.length + " source records loaded. Only the selected assessment and attempt will be used."); }); }} /></label>
        <button className="wf-button" disabled={busy || !status.connected || !status.automated || !profile.module || !profile.assessment} onClick={() => run(async () => { const data = await api("results", profile); setResults(data.results); setPreview(undefined); setMessage("Retrieved " + data.results.length + " authorized Moodle records."); })}>Retrieve from Moodle / Turnitin</button>
        <p className="ss-note">{status.automated ? "Institution-authorized Moodle results service configured." : "Automatic retrieval requires an institution-authorized service exposing Turnitin User IDs and Similarity Scores. It is not connected."}</p>
      </div>
    </div>
    
    {sheet && <div className="ss-mapping"><h3>4. Column mapping</h3><div className="ss-grid ss-columns">{(["email", "studentId", "userId", "similarity"] as const).map(key => <label key={key}>{({ email: "Email (match)", studentId: "Student ID (match)", userId: "Turnitin User ID (write)", similarity: "Similarity score 0–100 (write)" })[key]}<select disabled={busy} value={profile.mapping[key]} onChange={e => change({ mapping: { ...profile.mapping, [key]: Number(e.target.value) } })}><option value={-1}>{key === "email" || key === "studentId" ? "Not used" : "Select output column"}</option>{sheet.values[0]?.map((header, i) => <option key={i} value={i}>{column(sheet.columnIndex + i)} · {String(header || "Unnamed")}</option>)}</select></label>)}</div></div>}
    <div className="ss-actions"><button className="wf-button" disabled={busy || !profile.module || !profile.assessment || !profile.link || !profile.sheet || !sheet} onClick={() => { try { if (!sheet) return; planChanges(sheet, [{ email: "validation@example.edu", studentId: "", userId: "1", similarity: "0", assessment: profile.assessment, attempt: profile.attempt }], profile.mapping, profile.assessment, profile.attempt); const saved = { ...profile, id: profile.id || crypto.randomUUID() }; const next = [saved, ...profiles.filter(p => p.id !== saved.id)]; localStorage.setItem("gradezy_smartsync_profiles", JSON.stringify(next)); setProfiles(next); setProfile(saved); setMessage("Workbook link and mappings saved in this browser."); } catch(e) { setError(e instanceof Error ? e.message : "Could not save setup."); } }}>Save setup</button>
    <button className="wf-button primary" disabled={busy || !valid || !status.connected} onClick={() => run(async () => { setPreview(undefined); setPreview(await api("preview", { ...profile, results })); })}>{busy ? "Working…" : "Preview changes"}</button></div>
    {preview && <div className="ss-preview"><h3>Preview · {preview.changes.length} cell changes · {preview.issues.length} flagged records</h3><p>{preview.unchanged} cells already match. Similarity values are written as numbers from 0 to 100.</p>
      {preview.issues.length > 0 && <div role="alert" className="ss-test"><strong>Sync blocked. Resolve all flagged records and preview again.</strong><ul>{preview.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}
      <div className="ss-table"><table><thead><tr><th>Student</th><th>Cell</th><th>Current value</th><th>Proposed value</th></tr></thead><tbody>{preview.changes.map(c => <tr key={c.address}><td>{c.student}</td><td>{c.address}</td><td>{String(c.before || "—")}</td><td>{c.after}</td></tr>)}</tbody></table></div>
      <button className="wf-button primary" disabled={busy || !preview.ticket || !preview.changes.length || !!preview.issues.length} onClick={() => run(async () => { const ticket = preview.ticket; setPreview(undefined); const data = await api("sync", { ticket }); setMessage("Microsoft confirmed " + data.completed + " cell updates. Reload the workbook to review."); setSheet(undefined); })}>Sync to Excel</button>
    </div>}
    <p className="ss-note">Saved setups are local to this browser. Each update requires a fresh preview. Resubmissions use a separate attempt and can have their own worksheet and output columns.</p>
  </section>;
}
