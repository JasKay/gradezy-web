export type ExpectedStudent = {
  ncgId: string;
  firstName: string;
  lastName: string;
  grade: string;
};
export type ActualStudent = {
  ncgId: string;
  firstName: string;
  lastName: string;
  grade?: string;
};
export type ReconciliationStatus =
  | "matched"
  | "missing"
  | "unexpected"
  | "name_mismatch"
  | "grade_mismatch"
  | "duplicate"
  | "missing_id";
export type ReconciliationResult = {
  id: string;
  expectedStudent: ExpectedStudent | null;
  actualStudents: ActualStudent[];
  status: ReconciliationStatus;
  nameMatch?: boolean;
  gradeMatch?: boolean;
};
export type ReconciliationSummary = {
  total: number;
  expected: number;
  matched: number;
  missing: number;
  unexpected: number;
  nameMismatch: number;
  gradeMismatch: number;
  duplicate: number;
  missingId: number;
};
const normalise = (value: string | undefined) =>
  (value || "").trim().toLowerCase().replace(/\s+/g, " ");
export function reconcileStudents(
  expected: ExpectedStudent[],
  actual: ActualStudent[],
): ReconciliationResult[] {
  const results: ReconciliationResult[] = [];
  const actualById = new Map<string, ActualStudent[]>();
  const seen = new Set<string>();
  const expectedCounts = new Map<string, number>();
  for (const s of expected) {
    const id = normalise(s.ncgId);
    if (id) expectedCounts.set(id, (expectedCounts.get(id) || 0) + 1);
  }
  for (const [i, s] of actual.entries()) {
    const id = normalise(s.ncgId);
    if (!id)
      results.push({
        id: `actual-no-id-${i}`,
        expectedStudent: null,
        actualStudents: [s],
        status: "missing_id",
      });
    else actualById.set(id, [...(actualById.get(id) || []), s]);
  }
  const occurrences = new Map<string, number>();
  for (const [i, s] of expected.entries()) {
    const id = normalise(s.ncgId);
    const matches = actualById.get(id) || [];
    const occurrence = occurrences.get(id) || 0;
    occurrences.set(id, occurrence + 1);
    if (id) seen.add(id);
    let status: ReconciliationStatus;
    let nameMatch: boolean | undefined;
    let gradeMatch: boolean | undefined;
    if (!id) status = "missing_id";
    else if ((expectedCounts.get(id) || 0) > 1 || matches.length > 1)
      status = "duplicate";
    else if (!matches.length) status = "missing";
    else {
      nameMatch =
        normalise(s.firstName) === normalise(matches[0].firstName) &&
        normalise(s.lastName) === normalise(matches[0].lastName);
      gradeMatch =
        normalise(s.grade) && normalise(matches[0].grade)
          ? normalise(s.grade) === normalise(matches[0].grade)
          : undefined;
      status = !nameMatch
        ? "name_mismatch"
        : gradeMatch === false
          ? "grade_mismatch"
          : "matched";
    }
    results.push({
      id: id ? `expected-${id}-${occurrence}` : `expected-no-id-${i}`,
      expectedStudent: s,
      actualStudents: matches,
      status,
      nameMatch,
      gradeMatch,
    });
  }
  for (const [id, students] of actualById) {
    if (!seen.has(id))
      for (const [i, s] of students.entries())
        results.push({
          id: `actual-${id}-${i}`,
          expectedStudent: null,
          actualStudents: [s],
          status: "unexpected",
        });
  }
  return results;
}
export function calculateSummary(
  results: ReconciliationResult[],
): ReconciliationSummary {
  const summary: ReconciliationSummary = {
    total: results.length,
    expected: 0,
    matched: 0,
    missing: 0,
    unexpected: 0,
    nameMismatch: 0,
    gradeMismatch: 0,
    duplicate: 0,
    missingId: 0,
  };
  const keys = {
    matched: "matched",
    missing: "missing",
    unexpected: "unexpected",
    name_mismatch: "nameMismatch",
    grade_mismatch: "gradeMismatch",
    duplicate: "duplicate",
    missing_id: "missingId",
  } as const;
  for (const r of results) {
    summary[keys[r.status]]++;
    if (r.expectedStudent) summary.expected++;
  }
  return summary;
}
export function filterByStatus(
  results: ReconciliationResult[],
  status: ReconciliationStatus | "all",
) {
  return status === "all"
    ? results
    : results.filter((r) => r.status === status);
}
export function formatStatus(status: ReconciliationStatus): string {
  return {
    matched: "Matched",
    missing: "Missing",
    unexpected: "Unexpected",
    name_mismatch: "Name mismatch",
    grade_mismatch: "Grade mismatch",
    duplicate: "Duplicate",
    missing_id: "Missing ID",
  }[status];
}
export function getStatusColor(status: ReconciliationStatus): string {
  return {
    matched: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    missing: "bg-red-400/10 text-red-300 border-red-400/20",
    unexpected: "bg-orange-400/10 text-orange-300 border-orange-400/20",
    name_mismatch: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    grade_mismatch: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    duplicate: "bg-purple-400/10 text-purple-300 border-purple-400/20",
    missing_id: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  }[status];
}
