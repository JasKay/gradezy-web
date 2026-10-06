"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import {
  isExtensionAvailable,
  requestStudentsFromExtension,
} from "@/lib/extension-communication";
import { getAssessments } from "@/lib/assessment-store";

import {
  reconcileStudents,
  type ActualStudent,
  type ExpectedStudent,
} from "@/lib/reconciliation";

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

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);

  const [assessment, setAssessment] = useState<Assessment | null>(null);

  const [students, setStudents] = useState<ExpectedStudent[]>([]);
  const [actualStudents, setActualStudents] = useState<ActualStudent[]>([]);

  const [expectedFileName, setExpectedFileName] = useState("");
  const [actualFileName, setActualFileName] = useState("");

  const [isUploadingExpected, setIsUploadingExpected] = useState(false);
  const [isUploadingActual, setIsUploadingActual] = useState(false);

  const [error, setError] = useState("");

  const [extensionAvailable, setExtensionAvailable] = useState(false);
  const [isImportingFromExtension, setIsImportingFromExtension] =
    useState(false);

  /*
   * Load the assessment selected by the URL.
   *
   * IMPORTANT:
   * We intentionally do NOT use `gradezy_current_assessment` here.
   * The URL `/assessments/[id]` is the source of truth.
   */
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const storedAssessments = getAssessments();

      const selectedAssessment = storedAssessments.find(
        (item) => String(item.id) === assessmentId,
      );

      if (selectedAssessment) {
        setAssessment(selectedAssessment as Assessment);
      } else {
        console.error(`Assessment with ID "${assessmentId}" was not found.`);
        setAssessment(null);
      }

      /*
       * Load expected students for this specific assessment.
       */
      const expectedRaw = localStorage.getItem(
        `gradezy_students_${assessmentId}`,
      );

      if (expectedRaw) {
        try {
          const parsedExpected = JSON.parse(expectedRaw) as ExpectedStudent[];

          setStudents(parsedExpected);
        } catch (err) {
          console.error("Failed to load expected students:", err);
        }
      } else {
        setStudents([]);
      }

      /*
       * Load actual students for this specific assessment.
       */
      const actualRaw = localStorage.getItem(
        `gradezy_actual_students_${assessmentId}`,
      );

      if (actualRaw) {
        try {
          const parsedActual = JSON.parse(actualRaw) as ActualStudent[];

          setActualStudents(parsedActual);
        } catch (err) {
          console.error("Failed to load actual students:", err);
        }
      } else {
        setActualStudents([]);
      }

      /*
       * Check whether the Gradezy browser extension is available.
       */
      setExtensionAvailable(isExtensionAvailable());
    });
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  /*
   * Handle expected student file upload.
   */
  const handleExpectedFileUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setIsUploadingExpected(true);
    setExpectedFileName(file.name);

    try {
      const text = await file.text();

      let parsedStudents: ExpectedStudent[] = [];

      /*
       * Try JSON first.
       */
      try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          parsedStudents = parsed as ExpectedStudent[];
        }
      } catch {
        /*
         * If it isn't JSON, try CSV.
         */
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 1) {
          const headers = lines[0]
            .split(",")
            .map((header) => header.trim().toLowerCase());

          const ncgIdIndex = headers.findIndex(
            (header) =>
              header === "ncg id" ||
              header === "ncgid" ||
              header === "student id" ||
              header === "studentid" ||
              header === "id",
          );

          const firstNameIndex = headers.findIndex(
            (header) =>
              header === "first name" ||
              header === "firstname" ||
              header === "forename",
          );

          const lastNameIndex = headers.findIndex(
            (header) =>
              header === "last name" ||
              header === "lastname" ||
              header === "surname",
          );

          if (ncgIdIndex === -1) {
            throw new Error("Could not find an NCG ID / Student ID column.");
          }

          parsedStudents = lines.slice(1).map((line) => {
            const values = line
              .split(",")
              .map((value) => value.trim().replace(/^"|"$/g, ""));

            return {
              grade: "",
              ncgId: values[ncgIdIndex] || "",
              firstName:
                firstNameIndex >= 0 ? values[firstNameIndex] || "" : "",
              lastName: lastNameIndex >= 0 ? values[lastNameIndex] || "" : "",
            };
          });
        }
      }

      if (!parsedStudents.length) {
        throw new Error("No students could be found in the uploaded file.");
      }

      localStorage.setItem(
        `gradezy_students_${assessmentId}`,
        JSON.stringify(parsedStudents),
      );

      setStudents(parsedStudents);
    } catch (err) {
      console.error("Failed to upload expected students:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to process the expected student file.",
      );
    } finally {
      setIsUploadingExpected(false);
    }
  };

  /*
   * Handle actual grades file upload.
   */
  const handleActualFileUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setIsUploadingActual(true);
    setActualFileName(file.name);

    try {
      const text = await file.text();

      let parsedStudents: ActualStudent[] = [];

      /*
       * Try JSON first.
       */
      try {
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          parsedStudents = parsed as ActualStudent[];
        }
      } catch {
        /*
         * If it isn't JSON, try CSV.
         */
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        if (lines.length > 1) {
          const headers = lines[0]
            .split(",")
            .map((header) => header.trim().toLowerCase());

          const ncgIdIndex = headers.findIndex(
            (header) =>
              header === "ncg id" ||
              header === "ncgid" ||
              header === "student id" ||
              header === "studentid" ||
              header === "id",
          );

          const firstNameIndex = headers.findIndex(
            (header) =>
              header === "first name" ||
              header === "firstname" ||
              header === "forename",
          );

          const lastNameIndex = headers.findIndex(
            (header) =>
              header === "last name" ||
              header === "lastname" ||
              header === "surname",
          );

          const gradeIndex = headers.findIndex(
            (header) =>
              header === "grade" ||
              header === "final grade" ||
              header === "finalgrade" ||
              header === "mark" ||
              header === "score",
          );

          if (ncgIdIndex === -1) {
            throw new Error("Could not find an NCG ID / Student ID column.");
          }

          parsedStudents = lines.slice(1).map((line) => {
            const values = line
              .split(",")
              .map((value) => value.trim().replace(/^"|"$/g, ""));

            return {
              ncgId: values[ncgIdIndex] || "",
              firstName:
                firstNameIndex >= 0 ? values[firstNameIndex] || "" : "",
              lastName: lastNameIndex >= 0 ? values[lastNameIndex] || "" : "",
              grade: gradeIndex >= 0 ? values[gradeIndex] || "" : "",
            } as ActualStudent;
          });
        }
      }

      if (!parsedStudents.length) {
        throw new Error("No grades could be found in the uploaded file.");
      }

      localStorage.setItem(
        `gradezy_actual_students_${assessmentId}`,
        JSON.stringify(parsedStudents),
      );

      setActualStudents(parsedStudents);
    } catch (err) {
      console.error("Failed to upload actual grades:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to process the grades file.",
      );
    } finally {
      setIsUploadingActual(false);
    }
  };

  /*
   * Import grades from the Gradezy browser extension.
   */
  const handleExtensionImport = async () => {
    setError("");
    setIsImportingFromExtension(true);

    try {
      const importedStudents = await requestStudentsFromExtension();

      if (!importedStudents || !importedStudents.length) {
        throw new Error("The Gradezy extension did not return any students.");
      }

      localStorage.setItem(
        `gradezy_actual_students_${assessmentId}`,
        JSON.stringify(importedStudents),
      );

      setActualStudents(importedStudents);
    } catch (err) {
      console.error("Failed to import from extension:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to import grades from the extension.",
      );
    } finally {
      setIsImportingFromExtension(false);
    }
  };

  /*
   * Run reconciliation.
   */
  const handleRunReconciliation = () => {
    if (!assessment) return;

    router.push(`/assessments/${assessment.id}/reconciliation`);
  };

  /*
   * Assessment not found.
   */
  if (!assessment) {
    return (
      <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
        <AppSidebar />

        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 text-slate-500"
              >
                <path
                  d="M12 8v4m0 4h.01M10.29 3.86l-8.18 14A2 2 0 003.84 21h16.32a2 2 0 001.73-3.14l-8.18-14a2 2 0 00-3.42 0z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h1 className="text-lg font-semibold text-slate-900">
              Assessment not found
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              We couldn&apos;t find the assessment associated with this link.
            </p>

            <button
              type="button"
              onClick={() => router.push("/assessments")}
              className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Back to assessments
            </button>
          </div>
        </div>
      </main>
    );
  }

  const reconciliation =
    students.length || actualStudents.length
      ? reconcileStudents(students, actualStudents)
      : null;

  const matchedCount =
    reconciliation?.filter((r) => r.status === "matched").length ?? 0;
  const issueCount =
    reconciliation?.filter((r) => r.status !== "matched").length ?? 0;

  return (
    <main className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <AppSidebar
        assessment={{
          id: assessment.id,
          name: assessment.name,
          module: assessment.module,
        }}
      />

      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <button
                    type="button"
                    onClick={() => router.push("/assessments")}
                    className="transition hover:text-indigo-600"
                  >
                    Assessments
                  </button>

                  <span>/</span>

                  <span className="text-slate-700">{assessment.name}</span>
                </div>

                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {assessment.name}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  {assessment.module} · Level {assessment.level} ·{" "}
                  {assessment.cohort}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRunReconciliation}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                >
                  Run reconciliation
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Assessment information */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Module
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {assessment.module}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Level
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                Level {assessment.level}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Cohort
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {assessment.cohort}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Assessment type
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {assessment.assessmentType}
              </p>
            </div>
          </section>

          {/* Data import */}
          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            {/* Expected data */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Expected student data
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Upload the expected student list for this assessment.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {students.length} students
                </div>
              </div>

              <div className="mt-5">
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleExpectedFileUpload}
                    className="hidden"
                  />

                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {isUploadingExpected
                        ? "Processing..."
                        : "Choose expected student file"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">CSV or JSON</p>
                  </div>
                </label>
              </div>

              {expectedFileName && (
                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {expectedFileName}
                </div>
              )}
            </div>

            {/* Actual grades */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Actual grades
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Import the grades currently recorded for this assessment.
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                  {actualStudents.length} students
                </div>
              </div>

              <div className="mt-5">
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                  <input
                    type="file"
                    accept=".csv,.json,.txt"
                    onChange={handleActualFileUpload}
                    className="hidden"
                  />

                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {isUploadingActual
                        ? "Processing..."
                        : "Choose grades file"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">CSV or JSON</p>
                  </div>
                </label>
              </div>

              {actualFileName && (
                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {actualFileName}
                </div>
              )}

              {extensionAvailable && (
                <button
                  type="button"
                  onClick={handleExtensionImport}
                  disabled={isImportingFromExtension}
                  className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImportingFromExtension
                    ? "Importing from extension..."
                    : "Import grades from Gradezy extension"}
                </button>
              )}
            </div>
          </section>

          {/* Reconciliation summary */}
          <section className="mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Reconciliation
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Compare expected students with the grades currently
                    recorded.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunReconciliation}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Open reconciliation →
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Expected
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {students.length}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Matched
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {matchedCount}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Issues
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {issueCount}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Student data */}
          <section>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Students
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Students associated with this assessment.
                </p>
              </div>

              {students.length === 0 && actualStudents.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No student data yet
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    Upload expected students or import grades to begin.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Student
                        </th>

                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          NCG ID
                        </th>

                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Grade
                        </th>

                        <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {students.map((student) => {
                        const actualStudent = actualStudents.find(
                          (actual) =>
                            String(actual.ncgId).trim() ===
                            String(student.ncgId).trim(),
                        );

                        const grade = actualStudent?.grade;

                        return (
                          <tr
                            key={String(student.ncgId)}
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">
                                {student.firstName} {student.lastName}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-sm text-slate-500">
                              {student.ncgId}
                            </td>

                            <td className="px-6 py-4 text-sm font-medium text-slate-700">
                              {grade !== undefined &&
                              grade !== null &&
                              String(grade).trim() !== ""
                                ? String(grade)
                                : "—"}
                            </td>

                            <td className="px-6 py-4">
                              {grade !== undefined &&
                              grade !== null &&
                              String(grade).trim() !== "" ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                  Recorded
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                  Missing
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
