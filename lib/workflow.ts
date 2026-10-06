export const SUBJECTS = [
  "Business Management",
  "Computer Science",
  "Health and Social Care",
] as const;
export type Subject = (typeof SUBJECTS)[number];
export const STAGES = [
  { key: "allocation", label: "Marker allocation", days: 3 },
  { key: "resubmission", label: "Resubmission", days: 7 },
  { key: "marking", label: "Marking", days: 10 },
  { key: "moderation", label: "Internal moderation", days: 21 },
  { key: "release", label: "Grade release", days: 30 },
] as const;
export type Stage = (typeof STAGES)[number]["key"];
export type Cohort = { id: string; name: string; startMonth: string };
export type Student = {
  id: string;
  ncgId: string;
  firstName: string;
  lastName: string;
  enrolments: { cohortId: string; subject: Subject }[];
  profile?: Record<string, string>;
  sample?: boolean;
};
export type Marker = { id: string; name: string };
export type Progress = {
  studentId: string;
  markerId: string;
  submission: "awaiting" | "submitted" | "resubmission";
  grade: string;
  allocatedAt?: string;
  submittedAt?: string;
  markedAt?: string;
  reviewer: string;
  reviewedAt?: string;
  releasedAt?: string;
  notes: string;
  attempts?: {
    first: Record<string, string>;
    resubmission: Record<string, string>;
  };
  activeAttempt?: "first" | "resubmission";
};
export type Assessment = {
  id: string;
  name: string;
  module: string;
  cohortId: string;
  subject: Subject | "";
  issueDate: string;
  offsets: Record<Stage, number>;
  records: Progress[];
  legacy?: boolean;
  createdAt: string;
  operations?: Record<string, string>;
  sample?: boolean;
};
export type UploadRow = {
  studentId: string;
  ncgId: string;
  firstName: string;
  lastName: string;
  assessment: string;
  module: string;
  subject: string;
  cohort: string;
  grade: string;
  reviewer: string;
  reviewedAt: string;
};
export const UPLOAD_FIELDS = [
  "ncgId",
  "firstName",
  "lastName",
  "assessment",
  "module",
  "subject",
  "cohort",
  "grade",
  "reviewer",
  "reviewedAt",
] as const;
export type UploadField = (typeof UPLOAD_FIELDS)[number];
export type UploadMapping = Record<UploadField, string>;
export type Batch = {
  id: string;
  assessmentId: string;
  createdAt: string;
  fingerprint: string;
  rows: UploadRow[];
  mapping: UploadMapping;
  downloadedAt?: string;
  uploadedAt?: string;
  reference?: string;
};
export type Workflow = {
  version: 1;
  revision: number;
  cohorts: Cohort[];
  students: Student[];
  markers: Marker[];
  assessments: Assessment[];
  batches: Batch[];
  mapping: UploadMapping;
  templateConfirmed: boolean;
  learningProgress?: {
    assessmentId: string;
    studentId: string;
    values: Record<string, string>;
  }[];
  sources?: {
    id: string;
    label: string;
    url: string;
    system: string;
    cohortId: string;
    subject: string;
  }[];
  imports?: {
    id: string;
    fileName: string;
    sheetName: string;
    kind: string;
    system: string;
    at: string;
    rows: number;
  }[];
  activity: { id: string; at: string; text: string }[];
};
export const WORKFLOW_KEY = "gradezy_workflow_v1";
export const defaultOffsets = (): Record<Stage, number> =>
  Object.fromEntries(STAGES.map((s) => [s.key, s.days])) as Record<
    Stage,
    number
  >;
export const defaultMapping = (): UploadMapping =>
  Object.fromEntries(UPLOAD_FIELDS.map((f) => [f, f])) as UploadMapping;
