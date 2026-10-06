"use client";
import Link from "next/link";
import { useState } from "react";
import {
  SUBJECTS,
  isReviewed,
  updateProgress,
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
  populateSamples,
  removeSamples,
  activateAttempt,
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
    <Box title="Import your Excel trackers">
      <p className="wf-muted">
        Select the workbook, worksheet and tracker type. Duplicate column names
        are preserved for resubmissions and Week 4 / Week 8 checkpoints.
      </p>
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
  const assessments = w.assessments.filter(
    (a) => (!cid || a.cohortId === cid) && (!subject || a.subject === subject),
  );
  const student = w.students.find((s) => s.id === selected);
  async function exportCohort() {
    const roster = [
      [
        ...STUDENT_COLUMNS.map(([, label]) => label),
        "Cohort",
        "Subjects",
        "Sample data",
      ],
      ...list.map((s) =>
        studentCells(s).concat([
          s.enrolments
            .filter((e) => !cid || e.cohortId === cid)
            .map((e) => w.cohorts.find((c) => c.id === e.cohortId)?.name)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join("; "),
          s.enrolments
            .filter((e) => !cid || e.cohortId === cid)
            .map((e) => e.subject)
            .join("; "),
          s.sample ? "Y" : "N",
        ]),
      ),
    ];
    const schedule = [
      ASSESSMENT_COLUMNS.map(([, label]) => label),
      ...assessments.map((a) =>
        ASSESSMENT_COLUMNS.map(([key]) =>
          key === "cohort"
            ? w.cohorts.find((c) => c.id === a.cohortId)?.name || ""
            : key === "module"
              ? a.module
              : key === "assessment"
                ? a.name
                : a.operations?.[key] || "",
        ),
      ),
    ];
    const learning = [
      [
        "Module Code",
        ...STUDENT_COLUMNS.map(([, label]) => label),
        ...LEARNING_COLUMNS.map(([, label]) => label),
      ],
      ...(w.learningProgress || [])
        .filter(
          (p) =>
            assessments.some((a) => a.id === p.assessmentId) &&
            list.some((s) => s.id === p.studentId),
        )
        .map((p) => {
          const s = w.students.find((s) => s.id === p.studentId)!;
          return [
            w.assessments.find((a) => a.id === p.assessmentId)!.module,
            ...studentCells(s),
            ...LEARNING_COLUMNS.map(([key]) => p.values[key] || ""),
          ];
        }),
    ];
    const marking = [
      [
        "Module Code",
        ...STUDENT_COLUMNS.map(([, label]) => label),
        ...ATTEMPT_COLUMNS.map(([, label]) => label),
        ...RESUB_COLUMNS.map(([, label]) => label),
        "Grade review status",
      ],
      ...assessments.flatMap((a) =>
        a.records
          .filter((r) => list.some((s) => s.id === r.studentId))
          .map((r) => [
            a.module,
            ...studentCells(w.students.find((s) => s.id === r.studentId)!),
            ...ATTEMPT_COLUMNS.map(([key]) => r.attempts?.first[key] || ""),
            ...RESUB_COLUMNS.map(
              ([key]) => r.attempts?.resubmission[key] || "",
            ),
            isReviewed(r, w) ? "Reviewed" : "Pending review",
          ]),
      ),
    ];
    await saveExcel(
      `${w.cohorts.find((c) => c.id === cid)?.name || "All-cohorts"}-trackers`,
      [
        { name: "Students", rows: roster },
        { name: "Assessment tracker", rows: schedule },
        { name: "Progress Tracker", rows: learning },
        { name: "Marking Allocation", rows: marking },
      ],
    );
  }
  return (
    <>
      <Box title="Cohort student directory & downloads">
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
            onClick={() => void exportCohort()}
          >
            Download cohort workbook
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
                {STUDENT_COLUMNS.map(([, label]) => (
                  <th key={label}>{label}</th>
                ))}
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  {studentCells(s).map((v, i) => (
                    <td key={i}>
                      {v || "—"}
                      {i === 0 && s.sample && <small>Sample data</small>}
                    </td>
                  ))}
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
      <Box title="Sample workspace">
        <p className="wf-muted">
          Six cohorts, three subjects, three campuses, sample student details,
          learning checkpoints, first marking, moderation and resubmission
          examples. Sample IDs begin DEMO; real imports remain separate.
        </p>
        <button
          className="wf-button"
          disabled={w.students.some((s) => s.sample)}
          onClick={() =>
            commit(
              populateSamples,
              "Added clearly labelled sample cohort data.",
            )
          }
        >
          {w.students.some((s) => s.sample)
            ? "Sample cohorts loaded"
            : "Populate sample cohorts"}
        </button>
        {w.students.some((s) => s.sample) && (
          <button
            className="wf-button"
            onClick={() =>
              commit(
                removeSamples,
                "Removed sample records; real data preserved.",
              )
            }
          >
            Remove sample records
          </button>
        )}
      </Box>
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
      <div className="wf-heading">
        <h2>Learning progress, before the grades</h2>
        <p>
          Tasks, Week 4 and Week 8 checkpoints, lecturer feedback and retention
          follow-ups. Learning records are separate from marking and moderation.
        </p>
      </div>
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
                <th>Campus / lecturer</th>
                {LEARNING_COLUMNS.map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>
                      {s.firstName} {s.lastName}
                    </strong>
                    <small>{s.ncgId}</small>
                  </td>
                  <td>
                    {s.profile?.campus || "—"}
                    <small>{s.profile?.lecturer || "—"}</small>
                  </td>
                  {LEARNING_COLUMNS.map(([key]) => (
                    <td key={key}>{records(s)?.values[key] || "—"}</td>
                  ))}
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
        </button>
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
export function MarkingTracker({ w, commit }: { w: Workflow; commit: Commit }) {
  const [aid, setAid] = useState(w.assessments[0]?.id || "");
  const [studentId, setStudent] = useState("");
  const a = w.assessments.find((a) => a.id === aid);
  const r = a?.records.find((r) => r.studentId === studentId);
  return (
    <>
      <div className="wf-heading">
        <h2>Marking Allocation & moderation</h2>
        <p>
          Turnitin paper IDs, similarity, AI scores, marker comments, IM grades
          and resubmissions. AI scores are source values; they do not determine
          a student&apos;s grade.
        </p>
      </div>
      <Box title="Marking Allocation">
        <label className="wf-field">
          <span>Assessment</span>
          <select
            aria-label="Marking assessment"
            value={aid}
            onChange={(e) => {
              setAid(e.target.value);
              setStudent("");
            }}
          >
            {w.assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {w.cohorts.find((c) => c.id === a.cohortId)?.name} · {a.module}{" "}
                · {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className="wf-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Paper ID</th>
                <th>Similarity / AI</th>
                <th>1st marker / grade</th>
                <th>IM / final grade</th>
                <th>Resubmission / final grade</th>
                <th>Active result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {a?.records.map((r) => {
                const s = w.students.find((s) => s.id === r.studentId);
                const first = r.attempts?.first;
                const resub = r.attempts?.resubmission;
                return (
                  <tr key={r.studentId}>
                    <td>
                      <strong>
                        {s?.firstName} {s?.lastName}
                      </strong>
                      <small>{s?.ncgId}</small>
                    </td>
                    <td>{first?.paperId || "—"}</td>
                    <td>
                      {first?.similarity || "—"} / {first?.aiScore || "—"}
                    </td>
                    <td>
                      {first?.marker ||
                        w.markers.find((m) => m.id === r.markerId)?.name ||
                        "—"}
                      <small>{first?.grade || r.grade || "—"}</small>
                    </td>
                    <td>
                      {first?.imName || "—"}
                      <small>
                        {first?.imGrade || "—"} / {first?.finalGrade || "—"}
                      </small>
                    </td>
                    <td>
                      {resub?.paperId || "—"}
                      <small>{resub?.finalGrade || resub?.grade || "—"}</small>
                    </td>
                    <td>
                      {r.activeAttempt === "resubmission"
                        ? "Resubmission"
                        : "First attempt"}{" "}
                      · {r.grade || "—"}
                      <small>
                        {isReviewed(r, w) ? "Reviewed" : "Pending review"}
                      </small>
                    </td>
                    <td>
                      <button
                        className="wf-text-button"
                        onClick={() => setStudent(r.studentId)}
                      >
                        View / edit attempts →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {a && (
          <Link className="wf-button" href={`/workflow/${a.id}`}>
            Open allocation, submission & grade approval →
          </Link>
        )}
      </Box>
      {r && a && (
        <AttemptEditor
          key={`${a.id}-${r.studentId}`}
          w={w}
          a={a}
          studentId={r.studentId}
          commit={commit}
          close={() => setStudent("")}
        />
      )}
      <SpreadsheetImport
        key={aid}
        w={w}
        commit={commit}
        defaultKind="marking"
        assessmentId={aid}
      />
    </>
  );
}
function AttemptEditor({
  w,
  a,
  studentId,
  commit,
  close,
}: {
  w: Workflow;
  a: Assessment;
  studentId: string;
  commit: Commit;
  close: () => void;
}) {
  const r = a.records.find((r) => r.studentId === studentId)!;
  const s = w.students.find((s) => s.id === studentId)!;
  const [first, setFirst] = useState({ ...r.attempts?.first });
  const [resub, setResub] = useState({ ...r.attempts?.resubmission });
  const [error, setError] = useState("");
  return (
    <Box title={`${s.firstName} ${s.lastName}: first attempt & resubmission`}>
      {error && (
        <div role="alert" className="wf-message error">
          {error}
        </div>
      )}
      <h3>First attempt</h3>
      <FormFields fields={ATTEMPT_COLUMNS} values={first} onChange={setFirst} />
      <h3>Resubmission</h3>
      <FormFields fields={RESUB_COLUMNS} values={resub} onChange={setResub} />
      <div className="wf-actions">
        <button
          className="wf-button primary"
          onClick={() => {
            for (const values of [first, resub])
              for (const key of ["grade", "imGrade", "finalGrade"])
                if (
                  values[key] &&
                  (!Number.isFinite(Number(values[key])) ||
                    Number(values[key]) < 0 ||
                    Number(values[key]) > 100)
                )
                  return setError(
                    "Marker, IM and final grades must be 0 to 100.",
                  );
            if (
              commit((next) => {
                const record = next.assessments
                  .find((x) => x.id === a.id)!
                  .records.find((r) => r.studentId === studentId)!;
                const attempts = { first, resubmission: resub };
                if (
                  JSON.stringify(attempts) === JSON.stringify(record.attempts)
                )
                  return next;
                const active =
                  record.activeAttempt === "resubmission" ? resub : first;
                let marker = next.markers.find(
                  (m) => m.name.toLowerCase() === active.marker?.toLowerCase(),
                );
                if (!marker && active.marker) {
                  marker = { id: crypto.randomUUID(), name: active.marker };
                  next.markers.push(marker);
                }
                Object.assign(
                  record,
                  updateProgress(
                    record,
                    {
                      grade: active.finalGrade || active.grade || "",
                      markerId: marker?.id || record.markerId,
                    },
                    next,
                  ),
                  {
                    attempts,
                    reviewedAt: undefined,
                    reviewer: "",
                    releasedAt: undefined,
                  },
                );
                return next;
              }, `Saved separate marking attempts for ${s.ncgId} / ${a.module}; review reopened.`)
            )
              close();
          }}
        >
          Save marking details
        </button>
        <button className="wf-button" onClick={close}>
          Close
        </button>
      </div>
      <div className="wf-message info">
        Save attempt details first. Selecting an attempt below chooses the
        result for review and upload preparation; it reopens approval.
      </div>
      <div className="wf-actions">
        <button
          className="wf-button"
          onClick={() => {
            if (
              commit(
                (next) => activateAttempt(next, a.id, studentId, "first"),
                "Selected first-attempt grade for review.",
              )
            )
              close();
          }}
        >
          Use saved first-attempt result
        </button>
        <button
          className="wf-button"
          onClick={() => {
            if (
              commit(
                (next) =>
                  activateAttempt(next, a.id, studentId, "resubmission"),
                "Selected resubmission grade for review.",
              )
            )
              close();
          }}
        >
          Use saved resubmission result
        </button>
      </div>
    </Box>
  );
}
export function SourceRegister({ w, commit }: { w: Workflow; commit: Commit }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [system, setSystem] = useState("SharePoint");
  const [cid, setCid] = useState(w.cohorts[0]?.id || "");
  const [subject, setSubject] = useState<Subject>(SUBJECTS[0]);
  return (
    <>
      <div className="wf-heading">
        <h2>Know where each tracker comes from</h2>
        <p>
          Register SharePoint, SIMS and StaffAdvantage locations, and retain the
          source of every imported workbook.
        </p>
      </div>
      <div className="wf-source-cards">
        {[
          {
            name: "Excel workbooks",
            state: "Import ready",
            detail:
              "Select worksheets, preview rows, and download cohort workbooks.",
          },
          {
            name: "SharePoint",
            state: "Website sync not configured",
            detail:
              "Register file links now. A ChatGPT SharePoint connection can help inspect files; automatic website sync needs Microsoft app credentials.",
          },
          {
            name: "SIMS",
            state: "Export import ready",
            detail:
              "Upload a SIMS Excel/CSV export. Live SIMS access has not been configured.",
          },
          {
            name: "StaffAdvantage",
            state: "Preparation ready",
            detail:
              "Keep reviewed exports and manual upload acceptance. The existing browser extension reads records; direct write-back is not configured.",
          },
        ].map((s) => (
          <div key={s.name}>
            <h3>{s.name}</h3>
            <span className="wf-badge">{s.state}</span>
            <p>{s.detail}</p>
          </div>
        ))}
      </div>
      <Box title="Register a source file">
        <form
          className="wf-form"
          onSubmit={(e) => {
            e.preventDefault();
            commit((next) => {
              const parsed = new URL(url);
              if (parsed.protocol !== "https:")
                throw new Error("Use a secure https source link.");
              next.sources ||= [];
              next.sources.push({
                id: crypto.randomUUID(),
                label,
                url: parsed.href,
                system,
                cohortId: cid,
                subject,
              });
              return next;
            }, `Registered ${system} source: ${label}.`);
          }}
        >
          <div className="wf-form-grid">
            <Input
              label="Source file label"
              value={label}
              onChange={setLabel}
            />
            <Input
              label="Source file URL"
              type="url"
              value={url}
              onChange={setUrl}
            />
            <label className="wf-field">
              <span>Source system</span>
              <select
                aria-label="Source system"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
              >
                {["SharePoint", "SIMS", "StaffAdvantage"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="wf-field">
              <span>Cohort</span>
              <select
                aria-label="Source cohort"
                value={cid}
                onChange={(e) => setCid(e.target.value)}
              >
                {w.cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="wf-field">
              <span>Subject</span>
              <select
                aria-label="Source subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value as Subject)}
              >
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="wf-button primary"
            disabled={!label.trim() || !url.trim()}
          >
            Save source reference
          </button>
        </form>
        {w.sources?.map((s) => (
          <div className="wf-check-item" key={s.id}>
            <strong>
              {s.label} · {s.system}
            </strong>
            <p>
              {w.cohorts.find((c) => c.id === s.cohortId)?.name} · {s.subject}
            </p>
            <a
              className="wf-text-button"
              href={s.url}
              target="_blank"
              rel="noreferrer"
            >
              Open source file ↗
            </a>
          </div>
        ))}
      </Box>
      <Box title="Workbook import history">
        <div className="wf-table-wrap">
          <table>
            <thead>
              <tr>
                <th>File / worksheet</th>
                <th>Source</th>
                <th>Tracker</th>
                <th>Rows</th>
                <th>Imported at</th>
              </tr>
            </thead>
            <tbody>
              {w.imports?.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.fileName}
                    <small>{i.sheetName}</small>
                  </td>
                  <td>{i.system}</td>
                  <td>{i.kind}</td>
                  <td>{i.rows}</td>
                  <td>
                    {new Date(i.at).toLocaleString("en-GB", {
                      timeZone: "Europe/London",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>
    </>
  );
}
