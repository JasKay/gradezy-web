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

type NcgScheduleRow = { key: string; code: string; name: string; programme: ProgrammeCode | ""; cohortId: string; assessment: Assessment | undefined };
export function ncgScheduleRows(w: Workflow): NcgScheduleRow[] {
  const entries = ncgModuleEntries(w);
  const rows = entries.flatMap<NcgScheduleRow>(m => {
    const cohorts = m.cohortIds.length ? m.cohortIds : [""];
    return cohorts.flatMap<NcgScheduleRow>(cohortId => {
      const assessments = m.assessments.filter(a => a.cohortId === cohortId);
      return assessments.length ? assessments.map(assessment => ({ key: assessment.id, code: m.code, name: m.name, programme: m.programme as ProgrammeCode | "", cohortId, assessment })) : [{ key: m.key + ":" + cohortId, code: m.code, name: m.name, programme: m.programme as ProgrammeCode | "", cohortId, assessment: undefined }];
    });
  });
  // Retain imported assessments outside the NCG catalogue.
  w.assessments.filter(a => !entries.some(m => m.assessments.some(existing => existing.id === a.id))).forEach(assessment => rows.push({ key: assessment.id, code: assessment.module, name: assessment.operations?.moduleName || assessment.module, programme: programmeForSubject(assessment.subject) || "", cohortId: assessment.cohortId, assessment }));
  return rows;
}
