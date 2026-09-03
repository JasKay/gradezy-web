/**
 * Gradezy Assessment Readiness Checking
 *
 * Verifies that an assessment meets all requirements before publishing
 */

import { Issue, IssueSeverity } from "./issues";

export type ReadinessCheckType =
  | "data_complete"
  | "reconciliation_complete"
  | "critical_issues_resolved"
  | "metadata_complete"
  | "no_pending_actions";

export type ReadinessCheckStatus = "pass" | "fail" | "warning";

export type ReadinessCheckResult = {
  type: ReadinessCheckType;
  status: ReadinessCheckStatus;
  title: string;
  description: string;
  passedAt?: string;
  failureReason?: string;
};

export type AssessmentReadiness = {
  assessmentId: string;
  overallStatus: "ready" | "not_ready" | "at_risk";
  percentComplete: number;
  checks: ReadinessCheckResult[];
  criticalIssuesRemaining: number;
  readyAt?: string;
  updatedAt: string;
};

/**
 * Check if assessment data is complete
 */
export function checkDataComplete(
  expectedCount: number,
  actualCount: number
): ReadinessCheckResult {
  if (expectedCount > 0 && actualCount > 0) {
    return {
      type: "data_complete",
      status: "pass",
      title: "Assessment data uploaded",
      description: `Expected students: ${expectedCount}, Assessment system: ${actualCount}`,
      passedAt: new Date().toISOString(),
    };
  }

  return {
    type: "data_complete",
    status: "fail",
    title: "Assessment data missing",
    description:
      "Both Progress Tracker (expected students) and assessment system export (actual students) must be uploaded.",
    failureReason:
      expectedCount === 0 ? "Progress Tracker not uploaded" : "Assessment system data not uploaded",
  };
}

/**
 * Check if reconciliation has been completed
 */
export function checkReconciliationComplete(
  reconciliationResultsCount: number
): ReadinessCheckResult {
  if (reconciliationResultsCount > 0) {
    return {
      type: "reconciliation_complete",
      status: "pass",
      title: "Reconciliation complete",
      description: `Matched and compared ${reconciliationResultsCount} records.`,
      passedAt: new Date().toISOString(),
    };
  }

  return {
    type: "reconciliation_complete",
    status: "fail",
    title: "Reconciliation not completed",
    description: "Run reconciliation to match expected and actual student data.",
  };
}

/**
 * Check if critical issues are resolved
 */
export function checkCriticalIssuesResolved(
  issues: Issue[]
): ReadinessCheckResult {
  const criticalOpen = issues.filter(
    (i) => i.severity === "critical" && i.status === "open"
  );

  if (criticalOpen.length === 0) {
    const criticalResolved = issues.filter((i) => i.severity === "critical");
    return {
      type: "critical_issues_resolved",
      status: "pass",
      title: "No critical issues remaining",
      description:
        criticalResolved.length > 0
          ? `All ${criticalResolved.length} critical issues have been addressed.`
          : "No critical issues detected.",
      passedAt: new Date().toISOString(),
    };
  }

  return {
    type: "critical_issues_resolved",
    status: "fail",
    title: "Critical issues remaining",
    description: `${criticalOpen.length} critical issue${criticalOpen.length === 1 ? "" : "s"} must be resolved before publishing.`,
    failureReason: `${criticalOpen.length} critical issue${criticalOpen.length === 1 ? "" : "s"} in open or in_review status`,
  };
}

/**
 * Check if assessment metadata is complete
 */
