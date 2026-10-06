"use client";
import Link from "next/link";
import { useState } from "react";
import {
  SUBJECTS,
  isReviewed,
  type Workflow,
  type Assessment,
  type Subject,
  type Student,
} from "@/lib/workflow";
import {
  STUDENT_COLUMNS,
  ASSESSMENT_COLUMNS,
  LEARNING_COLUMNS,
  ATTEMPT_COLUMNS,
  RESUB_COLUMNS,
  parseSpreadsheet,
  applySpreadsheet,
  type SheetKind,
} from "@/lib/tracker-sheets";
type Commit = (fn: (w: Workflow) => Workflow, message: string) => boolean;
async function saveExcel(
  name: string,
  sheets: { name: string; rows: string[][] }[],
) {
  const X = await import("xlsx");
  const book = X.utils.book_new();
  sheets.forEach((s) =>
    X.utils.book_append_sheet(book, X.utils.aoa_to_sheet(s.rows), s.name),
  );
  X.writeFile(book, `${name}.xlsx`);
}
function Box({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="wf-panel">
      <div className="wf-panel-head">
        <h2>{title}</h2>
      </div>
      <div className="wf-form">{children}</div>
    </section>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="wf-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function FormFields({
  fields,
  values,
  onChange,
}: {
  fields: readonly (readonly [string, string])[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div className="wf-form-grid three">
      {fields.map(([key, label]) => (
        <Input
          key={key}
          label={label}
          value={values[key] || ""}
          onChange={(value) => onChange({ ...values, [key]: value })}
        />
      ))}
    </div>
  );
}
export function SpreadsheetImport({
  w,
  commit,
  defaultKind = "students",
  assessmentId,
}: {
  w: Workflow;
  commit: Commit;
  defaultKind?: SheetKind;
  assessmentId?: string;
}) {
  const [kind, setKind] = useState<SheetKind>(defaultKind);
  const [cohortId, setCohort] = useState(w.cohorts[0]?.id || "");
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0]);
  const [aid, setAid] = useState(assessmentId || w.assessments[0]?.id || "");
  const [system, setSystem] = useState("Excel upload");
  const [sheets, setSheets] = useState<{ name: string; grid: string[][] }[]>(
    [],
  );
  const [sheet, setSheet] = useState("");
  const [fileName, setFile] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const grid = sheets.find((s) => s.name === sheet)?.grid;
  let preview: { headers: string[]; rows: string[][] } | undefined;
  let validation = "";
  if (grid)
    try {
      preview = parseSpreadsheet(grid, kind);
      applySpreadsheet(w, kind, preview.headers, preview.rows, {
        cohortId,
        subject,
        assessmentId: aid,
        fileName,
        sheetName: sheet,
        system,
      });
    } catch (e) {
      validation = e instanceof Error ? e.message : "Invalid worksheet";
    }
  async function read(file?: File) {
    if (!file) return;
    setError("");
    setSheets([]);
    setBusy(true);
    setFile(file.name);
    try {
      if (file.size > 5_000_000)
        throw new Error("Maximum workbook size is 5 MB.");
      const X = await import("xlsx");
      const b = X.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });
      const parsed = b.SheetNames.map((name) => ({
        name,
        grid: X.utils.sheet_to_json<string[]>(b.Sheets[name], {
          header: 1,
          raw: false,
          defval: "",
          dateNF: "yyyy-mm-dd",
        }),
      }));
      setSheets(parsed);
      setSheet(parsed[0]?.name || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open workbook");
    } finally {
      setBusy(false);
    }
  }
  const fields =
    kind === "assessments"
      ? ASSESSMENT_COLUMNS
      : kind === "learning"
        ? [...STUDENT_COLUMNS, ...LEARNING_COLUMNS]
        : kind === "marking"
          ? [...STUDENT_COLUMNS, ...ATTEMPT_COLUMNS, ...RESUB_COLUMNS]
          : STUDENT_COLUMNS;
  return (
    <details className="wf-disclosure">
      <summary>Import {defaultKind === "students" ? "students" : defaultKind === "assessments" ? "assessment tracker" : defaultKind === "learning" ? "progress tracker" : "marking tracker"} from Excel</summary>
      <Box title="Upload workbook">
      <div className="wf-form-grid three">
        <label className="wf-field">
          <span>Tracker type</span>
          <select
            aria-label="Tracker type"
            value={kind}
            onChange={(e) => setKind(e.target.value as SheetKind)}
          >
            <option value="students">Student / SIMS enrolments</option>
            <option value="assessments">Assessment tracker</option>
            <option value="learning">
              Progress Tracker (learning checkpoints)
            </option>
            <option value="marking">
              Marking Allocation (grades & moderation)
            </option>
          </select>
        </label>
        <label className="wf-field">
          <span>Data source</span>
          <select
            aria-label="Data source"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
          >
            {[
              "Excel upload",
              "SharePoint export",
              "SIMS export",
              "StaffAdvantage export",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="wf-field">
          <span>Default cohort</span>
          <select
            aria-label="Default cohort"
            value={cohortId}
            onChange={(e) => setCohort(e.target.value)}
          >
            {w.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="wf-field">
          <span>Default subject</span>
          <select
            aria-label="Default subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as Subject)}
          >
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {(kind === "learning" || kind === "marking") && (
          <label className="wf-field">
            <span>Assessment / module</span>
            <select
              aria-label="Assessment / module"
              value={aid}
              onChange={(e) => setAid(e.target.value)}
            >
              <option value="">Choose assessment</option>
              {w.assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {w.cohorts.find((c) => c.id === a.cohortId)?.name} ·{" "}
                  {a.module} · {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {sheets.length > 0 && (
          <label className="wf-field">
            <span>Worksheet</span>
            <select
              aria-label="Worksheet"
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
            >
              {sheets.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="wf-muted">
        Recognised programme names select the subject automatically. The default
        subject applies when a programme cannot be recognised. Learning and
        marking trackers use the selected assessment&apos;s cohort and subject.
      </p>
      <div className="wf-actions">
        <label className="wf-button">
          {busy ? "Reading workbook…" : "Choose Excel or CSV"}
          <input
            className="sr-only"
            aria-label="Upload tracker workbook"
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          className="wf-button"
          onClick={() =>
            void saveExcel(`${kind}-tracker-template`, [
              { name: "Tracker", rows: [fields.map(([, label]) => label)] },
            ])
          }
        >
          Download matching Excel template
        </button>
        <span className="wf-muted">{fileName}</span>
      </div>
      {(error || validation) && (
        <div role="alert" className="wf-message error">
          {error || validation}
        </div>
      )}
      {preview && (
        <>
          <div className="wf-table-wrap">
            <table>
              <thead>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 3).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wf-actions">
            <span className="wf-muted">
              {preview.rows.length} rows · preview shows first three · {sheet}
            </span>
            <button
              className="wf-button primary"
              disabled={!!validation}
              onClick={() => {
                if (
                  preview &&
                  commit(
                    (next) =>
                      applySpreadsheet(
                        next,
                        kind,
                        preview!.headers,
                        preview!.rows,
                        {
                          cohortId,
                          subject,
                          assessmentId: aid,
                          fileName,
                          sheetName: sheet,
                          system,
                        },
                      ),
                    `Imported ${fileName} / ${sheet}: ${preview.rows.length} ${kind} rows.`,
                  )
                ) {
                  setSheets([]);
                  setFile("");
                }
              }}
            >
              Confirm tracker import
            </button>
          </div>
          <p className="wf-muted">
            Imported final grades and released flags are source values; imports
            do not grant approval or confirm uploads. Configure timeline dates
            explicitly after importing an assessment tracker.
          </p>
        </>
      )}
    </Box>
    </details>
  );
}
function studentCells(s: Student) {
  return STUDENT_COLUMNS.map(([key]) =>
    key === "ncgId"
      ? s.ncgId
      : key === "firstName"
        ? s.firstName
        : key === "lastName"
          ? s.lastName
          : s.profile?.[key] || "",
  );
}
export function CohortDirectory({
  w,
  commit,
}: {
  w: Workflow;
  commit: Commit;
}) {
  const [cid, setCid] = useState(w.cohorts[0]?.id || "");
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const list = w.students.filter(
    (s) =>
      (!cid ||
        s.enrolments.some(
          (e) => e.cohortId === cid && (!subject || e.subject === subject),
        )) &&
      (!subject ||
        s.enrolments.some(
          (e) => e.subject === subject && (!cid || e.cohortId === cid),
        )) &&
      `${s.firstName} ${s.lastName} ${s.ncgId} ${s.profile?.eslId || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const student = w.students.find((s) => s.id === selected);
  async function exportCohort() {
    const roster = [
      [
        ...STUDENT_COLUMNS.map(([, label]) => label),
        "Cohort",
        "Subjects",
      ],
      ...list.map((s) =>
        studentCells(s).concat([
          s.enrolments
            .filter((e) => (!cid || e.cohortId === cid) && (!subject || e.subject === subject))
            .map((e) => w.cohorts.find((c) => c.id === e.cohortId)?.name)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join("; "),
          s.enrolments
            .filter((e) => (!cid || e.cohortId === cid) && (!subject || e.subject === subject))
            .map((e) => e.subject)
            .join("; "),
        ]),
      ),
    ];
    await saveExcel("Students", [{ name: "Students", rows: roster }]);
  }
  return (
    <>
      <Box title="Students">
        <div className="wf-filters">
          <select
            aria-label="Directory cohort"
            value={cid}
            onChange={(e) => setCid(e.target.value)}
          >
            <option value="">All cohorts</option>
            {w.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.startMonth}
              </option>
            ))}
          </select>
          <select
            aria-label="Directory subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">All subjects</option>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            aria-label="Directory student search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, NCG or ESL ID"
          />
          <button
            className="wf-button primary"
            disabled={!list.length}
            onClick={() => void exportCohort()}
          >
            Download list
          </button>
        </div>
        <p className="wf-muted">
          {list.length} students · downloads include student details, the
          assessment schedule, learning checkpoints, and separate
          marking/resubmission attempts.
        </p>
        <div className="wf-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student ID</th><th>Name</th><th>Cohort / subject</th><th>Campus</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {!list.length && <tr><td colSpan={5}>No students in this selection. Add a student or import a workbook.</td></tr>}
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{s.ncgId}</td><td>{s.firstName} {s.lastName}</td>
                  <td>{s.enrolments.filter((e) => (!cid || e.cohortId === cid) && (!subject || e.subject === subject)).map((e) => <small key={e.cohortId + e.subject}>{w.cohorts.find((c) => c.id === e.cohortId)?.name} · {e.subject}</small>)}</td>
                  <td>{s.profile?.campus || "—"}</td>
                  <td>
                    <button
                      className="wf-text-button"
                      onClick={() => setSelected(s.id)}
                    >
                      View student →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
      {student && (
        <StudentProfile
          key={student.id}
          s={student}
          w={w}
          commit={commit}
          close={() => setSelected("")}
        />
      )}
      <SpreadsheetImport w={w} commit={commit} />

    </>
  );
}
function StudentProfile({
  s,
  w,
  commit,
  close,
}: {
  s: Student;
  w: Workflow;
  commit: Commit;
  close: () => void;
}) {
  const [profile, setProfile] = useState({ ...s.profile });
  return (
    <Box title={`${s.firstName} ${s.lastName} · ${s.ncgId}`}>
      <div className="wf-actions">
        <span className="wf-muted">
          {s.enrolments
            .map(
              (e) =>
                `${w.cohorts.find((c) => c.id === e.cohortId)?.name} / ${e.subject}`,
            )
            .join(" · ")}
        </span>
        <button className="wf-button" onClick={close}>
          Close student
        </button>
      </div>
      <FormFields
        fields={STUDENT_COLUMNS.filter(
          ([key]) => !["ncgId", "firstName", "lastName"].includes(key),
        )}
        values={profile}
        onChange={setProfile}
      />
      <button
        className="wf-button primary"
        onClick={() =>
          commit((next) => {
            next.students.find((x) => x.id === s.id)!.profile = profile;
            return next;
          }, `Updated student profile ${s.ncgId}.`)
        }
      >
        Save student details
      </button>
      <div className="wf-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Module / assessment</th>
              <th>Week 4 progress</th>
              <th>Week 8 progress</th>
              <th>Marker result</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {w.assessments
              .filter(
                (a) =>
                  a.records.some((r) => r.studentId === s.id) ||
                  (w.learningProgress || []).some(
                    (p) => p.assessmentId === a.id && p.studentId === s.id,
                  ),
              )
              .map((a) => {
                const p = w.learningProgress?.find(
                  (p) => p.assessmentId === a.id && p.studentId === s.id,
                );
                const r = a.records.find((r) => r.studentId === s.id);
                return (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/workflow/${a.id}`}>
                        {a.module} · {a.name} →
                      </Link>
                    </td>
                    <td>{p?.values.progress1 || "—"}</td>
                    <td>{p?.values.progress2 || "—"}</td>
                    <td>{r?.grade || "—"}</td>
                    <td>
                      {r && isReviewed(r, w) ? "Reviewed" : "Pending review"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Box>
  );
}
export function LearningTracker({
  w,
  commit,
}: {
  w: Workflow;
  commit: Commit;
}) {
  const modules = w.assessments.filter(
    (a, i, all) =>
      all.findIndex(
        (other) =>
          other.cohortId === a.cohortId &&
          other.subject === a.subject &&
          other.module === a.module,
      ) === i,
  );
  const [aid, setAid] = useState(modules[0]?.id || "");
  const [studentId, setStudent] = useState("");
  const a = modules.find((a) => a.id === aid);
  const students = w.students.filter(
    (s) =>
      a &&
      s.enrolments.some(
        (e) => e.cohortId === a.cohortId && e.subject === a.subject,
      ),
  );
  const records = (s: Student) =>
    (w.learningProgress || []).find(
      (p) =>
        p.studentId === s.id &&
        (p.assessmentId === a?.id ||
          w.assessments.some(
            (other) =>
              other.id === p.assessmentId &&
              other.cohortId === a?.cohortId &&
              other.subject === a?.subject &&
              other.module === a?.module,
          )),
    );
  const selected = students.find((s) => s.id === studentId);
  return (
    <>
      <Box title="Progress Tracker">
        <label className="wf-field">
          <span>Module / cohort</span>
          <select
            aria-label="Learning module"
            value={aid}
            onChange={(e) => {
              setAid(e.target.value);
              setStudent("");
            }}
          >
            {!modules.length && <option value="">No modules yet</option>}
            {modules.map((a) => (
              <option key={a.id} value={a.id}>
                {w.cohorts.find((c) => c.id === a.cohortId)?.name} · {a.subject}{" "}
                · {a.module}
              </option>
            ))}
          </select>
        </label>
        <div className="wf-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Week 4</th><th>Week 8</th><th>Submission / marking</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!students.length && <tr><td colSpan={5}>{a ? "No enrolled students in this module." : "Add an assessment to create a module tracker."}</td></tr>}
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>
                      {s.firstName} {s.lastName}
                    </strong>
                    <small>{s.ncgId}</small>
                  </td>
                  <td>{records(s)?.values.progress1 || "—"}<small>{records(s)?.values.task1}</small></td>
                  <td>{records(s)?.values.progress2 || "—"}<small>{records(s)?.values.task2}</small></td>
                  <td>{w.assessments.filter((other) => other.module === a?.module && other.cohortId === a?.cohortId && other.subject === a?.subject).map((other) => {
                    const r = other.records.find((r) => r.studentId === s.id);
                    return <Link className="wf-record-line" key={other.id} href={"/workflow/" + other.id}>
                      {other.name}: {r?.submission === "submitted" ? "Submitted" : r?.submission === "resubmission" ? "Resubmission" : "Awaiting submission"}
                      <small>{w.markers.find((m) => m.id === r?.markerId)?.name || "Unallocated"} · {r && r.grade !== "" ? "Grade " + r.grade : "Awaiting marking"}</small>
                    </Link>;
                  })}</td>
                  <td>
                    <button
                      className="wf-text-button"
                      onClick={() => setStudent(s.id)}
                    >
                      Update checkpoints →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="wf-actions"><Link className="wf-button" href={"/marking" + (a ? "?module=" + encodeURIComponent(a.module) + "&cohort=" + encodeURIComponent(a.cohortId) + "&subject=" + encodeURIComponent(a.subject) : "")}>Marking allocation →</Link>
        <button
          className="wf-button"
          disabled={!a}
          onClick={() =>
            void saveExcel("Progress-Tracker", [
              {
                name: "Progress Tracker",
                rows: [
                  [
                    ...STUDENT_COLUMNS.map(([, label]) => label),
                    ...LEARNING_COLUMNS.map(([, label]) => label),
                  ],
                  ...students.map((s) => [
                    ...studentCells(s),
                    ...LEARNING_COLUMNS.map(
                      ([key]) => records(s)?.values[key] || "",
                    ),
                  ]),
                ],
              },
            ])
          }
        >
          Download Progress Tracker
        </button></div>
      </Box>
      {selected && a && (
        <LearningEditor
          key={`${a.id}-${selected.id}`}
          values={records(selected)?.values || {}}
          student={selected}
          save={(values) =>
            commit((next) => {
              next.learningProgress ||= [];
              const old = next.learningProgress.find(
                (p) =>
                  p.studentId === selected.id &&
                  (p.assessmentId === a.id ||
                    next.assessments.some(
                      (other) =>
                        other.id === p.assessmentId &&
                        other.cohortId === a.cohortId &&
                        other.subject === a.subject &&
                        other.module === a.module,
                    )),
              );
              if (old) old.values = values;
              else
                next.learningProgress.push({
                  assessmentId: a.id,
                  studentId: selected.id,
                  values,
                });
              return next;
            }, `Updated learning checkpoints for ${selected.ncgId} / ${a.module}.`)
          }
          close={() => setStudent("")}
        />
      )}
      <SpreadsheetImport
        key={aid}
        w={w}
        commit={commit}
        defaultKind="learning"
        assessmentId={aid}
      />
    </>
  );
}
function LearningEditor({
  values,
  student,
  save,
  close,
}: {
  values: Record<string, string>;
  student: Student;
  save: (v: Record<string, string>) => boolean;
  close: () => void;
}) {
  const [draft, setDraft] = useState({ ...values });
  return (
    <Box
      title={`Learning checkpoints: ${student.firstName} ${student.lastName}`}
    >
      <FormFields
        fields={LEARNING_COLUMNS}
        values={draft}
        onChange={setDraft}
      />
      <div className="wf-actions">
        <button
          className="wf-button primary"
          onClick={() => {
            if (save(draft)) close();
          }}
        >
          Save learning progress
        </button>
        <button className="wf-button" onClick={close}>
          Cancel
        </button>
      </div>
    </Box>
  );
}
export function AssessmentOperations({
  a,
  commit,
}: {
  a: Assessment;
  commit: Commit;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ ...a.operations });
  return (
    <Box title="Assessment Tracker: operational checklist">
      <div className="wf-actions">
        <span className="wf-muted">
          Module leader, deadlines, standardisation, SAM forms, HE07, EE samples
          and campus upload statuses.
        </span>
        <button className="wf-button" onClick={() => setOpen(!open)}>
          {open ? "Hide full tracker" : "View / edit full tracker"}
        </button>
      </div>
      <div className="wf-operations-grid">
        {[
          "moduleName",
          "programme",
          "submissionDate",
          "moduleLeader",
          "standardisation",
          "samA",
          "samB",
          "uploadLeeds",
          "uploadLeicester",
          "uploadBirmingham",
        ].map((key) => (
          <div key={key}>
            <span>{ASSESSMENT_COLUMNS.find(([k]) => k === key)?.[1]}</span>
            <strong>{a.operations?.[key] || "Not recorded"}</strong>
          </div>
        ))}
      </div>
      {open && (
        <>
          <FormFields
            fields={ASSESSMENT_COLUMNS.filter(
              ([key]) => !["cohort", "module", "assessment"].includes(key),
            )}
            values={values}
            onChange={setValues}
          />
          <p className="wf-muted">
            These are source tracker values. A released flag or campus-upload
            flag does not approve a student grade or confirm a StaffAdvantage
            upload. Your configurable timeline remains separate from imported
            deadlines.
          </p>
          <button
            className="wf-button primary"
            onClick={() => {
              if (
                commit((next) => {
                  next.assessments.find(
                    (other) => other.id === a.id,
                  )!.operations = values;
                  return next;
                }, `Updated Assessment Tracker operations for ${a.module}.`)
              )
                setOpen(false);
            }}
          >
            Save Assessment Tracker fields
          </button>
        </>
      )}
    </Box>
  );
}
export function MarkingTracker({ w }: { w: Workflow; commit: Commit }) {
  const [module, setModule] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("module") || "");
  const [cohort, setCohort] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("cohort") || "");
  const [subject, setSubject] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("subject") || "");
  const assessments = w.assessments.filter((a) => (!module || a.module === module) && (!cohort || a.cohortId === cohort) && (!subject || a.subject === subject));
  const groups = assessments.filter((a, i, all) => all.findIndex((b) => b.module === a.module && b.cohortId === a.cohortId && b.subject === a.subject) === i);
  return <Box title="Markers by module">
    <div className="wf-filters">
      <select aria-label="Marking module" value={module} onChange={(e) => setModule(e.target.value)}><option value="">All modules</option>{Array.from(new Set(w.assessments.map((a) => a.module))).map((m) => <option key={m}>{m}</option>)}</select>
      <select aria-label="Marking cohort" value={cohort} onChange={(e) => setCohort(e.target.value)}><option value="">All cohorts</option>{w.cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select aria-label="Marking subject" value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">All subjects</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
      <Link className="wf-button" href="/progress">Progress tracker →</Link>
    </div>
    <div className="wf-table-wrap"><table><thead><tr><th>Marker</th><th>Course / module</th><th>Allocated</th><th>Marked</th></tr></thead><tbody>
      {groups.flatMap((a) => {
        const records = assessments.filter((b) => b.module === a.module && b.cohortId === a.cohortId && b.subject === a.subject).flatMap((b) => b.records);
        return Array.from(new Set(records.map((r) => r.markerId))).map((id) => {
          const assigned = records.filter((r) => r.markerId === id);
          return <tr key={a.id + id}><td>{w.markers.find((m) => m.id === id)?.name || "Unallocated"}</td><td><Link href={"/workflow/" + a.id}>{a.subject} · {a.module}</Link><small>{w.cohorts.find((c) => c.id === a.cohortId)?.name}</small></td><td>{assigned.length}</td><td>{assigned.filter((r) => r.grade !== "").length}</td></tr>;
        });
      })}
      {!assessments.some((a) => a.records.length) && <tr><td colSpan={4}>No allocations in this selection.</td></tr>}
    </tbody></table></div>
  </Box>;
}
export function SourceRegister() {
  return <Box title="Integrations">
    <p className="wf-muted">Connect your systems to bring enrolments, submissions and grades into one workspace.</p>
    <div className="wf-integration-list">
      <div><strong>Excel</strong><span>Available</span><p>Import workbooks from the student and tracker pages.</p></div>
      {["SharePoint", "SIMS", "StaffAdvantage"].map((name) => <div key={name}><strong>{name}</strong><span>Planned</span><p>Connections and automated sync are planned.</p></div>)}
    </div>
  </Box>;
}
