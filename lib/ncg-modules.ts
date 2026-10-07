import { NCG_OFFERINGS } from "./ncg-offerings";
import type { Assessment, Subject, Workflow } from "./workflow";

export const ORGANISATION = "NCG";
export const PROGRAMMES = {
  BM: { name: "Business Management", subject: "Business Management" as Subject },
  COMP: { name: "Computing", subject: "Computer Science" as Subject },
  HSC: { name: "Health and Social Care", subject: "Health and Social Care" as Subject },
} as const;
export type ProgrammeCode = keyof typeof PROGRAMMES;
export type NcgModule = { code: string; name: string; programmes: ProgrammeCode[]; aliases?: string[] };

const shared: ProgrammeCode[] = ["BM", "COMP", "HSC"];
export const NCG_MODULES: readonly NcgModule[] = [
  { code: "ACS100", name: "Academic Study Skills", programmes: [...shared] },
  { code: "BM101", name: "The Business Environment", programmes: ["BM"] },
  { code: "BM102", name: "Principles of Marketing", programmes: ["BM"] },
  { code: "BM103", name: "People and Performance Management", programmes: ["BM"] },
  { code: "BM104", name: "Accounting for Managers", programmes: ["BM"] },
  { code: "CMP111", name: "Information Systems and Databases", programmes: ["COMP"] },
  { code: "CMP114", name: "Dynamic Website Development", programmes: ["COMP"] },
  { code: "IHS101", name: "Investigating Health, Social Care and Wellbeing Provisions", programmes: ["HSC"] },
  { code: "IHS102", name: "Developing Wellbeing in the Community", programmes: ["HSC"] },
  { code: "IHS103", name: "Making a Difference: Supporting Individuals with Specific Needs", programmes: ["HSC"] },
  { code: "IHS104", name: "Growing Pain: The Psychology of Childhood and the Youth", programmes: ["HSC"] },
  { code: "NCS401", name: "Introduction to Networks", programmes: ["COMP"] },
  { code: "NCS402", name: "Switching Routing and Wireless", programmes: ["COMP"] },
  { code: "PRD100", name: "Personal Development", programmes: [...shared] },
  { code: "WRL100", name: "Work Related Learning", programmes: [...shared] },
  { code: "BM201", name: "Ethics and Sustainability", programmes: ["BM"] },
  { code: "BM202", name: "Operations & Supply Chain Management", programmes: ["BM"] },
  { code: "BM203", name: "Digital Marketing", programmes: ["BM"] },
  { code: "BM204", name: "Enterprise and Entrepreneurship", programmes: ["BM"] },
  { code: "CMP211", name: "Intelligent Systems", programmes: ["COMP"] },
  { code: "CMP212", name: "Object Oriented Programming", programmes: ["COMP"] },
  { code: "CMP213", name: "Internet of Things", programmes: ["COMP"] },
  { code: "CMP214", name: "Secure Website Development", programmes: ["COMP"] },
  { code: "IHS201", aliases: ["IH201"], name: "Health Inequalities and Social Justice in the 21st Century", programmes: ["HSC"] },
  { code: "IHS202", aliases: ["IH202"], name: "The Individual Across the Life Course", programmes: ["HSC"] },
  { code: "IHS203", aliases: ["IH203"], name: "Safeguarding and Safe Working Practices", programmes: ["HSC"] },
  { code: "IHS204", aliases: ["IH204"], name: "Under Pressure: The Effects of Mental ill Health on Well-Being", programmes: ["HSC"] },
  { code: "PFD200", name: "Professional Development", programmes: [...shared] },
  { code: "WKL200", name: "Work Based Learning", programmes: [...shared] },
  { code: "BM300", name: "BM Dissertation", programmes: ["BM"] },
  { code: "BM301", name: "Business Strategy", programmes: ["BM"] },
  { code: "BM302", name: "Responsible Business", programmes: ["BM"] },
  { code: "BM303", name: "Strategic Career Development", programmes: ["BM"] },
  { code: "BM304", name: "Leading Innovation", programmes: ["BM"] },
  { code: "BM305", name: "Equality, Diversity and Inclusion at Work", programmes: ["BM"] },
  { code: "CMP600", name: "COMP Dissertation", programmes: ["COMP"] },
  { code: "CMP604", name: "Collaborative Development", programmes: ["COMP"] },
  { code: "CMP609", name: "Advanced Networking", programmes: ["COMP"] },
  { code: "CMP610", name: "Digital Forensic Investigations", programmes: ["COMP"] },
  { code: "CMP611", name: "Vulnerability & Penetration Testing", programmes: ["COMP"] },
  { code: "IHS301", name: "Research Theory and Practice", programmes: ["HSC"] },
  { code: "IHS302", name: "Developing Wellbeing Strategies in the Community", programmes: ["HSC"] },
  { code: "IHS303", name: "Health Policy, Politics and Power", programmes: ["HSC"] },
  { code: "IHS304", name: "Taking Control: Leading, Managing and Caring in IHSCWB", programmes: ["HSC"] },
  { code: "IHS305", name: "HSC Dissertation", programmes: ["HSC"] },
];

export function normalizeProgramme(value: string): ProgrammeCode | undefined {
  const code = value.replace(/<br\s*\/?>/gi, " ").trim().toUpperCase();
  if (code === "CMP" || code === "COMP" || /COMPUT|COMPUTER|SOFTWARE/.test(code)) return "COMP";
  if (code === "BM" || code === "BUSINESS MANAGEMENT") return "BM";
  if (code === "HSC" || /HEALTH.*SOCIAL|SOCIAL.*CARE/.test(code)) return "HSC";
}
export function normalizeModuleCode(value: string): string {
  const code = value.replace(/\s/g, "").toUpperCase();
  return /^IH20[1-4]$/.test(code) ? code.replace(/^IH/, "IHS") : code;
}
export function findNcgModule(code: string): NcgModule | undefined {
  return NCG_MODULES.find((m) => m.code === normalizeModuleCode(code));
}
export function programmeForSubject(subject: string): ProgrammeCode | undefined {
  return (Object.keys(PROGRAMMES) as ProgrammeCode[]).find((code) => PROGRAMMES[code].subject === subject);
}
export function subjectLabel(subject: string): string {
  const programme = programmeForSubject(subject);
  return programme ? PROGRAMMES[programme].name : subject;
}

