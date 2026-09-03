/**
 * Gradezy Issues Engine
 *
 * Detects exceptions and issues from reconciliation results
 * and manages their lifecycle (open, in review, resolved, dismissed).
 */

import {
  ReconciliationResult,
} from "./reconciliation";

export type IssueSeverity = "critical" | "warning" | "info";

export type IssueStatus = "open" | "in_review" | "resolved" | "dismissed";

export type IssueType =
  | "missing_student"
  | "missing_grade"
  | "unexpected_student"
  | "name_mismatch"
  | "duplicate_record"
  | "missing_ncg_id";

export type Issue = {
  id: string;
  assessmentId: string;
  type: IssueType;
  severity: IssueSeverity;
  status: IssueStatus;
  title: string;
  description: string;
  reconciliationResultId: string;
  expectedStudentNcgId?: string;
  actualStudentNcgId?: string;
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
};

/**
 * Generate issues from reconciliation results.
 *
 * Supports both:
 *
 * generateIssuesFromReconciliation(results)
 *
 * and the preferred:
 *
 * generateIssuesFromReconciliation(assessmentId, results)
 *
 * The one-argument form is kept for compatibility with the
 * current reconciliation page while the application is being
 * built out.
 */
export function generateIssuesFromReconciliation(
  results: ReconciliationResult[]
): Issue[];

export function generateIssuesFromReconciliation(
  assessmentId: string,
  results: ReconciliationResult[]
): Issue[];

export function generateIssuesFromReconciliation(
  assessmentIdOrResults: string | ReconciliationResult[],
  maybeResults?: ReconciliationResult[]
): Issue[] {
  const assessmentId =
    typeof assessmentIdOrResults === "string"
      ? assessmentIdOrResults
      : "";

  const results =
    typeof assessmentIdOrResults === "string"
      ? maybeResults ?? []
      : assessmentIdOrResults;

  const issues: Issue[] = [];
  const now = new Date().toISOString();

  for (const result of results) {
    const baseIssue = {
      assessmentId,
      status: "open" as IssueStatus,
      createdAt: now,
      reconciliationResultId: result.id,
    };

    switch (result.status) {
      case "missing":
        if (result.expectedStudent) {
          issues.push({
            id: `issue-${result.id}`,
            type: "missing_student",
            severity: "critical",
            title: `Student not found: ${result.expectedStudent.firstName} ${result.expectedStudent.lastName}`,
            description: `${result.expectedStudent.firstName} ${result.expectedStudent.lastName} (${result.expectedStudent.ncgId}) appears in the expected data (Progress Tracker) but was not found in the assessment system.`,
            expectedStudentNcgId: result.expectedStudent.ncgId,
            ...baseIssue,
          });
        }
        break;

      case "name_mismatch":
        if (result.expectedStudent && result.actualStudents[0]) {
          const expected = result.expectedStudent;
          const actual = result.actualStudents[0];

          issues.push({
            id: `issue-${result.id}`,
            type: "name_mismatch",
            severity: "warning",
            title: `Name mismatch for ${expected.ncgId}`,
            description: `NCG ID ${expected.ncgId} matches, but the names differ. Expected: ${expected.firstName} ${expected.lastName}, Actual: ${actual.firstName} ${actual.lastName}. Verify this is the same person.`,
            expectedStudentNcgId: expected.ncgId,
            actualStudentNcgId: actual.ncgId,
            ...baseIssue,
          });
        }
        break;

      case "duplicate":
        if (result.expectedStudent) {
          issues.push({
            id: `issue-${result.id}`,
            type: "duplicate_record",
            severity: "critical",
            title: `Duplicate NCG ID: ${result.expectedStudent.ncgId}`,
            description: `NCG ID ${result.expectedStudent.ncgId} appears ${result.actualStudents.length} times in the assessment system. This indicates a data integrity issue.`,
            expectedStudentNcgId: result.expectedStudent.ncgId,
            ...baseIssue,
          });
        }
        break;

      case "unexpected":
        if (result.actualStudents[0]) {
          const actual = result.actualStudents[0];

          issues.push({
            id: `issue-${result.id}`,
            type: "unexpected_student",
            severity: "info",
            title: `Unexpected student: ${actual.firstName} ${actual.lastName}`,
            description: `${actual.firstName} ${actual.lastName} (${actual.ncgId || "No NCG ID"}) appears in the assessment system but was not in the expected students list.`,
            actualStudentNcgId: actual.ncgId,
            ...baseIssue,
          });
        }
        break;

      case "missing_id":
        if (result.expectedStudent) {
          issues.push({
            id: `issue-${result.id}`,
            type: "missing_ncg_id",
            severity: "warning",
            title: `Missing NCG ID: ${result.expectedStudent.firstName} ${result.expectedStudent.lastName}`,
            description: `${result.expectedStudent.firstName} ${result.expectedStudent.lastName} has no NCG ID in the expected data. Cannot reliably reconcile without an NCG ID.`,
            ...baseIssue,
          });
        }
        break;

      case "matched":
        // No issue should be generated for a successfully matched student.
        break;
    }
  }

  return issues;
}

/**
 * Filter issues by status.
 */
export function filterByIssueStatus(
  issues: Issue[],
  status: IssueStatus | "all"
): Issue[] {
  if (status === "all") {
    return issues;
  }

  return issues.filter((issue) => issue.status === status);
}

/**
 * Filter issues by type.
 */
export function filterByIssueType(
  issues: Issue[],
  type: IssueType | "all"
): Issue[] {
  if (type === "all") {
    return issues;
  }

  return issues.filter((issue) => issue.type === type);
}

/**
 * Get issue type label.
 */
export function getIssueTypeLabel(type: IssueType): string {
  const labels: Record<IssueType, string> = {
    missing_student: "Missing student",
    missing_grade: "Missing grade",
    unexpected_student: "Unexpected student",
    name_mismatch: "Name mismatch",
    duplicate_record: "Duplicate record",
    missing_ncg_id: "Missing NCG ID",
  };

  return labels[type];
}

/**
 * Get issue status label.
 */
export function getIssueStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    open: "Open",
    in_review: "In review",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };

  return labels[status];
}

/**
 * Get severity color.
 */
export function getSeverityColor(severity: IssueSeverity): string {
  const colors: Record<IssueSeverity, string> = {
    critical: "bg-red-400/10 text-red-300 border-red-400/20",
    warning: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    info: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  };

  return colors[severity];
}

/**
 * Get status color.
 */
export function getIssueStatusColor(status: IssueStatus): string {
  const colors: Record<IssueStatus, string> = {
    open: "bg-red-400/10 text-red-300 border-red-400/20",
    in_review: "bg-amber-400/10 text-amber-300 border-amber-400/20",
    resolved: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    dismissed: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  };

  return colors[status];
}

/**
 * Count issues by severity.
 */
export function countBySeverity(
  issues: Issue[]
): Record<IssueSeverity, number> {
  return {
    critical: issues.filter((issue) => issue.severity === "critical").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };
}

/**
 * Count issues by status.
 */
export function countByStatus(
  issues: Issue[]
): Record<IssueStatus, number> {
  return {
    open: issues.filter((issue) => issue.status === "open").length,
    in_review: issues.filter((issue) => issue.status === "in_review").length,
    resolved: issues.filter((issue) => issue.status === "resolved").length,
    dismissed: issues.filter((issue) => issue.status === "dismissed").length,
  };
}