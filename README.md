# Gradezy assessment operations

Gradezy connects cohort subject enrolments, assessment schedules, marker allocation, student progress, grade review and StaffAdvantage preparation.

## Run locally

Install Node.js 22 or later, then run:

```sh
npm ci
npm run dev
```

Open http://localhost:3000/dashboard. The development environment used for this change did not have Node installed; a portable runtime was downloaded to the Windows temporary folder for verification. This is not a project dependency.

## Workflow

1. **Cohorts & enrolments:** six initial cohorts. C1 October 2023, C2 February 2024, C3 October 2024, C4 February 2025, C5 October 2025 and C6 February 2026. Add student IDs, names and enrolments in Business Management, Computer Science, or Health and Social Care. One student identity supports multiple subject/cohort enrolments.
2. **Assessment tracker:** create an assessment for a subject/cohort. Its roster is generated from enrolments. Use Sync enrolments to add subsequently enrolled students without replacing existing progress.
3. **Timeline:** editable calendar-day offsets from each assessment's issue date. Defaults: allocation +3, resubmission +7, marking +10, internal moderation +21 and grade release +30. Keep targets separate from actual completion. Completed-late milestones remain labelled; unfinished overdue work remains visible downstream. A submitted record counts as having no outstanding resubmission.
4. **Markers & progress:** add staff to the marker directory. Allocate individually or assign all unallocated records to a chosen marker. Record submission/resubmission state, grades and delay notes. Grades may be numeric or subject-specific codes; no grading scale is assumed.
5. **Review:** save progress, reopen the student editor, enter the reviewer and approve the result. Marker allocation, submitted work and a nonblank grade are required. Record grade release separately. Changes to grade, marker or submission reopen approval and invalidate previous preparation batches. Reviewer names are local staff attestations, not authenticated identities.
6. **Uploads:** prepare a whole-assessment snapshot only when every result is reviewed and the student enrolments and metadata are complete. Preview the first five rows; the CSV contains all rows. Column names are editable. Until staff confirm the mapping and grade codes against an accepted StaffAdvantage template, files are labelled preparation CSVs. Upload outside Gradezy, then record the acceptance reference. Stale batches remain in history and cannot be exported or newly confirmed.

Assessment list, progress tracker, dashboard, marker workload and assistant checks derive their state from the same records.

## Tracker imports

CSV/XLSX/XLS tracker imports let staff choose a worksheet, accept up to 5 MB / 5,000 rows, and show a preview before committing. Headers are matched without regard to spaces or case. Imports are validated atomically: an invalid row prevents the entire import. Download blank templates from the relevant screen.

Enrolment columns:

```csv
ncgId,firstName,lastName,cohort,subject
NCG001,Example,Student,Cohort 1,Business Management
NCG001,Example,Student,Cohort 1,Computer Science
```

Grade columns (marker optional, but must name an existing directory entry if supplied):

```csv
ncgId,grade,marker
NCG001,72,Example Marker
```

Grades import as draft results; import does not assert submission, moderation or grade approval. Text identifiers retain leading zeros when the source cell itself is stored as text. Conflicting student names, duplicate grade rows, unrecognised subjects/cohorts and out-of-roster grades require correction before import.

## AI assistant

Live workflow checks run locally without any AI credentials. To enable real AI explanations and follow-up drafts, create a git-ignored `.env.local`:

```dotenv
OPENAI_API_KEY=your_server_api_key
OPENAI_MODEL=your_available_responses_model
ASSESSMENT_ASSISTANT_TOKEN=a_long_random_workspace_access_token
```

Restart the app, then enter the assistant access token in the assistant screen. Do not enter your OpenAI API key in the browser. The token is held in component memory only. The server rejects requests without a matching token and applies a basic per-process limit of ten requests per minute. This local prototype token is not a substitute for production staff authentication or a shared rate limiter.

The endpoint uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses) with `store: false`, a configured model, bounded inputs, an upstream timeout and a server-side API key. Workflow context includes aggregate counts, timeline targets, blockers and anonymous references A1/M1. It excludes student names, IDs, individual grades, progress notes and marker/reviewer names. Questions are sent as entered, so avoid personal data in the question. No requests are sent merely by opening a screen. AI suggests actions and drafts messages; it cannot edit records, approve grades, upload files or send messages.

## Persistence and existing records

This implementation retains browser-local persistence. Staff on another computer do not see the same workspace. The sign-in page is the existing prototype and does not authenticate staff.

The versioned `gradezy_workflow_v1` store contains the connected workflow. Existing `gradezy_assessments` and assessment-specific imports are read during initial migration and remain intact. Legacy dates are not guessed as issue dates; subjects and student enrolments require confirmation. Initial legacy grades remain unapproved. Legacy import/reconciliation tools remain accessible from migrated assessment workspaces. After migration, new edits in legacy tools are not silently merged; use the explicit legacy-grade import action or the validated tracker imports in the connected workspace. Legacy student analytics are separately labelled and still read the legacy stores.

Use Download backup to export local Gradezy data (excluding the prototype session). Malformed workflow data is not silently overwritten. Revision checks reject stale writes from other tabs. The local activity log records changes but is not an immutable audit trail.

## Verification

```sh
npm test
npm run lint
npm run build
```

Domain regression tests cover calendar dates, enrolments, roster synchronisation, approval/release gates, stale batches, atomic imports, privacy of AI context, storage conflicts and reconciliation. Browser smoke tests use synthetic data in a fresh browser context and exercise enrolment through reviewed export, persistence, stale-batch blocking and mobile navigation.

## Next integration inputs

Before replacing browser storage for a shared staff deployment, establish staff roles, a real authentication provider, a database and backup/audit requirements. An accepted StaffAdvantage template is needed to finalise column selection, assessment/attempt identifiers, allowable grade codes and the exact upload format. This version prepares CSV snapshots and records manual acceptance; it does not claim to have uploaded to StaffAdvantage.

## Practice workbooks and workspace search

Workspaces automatically receive linked tracker examples once, including 36 fictional students, 18 assessments and three markers across three cohorts and subjects. Modules have two assessments, varied submission/marking/review states, and Week 4/Week 8 progress records. The workbook provenance is explicitly labelled Practice workbook. These are fictional testing records, not uploaded student files. Settings offers Load practice records and Remove practice records; loading is idempotent and removal keeps user-added records. Removing practice records also disables automatic population in that browser. Existing student-only workspaces receive the linked assessment, progress and marking examples without overwriting entered records; repeated loading fills missing examples and preserves edits.

Ask Gradezy searches browser-local records by student name or ID, module, assessment, cohort and marker. It distinguishes missing submissions, resubmissions, submitted work awaiting marking, results ready for review, overdue milestones and students needing learning support. Answers link to the relevant assessment workspaces and can be closed. Unknown module, cohort and student IDs return no match; unsupported questions prompt a more specific query. Workspace search is deterministic and works without AI credentials. Configured AI receives richer anonymous counts and focused assessment references for explanations; student-level searches remain local.

The Progress Tracker links checkpoints with submission and marking status. Marking Allocation summarizes each marker's allocated and marked assessment records by module/cohort. Excel imports remain available through compact controls. Integrations lists Excel as available and SharePoint, SIMS and StaffAdvantage sync as planned.
