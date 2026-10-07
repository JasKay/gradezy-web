import { PROGRAMMES, type ProgrammeCode } from "./ncg-modules";
import { NCG_OFFERINGS } from "./ncg-offerings";
import type { Workflow } from "./workflow";

const firstNames = ["Amelia", "Noah", "Isla", "Oliver", "Ava", "Leo", "Freya", "Jack", "Mia", "Oscar", "Grace", "Arthur", "Sophia", "Ethan", "Aisha", "Lucas", "Chloe", "Samuel", "Zara", "Daniel", "Ella", "Adam", "Hannah", "Isaac"];
const lastNames = ["Bennett", "Clarke", "Morgan", "Reed", "Patel", "Williams", "Ahmed", "Turner", "Wilson", "Evans", "Thompson", "Lewis", "Hughes", "Price", "Davies", "Harris", "Roberts", "Wood", "Scott", "Hill", "Green", "Baker", "Young", "King"];

/** Fill each cohort to 20 students using its supplied programmes, preserving all existing records. */
export function populateStudentExamples(w: Workflow): Workflow {
  const next = structuredClone(w);
  let changed = false;
  for (const cohort of next.cohorts) {
    const number = Number(cohort.name.match(/\d+/)?.[0] || cohort.id.match(/\d+/)?.[0]);
    const offerings = NCG_OFFERINGS.filter(row => row.cohort === number);
    const programmes = [...new Set(offerings.map(row => row.programme))] as ProgrammeCode[];
    if (!programmes.length) continue;
    const enrolled = () => next.students.filter(s => s.enrolments.some(e => e.cohortId === cohort.id));
    let index = 0;
    while (enrolled().length < 20) {
      const programme = [...programmes].sort((a, b) => enrolled().filter(s => s.enrolments.some(e => e.cohortId === cohort.id && e.subject === PROGRAMMES[a].subject)).length - enrolled().filter(s => s.enrolments.some(e => e.cohortId === cohort.id && e.subject === PROGRAMMES[b].subject)).length)[0];
      const id = "practice-student-fill-" + number + "-" + index;
      if (next.students.some(s => s.id === id)) { index++; continue; }
      let firstName = firstNames[index % firstNames.length];
      let lastName = lastNames[(index * 7 + number * 3) % lastNames.length];
      let nameIndex = index;
      while (enrolled().some(s => s.firstName === firstName && s.lastName === lastName)) { nameIndex++; firstName = firstNames[nameIndex % firstNames.length]; lastName = lastNames[(nameIndex * 7 + number * 3) % lastNames.length]; }
      let ncgId = String(2700000 + number * 100 + index);
      while (next.students.some(s => s.ncgId === ncgId)) ncgId = String(Number(ncgId) + 100000);
      let eslId = String(720000 + number * 100 + index);
      while (next.students.some(s => s.profile?.eslId === eslId)) eslId = String(Number(eslId) + 100000);
      const level = number < 3 ? 6 : number < 5 ? 5 : 4;
      const programmeName = programme === "BM" ? (level === 6 ? "BA (Hons) Business Management" : "FdA Business Management") : programme === "COMP" ? (level === 6 ? "BSc (Hons) Computing" : "FdSc Computing") : (level === 6 ? "BSc (Hons) Health and Social Care" : "FdSc Health and Social Care");
      next.students.push({ id, ncgId, firstName, lastName, enrolments: [{ cohortId: cohort.id, subject: PROGRAMMES[programme].subject }], profile: { eslId, campus: ["Birmingham - York House", "Leicester", "Leeds"][index % 3], groupCode: "C" + number + "L" + level + "S1", programme: programmeName, email: (cohort.startMonth || "2026-10").replace("-", "").slice(2) + "-" + eslId + "@esl.ac.uk", status: "Active" } });
      changed = true;
      index++;
    }
  }
  return changed ? next : w;
}
