/**
 * Gradezy Reconciliation Engine
 * 
 * Compares expected students (from Progress Tracker) against actual students
 * (from assessment system like StaffAdvantage) and identifies matches, mismatches,
 * and exceptions.
 */

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
  matched: number;
  missing: number;
  unexpected: number;
  nameMismatch: number;
  duplicate: number;
  missingId: number;
};

/**
 * Normalize names for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Check if names match
 */
function namesMatch(
  expected: { firstName: string; lastName: string },
  actual: { firstName: string; lastName: string }
): boolean {
  const expectedFirst = normalizeName(expected.firstName);
  const expectedLast = normalizeName(expected.lastName);
  const actualFirst = normalizeName(actual.firstName);
  const actualLast = normalizeName(actual.lastName);

  return expectedFirst === actualFirst && expectedLast === actualLast;
}

/**
 * Main reconciliation engine
 * 
 * Compares expected and actual student datasets and returns detailed results
 */
export function reconcileStudents(
  expected: ExpectedStudent[],
  actual: ActualStudent[]
): ReconciliationResult[] {
  const results: ReconciliationResult[] = [];
  
  // Create a map of actual students by NCG ID for quick lookup
  const actualByNcgId = new Map<string, ActualStudent[]>();
  const processedActualIds = new Set<string>();

  for (const student of actual) {
    if (!student.ncgId) {
      // Students without NCG IDs are handled separately as unexpected
      results.push({
        id: `actual-no-id-${results.length}`,
        expectedStudent: null,
        actualStudents: [student],
        status: "unexpected",
      });
      processedActualIds.add(`${student.firstName}-${student.lastName}`);
    } else {
      const normalizedId = student.ncgId.toLowerCase().trim();
      if (!actualByNcgId.has(normalizedId)) {
        actualByNcgId.set(normalizedId, []);
      }
      actualByNcgId.get(normalizedId)!.push(student);
    }
  }

  // Process each expected student
  for (const expectedStudent of expected) {
    let status: ReconciliationStatus;
    let actualStudents: ActualStudent[] = [];

    if (!expectedStudent.ncgId) {
      // Expected student has no NCG ID - cannot reliably match
      status = "missing_id";
    } else {
      const normalizedId = expectedStudent.ncgId.toLowerCase().trim();
      const matchingActual = actualByNcgId.get(normalizedId) || [];

      if (matchingActual.length === 0) {
        // No actual student with this NCG ID found
        status = "missing";
      } else if (matchingActual.length > 1) {
        // Multiple actual students with same NCG ID
        status = "duplicate";
        actualStudents = matchingActual;
      } else {
        // Exactly one match - check if names agree
        const actualStudent = matchingActual[0];
        actualStudents = [actualStudent];

        if (
          namesMatch(expectedStudent, {
            firstName: actualStudent.firstName,
            lastName: actualStudent.lastName,
          })
        ) {
          status = "matched";
        } else {
          status = "name_mismatch";
        }

        // Mark this actual student as processed
        processedActualIds.add(normalizedId);
      }
    }

    results.push({
      id: `expected-${expectedStudent.ncgId}-${results.length}`,
      expectedStudent,
      actualStudents,
      status,
    });
  }

  // Find unexpected students (actual students not matched to any expected student)
  for (const [ncgId, students] of actualByNcgId.entries()) {
    if (!processedActualIds.has(ncgId)) {
      for (const student of students) {
        results.push({
          id: `actual-${ncgId}-${results.length}`,
          expectedStudent: null,
          actualStudents: [student],
          status: "unexpected",
        });
      }
    }
  }

  return results;
}

/**
 * Calculate summary statistics from reconciliation results
 */
export function calculateSummary(results: ReconciliationResult[]): ReconciliationSummary {
  const summary: ReconciliationSummary = {
    total: results.length,
    matched: 0,
    missing: 0,
    unexpected: 0,
    nameMismatch: 0,
    duplicate: 0,
    missingId: 0,
  };

  for (const result of results) {
    switch (result.status) {
      case "matched":
        summary.matched++;
        break;
      case "missing":
        summary.missing++;
        break;
      case "unexpected":
        summary.unexpected++;
        break;
      case "name_mismatch":
        summary.nameMismatch++;
        break;
      case "duplicate":
        summary.duplicate++;
        break;
      case "missing_id":
        summary.missingId++;
        break;
    }
  }

  return summary;
}

/**
 * Filter reconciliation results by status
 */
export function filterByStatus(
  results: ReconciliationResult[],
  status: ReconciliationStatus | "all"
): ReconciliationResult[] {
  if (status === "all") {
    return results;
  }
  return results.filter((r) => r.status === status);
}

/**
 * Format status for display
 */
export function formatStatus(status: ReconciliationStatus): string {
  const labels: Record<ReconciliationStatus, string> = {
    matched: "Matched",
    missing: "Missing",
    unexpected: "Unexpected",
    name_mismatch: "Name mismatch",
    duplicate: "Duplicate",
    missing_id: "Missing ID",
  };
  return labels[status];
}

/**
 * Get status display color/style class
 */
export function getStatusColor(status: ReconciliationStatus): string {
  const colors: Record<ReconciliationStatus, string> = {
    matched: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    missing: "bg-red-400/10 text-red-300 border-red-400/20",
    unexpected: "bg-orange-400/10 text-orange-300 border-orange-400/20",
    name_mismatch: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    duplicate: "bg-purple-400/10 text-purple-300 border-purple-400/20",
    missing_id: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  };
  return colors[status];
}
