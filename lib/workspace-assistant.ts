import { NCG_MODULES, PROGRAMMES, findNcgModule, normalizeModuleCode, subjectLabel } from "./ncg-modules";
import { STAGES, stageProgress, isReviewed, canReview, blockers, today, type Workflow } from "./workflow";
export type WorkspaceAnswer = {
  answer: string;
  links: {
    label: string;
    href: string;
  }[];
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function searchWorkspace(w: Workflow, question: string, date = today()): WorkspaceAnswer {
  const q = norm(question);
  const contains = (value: string) => value.length > 2 && (" " + q + " ").includes(" " + norm(value) + " ");
  const cohorts = w.cohorts.filter((c) => contains(c.name) || new RegExp("\\bc" + c.name.replace(/\D/g, "") + "\\b").test(q));
  const students = w.students.filter((s) => contains(s.ncgId) || contains(s.profile?.eslId || "") || contains(s.firstName + " " + s.lastName) || contains(s.firstName) || contains(s.lastName));
  const markers = w.markers.filter((m) => contains(m.name) || contains(m.name.split(" ")[0]) || contains(m.name.split(" ").at(-1) || ""));
  const modules = Array.from(new Set(w.assessments.filter((a) => contains(a.module) || (findNcgModule(a.module)?.aliases || []).some((alias) => contains(alias)) || contains(a.name) || contains(a.operations?.moduleName || "")).map((a) => a.module)));
  const subject = /\b(business|bm)\b/.test(q) ? "Business Management" : /\b(computing|computer|software|comp|cmp)\b/.test(q) ? "Computer Science" : /\b(care|health|hsc)\b/.test(q) ? "Health and Social Care" : "";
  const namedAssessments = w.assessments.filter((a) => contains(a.name));
  const assessments = w.assessments.filter((a) => (!cohorts.length || cohorts.some((c) => c.id === a.cohortId)) && (!modules.length || modules.includes(a.module)) && (!subject || a.subject === subject) && (!namedAssessments.length || namedAssessments.some((named) => named.id === a.id)));
  const rows = assessments.flatMap((a) => a.records.map((r) => ({ a, r, s: w.students.find((s) => s.id === r.studentId) }))).filter(({ r }) => (!students.length || students.some((s) => s.id === r.studentId)) && (!markers.length || markers.some((m) => m.id === r.markerId)));
  const links: WorkspaceAnswer["links"] = [];
  const link = (id: string, label: string) => { if (!links.some((l) => l.href === "/workflow/" + id))
    links.push({ label, href: "/workflow/" + id }); };
  const label = ({ a, s }: typeof rows[number]) => {
    link(a.id, a.module + " / " + a.name);
    return (s ? s.firstName + " " + s.lastName + " (" + s.ncgId + ")" : "Student record") + " - " + a.module + " / " + a.name;
  };
  const result = (title: string, lines: string[], total = lines.length) => ({ answer: title + "\n" + (lines.length ? lines.slice(0, 8).join("\n") : "No matching records found.") + (total > 8 ? "\nShowing 8 of " + total + " matches. Narrow by cohort, module or name." : ""), links: links.slice(0, 5) });
  // Explicit unknown references should never fall back to unrelated results.
  const namedModule = question.match(/\b[A-Z]{2,5}\d{2,5}\b/i)?.[0];
  const namedStudent = question.match(/\b(?:NCG|ESL)\d+\b/i)?.[0];
  if (namedStudent && !w.students.some((s) => norm(s.ncgId) === norm(namedStudent) || norm(s.profile?.eslId || "") === norm(namedStudent)))
    return result("I couldn't find that student ID in this workspace.", []);
  const catalogueModule = namedModule ? findNcgModule(namedModule) : undefined;
  if (catalogueModule && !w.assessments.some((a) => normalizeModuleCode(a.module) === catalogueModule.code)) {
    return { answer: catalogueModule.code + " - " + catalogueModule.name + "\n" + catalogueModule.programmes.map((code) => code + " - " + PROGRAMMES[code].name).join(", ") + "\nNo assessments have been scheduled for this module yet.", links: [{ label: "Add assessment", href: "/assessments/new?module=" + catalogueModule.code }] };
  }
  if (/\bmodules?\b/.test(q) && /list|show|which|available|catalogue|catalog|how many/.test(q) && !namedModule) {
    const catalogue = NCG_MODULES.filter((m) => !subject || m.programmes.some((code) => PROGRAMMES[code].subject === subject));
    return { answer: catalogue.length + " NCG modules.\n" + catalogue.map((m) => m.code + " - " + m.name).join("\n"), links: [{ label: "NCG module catalogue", href: "/assessments" }] };
  }
  const namedCohort = q.match(/\bcohort\s+(\d+)\b/)?.[1];
  if ((namedModule && !w.assessments.some((a) => normalizeModuleCode(a.module) === normalizeModuleCode(namedModule))) || (namedCohort && !cohorts.length))
    return result("I couldn't find that module or cohort in this workspace.", []);
  if (/\b(submi|submission|submitted|resubmission)/.test(q)) {
    const resub = /resubmission|resubmit/.test(q);
    const missing = /missing|outstanding|awaiting|not|hasn t|haven t|who needs|still|yet|late|overdue/.test(q);
    const matches = rows.filter(({ r }) => resub ? r.submission === "resubmission" : missing ? r.submission !== "submitted" : r.submission === "submitted");
    return result(matches.length + (resub ? " resubmissions" : missing ? " outstanding submissions" : " submitted records") + ".", matches.map((row) => label(row) + ": " + row.r.submission + (missing ? ". Next: follow up on the submission." : "")));
  }
  if (/\b(review|reviews|reviewed|approval|approve|moderation)\b/.test(q)) {
    const done = /already|completed|approved|reviewed/.test(q) && !/not|pending|awaiting|outstanding|need|ready|missing/.test(q);
    const matches = rows.filter(({ r }) => done ? isReviewed(r, w) : canReview(r, w) && !isReviewed(r, w));
    return result(matches.length + (done ? " reviewed results." : " results ready for review."), matches.map((row) => label(row) + (done ? ": reviewed." : ": marked and submitted. Next: approve the grade review.")));
  }
  if (/\b(progress|checkpoint|checkpoints|behind|support|week|retention)\b/.test(q)) {
    const progress = (w.learningProgress || []).filter((p) => assessments.some((a) => a.id === p.assessmentId) && (!students.length || students.some((s) => s.id === p.studentId)) && (!markers.length || rows.some((row) => row.r.studentId === p.studentId)));
    const needsSupport = /behind|support|risk|retention|follow up|need/.test(q);
    const matches = progress.filter((p) => !needsSupport || /behind|support|not started/i.test(p.values.progress1 + " " + p.values.progress2));
    return result(matches.length + (needsSupport ? " students need a progress follow-up." : " learning progress records."), matches.map((p) => {
      const a = w.assessments.find((a) => a.id === p.assessmentId)!;
      const s = w.students.find((s) => s.id === p.studentId);
      link(a.id, a.module);
      return (s ? s.firstName + " " + s.lastName : "Student") + " - " + a.module + ": Week 4 " + (p.values.progress1 || "not recorded") + "; Week 8 " + (p.values.progress2 || "not recorded") + (needsSupport ? ". Next: arrange a check-in." : "");
    }));
  }
  if (/\b(unallocated|allocation|allocate|allocated)\b/.test(q) && !/balance|workload|how much|how many/.test(q) && !markers.length) {
    const assigned = /already|allocated/.test(q) && !/unallocated|not|missing|awaiting/.test(q);
    const matches = rows.filter(({ r }) => assigned ? !!r.markerId : !r.markerId);
    return result(matches.length + (assigned ? " allocated records." : " records need a marker."), matches.map((row) => label(row) + (assigned ? ": " + w.markers.find((m) => m.id === row.r.markerId)?.name : ". Next: assign a marker.")));
  }
  if (/who|which student|unmarked|not marked|awaiting marking|waiting for marking/.test(q) && /mark|graded/.test(q) && !/workload|balance/.test(q)) {
    const pending = /not|hasn t|haven t|unmarked|awaiting|pending|need|waiting/.test(q);
    const matches = rows.filter(({ r }) => pending ? r.submission === "submitted" && !r.grade.trim() : !!r.grade.trim());
    return result(matches.length + (pending ? " submitted records awaiting marking." : " marked records."), matches.map((row) => label(row) + ": " + (w.markers.find((m) => m.id === row.r.markerId)?.name || "Unallocated") + (pending ? ". Next: complete marking." : "; grade " + row.r.grade + ".")));
  }
  if ((/\b(marker|markers|marking|marked|workload|balance|work)\b/.test(q) || markers.length > 0) && !/grade|result/.test(q)) {
    const selected = markers.length ? markers : w.markers;
    const workloads = selected.map((m) => {
      const assigned = rows.filter(({ r }) => r.markerId === m.id);
      const awaiting = assigned.filter(({ r }) => r.submission === "submitted" && !r.grade.trim()).length;
      return { m, assigned, awaiting };
    }).filter((x) => x.assigned.length).sort((a, b) => b.awaiting - a.awaiting || b.assigned.length - a.assigned.length);
    return result("Marking workload (assessment records, not unique students).", workloads.map(({ m, assigned, awaiting }) => m.name + ": " + assigned.length + " allocated, " + assigned.filter(({ r }) => r.grade.trim() !== "").length + " marked, " + awaiting + " submitted and awaiting marking, " + assigned.filter(({ r }) => r.submission !== "submitted").length + " awaiting submission.")
      .concat(/balance/.test(q) && workloads.length ? ["Next: compare submitted work awaiting marking before reassigning; confirm the marker teaches the module."] : []));
  }
  if (/\b(grade|grades|result|results)\b/.test(q))
    return result("Recorded grades.", rows.map((row) => label(row) + ": " + (row.r.grade.trim() || "not marked") + "; " + (isReviewed(row.r, w) ? "reviewed" : "not reviewed") + "."));
  if ((/\b(student|students|enrolment|enrolments|enrolled|roster)\b/.test(q) || students.length) && !/block|overdue|deadline|priority|urgent|late/.test(q)) {
    const selected = w.students.filter((s) => (!students.length || students.some((x) => x.id === s.id)) && s.enrolments.some((e) => (!cohorts.length || cohorts.some((c) => c.id === e.cohortId)) && (!subject || e.subject === subject)) && (!modules.length || rows.some((row) => row.r.studentId === s.id)));
    return result(selected.length + " students match.", selected.map((s) => s.firstName + " " + s.lastName + " (" + s.ncgId + ") - " + s.enrolments.map((e) => w.cohorts.find((c) => c.id === e.cohortId)?.name + " / " + subjectLabel(e.subject)).join(", ")));
  }
  if (/\b(overdue|deadline|deadlines|due|late|urgent|block|blocking|blocked|priority|priorities|next|completion)\b/.test(q)) {
    const overdueOnly = /overdue|late/.test(q);
    const upcoming = /upcoming|next week|due soon/.test(q) && !overdueOnly;
    const scoped = assessments.map((a) => ({ ...a, records: a.records.filter((r) => (!students.length || students.some((s) => s.id === r.studentId)) && (!markers.length || markers.some((m) => m.id === r.markerId))) })).filter((a) => a.records.length);
    const matches = scoped.map((a) => ({ a, stages: STAGES.map((stage) => ({ stage, ...stageProgress(a, w, stage.key, date) })), reasons: blockers(a, w) })).filter(({ stages, reasons }) => upcoming ? stages.some((s) => !s.complete && s.target >= date) : overdueOnly ? stages.some((s) => s.overdue) : reasons.length || stages.some((s) => s.overdue)).sort((a, b) => Number(b.stages.some((s) => s.overdue)) - Number(a.stages.some((s) => s.overdue)));
    return result(matches.length + (overdueOnly ? " overdue assessments." : upcoming ? " assessments with upcoming targets." : " assessments need attention."), matches.map(({ a, stages, reasons }) => {
      link(a.id, a.module + " / " + a.name);
      const stage = stages.find((s) => upcoming ? !s.complete && s.target >= date : s.overdue);
      return a.module + " / " + a.name + " / " + w.cohorts.find((c) => c.id === a.cohortId)?.name + ": " + (stage ? stage.stage.label + " target " + stage.target + "; " + stage.done + "/" + stage.total + " complete. " : "") + reasons.slice(0, 2).join(" ") + " Next: open this assessment and resolve the earliest unfinished stage.";
    }));
  }
  if (/\b(summary|overview|how many|total|count)\b/.test(q))
    return result("Workspace summary.", [new Set(rows.map(({ r }) => r.studentId)).size + " students across " + assessments.length + " assessments.", rows.filter(({ r }) => r.submission !== "submitted").length + " outstanding submissions; " + rows.filter(({ r }) => !r.markerId).length + " unallocated records; " + rows.filter(({ r }) => canReview(r, w) && !isReviewed(r, w)).length + " ready for review."]);
  return result("I can search the current records, but couldn't identify what to check.", ["Try: Who hasn't submitted BM301?", "Try: Which students in Cohort 1 need support?", "Try: How much work is allocated to Rachel Adams?"]);
}
