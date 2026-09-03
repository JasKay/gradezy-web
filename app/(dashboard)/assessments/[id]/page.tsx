"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
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

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [actualStudents, setActualStudents] = useState<Student[]>([]);
  const [fileName, setFileName] = useState("");
  const [actualFileName, setActualFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingActual, setUploadingActual] = useState(false);
  const [error, setError] = useState("");
  const [actualError, setActualError] = useState("");
  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [importingFromExtension, setImportingFromExtension] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("gradezy_current_assessment");

    if (stored) {
      const parsed = JSON.parse(stored);

      if (parsed.id === params.id) {
        setAssessment(parsed);
      }
    }

    const storedStudents = localStorage.getItem(
      `gradezy_students_${params.id}`
    );

    if (storedStudents) {
      setStudents(JSON.parse(storedStudents));
    }

    const storedActualStudents = localStorage.getItem(
      `gradezy_actual_students_${params.id}`
    );

    if (storedActualStudents) {
      setActualStudents(JSON.parse(storedActualStudents));
    }

    // Check if extension is available
    setExtensionAvailable(isExtensionAvailable());
  }, [params.id]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setUploading(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        {
          defval: "",
        }
      );

      if (!rows.length) {
        throw new Error("The spreadsheet appears to be empty.");
      }

      const parsedStudents = rows
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
            student.ncgId ||
            student.firstName ||
            student.lastName ||
            student.grade
        );

      if (!parsedStudents.length) {
        throw new Error(
          "No student records could be found in this spreadsheet."
        );
      }

      setStudents(parsedStudents);

      localStorage.setItem(
        `gradezy_students_${params.id}`,
        JSON.stringify(parsedStudents)
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the spreadsheet."
      );

      setStudents([]);
    } finally {
      setUploading(false);
    }
  }

  async function handleActualFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setActualError("");
    setUploadingActual(true);
    setActualFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        {
          defval: "",
        }
      );

      if (!rows.length) {
        throw new Error("The spreadsheet appears to be empty.");
      }

      const parsedStudents = rows
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
            student.ncgId ||
            student.firstName ||
            student.lastName ||
            student.grade
        );

      if (!parsedStudents.length) {
        throw new Error(
          "No student records could be found in this spreadsheet."
        );
      }

      setActualStudents(parsedStudents);

      localStorage.setItem(
        `gradezy_actual_students_${params.id}`,
        JSON.stringify(parsedStudents)
      );
    } catch (err) {
      console.error(err);

      setActualError(
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the spreadsheet."
      );

      setActualStudents([]);
    } finally {
      setUploadingActual(false);
    }
  }

  async function handleImportFromExtension() {
    setActualError("");
    setImportingFromExtension(true);

    try {
      const grades = await requestGradesFromExtension();

      if (!grades || grades.length === 0) {
        throw new Error(
          "No grades were extracted from the assessment system. Make sure you have the Gradezy extension installed and are on an assessment system page (Canvas, Moodle, etc.)."
        );
      }

      // Convert extension grade data to student format
      const parsedStudents = grades.map((grade) => ({
        ncgId: "", // Extension may not have NCG ID
        firstName: grade.name.split(" ")[0] || "",
        lastName: grade.name.split(" ").slice(1).join(" ") || "",
        grade: grade.grade.toString(),
      }));

      setActualStudents(parsedStudents);
      setActualFileName(`Imported from ${grades[0]?.source || "assessment system"}`);

      localStorage.setItem(
        `gradezy_actual_students_${params.id}`,
        JSON.stringify(parsedStudents)
      );
    } catch (err) {
      console.error(err);

      setActualError(
        err instanceof Error
          ? err.message
          : "Failed to import grades from the assessment system."
      );

      setActualStudents([]);
    } finally {
      setImportingFromExtension(false);
    }
  }

  if (!assessment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070b12] text-white">
        <p className="text-slate-500">Loading assessment...</p>
      </main>
    );
  }

  const studentsWithIds = students.filter((student) => student.ncgId);
  const studentsWithoutIds = students.filter((student) => !student.ncgId);
  const gradesPresent = students.filter((student) => student.grade !== "");

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-[#0a0f17] lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#070b12]">
              G
            </div>

            <span className="text-xl font-semibold tracking-tight">
              Gradezy
            </span>
          </div>

          <div className="border-b border-white/10 px-5 py-5">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-slate-500 transition hover:text-white"
            >
              ← Dashboard
            </button>

            <p className="mt-5 text-xs uppercase tracking-[0.15em] text-slate-600">
              Assessment
            </p>

            <p className="mt-2 font-semibold">{assessment.module}</p>

            <p className="mt-1 text-sm text-slate-500">{assessment.name}</p>
          </div>

          <nav className="flex-1 px-4 py-6">
            <WorkspaceNav active label="Overview" />
            <WorkspaceNav label="Students" />
            <WorkspaceNav label="Reconciliation" />
            <WorkspaceNav label="Issues" />
            <WorkspaceNav label="Readiness" />
          </nav>
        </div>
      </aside>

      {/* MAIN */}
      <div className="lg:pl-64">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-white/10 px-6 py-5 lg:px-10">
          <div>
            <p className="text-sm text-slate-500">
              {assessment.module} · {assessment.level} · {assessment.cohort}
            </p>

            <h1 className="mt-1 text-xl font-semibold">
              {assessment.name}
            </h1>
          </div>

          <div
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              students.length
                ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                : "border-white/10 bg-white/5 text-slate-500"
            }`}
          >
            {students.length ? "Needs review" : "Not ready"}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* HEADER */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">
              Assessment overview
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
              Assessment Health
            </h2>

            <p className="mt-3 max-w-2xl text-slate-500">
              Bring your assessment data into Gradezy to start checking
              completeness, consistency and exceptions.
            </p>
          </div>

          {/* HEALTH */}
          <section className="mt-10 rounded-3xl border border-white/10 bg-[#0d131d] p-7">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-slate-500">
                  Current assessment health
                </p>

                <p className="mt-2 text-5xl font-semibold">
                  {students.length ? "In progress" : "0%"}
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  {students.length
                    ? `${students.length.toLocaleString()} student records imported.`
                    : "No assessment data has been imported yet."}
                </p>
              </div>

              <div className="max-w-sm rounded-2xl border border-indigo-400/15 bg-indigo-400/5 p-5">
                <p className="text-sm font-medium text-indigo-300">
                  {students.length
                    ? "Data imported successfully"
                    : "Start with your Progress Tracker"}
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {students.length
                    ? "Gradezy is ready to reconcile these students against your assessment system."
                    : "Upload your Progress Tracker to begin reconciling students and assessment data."}
                </p>
              </div>
            </div>
          </section>

          {/* METRICS */}
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Students expected"
              value={
                students.length
                  ? students.length.toLocaleString()
                  : "—"
              }
            />

            <Metric
              label="Valid NCG IDs"
              value={
                students.length
                  ? studentsWithIds.length.toLocaleString()
                  : "—"
              }
            />

            <Metric
              label="Grades present"
              value={
                students.length
                  ? gradesPresent.length.toLocaleString()
                  : "—"
              }
            />

            <Metric
              label="Data issues"
              value={
                students.length
                  ? studentsWithoutIds.length.toLocaleString()
                  : "—"
              }
            />
          </section>

          {/* IMPORT */}
          {!students.length && (
            <section className="mt-10">
              <div className="mb-5">
                <h3 className="text-xl font-semibold">
                  Bring in your data
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Start with your Progress Tracker spreadsheet.
                </p>
              </div>

              <label className="group block cursor-pointer rounded-3xl border border-dashed border-white/15 bg-[#0d131d] p-10 text-center transition hover:border-indigo-400/40 hover:bg-white/[0.025]">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                  ↑
                </div>

                <h4 className="mt-6 text-lg font-semibold">
                  {uploading
                    ? "Reading spreadsheet..."
                    : "Upload your Progress Tracker"}
                </h4>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                  Drag and drop isn't required yet. Click here to select your
                  Excel file. Gradezy will automatically detect the student
                  information inside it.
                </p>

                <span className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#070b12]">
                  {uploading ? "Processing..." : "Choose Excel file"}
                </span>

                <p className="mt-4 text-xs text-slate-700">
                  XLSX, XLS or CSV
                </p>
              </label>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
                  {error}
                </div>
              )}
            </section>
          )}

          {/* IMPORTED DATA */}
          {students.length > 0 && (
            <section className="mt-10">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-300">
                    Imported data
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    Student records
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {fileName || "Progress Tracker"} ·{" "}
                    {students.length.toLocaleString()} records
                  </p>
                </div>

                <label className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  Replace file
                </label>
              </div>

              {/* WARNING */}
              {studentsWithoutIds.length > 0 && (
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
                  <p className="text-sm font-medium text-amber-300">
                    {studentsWithoutIds.length} student
                    {studentsWithoutIds.length === 1 ? "" : "s"} missing an
                    NCG ID
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    These records may not be possible to reconcile until an
                    NCG ID is available.
                  </p>
                </div>
              )}

              {/* TABLE */}
              <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#0d131d]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left">
                    <thead className="border-b border-white/10 bg-white/[0.02]">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          NCG ID
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          First name
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Last name
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Grade
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {students.slice(0, 100).map((student, index) => (
                        <tr
                          key={`${student.ncgId}-${index}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-6 py-4 text-sm font-medium">
                            {student.ncgId || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-400">
                            {student.firstName || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-400">
                            {student.lastName || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm">
                            {student.grade || (
                              <span className="text-slate-700">
                                Missing
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {student.ncgId ? (
                              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                                Valid
                              </span>
                            ) : (
                              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
                                Missing ID
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {students.length > 100 && (
                  <div className="border-t border-white/10 px-6 py-4 text-sm text-slate-600">
                    Showing first 100 of{" "}
                    {students.length.toLocaleString()} students.
                  </div>
                )}
              </div>

              {/* NEXT STEP */}
              <div className="mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-indigo-400/15 bg-indigo-400/[0.04] p-7 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold">
                    {actualStudents.length
                      ? "Ready for reconciliation"
                      : "Next: Upload assessment data"}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {actualStudents.length
                      ? "Both datasets are ready. Compare expected vs actual students."
                      : "Upload your StaffAdvantage or assessment system export to begin reconciliation."}
                  </p>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      `/assessments/${assessment.id}/reconciliation`
                    )
                  }
                  disabled={!actualStudents.length}
                  className={`rounded-full px-6 py-3 text-sm font-semibold transition ${
                    actualStudents.length
                      ? "bg-white text-[#070b12] hover:bg-slate-200"
                      : "cursor-not-allowed bg-white/10 text-slate-600"
                  }`}
                >
                  {actualStudents.length ? "Go to reconciliation →" : "Upload data first"}
                </button>
              </div>
            </section>
          )}

          {/* ACTUAL DATA UPLOAD */}
          {students.length > 0 && !actualStudents.length && (
            <section className="mt-10">
              <div className="mb-5">
                <h3 className="text-xl font-semibold">
                  Now bring in your assessment system data
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Upload an export from StaffAdvantage or your assessment system.
                </p>
              </div>

              <label className="group block cursor-pointer rounded-3xl border border-dashed border-white/15 bg-[#0d131d] p-10 text-center transition hover:border-indigo-400/40 hover:bg-white/[0.025]">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleActualFileUpload}
                  className="hidden"
                />

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                  ↑
                </div>

                <h4 className="mt-6 text-lg font-semibold">
                  {uploadingActual
                    ? "Reading spreadsheet..."
                    : "Upload your assessment system data"}
                </h4>

                <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
                  Upload an export from StaffAdvantage containing student records.
                  Gradezy will compare these against your expected students.
                </p>

                <span className="mt-6 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#070b12]">
                  {uploadingActual ? "Processing..." : "Choose Excel file"}
                </span>

                <p className="mt-4 text-xs text-slate-700">
                  XLSX, XLS or CSV
                </p>
              </label>

              {actualError && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-red-300">
                  {actualError}
                </div>
              )}

              {/* EXTENSION ALTERNATIVE */}
              {extensionAvailable && (
                <div className="mt-8">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs font-medium text-slate-500">OR</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <button
                    onClick={handleImportFromExtension}
                    disabled={importingFromExtension}
                    className="w-full rounded-2xl border border-indigo-400/30 bg-indigo-400/5 px-6 py-4 text-center transition hover:bg-indigo-400/10 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg">⚡</span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-indigo-300">
                          {importingFromExtension
                            ? "Extracting grades..."
                            : "Extract from assessment system"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Use Gradezy browser extension to auto-import grades
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ACTUAL DATA IMPORTED */}
          {actualStudents.length > 0 && (
            <section className="mt-10">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-300">
                    Assessment system data
                  </p>

                  <h3 className="mt-2 text-2xl font-semibold">
                    Student records from system
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {actualFileName || "Assessment system export"} ·{" "}
                    {actualStudents.length.toLocaleString()} records
                  </p>
                </div>

                <label className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleActualFileUpload}
                    className="hidden"
                  />

                  Replace file
                </label>
              </div>

              {/* TABLE */}
              <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#0d131d]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left">
                    <thead className="border-b border-white/10 bg-white/[0.02]">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          NCG ID
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          First name
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Last name
                        </th>

                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Grade
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {actualStudents.slice(0, 100).map((student, index) => (
                        <tr
                          key={`${student.ncgId}-${index}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-6 py-4 text-sm font-medium">
                            {student.ncgId || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-400">
                            {student.firstName || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-400">
                            {student.lastName || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm">
                            {student.grade || (
                              <span className="text-slate-700">
                                Missing
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {actualStudents.length > 100 && (
                  <div className="border-t border-white/10 px-6 py-4 text-sm text-slate-600">
                    Showing first 100 of{" "}
                    {actualStudents.length.toLocaleString()} students.
                  </div>
                )}
              </div>

              {/* READY FOR RECONCILIATION */}
              <div className="mt-6 flex flex-col justify-between gap-5 rounded-3xl border border-emerald-400/15 bg-emerald-400/[0.04] p-7 sm:flex-row sm:items-center">
                <div>
                  <p className="font-semibold">
                    Both datasets ready for reconciliation
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {students.length.toLocaleString()} expected students vs{" "}
                    {actualStudents.length.toLocaleString()} actual students.
                    Gradezy will compare and identify matches, missing, and
                    exceptions.
                  </p>
                </div>

                <button
                  onClick={() =>
                    router.push(
                      `/assessments/${assessment.id}/reconciliation`
                    )
                  }
                  className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Run reconciliation →
                </button>
              </div>
            </section>
          )}

          {/* WORKFLOW */}
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-600">
              Workflow
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-4">
              <WorkflowStep
                number="01"
                title="Import data"
                active={!students.length}
                complete={students.length > 0}
              />

              <WorkflowStep
                number="02"
                title="Reconcile"
                active={students.length > 0}
              />

              <WorkflowStep number="03" title="Review issues" />

              <WorkflowStep number="04" title="Check readiness" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function getValue(
  row: Record<string, unknown>,
  possibleNames: string[]
) {
  const normalizedKeys = Object.keys(row).reduce(
    (acc, key) => {
      acc[normalizeHeader(key)] = row[key];
      return acc;
    },
    {} as Record<string, unknown>
  );

  for (const name of possibleNames) {
    const value = normalizedKeys[normalizeHeader(name)];

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return "";
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value);
  }

  return String(value).trim().replace(/\.0$/, "");
}

function WorkspaceNav({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-500 hover:bg-white/5 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d131d] p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
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
    <div>
      <span
        className={`text-xs font-semibold ${
          complete
            ? "text-emerald-300"
            : active
              ? "text-indigo-300"
              : "text-slate-700"
        }`}
      >
        {complete ? "✓" : number}
      </span>

      <p
        className={`mt-3 text-sm font-medium ${
          complete || active ? "text-white" : "text-slate-600"
        }`}
      >
        {title}
      </p>
    </div>
  );
}
