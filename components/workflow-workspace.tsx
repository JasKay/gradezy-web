"use client";
import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  CohortDirectory,
  LearningTracker,
  MarkingTracker,
  AssessmentOperations,
  SpreadsheetImport,
  SourceRegister,
} from "@/components/tracker-workspace";

import { removeSamples } from "@/lib/tracker-sheets";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SUBJECTS,
  STAGES,
  UPLOAD_FIELDS,
  WORKFLOW_KEY,
  defaultOffsets,
  today,
  targetDate,
  validateSchedule,
  assessmentStatus,
  stageProgress,
  blockers,
  canReview,
  isReviewed,
  updateProgress,
  syncRoster,
  prepareBatch,
  batchCurrent,
  batchCsv,
  importEnrolments,
  importGrades,
  readWorkflow,
  saveWorkflow,
  recordActivity,
  assistantContext,
  type Workflow,
  type Assessment,
  type Progress,
  type Subject,
  type ImportRow,
  type Batch,
} from "@/lib/workflow";
export type WorkspaceView =
  | "overview"
  | "assessments"
  | "enrolments"
  | "markers"
  | "uploads"
  | "assistant"
  | "new"
  | "detail"
  | "progress"
  | "marking"
  | "sources";
type Commit = (change: (w: Workflow) => Workflow, message: string) => boolean;
const titles: Record<WorkspaceView, string> = {
  overview: "Overview",
  assessments: "Assessment tracker",
  enrolments: "Cohorts & enrolments",
  markers: "Marker allocation",
  uploads: "StaffAdvantage preparation",
  assistant: "Assessment assistant",
  new: "New assessment",
  detail: "Assessment workspace",
  progress: "Progress Tracker",
  marking: "Marking Allocation",
  sources: "Integrations",
};
const links = [
  { label: "Overview", href: "/dashboard" },
  { label: "Assessments", href: "/assessments" },
  { label: "Enrolments", href: "/students" },
  { label: "Progress", href: "/progress" },
  { label: "Markers", href: "/markers" },
  { label: "Marking", href: "/marking" },
  { label: "Integrations", href: "/sources" },
];
function formatDate(value: string) {
  if (!value) return "Not set";
  return new Date(
    value.length === 7
      ? `${value}-01T12:00:00Z`
      : value.length === 10
        ? `${value}T12:00:00Z`
        : value,
  ).toLocaleDateString("en-GB", {
    day: value.length === 7 ? undefined : "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}
function download(
  name: string,
  content: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="wf-field">
      <span>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        typeof child.type === "string" &&
        ["input", "select", "textarea"].includes(child.type)
          ? cloneElement(child as ReactElement<{ "aria-label"?: string }>, {
              "aria-label": label,
            })
          : child,
      )}
    </label>
  );
}
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`wf-badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  text,
  href,
  action,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="wf-empty">
      <span className="wf-empty-icon">◇</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {href && (
        <Link className="wf-button primary" href={href}>
          {action}
        </Link>
      )}
    </div>
  );
}
function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="wf-panel">
      <div className="wf-panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function WorkflowWorkspace({
  view = "overview",
  assessmentId,
}: {
  view?: WorkspaceView;
  assessmentId?: string;
}) {
  const [w, setW] = useState<Workflow | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const load = () => {
      try {
        const loaded = removeSamples(readWorkflow(localStorage));
        setW(loaded);
        setDate(today());
        setError("");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not read workspace data.",
        );
      }
    };
    queueMicrotask(load);
    const storage = (event: StorageEvent) => {
      if (event.key === WORKFLOW_KEY) load();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", load);
    const interval = setInterval(() => setDate(today()), 60_000);
    return () => {
      window.removeEventListener("storage", storage);
      window.removeEventListener("focus", load);
      clearInterval(interval);
    };
  }, []);
  const commit: Commit = (change, message) => {
    if (!w) return false;
    try {
      const next = change(structuredClone(w));
      recordActivity(next, message);
      setW(saveWorkflow(next, localStorage));
      setError("");
      setNotice(message);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
      return false;
    }
  };
  const selected = w?.assessments.find((a) => a.id === assessmentId);
  return (
    <main className={`wf-shell wf-view-${view} lg:pl-64`}>
      <AppSidebar />
      <header className="wf-topbar">
        <div>
          <span className="wf-eyebrow">ASSESSMENT TEAM / WORKSPACE</span>
          <h1>{titles[view]}</h1>
        </div>
        <div className="wf-actions">
          <Badge>Saved in this browser</Badge>
          <button
            className="wf-button"
            onClick={() =>
              download(
                "gradezy-workspace-backup.json",
                JSON.stringify(
                  Object.fromEntries(
                    Object.keys(localStorage)
                      .filter(
                        (k) =>
                          k.startsWith("gradezy_") && k !== "gradezy_session",
                      )
                      .map((k) => [k, localStorage.getItem(k)]),
                  ),
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            Download backup
          </button>
          <Link className="wf-button primary" href="/assessments/new">
            + New assessment
          </Link>
        </div>
      </header>
      <nav className="wf-mobile-nav" aria-label="Workspace navigation">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="wf-content">
        {error && (
          <div role="alert" className="wf-message error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="wf-message success">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {!w ? (
          <Empty
            title={error ? "Workspace needs attention" : "Loading workspace…"}
            text={
              error
                ? "Saved data has been left intact. Download a backup before repairing it."
                : "Connecting cohorts, schedules and assessment progress."
            }
          />
        ) : (
          <>
            {view === "overview" && <Overview w={w} date={date} />}
            {view === "assessments" && (
              <AssessmentList w={w} date={date} progress={false} />
            )}
            {view === "enrolments" && (
              <>
                <CohortDirectory w={w} commit={commit} />
                <Enrolments w={w} commit={commit} />
              </>
            )}
            {view === "progress" && <LearningTracker w={w} commit={commit} />}
            {view === "marking" && <MarkingTracker w={w} commit={commit} />}
            {view === "sources" && <SourceRegister />}
            {view === "markers" && <Markers w={w} commit={commit} />}
            {view === "assessments" && (
              <SpreadsheetImport
                w={w}
                commit={commit}
                defaultKind="assessments"
              />
            )}
            {view === "new" && <AssessmentForm w={w} commit={commit} />}
            {view === "detail" &&
              (selected ? (
                <AssessmentDetail
                  key={selected.id}
                  a={selected}
                  w={w}
                  date={date}
                  commit={commit}
                />
              ) : (
                <Empty
                  title="Assessment not found"
                  text="Choose an assessment from the tracker."
                  href="/assessments"
                  action="Open tracker"
                />
              ))}
            {view === "uploads" && <Uploads w={w} commit={commit} />}
            {view === "assistant" && <Assistant w={w} date={date} />}
          </>
        )}
      </div>
    </main>
  );
}
function Overview({ w, date }: { w: Workflow; date: string }) {
  const overdue = w.assessments.filter((a) =>
    STAGES.some((s) => stageProgress(a, w, s.key, date).overdue),
  );
  const ready = w.assessments.filter((a) => blockers(a, w).length === 0);
  const records = w.assessments.flatMap((a) => a.records);
  const unallocated = records.filter((r) => !r.markerId).length;
  const review = records.filter(
    (r) => canReview(r, w) && !isReviewed(r, w),
  ).length;
  return (
    <>
      <Assistant w={w} date={date} compact />
      <div className="wf-stats">
        {[
          {
            label: "Total assessments",
            value: w.assessments.length,
            detail: `${w.cohorts.length} cohorts · ${w.students.length} students`,
            href: "/assessments",
          },
          {
            label: "Overdue assessments",
            value: overdue.length,
            detail: "Target dates missed",
            href: "/progress",
            tone: "danger",
          },
          {
            label: "Awaiting allocation",
            value: unallocated,
            detail: "Student assessment records",
            href: "/markers",
            tone: "amber",
          },
          {
            label: "Awaiting grade review",
            value: review,
            detail: `${ready.length} assessments ready for preparation`,
            href: "/assessments",
            tone: "green",
          },
        ].map((s) => (
          <Link
            className={`wf-stat ${s.tone || ""}`}
            href={s.href}
            key={s.label}
          >
            <span>{s.label}</span>
            <strong>{s.value}</strong>
            <small>{s.detail}</small>
          </Link>
        ))}
      </div>
      <div className="wf-two-columns">
        <Panel
          title="Needs your attention"
          subtitle="Delays remain visible through the workflow."
          action={<Link href="/progress">View progress →</Link>}
        >
          {!w.assessments.length ? (
            <Empty
              title="Start with your cohorts"
              text="Add student subject enrolments, then create an assessment to build its roster."
              href="/students"
              action="Set up enrolments"
            />
          ) : (
            <div className="wf-attention">
              {w.assessments
                .filter(
                  (a) =>
                    blockers(a, w).length ||
                    STAGES.some(
                      (s) => stageProgress(a, w, s.key, date).overdue,
                    ),
                )
                .slice(0, 6)
                .map((a) => (
                  <Link key={a.id} href={`/workflow/${a.id}`}>
                    <span
                      className={`wf-dot ${assessmentStatus(a, w, date) === "Overdue" ? "danger" : "amber"}`}
                    />
                    <div>
                      <strong>{a.name}</strong>
                      <p>
                        {blockers(a, w).slice(0, 2).join(" ") ||
                          "Reviewed results are awaiting student grade release."}
                      </p>
                    </div>
                    <Badge
                      tone={
                        assessmentStatus(a, w, date) === "Overdue"
                          ? "danger"
                          : "amber"
                      }
                    >
                      {assessmentStatus(a, w, date)}
                    </Badge>
                  </Link>
                ))}
              {w.assessments.every(
                (a) =>
                  !blockers(a, w).length &&
                  !STAGES.some((s) => stageProgress(a, w, s.key, date).overdue),
              ) && (
                <p className="wf-padding">
                  All assessment results are reviewed.
                </p>
              )}
            </div>
          )}
        </Panel>
        <Panel
          title="Cohort coverage"
          subtitle="The same enrolments feed your assessment rosters."
        >
          {w.cohorts.map((c) => (
            <Link className="wf-cohort-line" href="/students" key={c.id}>
              <div className="wf-cohort-avatar">
                {c.name.replace("Cohort ", "")}
              </div>
              <div>
                <strong>{c.name}</strong>
                <p>
                  {c.startMonth
                    ? `Started ${formatDate(c.startMonth)}`
                    : "Start date to confirm"}
                </p>
              </div>
              <span>
                {
                  w.students.filter((s) =>
                    s.enrolments.some((e) => e.cohortId === c.id),
                  ).length
                }{" "}
                students
              </span>
            </Link>
          ))}
        </Panel>
      </div>
      <Panel
        title="Recent activity"
        subtitle="A local history of changes made in this workspace."
      >
        {w.activity.length ? (
          <div className="wf-activity">
            {w.activity.slice(0, 6).map((e) => (
              <div key={e.id}>
                <span className="wf-dot green" />
                <p>{e.text}</p>
                <time>{formatDate(e.at)}</time>
              </div>
            ))}
          </div>
        ) : (
          <p className="wf-padding wf-muted">
            Enrolments, progress, reviews and upload batches will appear here.
          </p>
        )}
      </Panel>
    </>
  );
}
function AssessmentList({
  w,
  date,
  progress = false,
}: {
  w: Workflow;
  date: string;
  progress?: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [cohort, setCohort] = useState("");
  const [search, setSearch] = useState("");
  const list = w.assessments.filter(
    (a) =>
      (!subject || a.subject === subject) &&
      (!cohort || a.cohortId === cohort) &&
      `${a.name} ${a.module}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="wf-heading">
        <h2>
          {progress
            ? "Progress across every stage"
            : "Your assessment schedule"}
        </h2>
        <p>
          {progress
            ? "Allocation, marking and review use the same student records."
            : "Each assessment has its own editable calendar-day timeline."}
        </p>
      </div>
      <div className="wf-filters">
        <input
          aria-label="Search assessments"
          placeholder="Search assessment or module…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filter subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter cohort"
          value={cohort}
          onChange={(e) => setCohort(e.target.value)}
        >
          <option value="">All cohorts</option>
          {w.cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {!list.length ? (
        <Empty
          title={
            w.assessments.length
              ? "No matching assessments"
              : "Your tracker starts here"
          }
          text="Create an assessment and connect it to a cohort and subject."
          href="/assessments/new"
          action="Create assessment"
        />
      ) : (
        <div className="wf-assessment-list">
          {list.map((a) => (
            <Link
              className="wf-assessment-card"
              href={`/workflow/${a.id}`}
              key={a.id}
            >
              <div className="wf-assessment-title">
                <div>
                  <span className="wf-eyebrow">
                    A{w.assessments.indexOf(a) + 1} ·{" "}
                    {a.subject || "SUBJECT TO CONFIRM"}
                  </span>
                  <h3>{a.name}</h3>
                  <p>
                    {a.module} ·{" "}
                    {w.cohorts.find((c) => c.id === a.cohortId)?.name} ·{" "}
                    {a.records.length} students
                  </p>
                </div>
                <Badge
                  tone={
                    assessmentStatus(a, w, date) === "Overdue"
                      ? "danger"
                      : assessmentStatus(a, w, date) === "Reviewed"
                        ? "green"
                        : ""
                  }
                >
                  {assessmentStatus(a, w, date)}
                </Badge>
              </div>
              <div className="wf-milestones">
                {STAGES.map((s) => {
                  const p = stageProgress(a, w, s.key, date);
                  return (
                    <div
                      key={s.key}
                      className={
                        p.complete ? "complete" : p.overdue ? "late" : ""
                      }
                    >
                      <span>{s.label}</span>
                      <strong>{formatDate(p.target)}</strong>
                      <small>
                        {p.done}/{p.total} complete
                        {p.overdue ? " · Overdue" : ""}
                      </small>
                      <div className="wf-progress-bar">
                        <i
                          style={{
                            width: `${p.total ? (p.done / p.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="wf-card-footer">
                <span>Issued {formatDate(a.issueDate)}</span>
                <span>Open workspace →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
function AssessmentForm({
  w,
  commit,
  existing,
  onClose,
}: {
  w: Workflow;
  commit: Commit;
  existing?: Assessment;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Assessment>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: "",
          name: "",
          module: "",
          cohortId: w.cohorts[0]?.id || "",
          subject: SUBJECTS[0],
          issueDate: today(),
          offsets: defaultOffsets(),
          records: [],
          createdAt: "",
        },
  );
  const [error, setError] = useState("");
  const rosterSize = w.students.filter((s) =>
    s.enrolments.some(
      (e) => e.cohortId === draft.cohortId && e.subject === draft.subject,
    ),
  ).length;
  function submit(e: FormEvent) {
    e.preventDefault();
    const errors = validateSchedule(draft);
    if (!w.cohorts.some((c) => c.id === draft.cohortId))
      errors.push("Choose a cohort.");
    if (errors.length) return setError(errors.join(" "));
    const a = existing
      ? draft
      : syncRoster(
          {
            ...draft,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          },
          w,
        );
    if (
      commit(
        (next) => {
          next.assessments = existing
            ? next.assessments.map((old) => (old.id === a.id ? a : old))
            : [...next.assessments, a];
          return next;
        },
        `${existing ? "Updated schedule for" : "Created assessment"} ${a.name}.`,
      )
    ) {
      if (onClose) onClose();
      else router.push(`/workflow/${a.id}`);
    }
  }
  return (
    <Panel
      title={
        existing
          ? "Edit assessment & timeline"
          : "Connect an assessment to its cohort"
      }
      subtitle="Target dates are calculated from the issue date. Actual progress is recorded separately."
    >
      <form className="wf-form" onSubmit={submit}>
        {error && (
          <div role="alert" className="wf-message error">
            {error}
          </div>
        )}
        <div className="wf-form-grid">
          <Field label="Assessment name">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Strategic management report"
            />
          </Field>
          <Field label="Module / assessment code">
            <input
              required
              value={draft.module}
              onChange={(e) => setDraft({ ...draft, module: e.target.value })}
              placeholder="e.g. BUS101-A1"
            />
          </Field>
          <Field label="Subject">
            <select
              required
              disabled={!!existing?.records.length && !!existing.subject}
              value={draft.subject}
              onChange={(e) =>
                setDraft({ ...draft, subject: e.target.value as Subject })
              }
            >
              <option value="">Choose subject</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Cohort">
            <select
              disabled={!!existing?.records.length && !!existing.subject}
              value={draft.cohortId}
              onChange={(e) => setDraft({ ...draft, cohortId: e.target.value })}
            >
              {w.cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Issue date">
            <input
              required
              type="date"
              value={draft.issueDate}
              onChange={(e) =>
                setDraft({ ...draft, issueDate: e.target.value })
              }
            />
          </Field>
          <div className="wf-roster-note">
            <strong>{rosterSize} enrolled students</strong>
            <p>
              {existing
                ? "Use Sync enrolments to add newly enrolled students."
                : "Progress records will be created with this assessment."}
            </p>
          </div>
        </div>
        <h3>Timeline · calendar days after issue</h3>
        <div className="wf-offset-grid">
          {STAGES.map((s) => (
            <Field key={s.key} label={s.label}>
              <input
                type="number"
                required
                min="0"
                max="3650"
                step="1"
                value={draft.offsets[s.key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    offsets: {
                      ...draft.offsets,
                      [s.key]: Number(e.target.value),
                    },
                  })
                }
              />
              <small>
                {formatDate(targetDate(draft.issueDate, draft.offsets[s.key]))}
              </small>
            </Field>
          ))}
        </div>
        {!!existing?.records.length && (
          <p className="wf-muted">
            An assessment with progress keeps its cohort and subject once
            confirmed. Create a separate assessment for a different class.
          </p>
        )}
        <div className="wf-actions">
          <button className="wf-button primary" type="submit">
            {existing ? "Save schedule" : "Create assessment"}
          </button>
          {onClose && (
            <button className="wf-button" type="button" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}
function AssessmentDetail({
  a,
  w,
  date,
  commit,
}: {
  a: Assessment;
  w: Workflow;
  date: string;
  commit: Commit;
}) {
  const [editing, setEditing] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [filter, setFilter] = useState("");
  const [bulkMarker, setBulkMarker] = useState("");
  const reasons = blockers(a, w);
  const mutate = (
    fn: (a: Assessment, next: Workflow) => Assessment,
    text: string,
  ) =>
    commit((next) => {
      next.assessments = next.assessments.map((old) =>
        old.id === a.id ? fn(old, next) : old,
      );
      return next;
    }, text);
  const record = a.records.find((r) => r.studentId === recordId);
  return (
    <>
      <Link className="wf-back" href="/assessments">
        ← Assessment tracker
      </Link>
      <div className="wf-detail-heading">
        <div>
          <span className="wf-eyebrow">
            {a.subject || "SUBJECT TO CONFIRM"} /{" "}
            {w.cohorts.find((c) => c.id === a.cohortId)?.name}
          </span>
          <h2>{a.name}</h2>
          <p>
            {a.module} · Issued {formatDate(a.issueDate)} · {a.records.length}{" "}
            student records
          </p>
        </div>
        <div className="wf-actions">
          <Badge
            tone={assessmentStatus(a, w, date) === "Overdue" ? "danger" : ""}
          >
            {assessmentStatus(a, w, date)}
          </Badge>
          <button className="wf-button" onClick={() => setEditing(!editing)}>
            Edit timeline
          </button>
          {a.legacy && (
            <Link className="wf-button" href={`/assessments/${a.id}`}>
              Legacy imports & reconciliation
            </Link>
          )}
        </div>
      </div>
      {editing && (
        <AssessmentForm
          key={a.id}
          existing={a}
          w={w}
          commit={commit}
          onClose={() => setEditing(false)}
        />
      )}
      <div className="wf-milestone-cards">
        {STAGES.map((s) => {
          const p = stageProgress(a, w, s.key, date);
          const times = a.records
            .map((r) =>
              s.key === "allocation"
                ? r.allocatedAt
                : s.key === "resubmission"
                  ? r.submittedAt
                  : s.key === "marking"
                    ? r.markedAt
                    : s.key === "moderation"
                      ? r.reviewedAt
                      : s.key === "release"
                        ? r.releasedAt
                        : undefined,
            )
            .filter(Boolean) as string[];
          return (
            <div
              key={s.key}
              className={p.overdue ? "late" : p.complete ? "complete" : ""}
            >
              <span>{s.label}</span>
              <h3>{formatDate(p.target)}</h3>
              <Badge tone={p.overdue ? "danger" : p.complete ? "green" : ""}>
                {p.complete
                  ? "Complete"
                  : p.overdue
                    ? "Overdue"
                    : "In progress"}
              </Badge>
              <p>
                {p.done}/{p.total} complete
              </p>
              {p.complete && times.length === p.total && (
                <small>
                  Completed {formatDate(times.sort().at(-1)!)}
                  {p.completedLate ? " · Late" : ""}
                </small>
              )}
            </div>
          );
        })}
      </div>
      <div className={`wf-blocker-panel ${reasons.length ? "" : "ready"}`}>
        <div>
          <h3>
            {reasons.length
              ? "What is holding up upload preparation?"
              : "Reviewed results are ready for preparation"}
          </h3>
          <p>
            {reasons.length
              ? reasons.join(" ")
              : "All grades are reviewed."}
          </p>
        </div>

      </div>
      <AssessmentOperations a={a} commit={commit} />
      <Link className="wf-button" href="/marking">
        Open full Marking Allocation tracker
      </Link>
      {record && (
        <RecordEditor
          key={`${record.studentId}-${record.reviewedAt || ""}`}
          r={record}
          w={w}
          a={a}
          onClose={() => setRecordId("")}
          commit={commit}
        />
      )}
      <Panel
        title="Student progress"
        subtitle="Update a student record to move every connected stage forward."
        action={
          <button
            className="wf-button"
            onClick={() =>
              mutate(
                (old, next) => syncRoster(old, next),
                `Synced enrolments for ${a.name}.`,
              )
            }
          >
            Sync enrolments
          </button>
        }
      >
        <div className="wf-filters">
          <input
            aria-label="Search student records"
            placeholder="Search name or student ID…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            aria-label="Marker for unallocated students"
            value={bulkMarker}
            onChange={(e) => setBulkMarker(e.target.value)}
          >
            <option value="">Choose marker for unallocated records</option>
            {w.markers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            className="wf-button"
            disabled={!bulkMarker}
            onClick={() =>
              mutate(
                (old, next) => ({
                  ...old,
                  records: old.records.map((r) =>
                    r.markerId
                      ? r
                      : updateProgress(r, { markerId: bulkMarker }, next),
                  ),
                }),
                `Allocated unassigned records in ${a.name}.`,
              )
            }
          >
            Allocate unassigned
          </button>
        </div>
        {!a.records.length ? (
          <Empty
            title="No students in this roster"
            text="Add subject enrolments for this cohort, then sync them into the assessment."
            href="/students"
            action="Add enrolments"
          />
        ) : (
          <div className="wf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Marker</th>
                  <th>Submission</th>
                  <th>Grade</th>
                  <th>Review / release</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {a.records
                  .filter((r) => {
                    const s = w.students.find((s) => s.id === r.studentId);
                    return `${s?.firstName} ${s?.lastName} ${s?.ncgId}`
                      .toLowerCase()
                      .includes(filter.toLowerCase());
                  })
                  .map((r) => {
                    const s = w.students.find((s) => s.id === r.studentId);
                    return (
                      <tr key={r.studentId}>
                        <td>
                          <strong>
                            {s
                              ? `${s.firstName} ${s.lastName}`
                              : "Missing student"}
                          </strong>
                          <small>{s?.ncgId}</small>
                        </td>
                        <td>
                          {w.markers.find((m) => m.id === r.markerId)?.name || (
                            <Badge tone="amber">Unallocated</Badge>
                          )}
                        </td>
                        <td>
                          <Badge
                            tone={
                              r.submission === "submitted" ? "green" : "amber"
                            }
                          >
                            {r.submission === "resubmission"
                              ? "Resubmission needed"
                              : r.submission === "submitted"
                                ? "Submitted"
                                : "Awaiting submission"}
                          </Badge>
                        </td>
                        <td>{r.grade || "—"}</td>
                        <td>
                          <Badge tone={isReviewed(r, w) ? "green" : ""}>
                            {r.releasedAt
                              ? "Released"
                              : isReviewed(r, w)
                                ? "Reviewed"
                                : "Pending review"}
                          </Badge>
                          {r.reviewedAt && (
                            <small>
                              {r.reviewer} · {formatDate(r.reviewedAt)}
                            </small>
                          )}
                        </td>
                        <td>
                          <button
                            className="wf-text-button"
                            onClick={() => setRecordId(r.studentId)}
                          >
                            Update →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <FileImport
        title="Import marker grades"
        kind="grades"
        w={w}
        assessmentId={a.id}
        commit={commit}
      />
      {a.legacy && (
        <button
          className="wf-button"
          onClick={() =>
            commit((next) => {
              const actual = JSON.parse(
                localStorage.getItem(`gradezy_actual_students_${a.id}`) || "[]",
              ) as { ncgId: string; grade?: string }[];
              if (!actual.length)
                throw new Error("No legacy grades available.");
              return importGrades(
                next,
                a.id,
                actual.map((s) => ({
                  ncgId: s.ncgId,
                  grade: String(s.grade ?? ""),
                })),
              );
            }, `Imported legacy grades into ${a.name}; review required.`)
          }
        >
          Bring legacy imported grades into progress
        </button>
      )}
    </>
  );
}
function RecordEditor({
  r,
  w,
  a,
  commit,
  onClose,
}: {
  r: Progress;
  w: Workflow;
  a: Assessment;
  commit: Commit;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState({ ...r });
  const [reviewer, setReviewer] = useState(r.reviewer);
  const [error, setError] = useState("");
  const s = w.students.find((s) => s.id === r.studentId);
  const apply = (patch: Partial<Progress>, message: string) =>
    commit((next) => {
      const assessment = next.assessments.find((x) => x.id === a.id)!;
      assessment.records = assessment.records.map((old) =>
        old.studentId === r.studentId ? updateProgress(old, patch, next) : old,
      );
      return next;
    }, message);
  return (
    <Panel
      title={`Update ${s?.firstName} ${s?.lastName}`}
      subtitle="Save allocation and grading first, then approve the reviewed result."
      action={
        <button className="wf-button" onClick={onClose}>
          Close
        </button>
      }
    >
      <form
        className="wf-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            apply(
              {
                markerId: draft.markerId,
                submission: draft.submission,
                grade: draft.grade,
                notes: draft.notes,
              },
              `Updated student progress in ${a.name}.`,
            )
          )
            onClose();
        }}
      >
        {error && (
          <div role="alert" className="wf-message error">
            {error}
          </div>
        )}
        <div className="wf-form-grid">
          <Field label="Assigned marker">
            <select
              value={draft.markerId}
              onChange={(e) => setDraft({ ...draft, markerId: e.target.value })}
            >
              <option value="">Unallocated</option>
              {w.markers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Submission state">
            <select
              value={draft.submission}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  submission: e.target.value as Progress["submission"],
                })
              }
            >
              <option value="awaiting">Awaiting submission</option>
              <option value="submitted">
                Submitted / resubmission complete
              </option>
              <option value="resubmission">Resubmission needed</option>
            </select>
          </Field>
          <Field label="Marker grade (number or grade code)">
            <input
              value={draft.grade}
              onChange={(e) => setDraft({ ...draft, grade: e.target.value })}
              placeholder="e.g. 72, Pass, Merit"
            />
          </Field>
          <Field label="Progress notes / reason for delay">
            <input
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </Field>
        </div>
        <button className="wf-button primary">Save progress</button>
      </form>
      <div className="wf-review-box">
        <Field label="Reviewer name">
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Staff member approving this result"
          />
        </Field>
        <button
          className="wf-button"
          disabled={!canReview(r, w) || isReviewed(r, w)}
          onClick={() => {
            if (!reviewer.trim()) return setError("Enter the reviewer name.");
            if (
              draft.grade !== r.grade ||
              draft.markerId !== r.markerId ||
              draft.submission !== r.submission
            )
              return setError("Save progress before approving this result.");
            if (
              apply(
                {
                  reviewer: reviewer.trim(),
                  reviewedAt: new Date().toISOString(),
                },
                `Approved a reviewed grade in ${a.name}.`,
              )
            )
              onClose();
          }}
        >
          Approve reviewed grade
        </button>
        <button
          className="wf-button"
          disabled={!isReviewed(r, w) || !!r.releasedAt}
          onClick={() => {
            if (
              apply(
                { releasedAt: new Date().toISOString() },
                `Recorded student grade release in ${a.name}.`,
              )
            )
              onClose();
          }}
        >
          Record grade release
        </button>
      </div>
      <p className="wf-padding wf-muted">
        Changing the grade, marker or submission reopens review and makes
        previous upload batches stale.
      </p>
    </Panel>
  );
}
function Enrolments({ w, commit }: { w: Workflow; commit: Commit }) {
  const [form, setForm] = useState({
    ncgId: "",
    firstName: "",
    lastName: "",
    subject: SUBJECTS[0] as Subject,
    cohort: w.cohorts[0]?.name || "",
  });
  return (
    <details className="wf-disclosure"><summary>Add student</summary>
      <Panel
        title="Student details"
      >
        <form
          className="wf-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              commit(
                (next) => importEnrolments(next, [form]),
                `Added ${form.subject} enrolment for ${form.firstName} ${form.lastName}.`,
              )
            )
              setForm({ ...form, ncgId: "", firstName: "", lastName: "" });
          }}
        >
          <div className="wf-form-grid three">
            <Field label="Student / NCG ID">
              <input
                required
                value={form.ncgId}
                onChange={(e) => setForm({ ...form, ncgId: e.target.value })}
              />
            </Field>
            <Field label="First name">
              <input
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm({ ...form, firstName: e.target.value })
                }
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </Field>
            <Field label="Cohort">
              <select
                value={form.cohort}
                onChange={(e) => setForm({ ...form, cohort: e.target.value })}
              >
                {w.cohorts.map((c) => (
                  <option key={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Subject">
              <select
                value={form.subject}
                onChange={(e) =>
                  setForm({ ...form, subject: e.target.value as Subject })
                }
              >
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <button className="wf-button primary">Add enrolment</button>
        </form>
      </Panel>
    </details>
  );
}
function Markers({ w, commit }: { w: Workflow; commit: Commit }) {
  const [name, setName] = useState("");
  return (
    <>
      <div className="wf-heading">
        <h2>Share the marking workload</h2>
        <p>
          Add markers, then allocate student records within each assessment
          workspace.
        </p>
      </div>
      <Panel title="Marker directory">
        <form
          className="wf-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              commit((next) => {
                if (!name.trim()) throw new Error("Enter a marker name.");
                if (
                  next.markers.some(
                    (m) => m.name.toLowerCase() === name.trim().toLowerCase(),
                  )
                )
                  throw new Error("This marker is already in the directory.");
                next.markers.push({
                  id: crypto.randomUUID(),
                  name: name.trim(),
                });
                return next;
              }, `Added marker ${name.trim()}.`)
            )
              setName("");
          }}
        >
          <Field label="Marker name">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter staff name"
            />
          </Field>
          <button className="wf-button primary">Add marker</button>
        </form>
        {w.markers.length ? (
          <div className="wf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Marker</th>
                  <th>Assigned</th>
                  <th>Awaiting marking</th>
                  <th>Awaiting review</th>
                </tr>
              </thead>
              <tbody>
                {w.markers.map((m, i) => {
                  const records = w.assessments
                    .flatMap((a) => a.records)
                    .filter((r) => r.markerId === m.id);
                  return (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.name}</strong>
                        <small>Assistant reference M{i + 1}</small>
                      </td>
                      <td>{records.length}</td>
                      <td>{records.filter((r) => !canReview(r, w)).length}</td>
                      <td>
                        {
                          records.filter(
                            (r) => canReview(r, w) && !isReviewed(r, w),
                          ).length
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No markers added yet"
            text="Your staff directory connects allocations to marking progress."
          />
        )}
      </Panel>
      <AssessmentList w={w} date={today()} progress />
    </>
  );
}
function FileImport({
  title,
  kind,
  w,
  assessmentId,
  commit,
}: {
  title: string;
  kind: "enrolments" | "grades";
  w: Workflow;
  assessmentId?: string;
  commit: Commit;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const fields =
    kind === "enrolments"
      ? ["ncgId", "firstName", "lastName", "cohort", "subject"]
      : ["ncgId", "grade", "marker"];
  async function read(file?: File) {
    setRows([]);
    setError("");
    if (!file) return;
    if (file.size > 5_000_000)
      return setError("Choose a file smaller than 5 MB.");
    setBusy(true);
    setName(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const values = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });
      if (!values.length || values.length > 5000)
        throw new Error("Provide between 1 and 5,000 rows on the first sheet.");
      const normalise = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const parsed = values.map((row) =>
        Object.fromEntries(
          fields.map((f) => [
            f,
            String(
              Object.entries(row).find(
                ([key]) => normalise(key) === normalise(f),
              )?.[1] ?? "",
            ).trim(),
          ]),
        ),
      );
      if (kind === "enrolments") importEnrolments(w, parsed);
      else importGrades(w, assessmentId!, parsed);
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title={title}
      subtitle={`CSV or Excel · first sheet · columns: ${fields.join(", ")}${kind === "grades" ? " (marker optional)" : ""}`}
    >
      <div className="wf-import-controls">
        <label className="wf-button">
          {busy ? "Reading file…" : "Choose tracker file"}
          <input
            aria-label={title}
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="sr-only"
          />
        </label>
        <button
          className="wf-text-button"
          onClick={() =>
            download(`${kind}-template.csv`, fields.join(",") + "\r\n")
          }
        >
          Download template ↓
        </button>
        <small>{name}</small>
      </div>
      {error && (
        <div className="wf-message error" role="alert">
          {error}
        </div>
      )}
      {rows.length > 0 && (
        <>
          <div className="wf-table-wrap">
            <table>
              <thead>
                <tr>
                  {fields.map((f) => (
                    <th key={f}>{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {fields.map((f) => (
                      <td key={f}>{r[f]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="wf-import-controls">
            <p>{rows.length} validated rows · preview shows the first five.</p>
            <button
              className="wf-button primary"
              onClick={() => {
                if (
                  commit(
                    (next) =>
                      kind === "enrolments"
                        ? importEnrolments(next, rows)
                        : importGrades(next, assessmentId!, rows),
                    `Imported ${rows.length} ${kind === "grades" ? "draft grades; review required" : "enrolment rows"}.`,
                  )
                ) {
                  setRows([]);
                  setName("");
                }
              }}
            >
              Confirm import
            </button>
            <button className="wf-button" onClick={() => setRows([])}>
              Cancel
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
function Uploads({ w, commit }: { w: Workflow; commit: Commit }) {
  const [selected, setSelected] = useState(w.assessments[0]?.id || "");
  const [mapping, setMapping] = useState({ ...w.mapping });
  const [confirmed, setConfirmed] = useState(w.templateConfirmed);
  const [reference, setReference] = useState("");
  const a = w.assessments.find((a) => a.id === selected);
  const reasons = a ? blockers(a, w) : ["Select an assessment."];
  function exportBatch(b: Batch) {
    if (!batchCurrent(b, w)) return;
    if (
      commit((next) => {
        next.batches.find((old) => old.id === b.id)!.downloadedAt =
          new Date().toISOString();
        return next;
      }, "Downloaded reviewed-grade preparation file.")
    )
      download(
        `gradezy-${b.id.slice(0, 8)}-${w.templateConfirmed ? "upload" : "preparation"}.csv`,
        batchCsv(b),
      );
  }

  return (
    <>
      <div className="wf-heading">
        <h2>Reviewed grades, ready for the next step</h2>
        <p>
          Prepare a full-assessment snapshot, check its columns, then record the
          upload outcome.
        </p>
      </div>
      <div className="wf-message info">
        {w.templateConfirmed
          ? "Column mapping confirmed by staff. Upload the downloaded file in StaffAdvantage and record its acceptance below."
          : "StaffAdvantage template not confirmed. Downloads are preparation files until your team verifies the required columns and grade codes."}
      </div>
      <Panel
        title="Upload column mapping"
        subtitle="Enter the column names from your accepted StaffAdvantage template."
      >
        <form
          className="wf-form"
          onSubmit={(e) => {
            e.preventDefault();
            commit((next) => {
              const headers = UPLOAD_FIELDS.map((f) => mapping[f].trim());
              if (
                headers.some((h) => !h) ||
                new Set(headers.map((h) => h.toLowerCase())).size !==
                  headers.length
              )
                throw new Error("Column names must be non-empty and unique.");
              next.mapping = Object.fromEntries(
                UPLOAD_FIELDS.map((f) => [f, mapping[f].trim()]),
              ) as Workflow["mapping"];
              next.templateConfirmed = confirmed;
              return next;
            }, "Updated upload column mapping.");
          }}
        >
          <div className="wf-form-grid three">
            {UPLOAD_FIELDS.map((f) => (
              <Field key={f} label={f}>
                <input
                  required
                  value={mapping[f]}
                  onChange={(e) => {
                    setMapping({ ...mapping, [f]: e.target.value });
                    setConfirmed(false);
                  }}
                />
              </Field>
            ))}
          </div>
          <label className="wf-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Our team has checked these columns and grade codes against an
            accepted StaffAdvantage template.
          </label>
          <button className="wf-button">Save mapping</button>
        </form>
      </Panel>
      <Panel title="Prepare reviewed results">
        <div className="wf-form">
          <Field label="Assessment">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose assessment</option>
              {w.assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {w.cohorts.find((c) => c.id === a.cohortId)?.name}
                </option>
              ))}
            </select>
          </Field>
          {reasons.length ? (
            <div className="wf-message warning">
              {reasons.join(" ")}{" "}
              {a && (
                <Link href={`/workflow/${a.id}`}>Open student progress →</Link>
              )}
            </div>
          ) : (
            <div className="wf-message success">
              All {a!.records.length} student results are allocated, marked and
              reviewed.
            </div>
          )}
          <button
            className="wf-button primary"
            disabled={!a || reasons.length > 0}
            onClick={() =>
              commit((next) => {
                next.batches.unshift(
                  prepareBatch(
                    next.assessments.find((old) => old.id === selected)!,
                    next,
                  ),
                );
                return next;
              }, "Prepared a reviewed-grade batch snapshot.")
            }
          >
            Prepare batch for preview
          </button>
        </div>
      </Panel>
      {!w.batches.length ? (
        <Empty
          title="No prepared batches yet"
          text="Complete the student records and grade reviews before preparing a file."
        />
      ) : (
        w.batches.map((b) => {
          const current = batchCurrent(b, w);
          return (
            <Panel
              key={b.id}
              title={`${w.assessments.find((a) => a.id === b.assessmentId)?.name || "Assessment"} · ${b.id.slice(0, 8)}`}
              subtitle={`Prepared ${formatDate(b.createdAt)} · ${b.rows.length} reviewed rows`}
              action={
                <Badge tone={!current ? "danger" : b.uploadedAt ? "green" : ""}>
                  {!current
                    ? "Stale · prepare again"
                    : b.uploadedAt
                      ? "Upload confirmed"
                      : b.downloadedAt
                        ? "Downloaded"
                        : "Prepared"}
                </Badge>
              }
            >
              <div className="wf-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {UPLOAD_FIELDS.map((f) => (
                        <th key={f}>{b.mapping[f]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.slice(0, 5).map((r) => (
                      <tr key={r.studentId}>
                        {UPLOAD_FIELDS.map((f) => (
                          <td key={f}>{r[f]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="wf-import-controls">
                <small>
                  Preview: first {Math.min(5, b.rows.length)} rows. Download
                  includes all rows.
                </small>
                <button
                  className="wf-button primary"
                  disabled={!current || !!b.uploadedAt}
                  onClick={() => exportBatch(b)}
                >
                  Download{" "}
                  {w.templateConfirmed ? "upload file" : "preparation CSV"}
                </button>
                {!b.uploadedAt && current && b.downloadedAt && (
                  <>
                    <input
                      aria-label={`Upload confirmation reference for batch ${b.id.slice(0, 8)}`}
                      placeholder="StaffAdvantage acceptance reference"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                    <button
                      className="wf-button"
                      disabled={!reference.trim() || !w.templateConfirmed}
                      onClick={() => {
                        if (
                          commit((next) => {
                            const batch = next.batches.find(
                              (old) => old.id === b.id,
                            )!;
                            if (
                              !batchCurrent(batch, next) ||
                              !next.templateConfirmed ||
                              !batch.downloadedAt
                            )
                              throw new Error(
                                "Download a current batch using a confirmed template first.",
                              );
                            batch.uploadedAt = new Date().toISOString();
                            batch.reference = reference.trim();
                            return next;
                          }, "Recorded StaffAdvantage upload confirmation.")
                        )
                          setReference("");
                      }}
                    >
                      Confirm accepted upload
                    </button>
                  </>
                )}
                {b.uploadedAt && (
                  <small>
                    Accepted {formatDate(b.uploadedAt)} · {b.reference}
                    {!current ? " · Source records have since changed." : ""}
                  </small>
                )}
              </div>
            </Panel>
          );
        })
      )}
    </>
  );
}
function Assistant({ w, date, compact = false }: { w: Workflow; date: string; compact?: boolean }) {
  const [question, setQuestion] = useState(
    "What is blocking assessment completion, and what should we do next?",
  );
  const [token, setToken] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const context = assistantContext(w, date);
  async function ask(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setAnswer("");
    if (!token.trim()) {
      const workload = /balance|workload|marker/i.test(question);
      const priority = context.assessments.map((a, i) => ({ a, assessment: w.assessments[i] }))
        .filter(({ a }) => a.status === "Overdue" || a.blockers.length)
        .sort((x, y) => Number(y.a.status === "Overdue") - Number(x.a.status === "Overdue"))
        .slice(0, 3);
      const lines = workload
        ? context.markerWorkload.filter((m) => m.awaitingMarking > 0).sort((a, b) => b.awaitingMarking - a.awaitingMarking).slice(0, 3).map((m) => {
            const index = context.markerWorkload.indexOf(m);
            return w.markers[index].name + ": " + m.awaitingMarking + " awaiting marking of " + m.assigned + " allocated.";
          })
        : priority.map(({ a, assessment }) => assessment.module + " / " + assessment.name + ": " + a.status + ". " + (a.blockers.slice(0, 2).join(" ") || "Check outstanding deadlines in the assessment workspace."));
      setAnswer("Live workspace checks\n" + (lines.length ? lines.join("\n") : "No outstanding issues found in the current records.") + "\nFor a tailored AI answer, configure Assistant access.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/assessment-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "The assistant could not respond.");
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assistant unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className={compact ? "wf-assistant-inline" : "wf-two-columns"}>
        <Panel
          title="Ask Gradezy"
        >
          <form className="wf-form" onSubmit={ask}>
            <div className="wf-prompt-chips">
              {[
                "What is overdue and what does it block?",
                "Suggest how to balance the marking workload.",
                "Draft a follow-up about outstanding reviews.",
              ].map((q) => (
                <button
                  className="wf-button"
                  type="button"
                  key={q}
                  onClick={() => setQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
            <Field label="Your question">
              <textarea
                required
                maxLength={2000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={compact ? 2 : 4}
              />
            </Field>
            <details className="wf-assistant-settings"><summary>Assistant access</summary>
            <Field label="Assistant access token">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                placeholder="Provided by your workspace administrator"
              />
            </Field>
            </details>
            {!compact && <p className="wf-muted">
              Student names, IDs, individual grades and notes are excluded from
              the workflow context. Avoid adding them to your question.
              Suggestions do not change records.
            </p>}
            <button className="wf-button primary" disabled={busy}>
              {busy ? "Reading the workflow…" : "Ask assistant ✦"}
            </button>
            {error && (
              <div role="alert" className="wf-message error">
                {error}
              </div>
            )}
            {answer && (
              <div className="wf-answer" aria-live="polite">
                <Badge tone="green">{answer.startsWith("Live workspace checks") ? "Live workspace checks" : "AI-generated suggestion"}</Badge>
                <p>{answer}</p>
                <button
                  type="button"
                  className="wf-button"
                  onClick={() =>
                    download("assessment-follow-up.txt", answer, "text/plain")
                  }
                >
                  Download draft
                </button>
              </div>
            )}
          </form>
        </Panel>
        {!compact && <Panel
          title="Live workflow checks"
          subtitle="Calculated from records; available without an AI connection."
        >
          {context.assessments.length ? (
            context.assessments.map((a, i) => ({ a, i })).filter(({ a }) => a.status === "Overdue" || a.blockers.length).sort((x, y) => Number(y.a.status === "Overdue") - Number(x.a.status === "Overdue")).slice(0, 5).map(({ a, i }) => (
              <Link
                className="wf-check-item"
                key={a.reference}
                href={`/workflow/${w.assessments[i].id}`}
              >
                <strong>
                  {a.reference} · {w.assessments[i].name}
                </strong>
                <Badge tone={a.status === "Overdue" ? "danger" : ""}>
                  {a.status}
                </Badge>
                <p>
                  {a.blockers.length
                    ? a.blockers.join(" ")
                    : "All results reviewed."}
                </p>
              </Link>
            ))
          ) : (
            <Empty
              title="No workflow records yet"
              text="Add enrolments and assessments to give the assistant something to work with."
            />
          )}
          <div className="wf-padding wf-muted">
            {context.gaps.cohortStartDatesMissing} cohort start months to
            confirm · {context.gaps.studentsWithoutEnrolment} student enrolments
            to confirm
          </div>
        </Panel>}
      </div>
    </>
  );
}
