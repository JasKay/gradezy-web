"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";

import { AppSidebar } from "@/components/app-sidebar";
import {
  isExtensionAvailable,
  requestGradesFromExtension,
} from "@/lib/extension-communication";

type Assessment = {
  id: string;
  name: string;
  module: string;
  level: string;
  cohort: string;
  assessmentType: string;
  dueDate: string;
  createdAt: string;
};

type Student = {
  ncgId: string;
  firstName: string;
  lastName: string;
  grade: string;
};

export default function AssessmentWorkspace() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);

  const [assessment, setAssessment] =
    useState<Assessment | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [actualStudents, setActualStudents] =
    useState<Student[]>([]);

  const [fileName, setFileName] = useState("");
  const [actualFileName, setActualFileName] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadingActual, setUploadingActual] = useState(false);

  const [error, setError] = useState("");
  const [actualError, setActualError] = useState("");

  const [extensionAvailable, setExtensionAvailable] =
    useState(false);

  const [importingFromExtension, setImportingFromExtension] =
    useState(false);

  useEffect(() => {
    if (!assessmentId) return;

    // Load current assessment
    const storedAssessment = localStorage.getItem(
      "gradezy_current_assessment"
    );

    if (storedAssessment) {
      try {
        const parsedAssessment = JSON.parse(
          storedAssessment
        ) as Assessment;

        if (parsedAssessment.id === assessmentId) {
          setAssessment(parsedAssessment);
        }
      } catch (err) {
        console.error(
          "Failed to load current assessment:",
          err
        );
      }
    }

    // Load expected students
    const storedStudents = localStorage.getItem(
      `gradezy_students_${assessmentId}`
    );

    if (storedStudents) {
      try {
        const parsedStudents = JSON.parse(
          storedStudents
        ) as Student[];

        setStudents(
          Array.isArray(parsedStudents)
            ? parsedStudents
            : []
        );
      } catch (err) {
        console.error(
          "Failed to load expected students:",
          err
        );
      }
    }

    // Load actual students
    const storedActualStudents = localStorage.getItem(
      `gradezy_actual_students_${assessmentId}`
    );

    if (storedActualStudents) {
      try {
        const parsedActualStudents = JSON.parse(
          storedActualStudents
        ) as Student[];

        setActualStudents(
          Array.isArray(parsedActualStudents)
            ? parsedActualStudents
            : []
        );
      } catch (err) {
        console.error(
          "Failed to load actual students:",
          err
        );
      }
    }

    // Check browser extension
    try {
      setExtensionAvailable(isExtensionAvailable());
    } catch (err) {
      console.error(
        "Failed to check Gradezy extension:",
        err
      );

      setExtensionAvailable(false);
    }
  }, [assessmentId]);

  async function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setUploading(true);
    setFileName(file.name);

    try {
      const parsedStudents = await parseStudentFile(file);

      setStudents(parsedStudents);

      localStorage.setItem(
        `gradezy_students_${assessmentId}`,
        JSON.stringify(parsedStudents)
      );
    } catch (err) {
      console.error(
        "Failed to import expected students:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the spreadsheet."
      );
    } finally {
      setUploading(false);

      // Allow selecting the same file again
      event.target.value = "";
    }
  }

  async function handleActualFileUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setActualError("");
    setUploadingActual(true);
    setActualFileName(file.name);

    try {
      const parsedStudents = await parseStudentFile(file);

      setActualStudents(parsedStudents);

      localStorage.setItem(
        `gradezy_actual_students_${assessmentId}`,
        JSON.stringify(parsedStudents)
      );
    } catch (err) {
      console.error(
        "Failed to import actual students:",
        err
      );

      setActualError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the spreadsheet."
      );
    } finally {
      setUploadingActual(false);

      // Allow selecting the same file again
      event.target.value = "";
    }
  }

  async function handleImportFromExtension() {
    setActualError("");
    setImportingFromExtension(true);

    try {
      const grades = await requestGradesFromExtension();

      if (!grades || grades.length === 0) {
        throw new Error(
          "No grades were extracted from the assessment system. Make sure the Gradezy extension is installed and that you are on an assessment system page."
        );
      }

      const parsedStudents: Student[] = grades.map(
        (grade) => {
          const fullName = String(grade.name ?? "").trim();
          const nameParts = fullName
            ? fullName.split(/\s+/)
            : [];

          return {
            ncgId: "",
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            grade: String(grade.grade ?? "").trim(),
          };
        }
      );

      setActualStudents(parsedStudents);

      const source =
        grades[0]?.source || "assessment system";

      setActualFileName(`Imported from ${source}`);

      localStorage.setItem(
        `gradezy_actual_students_${assessmentId}`,
        JSON.stringify(parsedStudents)
      );
    } catch (err) {
      console.error(
        "Failed to import grades from extension:",
        err
      );

      setActualError(
        err instanceof Error
          ? err.message
          : "Failed to import grades from the assessment system."
      );
    } finally {
      setImportingFromExtension(false);
    }
  }

  if (!assessment) {
    return (
      <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
        <AppSidebar />

        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

            <p className="text-sm text-slate-500">
              Loading assessment...
            </p>
          </div>
        </div>
      </main>
    );
  }

  const studentsWithIds = students.filter(
    (student) => student.ncgId.trim() !== ""
  );

  const studentsWithoutIds = students.filter(
    (student) => student.ncgId.trim() === ""
  );

  const gradesPresent = students.filter(
    (student) => student.grade.trim() !== ""
  );

  const missingGrades =
    students.length - gradesPresent.length;

  const hasExpectedData = students.length > 0;
  const hasActualData = actualStudents.length > 0;

  const isReadyForReconciliation =
    hasExpectedData && hasActualData;

  const expectedComplete =
    hasExpectedData &&
    studentsWithoutIds.length === 0 &&
    missingGrades === 0;

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar
        assessment={{
          id: assessment.id,
          name: assessment.name,
          module: assessment.module,
        }}
      />

      <div>
        {/* Header */}
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              {assessment.module} · {assessment.level} ·{" "}
              {assessment.cohort}
            </p>

            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-slate-950">
              {assessment.name}
            </h1>
          </div>

          <AssessmentStatus
            hasExpectedData={hasExpectedData}
            hasActualData={hasActualData}
          />
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* Page heading */}
          <section>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Assessment overview
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
              Assessment Health
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Review your assessment data, identify
              exceptions and prepare everything for
              reconciliation.
            </p>
          </section>

          {/* Health card */}
          <section className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-slate-500">
                  Current assessment health
                </p>

                <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {isReadyForReconciliation
                    ? "Ready to reconcile"
                    : hasExpectedData
                      ? "In progress"
                      : "Not started"}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  {hasExpectedData
                    ? `${students.length.toLocaleString()} expected student records imported.`
                    : "No assessment data has been imported yet."}
                </p>
              </div>

              <div className="max-w-sm rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                    <HealthIcon />
                  </span>

                  <p className="text-sm font-semibold text-indigo-700">
                    {isReadyForReconciliation
                      ? "Both datasets available"
                      : hasExpectedData
                        ? "One more dataset required"
                        : "Start with your Progress Tracker"}
                  </p>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {isReadyForReconciliation
                    ? "Gradezy can now compare your expected students against the assessment system data."
                    : hasExpectedData
                      ? "Bring in the assessment system data to begin reconciliation."
                      : "Upload your Progress Tracker to begin reconciling students and assessment data."}
                </p>
              </div>
            </div>
          </section>

          {/* Metrics */}
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Students expected"
              value={
                hasExpectedData
                  ? students.length.toLocaleString()
                  : "—"
              }
              detail={
                hasExpectedData
                  ? "From Progress Tracker"
                  : "Waiting for import"
              }
            />

            <Metric
              label="Valid NCG IDs"
              value={
                hasExpectedData
                  ? studentsWithIds.length.toLocaleString()
                  : "—"
              }
              detail={
                hasExpectedData
                  ? `${studentsWithoutIds.length} missing`
                  : "Waiting for import"
              }
              valueClass={
                hasExpectedData &&
                studentsWithoutIds.length > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            />

            <Metric
              label="Grades present"
              value={
                hasExpectedData
                  ? gradesPresent.length.toLocaleString()
                  : "—"
              }
              detail={
                hasExpectedData
                  ? `${missingGrades} missing`
                  : "Waiting for import"
              }
              valueClass={
                expectedComplete
                  ? "text-emerald-600"
                  : "text-slate-950"
              }
            />

            <Metric
              label="Data issues"
              value={
                hasExpectedData
                  ? studentsWithoutIds.length.toLocaleString()
                  : "—"
              }
              detail={
                !hasExpectedData
                  ? "Waiting for import"
                  : studentsWithoutIds.length === 0
                    ? "No ID issues"
                    : "Requires attention"
              }
              valueClass={
                studentsWithoutIds.length > 0
                  ? "text-red-600"
                  : "text-emerald-600"
              }
            />
          </section>

          {/* Empty state */}
          {!hasExpectedData && (
            <section className="mt-12">
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                  Step 1
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Bring in your data
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Start with your Progress Tracker
                  spreadsheet.
                </p>
              </div>

              <label className="group block cursor-pointer rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center transition hover:border-slate-400 hover:bg-slate-100">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                  <UploadIcon />
                </div>

                <h4 className="mt-6 text-lg font-semibold text-slate-950">
                  {uploading
                    ? "Reading spreadsheet..."
                    : "Upload your Progress Tracker"}
                </h4>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                  Select your Excel or CSV file and Gradezy
                  will automatically detect the student
                  information inside it.
                </p>

                <span className="mt-6 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
                  {uploading
                    ? "Processing..."
                    : "Choose Excel file"}
                </span>

                <p className="mt-4 text-xs text-slate-400">
                  XLSX, XLS or CSV
                </p>
              </label>

              {error && <ErrorMessage message={error} />}
            </section>
          )}

          {/* Expected students */}
          {hasExpectedData && (
            <section className="mt-12">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                    Imported data
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                    Student records
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {fileName || "Progress Tracker"} ·{" "}
                    {students.length.toLocaleString()} records
                  </p>
                </div>

                <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  Replace file
                </label>
              </div>

              {/* Warnings */}
              {studentsWithoutIds.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0 text-amber-600">
                      <WarningIcon />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        {studentsWithoutIds.length} student
                        {studentsWithoutIds.length === 1
                          ? ""
                          : "s"}{" "}
                        missing an NCG ID
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-700/80">
                        These records may not be possible
                        to reconcile until an NCG ID is
                        available.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {missingGrades > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0 text-amber-600">
                      <WarningIcon />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        {missingGrades} student
                        {missingGrades === 1 ? "" : "s"}{" "}
                        missing a grade
                      </p>

                      <p className="mt-1 text-sm leading-6 text-amber-700/80">
                        Review these records before completing
                        the assessment workflow.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <StudentTable students={students} />

              {/* Next action */}
              {!hasActualData && (
                <div className="mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-7 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold text-slate-950">
                      Next: Upload assessment data
                    </p>

                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                      Upload your StaffAdvantage or assessment
                      system export to begin reconciliation.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("actual-data-upload")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        })
                    }
                    className="shrink-0 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Upload assessment data →
                  </button>
                </div>
              )}

              {/* Ready action */}
              {hasActualData && (
                <div className="mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-7 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckIcon />
                      </span>

                      <p className="font-semibold text-slate-950">
                        Both datasets ready for reconciliation
                      </p>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {students.length.toLocaleString()} expected
                      students vs{" "}
                      {actualStudents.length.toLocaleString()}{" "}
                      actual students.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/assessments/${assessment.id}/reconciliation`
                      )
                    }
                    className="shrink-0 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Run reconciliation →
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Actual data upload */}
          {hasExpectedData && !hasActualData && (
            <section
              id="actual-data-upload"
              className="mt-12 scroll-mt-10"
            >
              <div className="mb-5">
                <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                  Step 2
                </p>

                <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                  Bring in your assessment system data
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Upload an export from StaffAdvantage or
                  your assessment system.
                </p>
              </div>

              <label className="group block cursor-pointer rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center transition hover:border-slate-400 hover:bg-slate-100">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleActualFileUpload}
                  className="hidden"
                />

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
                  <UploadIcon />
                </div>

                <h4 className="mt-6 text-lg font-semibold text-slate-950">
                  {uploadingActual
                    ? "Reading spreadsheet..."
                    : "Upload your assessment system data"}
                </h4>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                  Upload an export containing student
                  records. Gradezy will compare these against
                  your expected students.
                </p>

                <span className="mt-6 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition group-hover:bg-slate-800">
                  {uploadingActual
                    ? "Processing..."
                    : "Choose Excel file"}
                </span>

                <p className="mt-4 text-xs text-slate-400">
                  XLSX, XLS or CSV
                </p>
              </label>

              {actualError && (
                <ErrorMessage message={actualError} />
              )}

              {/* Extension */}
              {extensionAvailable && (
                <div className="mt-8">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />

                    <span className="text-xs font-medium text-slate-400">
                      OR
                    </span>

                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <button
                    type="button"
                    onClick={handleImportFromExtension}
                    disabled={importingFromExtension}
                    className="mt-5 w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4 text-center transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                        <LightningIcon />
                      </span>

                      <div className="text-left">
                        <p className="text-sm font-semibold text-indigo-700">
                          {importingFromExtension
                            ? "Extracting grades..."
                            : "Extract from assessment system"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Use the Gradezy browser extension to
                          auto-import grades
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Actual data */}
          {hasActualData && (
            <section className="mt-12">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600">
                    Assessment system data
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                    Student records from system
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {actualFileName ||
                      "Assessment system export"}{" "}
                    · {actualStudents.length.toLocaleString()}{" "}
                    records
                  </p>
                </div>

                <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleActualFileUpload}
                    className="hidden"
                  />
                  Replace file
                </label>
              </div>

              <StudentTable
                students={actualStudents}
                showStatus={false}
              />

              <div className="mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-7 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckIcon />
                    </span>

                    <p className="font-semibold text-slate-950">
                      Ready for reconciliation
                    </p>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Gradezy has both datasets and can now
                    identify matches, missing students and
                    exceptions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/assessments/${assessment.id}/reconciliation`
                    )
                  }
                  className="shrink-0 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Run reconciliation →
                </button>
              </div>
            </section>
          )}

          {/* Workflow */}
          <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">
              Workflow
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <WorkflowStep
                number="01"
                title="Import data"
                active={!hasExpectedData}
                complete={hasExpectedData}
              />

              <WorkflowStep
                number="02"
                title="Reconcile"
                active={isReadyForReconciliation}
                complete={false}
              />

              <WorkflowStep
                number="03"
                title="Review issues"
                active={false}
                complete={false}
              />

              <WorkflowStep
                number="04"
                title="Check readiness"
                active={false}
                complete={false}
              />
            </div>
          </section>

          {/* Assessment details */}
          <section className="mt-12 pb-10">
            <div>
              <h3 className="text-xl font-semibold text-slate-950">
                Assessment details
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Information about this assessment
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailCard
                label="Module"
                value={assessment.module}
              />

              <DetailCard
                label="Level"
                value={assessment.level}
              />

              <DetailCard
                label="Cohort"
                value={assessment.cohort}
              />

              <DetailCard
                label="Due date"
                value={formatDate(assessment.dueDate)}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function parseStudentFile(
  file: File
): Promise<Student[]> {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
  });

  if (!workbook.SheetNames.length) {
    throw new Error(
      "The spreadsheet does not contain any worksheets."
    );
  }

  const firstSheet =
    workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    throw new Error(
      "The first worksheet could not be read."
    );
  }

  const rows =
    XLSX.utils.sheet_to_json<Record<string, unknown>>(
      firstSheet,
      {
        defval: "",
      }
    );

  if (!rows.length) {
    throw new Error(
      "The spreadsheet appears to be empty."
    );
  }

  const parsedStudents: Student[] = rows
    .map((row) => {
      const ncgId = getValue(row, [
        "NCG ID",
        "NCG_ID",
        "NCGID",
        "NCG-ID",
      ]);

      const firstName = getValue(row, [
        "First Name",
        "FirstName",
        "Forename",
        "Given Name",
        "GivenName",
      ]);

      const lastName = getValue(row, [
        "Last Name",
        "LastName",
        "Surname",
        "Family Name",
        "FamilyName",
      ]);

      const grade = getValue(row, [
        "Grade",
        "Grades",
        "Mark",
        "Marks",
        "Score",
        "Percentage",
        "Final Grade",
        "FinalGrade",
        "Final Mark",
        "FinalMark",
      ]);

      return {
        ncgId: normalizeValue(ncgId),
        firstName: normalizeValue(firstName),
        lastName: normalizeValue(lastName),
        grade: normalizeValue(grade),
      };
    })
    .filter(
      (student) =>
        student.ncgId !== "" ||
        student.firstName !== "" ||
        student.lastName !== "" ||
        student.grade !== ""
    );

  if (!parsedStudents.length) {
    throw new Error(
      "No student records could be found in this spreadsheet."
    );
  }

  return parsedStudents;
}

