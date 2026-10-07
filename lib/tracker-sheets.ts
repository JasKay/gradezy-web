import { PROGRAMMES, normalizeProgramme, normalizeModuleCode, findNcgModule } from "./ncg-modules";
﻿import {
  SUBJECTS,
  canonicalId,
  defaultOffsets,
  emptyProgress,
  importEnrolments,
  updateProgress,
  today,
  type Workflow,
  type Assessment,
  type Subject,
  type Student,
} from "./workflow";
export const STUDENT_COLUMNS = [
  ["ncgId", "NCG ID"],
  ["eslId", "ESL ID"],
  ["firstName", "First Name"],
  ["lastName", "Last Name"],
  ["campus", "Campus"],
  ["lecturer", "Lecturer"],
  ["groupCode", "Group Code"],
  ["programme", "Program Name"],
  ["email", "ESL Email"],
  ["status", "Student Status"],
] as const;
export const LEARNING_COLUMNS = [
  ["task1", "Task 1"],
  ["progress1", "Progress 1 -W4"],
  ["lecturerComment1", "Comments Lec"],
  ["retentionComment1", "Comments Ret"],
  ["task2", "Task 2"],
  ["progress2", "Progress 2-W8"],
  ["lecturerComment2", "Comments Lec"],
  ["retentionComment2", "Comments Ret"],
] as const;
export const ATTEMPT_COLUMNS = [
  ["paperId", "TII Paper ID"],
  ["similarity", "Similarity"],
  ["aiScore", "AI Score"],
  ["marker", "1st Marker"],
  ["grade", "Grade (out of 100%)"],
  ["markerComment", "Comment 1"],
  ["sst", "SST"],
  ["imName", "IM Name"],
  ["imGrade", "IM Grade"],
  ["imComment", "Comment 2"],
  ["finalGrade", "Final Grade"],
  ["ncgComment", "Comment for NCG (0 - DNS, 0 - TZ, 40 - Late, 40 -True)"],
  ["difference", "Difference Check"],
] as const;
export const RESUB_COLUMNS = ATTEMPT_COLUMNS.map(
  ([key, label]) =>
    [
      key,
      key === "paperId"
        ? "Resubmission - TII Paper ID"
        : key === "similarity"
          ? "Resub Similarity"
          : key === "aiScore"
            ? "Resub AI Score"
            : key === "imComment"
              ? "IM Comment"
              : label,
    ] as const,
);
export const ASSESSMENT_COLUMNS = [
  ["cohort", "Cohort"],
  ["submissionDate", "Submission Date"],
  ["module", "Module Code"],
  ["moduleName", "Module Name"],
  ["programme", "Programme"],
  ["credits", "Credits"],
  ["assessment", "Assessment"],
  ["weight", "Weight"],
  ["moduleLeader", "Module Leader"],
  ["vleLink", "LINK creation for non-London VLE ESL"],
  ["contactML", "Contact ML"],
  [
    "paperIdNextDay",
    "Populate the Paper ID - Similarity one day after submission.",
  ],
  [
    "paperIdLate",
    "Populate the Paper ID - Similarity one week after submission for LATE SUBMISSIONS",
  ],
  ["standardisation", "Standardisation"],
  ["markingDeadline", "Deadline of 1st Marking"],
  ["markingAllocation", "Marking Allocation"],
  ["emailMarkers", "Email all Markers"],
  ["gradeReleased", "Grade released (Y/N)"],
  ["releasedBy", "By who?"],
  ["vleCrossCheck", "VLE Cross Check"],
  ["samA", "SAM Form A Y/N"],
  ["samB", "SAM Form B Y/N"],
  ["imDeadline", "IM Deadline (10%)"],
  ["he07", "HE07 - ML as IM"],
  ["eeSamples", "EE samples (PL)"],
  ["assessmentOwner", "By Who (Ass)?"],
  ["uploadLeeds", "NCG Staff Advantage Leeds"],
  ["uploadLeicester", "NCG Staff Advantage Leicester"],
  ["uploadBirmingham", "NCG Staff Advantage Birmingham"],
  ["doubleCheckBy", "Double Check By"],
] as const;
export type SheetKind = "students" | "assessments" | "learning" | "marking";
export const normalHeader = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  ncgId: ["student id", "ncgid"],
  eslId: ["eslid"],
  programme: ["Programme", "Program Name", "Programme Name", "Program"],
  cohort: ["Cohort", "Cohort Name"],
  imGrade: ["IM Garde"],
  imComment: ["Comment 2", "IM Comment"],
  marker: ["First Marker"],
  grade: ["Grade", "Grade (out of 100%)"],
};
export function subjectFor(programme: string): Subject | undefined {
  const programmeCode = normalizeProgramme(programme);
  if (programmeCode) return PROGRAMMES[programmeCode].subject;
  const key = programme.toLowerCase();
  if (/health.*social|social.*care/.test(key)) return "Health and Social Care";
  if (/comput|software|information technology/.test(key))
    return "Computer Science";
  if (/business|management/.test(key)) return "Business Management";
}
export function cohortFor(w: Workflow, label: string) {
  const raw = label.trim().toLowerCase().replace(/\s/g, "");
  const group = raw.match(/^c(\d+)(?:l\d+)?s\d+$/);
  const key = group ? "c" + group[1] : raw;
  return w.cohorts.find(
    (c) =>
      c.name.toLowerCase().replace(/\s/g, "") === key ||
      c.id === label ||
      `c${c.name.replace(/\D/g, "")}` === key,
  );
}
export function fieldAt(
  headers: string[],
  key: string,
  label: string,
  start = 0,
  end = headers.length,
  occurrence = 0,
) {
  const names = [label, key, ...(aliases[key] || [])].map(normalHeader);
  const indexes = headers
    .map((h, i) =>
      names.includes(normalHeader(h)) && i >= start && i < end ? i : -1,
    )
    .filter((i) => i >= 0);
  return indexes[occurrence] ?? -1;
}
export function readFields(
  headers: string[],
  cells: string[],
  fields: readonly (readonly [string, string])[],
  start = 0,
  end = headers.length,
) {
  const occurrences = new Map<string, number>();
  return Object.fromEntries(
    fields.map(([key, label]) => {
      const h = normalHeader(label);
      const occurrence = occurrences.get(h) || 0;
      occurrences.set(h, occurrence + 1);
      const index = fieldAt(headers, key, label, start, end, occurrence);
      return [key, index < 0 ? "" : (cells[index] || "").trim()];
    }),
  );
}
export function studentValues(headers: string[], cells: string[]) {
  return readFields(headers, cells, STUDENT_COLUMNS);
}
export function attemptValues(headers: string[], cells: string[]) {
  const split = headers.findIndex(
    (h) =>
      /^resubmission.*paperid$/.test(normalHeader(h)) ||
      normalHeader(h) === "resubtiipaperid",
  );
  return {
    first: readFields(
      headers,
      cells,
      ATTEMPT_COLUMNS,
      0,
      split < 0 ? headers.length : split,
    ),
    resubmission:
      split < 0 ? {} : readFields(headers, cells, RESUB_COLUMNS, split),
  };
}
export function parseSpreadsheet(grid: string[][], kind: SheetKind) {
  const required =
    kind === "assessments" ? ["cohort", "modulecode"] : ["ncgid", "studentid"];
  const headerIndex = grid.findIndex((row) =>
    kind === "assessments"
      ? required.every((key) => row.some((h) => normalHeader(h) === key))
      : required.some((key) => row.some((h) => normalHeader(h) === key)),
  );
  if (headerIndex < 0)
    throw new Error(
      "Cannot find a header row. Assessment trackers need Cohort and Module Code; student trackers need NCG ID.",
    );
  const headers = grid[headerIndex].map((h) => String(h || "").trim());
  const rows = grid
    .slice(headerIndex + 1)
    .filter((row) => row.some((v) => String(v || "").trim()))
    .map((row) => headers.map((_, i) => String(row[i] ?? "").trim()));
  if (!rows.length || rows.length > 5000)
    throw new Error("Provide 1 to 5,000 data rows in the selected worksheet.");
  return { headers, rows };
}
function identify(
  w: Workflow,
  values: Record<string, string>,
  cohortId: string,
  subject: Subject,
): Student {
  if (!values.ncgId || !values.firstName || !values.lastName)
    throw new Error(
      "NCG ID, First Name and Last Name are required on every student row.",
    );
  const c = w.cohorts.find((c) => c.id === cohortId);
  if (!c) throw new Error("Choose a cohort.");
  const merged = importEnrolments(w, [{ ...values, cohort: c.name, subject }]);
  w.students = merged.students;
  const student = w.students.find(
    (s) => canonicalId(s.ncgId) === canonicalId(values.ncgId),
  )!;
  student.profile = {
    ...student.profile,
    ...Object.fromEntries(
      Object.entries(values).filter(
        ([key, value]) =>
          !["ncgId", "firstName", "lastName"].includes(key) && value,
      ),
    ),
  };
  return student;
}
export function applySpreadsheet(
  w: Workflow,
  kind: SheetKind,
  headers: string[],
  rows: string[][],
  selection: {
    cohortId: string;
    subject: Subject;
    assessmentId?: string;
    fileName: string;
    sheetName: string;
    system: string;
  },
): Workflow {
  const next = structuredClone(w);
  const a = next.assessments.find((a) => a.id === selection.assessmentId);
  const seen = new Set<string>();
  if ((kind === "marking" || kind === "learning") && !a)
    throw new Error(
      "Choose the assessment or module this student tracker belongs to.",
    );
  for (const [index, cells] of rows.entries()) {
    try {
      if (kind === "assessments") {
        const v = readFields(headers, cells, ASSESSMENT_COLUMNS);
        v.module = normalizeModuleCode(v.module || "");
        const ncgModule = findNcgModule(v.module);
        if (ncgModule) v.moduleName = ncgModule.name;
        const c = cohortFor(next, v.cohort);
        if (!c) throw new Error(`Unknown cohort '${v.cohort}'.`);
        const suppliedProgramme = subjectFor(v.programme);
        if (v.programme && !suppliedProgramme) throw new Error(`Unknown programme '${v.programme}'. Use BM, COMP or HSC.`);
        const subject = suppliedProgramme || (ncgModule?.programmes.length === 1 ? PROGRAMMES[ncgModule.programmes[0]].subject : selection.subject);
        if (ncgModule && !ncgModule.programmes.some((code) => PROGRAMMES[code].subject === subject)) throw new Error("The programme does not offer this NCG module.");
        if (!v.module || !v.assessment)
          throw new Error("Module Code and Assessment are required.");
        const identity = `${c.id}|${subject}|${v.module}|${v.assessment}`.toLowerCase();
        if (seen.has(identity))
          throw new Error("Duplicate assessment in the selected worksheet.");
        seen.add(identity);
        const existing = next.assessments.find(
          (a) =>
            a.cohortId === c.id &&
            a.subject === subject &&
            normalizeModuleCode(a.module).toLowerCase() === v.module.toLowerCase() &&
            a.name.toLowerCase() === v.assessment.toLowerCase(),
        );
        if (existing)
          existing.operations = {
            ...existing.operations,
            ...Object.fromEntries(
              Object.entries(v).filter(([, value]) => value),
            ),
          };
        else
          next.assessments.push({
            id: crypto.randomUUID(),
            name: v.assessment,
            module: v.module,
            cohortId: c.id,
            subject,
            issueDate: "",
            offsets: defaultOffsets(),
            createdAt: new Date().toISOString(),
            records: next.students
              .filter((s) =>
                s.enrolments.some(
                  (e) => e.cohortId === c.id && e.subject === subject,
                ),
              )
              .map((s) => emptyProgress(s.id)),
            operations: v,
          });
      } else {
        const v = studentValues(headers, cells);
        const id = canonicalId(v.ncgId);
        if (seen.has(id))
          throw new Error("Duplicate NCG ID in the selected worksheet.");
        seen.add(id);
        const rowCohort = fieldAt(headers, "cohort", "Cohort");
        const groupCohort = v.groupCode ? cohortFor(next, v.groupCode) : undefined;
        if (v.groupCode && /^c\d/i.test(v.groupCode) && !groupCohort) throw new Error("Unknown cohort in Group Code.");
        if (rowCohort >= 0 && groupCohort && cohortFor(next, cells[rowCohort])?.id !== groupCohort.id) throw new Error("Group Code and Cohort must match.");
        const cohortId =
          rowCohort >= 0
            ? cohortFor(next, cells[rowCohort])?.id
            : groupCohort?.id || a?.cohortId || selection.cohortId;
        if (!cohortId) throw new Error("Unknown cohort.");
        const subject = (a?.subject ||
          subjectFor(v.programme) ||
          selection.subject) as Subject;
        if (a && cohortId !== a.cohortId)
          throw new Error(
            "Student cohort differs from the selected assessment.",
          );
        const student = identify(next, v, cohortId, subject);
        if (kind === "learning") {
          const values = readFields(headers, cells, LEARNING_COLUMNS);
          next.learningProgress ||= [];
          const existing = next.learningProgress.find(
            (r) =>
              r.studentId === student.id &&
              (r.assessmentId === a!.id ||
                next.assessments.some(
                  (other) =>
                    other.id === r.assessmentId &&
                    other.cohortId === a!.cohortId &&
                    other.subject === a!.subject &&
                    other.module === a!.module,
                )),
          );
          if (existing) existing.values = { ...existing.values, ...values };
          else
            next.learningProgress.push({
              studentId: student.id,
              assessmentId: a!.id,
              values,
            });
        }
        if (kind === "marking") {
          const attempts = attemptValues(headers, cells);
          for (const attempt of Object.values(attempts))
            for (const key of ["grade", "imGrade", "finalGrade"])
              if (
                attempt[key] &&
                (!Number.isFinite(Number(attempt[key])) ||
                  Number(attempt[key]) < 0 ||
                  Number(attempt[key]) > 100)
              )
                throw new Error(`${key} must be a number from 0 to 100.`);
          let r = a!.records.find((r) => r.studentId === student.id);
          if (!r) {
            r = emptyProgress(student.id);
            a!.records.push(r);
          }
          const selectedAttempt = attempts[r.activeAttempt || "first"];
          const marker = selectedAttempt.marker
            ? next.markers.find(
                (m) =>
                  m.name.toLowerCase() === selectedAttempt.marker.toLowerCase(),
              )
            : undefined;
          let markerId = marker?.id || r.markerId;
          if (selectedAttempt.marker && !marker) {
            markerId = crypto.randomUUID();
            next.markers.push({ id: markerId, name: selectedAttempt.marker });
          }
          const changed =
            JSON.stringify(r.attempts) !== JSON.stringify(attempts);
          const updated = updateProgress(
            r,
            {
              markerId,
              grade:
                selectedAttempt.finalGrade || selectedAttempt.grade || r.grade,
            },
            next,
          );
          if (changed) {
            updated.reviewedAt = undefined;
            updated.reviewer = "";
            updated.releasedAt = undefined;
          }
          Object.assign(r, updated, {
            attempts,
            activeAttempt: r.activeAttempt || "first",
          });
        }
      }
    } catch (e) {
      throw new Error(
        `Row ${index + 2}: ${e instanceof Error ? e.message : "invalid data"}`,
      );
    }
  }
  next.imports ||= [];
  next.imports.unshift({
    id: crypto.randomUUID(),
    fileName: selection.fileName,
    sheetName: selection.sheetName,
    system: selection.system,
    kind,
    at: new Date().toISOString(),
    rows: rows.length,
  });
  return next;
}
export function activateAttempt(
  w: Workflow,
  assessmentId: string,
  studentId: string,
  attempt: "first" | "resubmission",
): Workflow {
  const next = structuredClone(w);
  const r = next.assessments
    .find((a) => a.id === assessmentId)
    ?.records.find((r) => r.studentId === studentId);
  if (!r?.attempts) throw new Error("Import or enter marking details first.");
  const values = r.attempts[attempt];
  const grade = values.finalGrade || values.grade;
  if (!grade) throw new Error("This attempt has no grade.");
  let marker = next.markers.find(
    (m) => m.name.toLowerCase() === values.marker?.toLowerCase(),
  );
  if (!marker && values.marker) {
    marker = { id: crypto.randomUUID(), name: values.marker };
    next.markers.push(marker);
  }
  Object.assign(
    r,
    updateProgress(
      r,
      { grade, markerId: marker?.id || "", submission: r.submission },
      next,
    ),
    {
      activeAttempt: attempt,
      reviewedAt: undefined,
      reviewer: "",
      releasedAt: undefined,
    },
  );
  return next;
}
export function populateSamples(w: Workflow): Workflow {
  const next = structuredClone(w);
  if (next.students.some((s) => s.sample)) return next;
  const dates = [
    "2023-10",
    "2024-02",
    "2024-10",
    "2025-02",
    "2025-10",
    "2026-02",
  ];
  next.cohorts.forEach((c, i) => {
    if (i < 6 && !c.startMonth) c.startMonth = dates[i];
  });
  const campuses = ["Leeds", "Leicester", "Birmingham"];
  for (let c = 0; c < 6; c++)
    for (let course = 0; course < 3; course++) {
      const subject = SUBJECTS[course];
      const aid = `demo-assessment-${c + 1}-${course}`;
      const date = new Date(`${today()}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() - (12 + c * 4));
      const a: Assessment = {
        id: aid,
        name: `Sample ${["Business report", "Computing portfolio", "Care practice report"][course]}`,
        module: `DEMO-${["BUS", "COM", "HSC"][course]}${c + 1}`,
        cohortId: next.cohorts[c].id,
        subject,
        issueDate: date.toISOString().slice(0, 10),
        offsets: defaultOffsets(),
        records: [],
        createdAt: new Date().toISOString(),
        sample: true,
        operations: {
          moduleName: subject,
          programme: `${subject} (sample programme)`,
          credits: "20",
          weight: "100%",
          moduleLeader: `Demo Module Leader ${course + 1}`,
          submissionDate: date.toISOString().slice(0, 10),
          standardisation: "Pending",
          samA: "N",
          samB: "N",
          uploadLeeds: "Pending",
          uploadLeicester: "Pending",
          uploadBirmingham: "Pending",
        },
      };
      const markerId = `demo-marker-${course}`;
      if (!next.markers.some((m) => m.id === markerId))
        next.markers.push({ id: markerId, name: `Demo Marker ${course + 1}` });
      for (let i = 0; i < 3; i++) {
        const id = `demo-student-${c + 1}-${course}-${i}`;
        const student: Student = {
          id,
          ncgId: `DEMO-C${c + 1}-${course + 1}${i + 1}`,
          firstName: ["Alex", "Jordan", "Taylor"][i],
          lastName: `Sample C${c + 1}`,
          enrolments: [{ cohortId: a.cohortId, subject }],
          sample: true,
          profile: {
            eslId: `DEMO-ESL-${c + 1}${course}${i}`,
            campus: campuses[i],
            groupCode: String(i + 1),
            programme: `${subject} (sample programme)`,
            email: `demo.c${c + 1}.${course}${i}@example.invalid`,
            status: "Active",
            lecturer: `Demo Lecturer ${course + 1}`,
          },
        };
        next.students.push(student);
        const grade = String(58 + course * 7 + i * 4);
        const first = {
          paperId: `DEMO-PAPER-${c + 1}${course}${i}`,
          similarity: String(12 + i * 8),
          aiScore: String(i * 9),
          marker: `Demo Marker ${course + 1}`,
          grade,
          imName: "Demo Moderator",
          imGrade: grade,
          finalGrade: grade,
          markerComment: "Synthetic marker feedback for demonstration.",
          imComment: "Sample moderation notes.",
          ncgComment: "",
          difference: "0",
          sst: "",
        };
        let r = emptyProgress(id);
        if (i !== 2)
          r = updateProgress(
            r,
            { markerId, submission: "submitted", grade },
            next,
          );
        r.attempts = {
          first,
          resubmission:
            i === 1
              ? {
                  paperId: `DEMO-RESUB-${c + 1}${course}${i}`,
                  grade: "65",
                  finalGrade: "65",
                  marker: `Demo Marker ${course + 1}`,
                  similarity: "10",
                  aiScore: "0",
                  imName: "Demo Moderator",
                  imGrade: "65",
                  imComment: "Synthetic resubmission feedback.",
                }
              : {},
        };
        r.notes = "Sample data only.";
        if (i === 0)
          r = updateProgress(
            r,
            { reviewer: "Demo Reviewer", reviewedAt: new Date().toISOString() },
            next,
          );
        a.records.push(r);
        next.learningProgress ||= [];
        next.learningProgress.push({
          assessmentId: aid,
          studentId: id,
          values: {
            task1: "Portfolio planning",
            progress1: i === 2 ? "Needs support" : "Excellent",
            lecturerComment1: "Synthetic learning-progress example.",
            retentionComment1: i === 2 ? "Follow-up required" : "",
            task2: "Assessment draft",
            progress2: i === 2 ? "In progress" : "Good",
            lecturerComment2: "Sample Week 8 checkpoint.",
            retentionComment2: "",
          },
        });
      }
      next.assessments.push(a);
    }
  return next;
}
export function removeSamples(w: Workflow): Workflow {
  const next = structuredClone(w);
  const studentIds = new Set(
    next.students.filter((s) => s.sample).map((s) => s.id),
  );
  const assessmentIds = new Set(
    next.assessments.filter((a) => a.sample).map((a) => a.id),
  );
  next.students = next.students.filter((s) => !s.sample);
  next.assessments = next.assessments
    .filter((a) => !a.sample)
    .map((a) => ({
      ...a,
      records: a.records.filter((r) => !studentIds.has(r.studentId)),
    }));
  next.learningProgress = next.learningProgress?.filter(
    (p) => !studentIds.has(p.studentId) && !assessmentIds.has(p.assessmentId),
  );
  next.batches = next.batches.filter((b) => !assessmentIds.has(b.assessmentId));
  next.markers = next.markers.filter(
    (m) =>
      !m.id.startsWith("demo-marker-") ||
      next.assessments.some((a) => a.records.some((r) => r.markerId === m.id)),
  );
  return next;
}
