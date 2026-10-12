export type Result = { email: string; studentId: string; userId: string; similarity: string; assessment: string; attempt: string };
export type Mapping = { email: number; studentId: number; userId: number; similarity: number };
export type Sheet = { values: (string | number | boolean | null)[][]; formulas: unknown[][]; rowIndex: number; columnIndex: number };
export type Change = { address: string; before: unknown; after: string | number; student: string };
export type Plan = { changes: Change[]; issues: string[]; unchanged: number };
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
export function column(index: number): string {
  let out = ""; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
  return out;
}
export function validateMapping(m: Mapping, width: number) {
  const targets = [m.userId, m.similarity];
  if (targets.some(i => !Number.isInteger(i) || i < 0 || i >= width) || targets[0] === targets[1]) throw new Error("Choose two different output columns.");
  const keys = [m.email, m.studentId].filter(i => i >= 0);
  if (!keys.length || keys.some(i => !Number.isInteger(i) || i >= width) || new Set(keys).size !== keys.length || keys.some(i => targets.includes(i))) throw new Error("Choose distinct identity columns, separate from output columns.");
}
export function planChanges(sheet: Sheet, results: Result[], mapping: Mapping, assessment: string, attempt: string): Plan {
  validateMapping(mapping, sheet.values[0]?.length ?? 0);
  const plan: Plan = { changes: [], issues: [], unchanged: 0 };
  const data = results.filter(r => r.assessment === assessment && r.attempt === attempt);
  if (!data.length) throw new Error("No source records for this assessment and attempt.");
  const rows = sheet.values.slice(1);
  const targets = new Map<number, Result[]>();
  const duplicate = (r: Result) => data.filter(other =>
    (norm(r.email) && norm(r.email) === norm(other.email)) ||
    (norm(r.studentId) && norm(r.studentId) === norm(other.studentId))).length > 1;
  for (const r of data) {
    const label = r.email || r.studentId || "Unidentified record";
    if (!r.userId.trim() || !/^\d+(?:\.\d+)?%?$/.test(r.similarity.trim()) || Number(r.similarity.replace("%", "")) > 100 || /^[=+\-@]/.test(r.userId.trim())) {
      plan.issues.push(label + ": invalid User ID or similarity score."); continue;
    }
    if (duplicate(r)) { plan.issues.push(label + ": duplicate source identity."); continue; }
    const emails = mapping.email < 0 || !norm(r.email) ? [] : rows.flatMap((row, i) => norm(row[mapping.email]) === norm(r.email) ? [i] : []);
    const ids = mapping.studentId < 0 || !norm(r.studentId) ? [] : rows.flatMap((row, i) => norm(row[mapping.studentId]) === norm(r.studentId) ? [i] : []);
    const matches = [...new Set([...emails, ...ids])];
    if (emails.length > 1 || ids.length > 1 || matches.length > 1) { plan.issues.push(label + ": duplicate or conflicting workbook identities."); continue; }
    if (!matches.length) { plan.issues.push(label + ": student missing from workbook."); continue; }
    const i = matches[0], row = rows[i];
    if ((mapping.email >= 0 && norm(r.email) && norm(row[mapping.email]) && norm(r.email) !== norm(row[mapping.email])) ||
        (mapping.studentId >= 0 && norm(r.studentId) && norm(row[mapping.studentId]) && norm(r.studentId) !== norm(row[mapping.studentId]))) {
      plan.issues.push(label + ": email and student ID disagree."); continue;
    }
    targets.set(i, [...(targets.get(i) ?? []), r]);
  }
  for (const [i, records] of targets) {
    const r = records[0], label = r.email || r.studentId;
    if (records.length > 1) { plan.issues.push(label + ": multiple records target the same student."); continue; }
    const updates: [number, string | number][] = [[mapping.userId, r.userId.trim()], [mapping.similarity, Number(r.similarity.replace("%", ""))]];
    if (updates.some(([c]) => typeof sheet.formulas[i + 1]?.[c] === "string" && String(sheet.formulas[i + 1][c]).startsWith("="))) {
      plan.issues.push(label + ": output contains a protected formula."); continue;
    }
    for (const [c, after] of updates) {
      const before = rows[i][c] ?? "";
      if (String(before) === String(after)) { plan.unchanged++; continue; }
      plan.changes.push({ address: column(sheet.columnIndex + c) + (sheet.rowIndex + i + 2), before, after, student: label });
    }
  }
  return plan;
}