export const canonicalId = (id: string) => id.trim().toLowerCase();
export const emptyProgress = (studentId: string): Progress => ({
  studentId,
  markerId: "",
  submission: "awaiting",
  grade: "",
  reviewer: "",
  notes: "",
});
export function emptyWorkflow(): Workflow {
  return {
    version: 1,
    revision: 0,
    cohorts: Array.from({ length: 6 }, (_, i) => ({
      id: `cohort-${i + 1}`,
      name: `Cohort ${i + 1}`,
      startMonth: [
        "2023-10",
        "2024-02",
        "2024-10",
        "2025-02",
        "2025-10",
        "2026-02",
      ][i],
    })),
    students: [],
    markers: [],
    assessments: [],
    batches: [],
    mapping: defaultMapping(),
    templateConfirmed: false,
    activity: [],
  };
}
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function targetDate(issueDate: string, offset: number): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) ||
    !Number.isInteger(offset) ||
    offset < 0
  )
    return "";
  const date = new Date(`${issueDate}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== issueDate
  )
    return "";
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function validateSchedule(a: Assessment): string[] {
  const errors: string[] = [];
  if (!a.name.trim() || !a.module.trim())
    errors.push("Assessment name and module code are required.");
  if (!SUBJECTS.includes(a.subject as Subject))
    errors.push("Choose a subject.");
  if (!targetDate(a.issueDate, 0)) errors.push("Choose a valid issue date.");
  if (
    STAGES.some(
      (s, i) =>
        !Number.isInteger(a.offsets[s.key]) ||
        a.offsets[s.key] < 0 ||
        (i > 0 && a.offsets[s.key] < a.offsets[STAGES[i - 1].key]),
    )
  )
    errors.push(
      "Milestones must use non-negative whole days in timeline order.",
    );
  return errors;
}
export function canReview(r: Progress, w: Workflow): boolean {
  return (
    r.submission === "submitted" &&
    !!r.grade.trim() &&
    w.markers.some((m) => m.id === r.markerId) &&
    !!r.markedAt
  );
}
export function isReviewed(r: Progress, w: Workflow): boolean {
  return canReview(r, w) && !!r.reviewer.trim() && !!r.reviewedAt;
}
export function updateProgress(
  r: Progress,
  patch: Partial<Progress>,
  w: Workflow,
  now = new Date().toISOString(),
): Progress {
  const next = { ...r, ...patch, studentId: r.studentId };
  const materialChanged =
    next.grade !== r.grade ||
    next.markerId !== r.markerId ||
    next.submission !== r.submission;
  if (next.markerId !== r.markerId)
    next.allocatedAt = w.markers.some((m) => m.id === next.markerId)
      ? now
      : undefined;
  if (next.submission !== r.submission)
    next.submittedAt = next.submission === "submitted" ? now : undefined;
  if (materialChanged) {
    next.reviewedAt = undefined;
    next.reviewer = "";
    next.releasedAt = undefined;
    next.markedAt =
      next.grade.trim() &&
      next.submission === "submitted" &&
      w.markers.some((m) => m.id === next.markerId)
        ? now
        : undefined;
  }
  if (!canReview(next, w)) {
    next.reviewedAt = undefined;
    next.releasedAt = undefined;
  }
  if (next.reviewer !== r.reviewer && !patch.reviewedAt) {
    next.reviewedAt = undefined;
    next.releasedAt = undefined;
  }
  if (patch.reviewedAt && !isReviewed(next, w))
    throw new Error(
      "A submitted result, assigned marker, grade and reviewer are required before approval.",
    );
  if (patch.releasedAt && !isReviewed(next, w))
    throw new Error("Review the grade before recording release.");
  return next;
}
export function stageProgress(
  a: Assessment,
  w: Workflow,
  stage: Stage,
  date = today(),
) {
  const total = a.records.length;
  const done = a.records.filter((r) =>
    stage === "allocation"
      ? w.markers.some((m) => m.id === r.markerId)
      : stage === "resubmission"
        ? r.submission === "submitted"
        : stage === "marking"
          ? canReview(r, w)
          : stage === "moderation"
            ? isReviewed(r, w)
            : !!r.releasedAt && isReviewed(r, w),
  ).length;
  const target = targetDate(a.issueDate, a.offsets[stage]);
  const complete = total > 0 && done === total;
  const times = a.records
    .map((r) =>
      stage === "allocation"
        ? r.allocatedAt
        : stage === "resubmission"
          ? r.submittedAt
          : stage === "marking"
            ? r.markedAt
            : stage === "moderation"
              ? r.reviewedAt
              : r.releasedAt,
    )
    .filter(Boolean);
  const completedAt =
    complete && times.length === total ? times.sort().at(-1) : undefined;
  return {
    done,
    total,
    target,
    complete,
    completedAt,
    completedLate:
      !!completedAt && !!target && completedAt.slice(0, 10) > target,
    overdue: !!target && target < date && !complete,
  };
}
export function blockers(a: Assessment, w: Workflow): string[] {
  const reasons = validateSchedule(a);
  if (!w.cohorts.some((c) => c.id === a.cohortId))
    reasons.push("Choose a cohort.");
  if (!a.records.length)
    reasons.push("No enrolled students linked to this assessment.");
  const unenrolled = a.records.filter(
    (r) =>
      !w.students
        .find((s) => s.id === r.studentId)
        ?.enrolments.some(
          (e) => e.cohortId === a.cohortId && e.subject === a.subject,
        ),
  ).length;
  if (unenrolled)
    reasons.push(unenrolled + " student subject enrolments need confirmation.");
  const count = (predicate: (r: Progress) => boolean) =>
    a.records.filter(predicate).length;
  const missingIds = count(
    (r) => !w.students.some((s) => s.id === r.studentId && s.ncgId.trim()),
  );
  const unallocated = count((r) => !w.markers.some((m) => m.id === r.markerId));
  const awaiting = count((r) => r.submission !== "submitted");
  const ungraded = count((r) => !r.grade.trim());
  const unreviewed = count((r) => !isReviewed(r, w));
  if (missingIds)
    reasons.push(`${missingIds} student identities need attention.`);
  if (new Set(a.records.map((r) => r.studentId)).size !== a.records.length)
    reasons.push("Duplicate student records in assessment.");
  if (unallocated) reasons.push(`${unallocated} marker allocations missing.`);
  if (awaiting)
    reasons.push(`${awaiting} submissions or resubmissions outstanding.`);
  if (ungraded) reasons.push(`${ungraded} grades missing.`);
  if (unreviewed) reasons.push(`${unreviewed} results awaiting review.`);
  return reasons;
}
export function assessmentStatus(a: Assessment, w: Workflow, date = today()) {
  if (
    a.records.length &&
    a.records.every((r) => r.releasedAt && isReviewed(r, w))
  )
    return "Released";
  if (STAGES.some((s) => stageProgress(a, w, s.key, date).overdue))
    return "Overdue";
  if (blockers(a, w).length === 0) return "Reviewed";
  if (validateSchedule(a).length) return "Setup needed";
  return "In progress";
}
export function syncRoster(a: Assessment, w: Workflow): Assessment {
  const ids = new Set(a.records.map((r) => r.studentId));
  const additional = w.students.filter(
    (s) =>
      s.enrolments.some(
        (e) => e.cohortId === a.cohortId && e.subject === a.subject,
      ) && !ids.has(s.id),
  );
  return {
    ...a,
    records: [...a.records, ...additional.map((s) => emptyProgress(s.id))],
  };
}
export function uploadRows(a: Assessment, w: Workflow): UploadRow[] {
  const errors = blockers(a, w);
  if (errors.length) throw new Error(errors.join(" "));
  const rows = a.records.map((r) => {
    const s = w.students.find((s) => s.id === r.studentId)!;
    return {
      studentId: s.id,
      ncgId: s.ncgId.trim(),
      firstName: s.firstName,
      lastName: s.lastName,
      assessment: a.name,
      module: a.module,
      subject: a.subject,
      cohort: w.cohorts.find((c) => c.id === a.cohortId)!.name,
      grade: r.grade.trim(),
      reviewer: r.reviewer.trim(),
      reviewedAt: r.reviewedAt!,
    };
  });
  if (new Set(rows.map((r) => canonicalId(r.ncgId))).size !== rows.length)
    throw new Error("Duplicate student IDs block export.");
  return rows;
}
export function fingerprint(a: Assessment, w: Workflow): string {
  return JSON.stringify({ rows: uploadRows(a, w), mapping: w.mapping });
}
export function batchCurrent(batch: Batch, w: Workflow): boolean {
  const a = w.assessments.find((a) => a.id === batch.assessmentId);
  try {
    return !!a && batch.fingerprint === fingerprint(a, w);
  } catch {
    return false;
  }
}
export function prepareBatch(a: Assessment, w: Workflow): Batch {
  const headers = UPLOAD_FIELDS.map((f) => w.mapping[f].trim());
  if (
    headers.some((h) => !h) ||
    new Set(headers.map((h) => h.toLowerCase())).size !== headers.length
  )
    throw new Error("Upload column names must be present and unique.");
  return {
    id: crypto.randomUUID(),
    assessmentId: a.id,
    createdAt: new Date().toISOString(),
    fingerprint: fingerprint(a, w),
    rows: uploadRows(a, w),
    mapping: { ...w.mapping },
  };
}
export function csvCell(value: string): string {
  // Quote all cells and neutralise spreadsheet formulas, including leading whitespace.
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function batchCsv(batch: Batch): string {
  return (
    "\uFEFF" +
    [
      UPLOAD_FIELDS.map((f) => csvCell(batch.mapping[f])).join(","),
      ...batch.rows.map((r) =>
        UPLOAD_FIELDS.map((f) => csvCell(r[f])).join(","),
      ),
    ].join("\r\n")
  );
}
export type ImportRow = Record<string, string>;
export function importEnrolments(w: Workflow, rows: ImportRow[]): Workflow {
  const next = structuredClone(w);
  rows.forEach((row, index) => {
    const ncgId = row.ncgId?.trim();
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    const cohort = next.cohorts.find(
      (c) => c.name.toLowerCase() === row.cohort?.trim().toLowerCase(),
    );
    const subject = SUBJECTS.find(
      (s) => s.toLowerCase() === row.subject?.trim().toLowerCase(),
    );
    if (!ncgId || !firstName || !lastName || !cohort || !subject)
      throw new Error(
        `Row ${index + 2}: provide ncgId, firstName, lastName, a known cohort and subject.`,
      );
    let student = next.students.find(
      (s) => canonicalId(s.ncgId) === canonicalId(ncgId),
    );
    if (
      student &&
      (student.firstName.toLowerCase() !== firstName.toLowerCase() ||
        student.lastName.toLowerCase() !== lastName.toLowerCase())
    )
      throw new Error(
        `Row ${index + 2}: the student ID belongs to a different name. Resolve it before import.`,
      );
    if (!student) {
      student = {
        id: crypto.randomUUID(),
        ncgId,
        firstName,
        lastName,
        enrolments: [],
      };
      next.students.push(student);
    }
    if (
      !student.enrolments.some(
        (e) => e.cohortId === cohort.id && e.subject === subject,
      )
    )
      student.enrolments.push({ cohortId: cohort.id, subject });
  });
  return next;
}
export function importGrades(
  w: Workflow,
  assessmentId: string,
  rows: ImportRow[],
): Workflow {
  const next = structuredClone(w);
  const a = next.assessments.find((a) => a.id === assessmentId);
  if (!a) throw new Error("Assessment not found.");
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const id = canonicalId(row.ncgId || "");
    if (!id || seen.has(id))
      throw new Error(`Row ${index + 2}: missing or duplicate student ID.`);
    seen.add(id);
    const s = next.students.find((s) => canonicalId(s.ncgId) === id);
    const r = a.records.find((r) => r.studentId === s?.id);
    if (!r || !row.grade?.trim())
      throw new Error(
        `Row ${index + 2}: student is outside this roster or grade is blank.`,
      );
    const marker = row.marker?.trim()
      ? next.markers.find(
          (m) => m.name.toLowerCase() === row.marker.trim().toLowerCase(),
        )
      : undefined;
    if (row.marker?.trim() && !marker)
      throw new Error(
        `Row ${index + 2}: add marker '${row.marker}' to the staff list first.`,
      );
    Object.assign(
      r,
      updateProgress(
        r,
        { grade: row.grade.trim(), ...(marker ? { markerId: marker.id } : {}) },
        next,
      ),
    );
  }
  return next;
}
export function recordActivity(w: Workflow, text: string): void {
  w.activity.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    text,
  });
  w.activity = w.activity.slice(0, 200);
}
export function readWorkflow(storage: Pick<Storage, "getItem">): Workflow {
  const raw = storage.getItem(WORKFLOW_KEY);
  if (raw) {
    const w = JSON.parse(raw) as Workflow;
    if (
      w.version !== 1 ||
      !Array.isArray(w.assessments) ||
      !Array.isArray(w.students) ||
      !Array.isArray(w.cohorts) ||
      !Array.isArray(w.markers) ||
      !Array.isArray(w.batches) ||
      !Array.isArray(w.activity) ||
      !w.mapping ||
      !Number.isInteger(w.revision)
    )
      throw new Error(
        "Workflow data is invalid. Export a backup before repairing it.",
      );

    const valid =
      w.cohorts.every(
        (c) =>
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          typeof c.startMonth === "string",
      ) &&
      w.students.every(
        (s) =>
          typeof s.id === "string" &&
          typeof s.ncgId === "string" &&
          typeof s.firstName === "string" &&
          typeof s.lastName === "string" &&
          Array.isArray(s.enrolments) &&
          s.enrolments.every(
            (e) =>
              typeof e.cohortId === "string" && SUBJECTS.includes(e.subject),
          ),
      ) &&
      w.markers.every(
        (m) => typeof m.id === "string" && typeof m.name === "string",
      ) &&
      w.assessments.every(
        (a) =>
          typeof a.id === "string" &&
          typeof a.name === "string" &&
          typeof a.module === "string" &&
          typeof a.issueDate === "string" &&
          typeof a.cohortId === "string" &&
          typeof a.subject === "string" &&
          !!a.offsets &&
          STAGES.every((s) => Number.isInteger(a.offsets[s.key])) &&
          Array.isArray(a.records) &&
          a.records.every(
            (r) =>
              typeof r.studentId === "string" &&
              typeof r.markerId === "string" &&
              typeof r.grade === "string" &&
              typeof r.reviewer === "string" &&
              typeof r.notes === "string" &&
              ["awaiting", "submitted", "resubmission"].includes(r.submission),
          ),
      ) &&
      UPLOAD_FIELDS.every((f) => typeof w.mapping[f] === "string") &&
      w.batches.every(
        (b) =>
          typeof b.id === "string" &&
          typeof b.assessmentId === "string" &&
          typeof b.fingerprint === "string" &&
          Array.isArray(b.rows) &&
          b.rows.every((r) =>
            UPLOAD_FIELDS.every((f) => typeof r[f] === "string"),
          ) &&
          !!b.mapping &&
          UPLOAD_FIELDS.every((f) => typeof b.mapping[f] === "string"),
      ) &&
      w.activity.every(
        (e) =>
          typeof e.id === "string" &&
          typeof e.at === "string" &&
          typeof e.text === "string",
      );
    if (!valid)
      throw new Error(
        "Workflow records are invalid. Download a backup before repairing them.",
      );
    w.cohorts.forEach((c, i) => {
      if (i < 6 && !c.startMonth)
        c.startMonth = [
          "2023-10",
          "2024-02",
          "2024-10",
          "2025-02",
          "2025-10",
          "2026-02",
        ][i];
    });
    return w;
  }
  const w = emptyWorkflow();
  const legacy = JSON.parse(storage.getItem("gradezy_assessments") || "[]") as {
    id: string;
    name: string;
    module: string;
    cohort: string;
    createdAt: string;
  }[];
  for (const old of legacy) {
    let cohort = w.cohorts.find((c) => c.name === old.cohort);
    if (!cohort) {
      cohort = {
        id: crypto.randomUUID(),
        name: old.cohort || "Unassigned cohort",
        startMonth: "",
      };
      w.cohorts.push(cohort);
    }
    const expected = JSON.parse(
      storage.getItem(`gradezy_students_${old.id}`) || "[]",
    ) as { ncgId: string; firstName: string; lastName: string }[];
    const actual = JSON.parse(
      storage.getItem(`gradezy_actual_students_${old.id}`) || "[]",
    ) as { ncgId: string; grade?: string }[];
    const records: Progress[] = [];
    for (const imported of expected) {
      if (!imported.ncgId?.trim()) continue;
      let s = w.students.find(
        (s) => canonicalId(s.ncgId) === canonicalId(imported.ncgId),
      );
      if (!s) {
        s = { ...imported, id: crypto.randomUUID(), enrolments: [] };
        w.students.push(s);
      }
      if (records.some((r) => r.studentId === s!.id)) continue;
      const matches = actual.filter(
        (r) => canonicalId(r.ncgId || "") === canonicalId(imported.ncgId),
      );
      records.push({
        ...emptyProgress(s.id),
        grade: matches.length === 1 ? String(matches[0].grade ?? "") : "",
        notes:
          "Imported from legacy tracker. Confirm enrolment, submission and allocation before review.",
      });
    }
    w.assessments.push({
      id: old.id,
      name: old.name,
      module: old.module,
      cohortId: cohort.id,
      subject: "",
      issueDate: "",
      offsets: defaultOffsets(),
      records,
      createdAt: old.createdAt,
      legacy: true,
    });
  }
  return w;
}
export function saveWorkflow(
  w: Workflow,
  storage: Pick<Storage, "getItem" | "setItem">,
): Workflow {
  const current = storage.getItem(WORKFLOW_KEY);
  if (current && (JSON.parse(current) as Workflow).revision !== w.revision)
    throw new Error(
      "Another tab updated this workspace. Reload before saving your change.",
    );
  const next = { ...w, revision: w.revision + 1 };
  storage.setItem(WORKFLOW_KEY, JSON.stringify(next));
  return next;
}
export function assistantContext(w: Workflow, date = today()) {
  return {
    asOf: date,
    assessments: w.assessments.map((a, i) => ({
      reference: `A${i + 1}`,
      subject: a.subject || "Unassigned",
      cohort: w.cohorts.find((c) => c.id === a.cohortId)?.name,
      status: assessmentStatus(a, w, date),
      blockers: blockers(a, w),
      counts: {
        students: a.records.length,
        missingSubmissions: a.records.filter((r) => r.submission === "awaiting").length,
        resubmissions: a.records.filter((r) => r.submission === "resubmission").length,
        unallocated: a.records.filter((r) => !w.markers.some((m) => m.id === r.markerId)).length,
        awaitingMarking: a.records.filter((r) => r.submission === "submitted" && !r.grade.trim()).length,
        awaitingReview: a.records.filter((r) => canReview(r, w) && !isReviewed(r, w)).length,
        reviewed: a.records.filter((r) => isReviewed(r, w)).length,
        needsLearningSupport: (w.learningProgress || []).filter((p) => p.assessmentId === a.id && /behind|support|not started/i.test(p.values.progress1 + " " + p.values.progress2)).length,
      },
      timeline: STAGES.map((s) => ({
        milestone: s.label,
        ...stageProgress(a, w, s.key, date),
      })),
    })),
    markerWorkload: w.markers.map((m, i) => ({
      reference: `M${i + 1}`,
      assigned: w.assessments
        .flatMap((a) => a.records)
        .filter((r) => r.markerId === m.id).length,
      awaitingMarking: w.assessments
        .flatMap((a) => a.records)
        .filter((r) => r.markerId === m.id && r.submission === "submitted" && !r.grade.trim()).length,
    })),
    batches: w.batches.map((b) => ({
      rows: b.rows.length,
      current: batchCurrent(b, w),
      uploaded: !!b.uploadedAt,
    })),
    gaps: {
      cohortStartDatesMissing: w.cohorts.filter((c) => !c.startMonth).length,
      studentsWithoutEnrolment: w.students.filter((s) => !s.enrolments.length)
        .length,
      uploadTemplateConfirmed: w.templateConfirmed,
    },
  };
}