export function checkMetadataComplete(assessment: {
  name?: string;
  module?: string;
  level?: string;
  cohort?: string;
  assessmentType?: string;
  dueDate?: string;
}): ReadinessCheckResult {
  const required = ["name", "module", "level", "cohort", "assessmentType"];
  const missing = required.filter((field) => !assessment[field as keyof typeof assessment]);

  if (missing.length === 0) {
    return {
      type: "metadata_complete",
      status: "pass",
      title: "Assessment metadata complete",
      description: `${assessment.name} · ${assessment.module} · ${assessment.level} · ${assessment.cohort}`,
      passedAt: new Date().toISOString(),
    };
  }

  return {
    type: "metadata_complete",
    status: "fail",
    title: "Assessment metadata incomplete",
    description: `Missing: ${missing.join(", ")}. All fields are required.`,
    failureReason: `Missing fields: ${missing.join(", ")}`,
  };
}

/**
 * Check if there are no pending actions
 */
export function checkNoPendingActions(issues: Issue[]): ReadinessCheckResult {
  const inReview = issues.filter((i) => i.status === "in_review");

  if (inReview.length === 0) {
    return {
      type: "no_pending_actions",
      status: "pass",
      title: "No pending reviews",
      description: "All issues have been resolved or dismissed.",
      passedAt: new Date().toISOString(),
    };
  }

  return {
    type: "no_pending_actions",
    status: "warning",
    title: "Issues in review",
    description: `${inReview.length} issue${inReview.length === 1 ? "" : "s"} still in review status.`,
    failureReason: `${inReview.length} issue${inReview.length === 1 ? "" : "s"} in in_review status`,
  };
}

/**
 * Calculate overall readiness status
 */
export function calculateReadiness(
  checks: ReadinessCheckResult[],
  criticalIssuesCount: number
): "ready" | "not_ready" | "at_risk" {
  const hasFailures = checks.some((c) => c.status === "fail");
  const hasWarnings = checks.some((c) => c.status === "warning");

  if (hasFailures || criticalIssuesCount > 0) {
    return "not_ready";
  }

  if (hasWarnings) {
    return "at_risk";
  }

  return "ready";
}

/**
 * Run all readiness checks
 */
export function runReadinessChecks(
  assessment: {
    id: string;
    name?: string;
    module?: string;
    level?: string;
    cohort?: string;
    assessmentType?: string;
    dueDate?: string;
  },
  expectedStudentsCount: number,
  actualStudentsCount: number,
  reconciliationResultsCount: number,
  issues: Issue[]
): AssessmentReadiness {
  const checks: ReadinessCheckResult[] = [
    checkDataComplete(expectedStudentsCount, actualStudentsCount),
    checkReconciliationComplete(reconciliationResultsCount),
    checkCriticalIssuesResolved(issues),
    checkMetadataComplete(assessment),
    checkNoPendingActions(issues),
  ];

  const criticalOpen = issues.filter(
    (i) => i.severity === "critical" && i.status === "open"
  ).length;

  const overallStatus = calculateReadiness(checks, criticalOpen);

  const passedChecks = checks.filter((c) => c.status === "pass").length;
  const percentComplete = Math.round((passedChecks / checks.length) * 100);

  return {
    assessmentId: assessment.id,
    overallStatus,
    percentComplete,
    checks,
    criticalIssuesRemaining: criticalOpen,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get status label
 */
export function getReadinessStatusLabel(status: "ready" | "not_ready" | "at_risk"): string {
  const labels = {
    ready: "Ready to publish",
    not_ready: "Not ready",
    at_risk: "Review required",
  };
  return labels[status];
}

/**
 * Get status color
 */
export function getReadinessStatusColor(status: "ready" | "not_ready" | "at_risk"): string {
  const colors = {
    ready: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    not_ready: "bg-red-400/10 text-red-300 border-red-400/20",
    at_risk: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  };
  return colors[status];
}

/**
 * Get check icon
 */
export function getCheckIcon(status: ReadinessCheckStatus): string {
  const icons = {
    pass: "✓",
    fail: "✕",
    warning: "⚠",
  };
  return icons[status];
}

/**
 * Get check color
 */
export function getCheckColor(status: ReadinessCheckStatus): string {
  const colors = {
    pass: "text-emerald-400",
    fail: "text-red-400",
    warning: "text-amber-400",
  };
  return colors[status];
}
