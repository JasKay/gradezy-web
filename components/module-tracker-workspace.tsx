"use client";
import Link from 'next/link';
import { useState } from 'react';
import { Box, StudentModal, FormFields, SpreadsheetImport, saveExcel } from './tracker-workspace';
import { moduleRoster, moduleLearning, saveModuleLearning, saveModuleMarking, type ModuleStudent } from '@/lib/module-tracker';
import { ncgDirectoryRows, normalizeModuleCode, subjectLabel } from '@/lib/ncg-modules';
import { SUBJECTS, type Workflow, type Progress } from '@/lib/workflow';
import { LEARNING_COLUMNS, ATTEMPT_COLUMNS, RESUB_COLUMNS, STUDENT_COLUMNS, parseSpreadsheet, readFields, fieldAt, cohortFor, subjectFor } from '@/lib/tracker-sheets';
type Commit = (change: (w: Workflow) => Workflow, message: string) => boolean;
export function ModuleTrackerWorkspace({ w, commit, initialTab = 'progress' }: {
    w: Workflow;
    commit: Commit;
    initialTab?: 'progress' | 'marking';
}) {
    const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const modules = Array.from(new Set([...ncgDirectoryRows(w).map(o => normalizeModuleCode(o.code)), ...w.assessments.map(a => normalizeModuleCode(a.module))])).sort();
    const [module, setModule] = useState(normalizeModuleCode(query.get('module') || modules[0] || ''));
    const [cohort, setCohort] = useState(query.get('cohort') || '');
    const [programme, setProgramme] = useState(query.get('subject') || '');
    const [tab, setTab] = useState(initialTab);
    const [aid, setAid] = useState('');
    const [selected, setSelected] = useState<ModuleStudent>();
    const [importing, setImporting] = useState(false);
    const [search, setSearch] = useState('');
    const roster = moduleRoster(w, module).filter(r => (!cohort || r.cohortId === cohort) && (!programme || r.subject === programme));
    const assessments = w.assessments.filter(a => normalizeModuleCode(a.module) === module && (!cohort || a.cohortId === cohort) && (!programme || a.subject === programme));
    const assessment = assessments.find(a => a.id === aid) || assessments[0];
    const visible = roster.filter(r => tab === 'progress' || (assessment && r.cohortId === assessment.cohortId && r.subject === assessment.subject)).filter(r => { const s = w.students.find(s => s.id === r.studentId)!; return (s.firstName + ' ' + s.lastName + ' ' + s.ncgId).toLowerCase().includes(search.toLowerCase()); });
    const moduleName = ncgDirectoryRows(w).find(o => normalizeModuleCode(o.code) === module)?.name || module;
    const student = selected && w.students.find(s => s.id === selected.studentId);
    const close = () => setSelected(undefined);
    const download = () => void saveExcel(module + '-' + tab, [{ name: tab === 'progress' ? 'Progress Tracker' : 'Marking Allocation', rows: [['Module Code', 'Cohort', 'Programme', ...STUDENT_COLUMNS.map(c => c[1]), ...(tab === 'progress' ? LEARNING_COLUMNS.map(c => c[1]) : ['Assessment', ...ATTEMPT_COLUMNS.map(c => c[1]), ...RESUB_COLUMNS.map(c => c[1])])], ...visible.map(r => { const s = w.students.find(s => s.id === r.studentId)!; const p = moduleLearning(w, module, r); const record = assessment?.records.find(p => p.studentId === s.id); return [module, w.cohorts.find(c => c.id === r.cohortId)?.name || r.cohortId, subjectLabel(r.subject), ...STUDENT_COLUMNS.map(([k]) => k === 'ncgId' ? s.ncgId : k === 'firstName' ? s.firstName : k === 'lastName' ? s.lastName : (k === 'lecturer' && tab === 'progress' ? p.values.lecturer || s.profile?.lecturer : s.profile?.[k]) || ''), ...(tab === 'progress' ? LEARNING_COLUMNS.map(([k]) => p.values[k] || '') : [assessment?.name || '', ...ATTEMPT_COLUMNS.map(([k]) => record?.attempts?.first[k] || ((!record?.activeAttempt || record.activeAttempt==='first') ? k === 'grade' ? record?.grade || '' : k === 'marker' ? w.markers.find(m => m.id === record?.markerId)?.name || '' : '' : '')), ...RESUB_COLUMNS.map(([k]) => record?.attempts?.resubmission[k] || '')])]; })] }]);
    return <>
 <Box title="Module workspace" actions={<div className="wf-actions"><button className="wf-button" onClick={() => setImporting(true)}>Import Excel</button><button className="wf-button" disabled={!visible.length} onClick={download}>Download list</button></div>}>
 <div className="wf-filters">
 <label className="wf-field"><span>Module</span><select aria-label="Tracker module" value={module} onChange={e => { setModule(e.target.value); setAid(''); close(); }}>{modules.map(m => <option key={m} value={m}>{m} - {ncgDirectoryRows(w).find(o => normalizeModuleCode(o.code) === m)?.name || m}</option>)}</select></label>
 <label className="wf-field"><span>Cohort</span><select aria-label="Tracker cohort" value={cohort} onChange={e => { setCohort(e.target.value); close(); }}><option value="">All cohorts</option>{w.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label className="wf-field"><span>Programme</span><select aria-label="Tracker programme" value={programme} onChange={e => { setProgramme(e.target.value); close(); }}><option value="">All programmes</option>{SUBJECTS.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}</select></label>
 <label className="wf-field"><span>Find student</span><input value={search} onChange={e => setSearch(e.target.value)}/></label>
 </div>
 <p className="wf-muted">{moduleName}</p>
 <nav className="wf-tracker-tabs" aria-label="Module tracker views"><button className={tab === 'progress' ? 'active' : ''} aria-pressed={tab === 'progress'} onClick={() => { setTab('progress'); close(); }}>Progress Tracker</button><button className={tab === 'marking' ? 'active' : ''} aria-pressed={tab === 'marking'} onClick={() => { setTab('marking'); close(); }}>Marking & Allocation</button></nav>
 {tab === 'marking' && <label className="wf-field"><span>Assessment</span><select aria-label="Marking assessment" value={assessment?.id || ''} onChange={e => { setAid(e.target.value); close(); }}>{!assessments.length && <option value="">No assessments scheduled</option>}{assessments.map(a => <option key={a.id} value={a.id}>{a.name} - {w.cohorts.find(c => c.id === a.cohortId)?.name} - {subjectLabel(a.subject)}{a.operations?.semester ? ' - ' + a.operations.semester : ''}</option>)}</select></label>}
 {tab === 'marking' && assessment && <div className="wf-marker-summary">{Array.from(new Set(assessment.records.map(r => r.markerId))).map(id => { const records = assessment.records.filter(r => r.markerId === id); return <span key={id}>{w.markers.find(m => m.id === id)?.name || 'Unallocated'}: {records.length} allocated - {records.filter(r => r.grade !== '').length} marked</span>; })}</div>}
 <div className="wf-table-wrap"><table><thead><tr><th>Student</th><th>Cohort</th><th>Programme</th>{tab === 'progress' ? <><th>Lecturer</th><th>Latest checkpoint</th><th>Current issue</th><th>Last update</th></> : <><th>Submission</th><th>1st Marker</th><th>Marking status</th><th>Final grade</th></>}</tr></thead><tbody>
 {visible.map(row => { const s = w.students.find(s => s.id === row.studentId)!, p = moduleLearning(w, module, row), r = assessment?.records.find(r => r.studentId === s.id), v = r?.attempts?.[r.activeAttempt || 'first']; return <tr key={s.id + row.cohortId + row.subject}><td><button className="wf-text-button" onClick={() => setSelected(row)}>{s.firstName} {s.lastName}</button><small>{s.ncgId}</small></td><td>{w.cohorts.find(c => c.id === row.cohortId)?.name}</td><td>{subjectLabel(row.subject)}</td>{tab === 'progress' ? <><td>{p.values.lecturer || s.profile?.lecturer || '-'}</td><td>{p.values.progress2 || p.values.progress1 || 'Not recorded'}<small>{p.values.progress2 ? p.values.task2 : p.values.task1}</small></td><td>{p.values.retentionComment2 || p.values.lecturerComment2 || p.values.retentionComment1 || p.values.lecturerComment1 || '-'}</td><td>{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-GB') : '-'}</td></> : <><td>{v?.outcome || (r?.submission === 'submitted' ? 'Submitted' : r?.submission === 'resubmission' ? 'Resubmission' : 'Awaiting submission')}</td><td>{v?.marker || w.markers.find(m => m.id === r?.markerId)?.name || 'Unallocated'}</td><td>{r?.reviewedAt ? 'Reviewed' : r?.grade ? 'Marked' : r?.markerId ? 'Assigned' : 'Unallocated'}</td><td>{v?.finalGrade || r?.grade || '-'}</td></>}</tr>; })}
 {!visible.length && <tr><td colSpan={7}>{tab === 'marking' && !assessment ? <><span>Add an assessment for this module to begin grading. </span><Link href="/assessments/new">Add assessment</Link></> : 'No enrolled students in this selection.'}</td></tr>}
 </tbody></table></div>
 </Box>
 {selected && student && <StudentModal title={student.firstName + ' ' + student.lastName + ' - ' + module} close={close}>
 <p className="wf-muted">{student.ncgId} - {w.cohorts.find(c => c.id === selected.cohortId)?.name} - {subjectLabel(selected.subject)}</p><details><summary>Student details</summary><dl className="wf-operations-grid">{STUDENT_COLUMNS.filter(([k]) => !['firstName', 'lastName'].includes(k)).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{k === 'ncgId' ? student.ncgId : student.profile?.[k] || '-'}</dd></div>)}</dl></details>
 {tab === 'progress' ? <ProgressEditor key={student.id + module} w={w} module={module} row={selected} commit={commit} close={close}/> : assessment && <MarkingEditor key={student.id + assessment.id} w={w} assessmentId={assessment.id} studentId={student.id} commit={commit} close={close}/>}
 </StudentModal>}
 {importing && <StudentModal title={tab === 'progress' ? 'Import Progress Tracker' : 'Import Marking Allocation'} close={() => setImporting(false)}>{tab === 'progress' ? <ProgressImport w={w} module={module} cohort={cohort} programme={programme} commit={commit} close={() => setImporting(false)}/> : assessment ? <SpreadsheetImport w={w} commit={commit} defaultKind="marking" assessmentId={assessment.id} expanded onComplete={() => setImporting(false)}/> : <p>Add an assessment before importing grading records.</p>}</StudentModal>}
 </>;
}
function ProgressEditor({ w, module, row, commit, close }: {
    w: Workflow;
    module: string;
    row: ModuleStudent;
    commit: Commit;
    close: () => void;
}) {
    const current = moduleLearning(w, module, row), [values, setValues] = useState({ ...current.values });
    return <><FormFields fields={[['lecturer', 'Lecturer'], ...LEARNING_COLUMNS]} values={values} onChange={setValues}/><div className="wf-actions"><button className="wf-button primary" onClick={() => { if (commit(next => saveModuleLearning(next, module, row, values), 'Updated module progress.'))
        close(); }}>Save progress</button></div>{current.history.length > 0 && <details><summary>Checkpoint history ({current.history.length})</summary>{current.history.map((h, i) => <div className="wf-history-entry" key={h.at + i}><strong>{new Date(h.at).toLocaleString('en-GB')}</strong>{LEARNING_COLUMNS.map(([k, label]) => h.values[k] && <p key={k}>{label}: {h.values[k]}</p>)}</div>)}</details>}</>;
}
function MarkingEditor({ w, assessmentId, studentId, commit, close }: {
    w: Workflow;
    assessmentId: string;
    studentId: string;
    commit: Commit;
    close: () => void;
}) {
    const r = w.assessments.find(a => a.id === assessmentId)?.records.find(r => r.studentId === studentId);
    const [attempts, setAttempts] = useState({ first: { ...r?.attempts?.first, marker: r?.attempts ? r.attempts.first.marker || '' : w.markers.find(m => m.id === r?.markerId)?.name || '', grade: r?.attempts ? r.attempts.first.grade || '' : r?.grade || '' }, resubmission: { ...r?.attempts?.resubmission } });
    const [attempt, setAttempt] = useState<'first' | 'resubmission'>(r?.activeAttempt || 'first');
    const [submission, setSubmission] = useState<Progress['submission']>(r?.submission || 'awaiting');
    const [error, setError] = useState('');
    return <><div className="wf-form-grid"><label className="wf-field"><span>Attempt</span><select aria-label="Attempt" value={attempt} onChange={e => setAttempt(e.target.value as 'first' | 'resubmission')}><option value="first">First submission</option><option value="resubmission">Resubmission</option></select></label><label className="wf-field"><span>Submission status</span><select aria-label="Submission status" value={submission} onChange={e => setSubmission(e.target.value as Progress['submission'])}><option value="awaiting">Awaiting submission</option><option value="submitted">Submitted</option><option value="resubmission">Resubmission required</option></select></label></div><FormFields fields={ATTEMPT_COLUMNS} values={attempts[attempt]} onChange={v => setAttempts({ ...attempts, [attempt]: v })}/>{error && <p role="alert">{error}</p>}<button className="wf-button primary" onClick={() => { try {
        saveModuleMarking(w, assessmentId, studentId, attempts, attempt, submission);
        if (commit(next => saveModuleMarking(next, assessmentId, studentId, attempts, attempt, submission), 'Updated grading and marker allocation.'))
            close();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to save.');
    } }}>Save marking</button><p><Link href={'/workflow/' + assessmentId}>Open assessment review & release</Link></p></>;
}
function ProgressImport({ w, module, cohort, programme, commit, close }: {
    w: Workflow;
    module: string;
    cohort: string;
    programme: string;
    commit: Commit;
    close: () => void;
}) {
    const [sheets, setSheets] = useState<{
        name: string;
        grid: string[][];
    }[]>([]), [sheet, setSheet] = useState(''), [error, setError] = useState('');
    const apply = (next: Workflow) => { const grid = sheets.find(s => s.name === sheet)?.grid; if (!grid)
        throw new Error('Choose a worksheet.'); const { headers, rows } = parseSpreadsheet(grid, 'learning'); for (const cells of rows) {
        const identity = readFields(headers, cells, STUDENT_COLUMNS), context = readFields(headers, cells, [['cohort', 'Cohort'],['module','Module Code']]);
        if(context.module && normalizeModuleCode(context.module)!==normalizeModuleCode(module)) throw new Error('Workbook module must match the selected module.');
        const s = next.students.find(s => s.ncgId.trim().toLowerCase() === identity.ncgId?.trim().toLowerCase());
        if (!s)
            throw new Error('Unknown NCG ID: ' + identity.ncgId + '. Import the student first.');
        const c = context.cohort ? cohortFor(next, context.cohort) : identity.groupCode ? cohortFor(next, identity.groupCode) : undefined;
        if (identity.groupCode && /^c\d/i.test(identity.groupCode) && !cohortFor(next, identity.groupCode))
            throw new Error('Unknown cohort in Group Code.');
        if (context.cohort && identity.groupCode && cohortFor(next, identity.groupCode) && c?.id !== cohortFor(next, identity.groupCode)?.id)
            throw new Error('Cohort and Group Code must match.');
        const subject = identity.programme ? subjectFor(identity.programme) : undefined;
        const candidates = moduleRoster(next, module).filter(r => r.studentId === s.id && (!(c?.id || cohort) || r.cohortId === (c?.id || cohort)) && (!(subject || programme) || r.subject === (subject || programme)));
        if ((context.cohort && !c) || (identity.programme && !subject) || candidates.length !== 1)
            throw new Error('Provide a matching Cohort and Programme for ' + identity.ncgId + '.');
        next = saveModuleLearning(next, module, candidates[0], { ...moduleLearning(next, module, candidates[0]).values, ...Object.fromEntries(Object.entries(readFields(headers, cells, [['lecturer', 'Lecturer'], ...LEARNING_COLUMNS])).filter(([key]) => {const fields=[['lecturer','Lecturer'],...LEARNING_COLUMNS];const index=fields.findIndex(([k])=>k===key);const [k,label]=fields[index];const occurrence=fields.slice(0,index).filter(([,l])=>l===label).length;return fieldAt(headers,k,label,0,headers.length,occurrence)>=0;})) });
    } return next; };
    return <><p className="wf-muted">Import existing student checkpoints for {module}. Include Cohort or Group Code and Programme when a student has multiple enrolments.</p><label className="wf-field"><span>Upload progress workbook</span><input type="file" accept=".xlsx,.xls,.csv" onChange={async (e) => { try {
        setError('');
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (file.size > 5000000)
            throw new Error('Maximum workbook size is 5 MB.');
        const X = await import('xlsx'), book = X.read(await file.arrayBuffer(), { type: 'array' });
        setSheets(book.SheetNames.map(name => ({ name, grid: X.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, defval: '', raw: false }) })));
        setSheet(book.SheetNames[0]);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to read workbook.');
    } }}/></label>{sheets.length > 0 && <label className="wf-field"><span>Worksheet</span><select value={sheet} onChange={e => setSheet(e.target.value)}>{sheets.map(s => <option key={s.name}>{s.name}</option>)}</select></label>}{error && <p role="alert">{error}</p>}<button className="wf-button primary" disabled={!sheets.length} onClick={() => { try {
        apply(w);
        if (commit(apply, 'Imported module progress checkpoints.'))
            close();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid worksheet.');
    } }}>Confirm progress import</button></>;
}
