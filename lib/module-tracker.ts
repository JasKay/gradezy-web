import { ncgDirectoryRows, normalizeModuleCode, programmeForSubject } from './ncg-modules';
import { emptyProgress, updateProgress, type Workflow, type Subject, type Progress } from './workflow';
export type ModuleStudent = {
    studentId: string;
    cohortId: string;
    subject: Subject;
};
export function moduleRoster(w: Workflow, module: string): ModuleStudent[] {
    const code = normalizeModuleCode(module), offerings = ncgDirectoryRows(w).filter(o => normalizeModuleCode(o.code) === code);
    return w.students.flatMap(s => s.enrolments.filter(e => offerings.some(o => o.cohortId === e.cohortId && o.programme === programmeForSubject(e.subject)) || w.assessments.some(a => normalizeModuleCode(a.module) === code && a.cohortId === e.cohortId && a.subject === e.subject)).map(e => ({ studentId: s.id, ...e })));
}
export function moduleLearning(w: Workflow, module: string, row: ModuleStudent) {
    const code = normalizeModuleCode(module);
    const current = w.moduleProgress?.find(p => p.module === code && p.studentId === row.studentId && p.cohortId === row.cohortId && p.subject === row.subject);
    if (current)
        return current;
    const imported = w.learningProgress?.find(p => p.studentId === row.studentId && w.assessments.some(a => a.id === p.assessmentId && normalizeModuleCode(a.module) === code && a.cohortId === row.cohortId && a.subject === row.subject));
    return { values: imported?.values || {}, updatedAt: '', history: [] };
}
export function saveModuleLearning(w: Workflow, module: string, row: ModuleStudent, values: Record<string, string>, at = new Date().toISOString()): Workflow {
    if (!moduleRoster(w, module).some(r => r.studentId === row.studentId && r.cohortId === row.cohortId && r.subject === row.subject))
        throw new Error('Student is not enrolled in this module and cohort.');
    const next = structuredClone(w), code = normalizeModuleCode(module), previous = moduleLearning(w, module, row);
    next.moduleProgress ||= [];
    let record = next.moduleProgress.find(p => p.module === code && p.studentId === row.studentId && p.cohortId === row.cohortId && p.subject === row.subject);
    if (!record) {
        record = { module: code, ...row, values: {}, updatedAt: '', history: [] };
        next.moduleProgress.push(record);
    }
    record.values = { ...values };
    record.updatedAt = at;
    record.history = [{ at, values: { ...values } }, ...previous.history];
    // Keep existing assessment-linked consumers (student profiles and assistant) in sync.
    for (const p of next.learningProgress || [])
        if (p.studentId === row.studentId && next.assessments.some(a => a.id === p.assessmentId && normalizeModuleCode(a.module) === code && a.cohortId === row.cohortId && a.subject === row.subject))
            p.values = { ...values };
    return next;
}
export function saveModuleMarking(w: Workflow, assessmentId: string, studentId: string, attempts: NonNullable<Progress['attempts']>, activeAttempt: 'first' | 'resubmission', submission: Progress['submission']): Workflow {
    const next = structuredClone(w), a = next.assessments.find(a => a.id === assessmentId), student = next.students.find(s => s.id === studentId);
    if (!a || !student?.enrolments.some(e => e.cohortId === a.cohortId && e.subject === a.subject))
        throw new Error('Choose an assessment for this student cohort and programme.');
    for (const v of Object.values(attempts))
        for (const key of ['grade', 'imGrade', 'thirdGrade', 'finalGrade'])
            if (v[key] && (!Number.isFinite(Number(v[key])) || Number(v[key]) < 0 || Number(v[key]) > 100))
                throw new Error('Grades must be numbers from 0 to 100. Use Outcome for DNS or TZ.');
    const values = attempts[activeAttempt];
    let marker = next.markers.find(m => m.name.toLowerCase() === values.marker?.trim().toLowerCase());
    if (!marker && values.marker?.trim()) {
        marker = { id: crypto.randomUUID(), name: values.marker.trim() };
        next.markers.push(marker);
    }
    const old = a.records.find(r => r.studentId === studentId) || emptyProgress(studentId);
    const updated = updateProgress(old, { markerId: marker?.id || '', grade: values.finalGrade || values.grade || '', submission }, next);
    const changed = JSON.stringify(old.attempts) !== JSON.stringify(attempts) || old.activeAttempt !== activeAttempt;
    if (changed) {
        updated.reviewedAt = undefined;
        updated.reviewer = '';
        updated.releasedAt = undefined;
    }
    Object.assign(updated, { attempts: structuredClone(attempts), activeAttempt });
    const index = a.records.findIndex(r => r.studentId === studentId);
    if (index < 0)
        a.records.push(updated);
    else
        a.records[index] = updated;
    return next;
}
