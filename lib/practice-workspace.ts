import { SUBJECTS, emptyProgress, defaultOffsets, updateProgress, today, targetDate, type Workflow, type Assessment, } from "./workflow";
const names = [
  ["Amelia", "Bennett"], ["Noah", "Clarke"], ["Isla", "Morgan"], ["Oliver", "Reed"],
  ["Ava", "Patel"], ["Leo", "Williams"], ["Freya", "Ahmed"], ["Jack", "Turner"],
  ["Mia", "Wilson"], ["Oscar", "Evans"], ["Grace", "Thompson"], ["Arthur", "Lewis"],
];
const courses = [
  { code: "BM301", module: "Business Strategy", assessment: "Strategy report", marker: "Rachel Adams" },
  { code: "CMP114", module: "Dynamic Website Development", assessment: "Application portfolio", marker: "Daniel Brooks" },
  { code: "IHS103", module: "Making a Difference: Supporting Individuals with Specific Needs", assessment: "Care practice report", marker: "Priya Shah" },
];
const prefix = "practice-";
export function populatePracticeData(w: Workflow, date = today()): Workflow {
  const next = structuredClone(w);
  const iso = (days: number) => {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString();
  };
  courses.forEach((course, index) => {
    const markerId = prefix + "marker-" + index;
    if (!next.markers.some((m) => m.id === markerId)) next.markers.push({ id: markerId, name: course.marker });
    next.cohorts.slice(0, 3).forEach((cohort, c) => {
      const students = names.slice(c * 4, c * 4 + 4).map(([firstName, surname], i) => {
        const lastName = index === 0 ? surname : [
          ["Hughes", "Price", "Davies", "Harris", "Roberts", "Wood", "Scott", "Hill", "Green", "Baker", "Young", "King"],
          ["Walker", "Wright", "Allen", "Hall", "Edwards", "Cooper", "Ward", "Mitchell", "Phillips", "James", "Watson", "Bell"],
        ][index - 1][c * 4 + i];
        const id = prefix + "student-" + c + "-" + index + "-" + i;
        const existing = next.students.find((s) => s.id === id);
        if (existing) return existing;
        let number = 260001 + c * 12 + index * 4 + i;
        while (next.students.some((s) => s.ncgId === "NCG" + number))
          number += 100000;
        return ({
          id: prefix + "student-" + c + "-" + index + "-" + i,
          ncgId: "NCG" + number,
          firstName, lastName,
          enrolments: [{ cohortId: cohort.id, subject: SUBJECTS[index] }],
          profile: {
            eslId: "ESL" + (260001 + c * 12 + index * 4 + i),
            campus: ["Leeds", "Leicester", "Birmingham"][c],
            lecturer: course.marker, programme: SUBJECTS[index], status: "Active",
            groupCode: "G" + (c + 1), email: firstName.toLowerCase() + "." + lastName.toLowerCase() + "@example.invalid",
          },
        });
      });
      next.students.push(...students.filter((student) => !next.students.some((existing) => existing.id === student.id)));
      for (let attempt = 0; attempt < 2; attempt++) {
        const issueDate = iso(-(c === 0 ? 24 : c === 1 ? 12 : 4) + attempt * 3).slice(0, 10);
        const a: Assessment = {
          id: prefix + "assessment-" + c + "-" + index + "-" + attempt,
          name: attempt === 0 ? course.assessment : "Reflective presentation",
          module: course.code, cohortId: cohort.id, subject: SUBJECTS[index],
          issueDate, offsets: defaultOffsets(), createdAt: iso(-30), records: [],
          operations: {
            moduleName: course.module, programme: SUBJECTS[index], credits: "20",
            weight: attempt === 0 ? "70%" : "30%", moduleLeader: course.marker,
            submissionDate: targetDate(issueDate, 7), standardisation: "Complete",
          },
        };
        a.records = students.map((student, i) => {
          const state = (i + c + index + attempt) % 5;
          let r = updateProgress(emptyProgress(student.id), {
            markerId: state === 3 ? "" : markerId,
            submission: state === 3 ? "awaiting" : state === 2 ? "resubmission" : "submitted",
            grade: state < 2 ? String(58 + i * 7 + index * 3) : "",
            notes: state === 3 ? "Submission follow-up needed." : state === 2 ? "Revised evidence requested." : "",
          }, next, iso(-2));
          if (state === 0) {
            r = updateProgress(r, { reviewer: "Helen Carter", reviewedAt: iso(-1) }, next, iso(-1));
          }
          r.attempts = { first: {
              paperId: state === 3 ? "" : "TII" + (480000 + c * 100 + index * 10 + i),
              marker: state === 3 ? "" : course.marker, grade: r.grade,
              similarity: state === 3 ? "" : String(8 + i * 5),
            }, resubmission: {} };
          if (attempt === 0) {
            next.learningProgress ||= [];
            if (!next.learningProgress.some((p) => p.assessmentId === a.id && p.studentId === student.id)) next.learningProgress.push({ assessmentId: a.id, studentId: student.id, values: {
                task1: "Research plan", progress1: state === 3 ? "Needs support" : "Complete",
                lecturerComment1: state === 3 ? "Arrange a check-in about the draft." : "Research approach agreed.",
                retentionComment1: state === 3 ? "Contact student this week." : "",
                task2: "Assessment draft", progress2: state === 2 ? "Behind" : state === 3 ? "Not started" : "On track",
                lecturerComment2: state === 2 ? "Rework evidence before resubmission." : "",
              } });
          }
          return r;
        });
        if (!next.assessments.some((existing) => existing.id === a.id)) next.assessments.push(a);
      }
    });
  });
  next.imports ||= [];
  [
    { fileName: "Cohort enrolments.xlsx", kind: "students" as const, rows: 36 },
    { fileName: "Assessment schedule.xlsx", kind: "assessments" as const, rows: 18 },
    { fileName: "Module progress.xlsx", kind: "learning" as const, rows: 36 },
    { fileName: "Marking allocation.xlsx", kind: "marking" as const, rows: 72 },
  ].forEach((entry) => {
    if (!next.imports!.some((existing) => existing.id === prefix + entry.kind)) next.imports!.push({ ...entry, id: prefix + entry.kind, sheetName: "Tracker", system: "Practice workbook", at: iso(-1) });
  });
  return JSON.stringify(next) === JSON.stringify(w) ? w : next;
}
export function removePracticeData(w: Workflow): Workflow {
  const next = structuredClone(w);
  next.students = next.students.filter((s) => !s.id.startsWith(prefix));
  next.assessments = next.assessments.filter((a) => !a.id.startsWith(prefix)).map((a) => ({ ...a, records: a.records.filter((r) => !r.studentId.startsWith(prefix)) }));
  next.learningProgress = next.learningProgress?.filter((p) => !p.studentId.startsWith(prefix) && !p.assessmentId.startsWith(prefix));
  next.markers = next.markers.filter((m) => !m.id.startsWith(prefix) || next.assessments.some((a) => a.records.some((r) => r.markerId === m.id)));
  next.imports = next.imports?.filter((i) => !i.id.startsWith(prefix));
  next.batches = next.batches.filter((b) => !b.assessmentId.startsWith(prefix));
  return next;
}