function getValue(
  row: Record<string, unknown>,
  possibleNames: string[]
): unknown {
  const normalizedKeys = Object.keys(row).reduce(
    (result, key) => {
      result[normalizeHeader(key)] = row[key];
      return result;
    },
    {} as Record<string, unknown>
  );

  for (const name of possibleNames) {
    const normalizedName = normalizeHeader(name);

    if (
      Object.prototype.hasOwnProperty.call(
        normalizedKeys,
        normalizedName
      )
    ) {
      return normalizedKeys[normalizedName];
    }
  }

  return "";
}

function normalizeHeader(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return String(value)
    .trim()
    .replace(/\.0$/, "");
}

function formatDate(date: string): string {
  if (!date) {
    return "Not set";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* -------------------------------------------------------------------------- */
/* UI Components                                                              */
/* -------------------------------------------------------------------------- */

function AssessmentStatus({
  hasExpectedData,
  hasActualData,
}: {
  hasExpectedData: boolean;
  hasActualData: boolean;
}) {
  if (hasExpectedData && hasActualData) {
    return (
      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
        Ready
      </span>
    );
  }

  if (hasExpectedData) {
    return (
      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
        Needs review
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
      Not started
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  valueClass = "text-slate-950",
}: {
  label: string;
  value: string;
  detail: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>

      <p
        className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-400">
        {detail}
      </p>
    </div>
  );
}

function StudentTable({
  students,
  showStatus = true,
}: {
  students: Student[];
  showStatus?: boolean;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                NCG ID
              </th>

              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                First name
              </th>

              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Last name
              </th>

              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Grade
              </th>

              {showStatus && (
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Status
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {students
              .slice(0, 100)
              .map((student, index) => (
                <tr
                  key={`${student.ncgId}-${student.firstName}-${student.lastName}-${index}`}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-6 py-4 text-sm font-medium text-slate-950">
                    {student.ncgId || (
                      <span className="text-slate-400">
                        —
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {student.firstName || "—"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-600">
                    {student.lastName || "—"}
                  </td>

                  <td className="px-6 py-4 text-sm text-slate-700">
                    {student.grade || (
                      <span className="text-slate-400">
                        Missing
                      </span>
                    )}
                  </td>

                  {showStatus && (
                    <td className="px-6 py-4">
                      {student.ncgId ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Valid
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          Missing ID
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {students.length > 100 && (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-400">
          Showing first 100 of{" "}
          {students.length.toLocaleString()} students.
        </div>
      )}

      {students.length === 0 && (
        <div className="px-6 py-12 text-center text-sm text-slate-400">
          No student records available.
        </div>
      )}
    </div>
  );
}

function WorkflowStep({
  number,
  title,
  active = false,
  complete = false,
}: {
  number: string;
  title: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <div className="relative">
      <span
        className={`text-xs font-semibold ${
          complete
            ? "text-emerald-600"
            : active
              ? "text-indigo-600"
              : "text-slate-300"
        }`}
      >
        {complete ? "✓" : number}
      </span>

      <p
        className={`mt-3 text-sm font-medium ${
          complete || active
            ? "text-slate-950"
            : "text-slate-400"
        }`}
      >
        {title}
      </p>
    </div>
  );
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-950">
        {value || "Not set"}
      </p>
    </div>
  );
}

function ErrorMessage({
  message,
}: {
  message: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 text-red-600">
          <WarningIcon />
        </div>

        <p className="text-sm leading-6 text-red-700">
          {message}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                      */
/* -------------------------------------------------------------------------- */

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 20h16" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10.3 3.6-7.7 13.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M5.6 5.6 18.4 18.4" />
      <path d="m18.4 5.6-12.8 12.8" />
    </svg>
  );
}