/** Update only fictional starter module codes; entered assessment data is preserved. */
export function alignPracticeModules(w: Workflow): Workflow {
  const codes: Record<string, string> = { BUS101: "BM301", COM102: "CMP114", HSC103: "IHS103" };
  if (!w.assessments.some((a) => a.id.startsWith("practice-") && codes[a.module])) return w;
  const next = structuredClone(w);
  next.assessments.forEach((a) => {
    if (!a.id.startsWith("practice-") || !codes[a.module]) return;
    a.module = codes[a.module];
    a.operations = { ...a.operations, moduleName: findNcgModule(a.module)!.name };
  });
  return next;
}

/** One directory entry per module and programme; scheduled cohorts cannot be hidden. */
export function ncgModuleEntries(w: Workflow) {
  return NCG_MODULES.flatMap(m => m.programmes.map(programme => {
    const key = m.code + ":" + programme;
    const override = w.moduleEntries?.find(entry => entry.key === key);
    const assessments = w.assessments.filter(a => normalizeModuleCode(a.module) === m.code && programmeForSubject(a.subject) === programme);
    const cohortIds = [...new Set([...(override?.cohortIds || []), ...assessments.map(a => a.cohortId)])].filter(id => w.cohorts.some(c => c.id === id));
    return { ...m, key, programme, name: override?.name || m.name, cohortIds, assessments };
  }));
}

export function updateNcgModuleEntry(w: Workflow, key: string, name: string, cohortIds: string[]): Workflow {
  const entry = ncgModuleEntries(w).find(m => m.key === key);
  if (!entry) throw new Error("Module entry not found.");
  if (!name.trim()) throw new Error("Enter a module name.");
  if (cohortIds.some(id => !w.cohorts.some(c => c.id === id))) throw new Error("Choose an existing cohort.");
  return { ...w, moduleEntries: [...(w.moduleEntries || []).filter(m => m.key !== key), { key, name: name.trim(), cohortIds: [...new Set(cohortIds)] }] };
}

type NcgScheduleRow = { term?: string; key: string; code: string; name: string; programme: ProgrammeCode | ""; cohortId: string; assessment: Assessment | undefined };
export function ncgDirectoryRows(w: Workflow) {
  const claimed = new Set<string>();
  return NCG_OFFERINGS.map(source => {
    const rowKey = source.term + ":" + source.code + ":" + source.programme;
    const edit = w.moduleOfferingEdits?.find(e => e.key === rowKey);
    const cohortId = edit?.cohortId || w.cohorts.find(c => c.name.trim().toLowerCase() === "cohort " + source.cohort)?.id || "cohort-" + source.cohort;
    const assessments = w.assessments.filter(a => {
      if (claimed.has(a.id) || normalizeModuleCode(a.module) !== normalizeModuleCode(source.code) || programmeForSubject(a.subject) !== source.programme || a.cohortId !== cohortId) return false;
      if (a.operations?.semester && a.operations.semester !== source.term) return false;
      claimed.add(a.id);
      return true;
    });
    return { ...source, rowKey, cohortId, name: edit?.name || source.name, assessments };
  });
}

export function updateNcgOffering(w: Workflow, key: string, name: string, cohortId: string): Workflow {
  const row = ncgDirectoryRows(w).find(r => r.rowKey === key);
  if (!row) throw new Error("Module entry not found.");
  if (!name.trim()) throw new Error("Enter a module name.");
  if (!w.cohorts.some(c => c.id === cohortId)) throw new Error("Choose an existing cohort.");
  if (row.assessments.length && cohortId !== row.cohortId) throw new Error("Edit the assessment schedule to change its cohort.");
  return { ...w, moduleOfferingEdits: [...(w.moduleOfferingEdits || []).filter(e => e.key !== key), { key, name: name.trim(), cohortId }] };
}

export function ncgScheduleRows(w: Workflow): NcgScheduleRow[] {
  const entries = ncgDirectoryRows(w);
  const rows = entries.flatMap<NcgScheduleRow>(m => m.assessments.length ? m.assessments.map(assessment => ({ key: assessment.id, code: m.code, name: m.name, term: m.term, programme: m.programme, cohortId: m.cohortId, assessment })) : [{ key: m.rowKey, code: m.code, name: m.name, term: m.term, programme: m.programme, cohortId: m.cohortId, assessment: undefined }]);
  // Existing assessments outside the supplied offerings retain their records and schedule.
  const matched = new Set(entries.flatMap(m => m.assessments.map(a => a.id)));
  w.assessments.filter(a => !matched.has(a.id)).forEach(assessment => rows.push({ key: assessment.id, code: assessment.module, name: assessment.operations?.moduleName || assessment.module, programme: programmeForSubject(assessment.subject) || "", cohortId: assessment.cohortId, assessment }));
  return rows;
}

export function compareCohorts(w: Workflow, left: string, right: string, descending = false): number {
  if (!left || !right) return left === right ? 0 : !left ? 1 : -1;
  const a = w.cohorts.find(c => c.id === left)?.name || left;
  const b = w.cohorts.find(c => c.id === right)?.name || right;
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }) * (descending ? -1 : 1);
}
