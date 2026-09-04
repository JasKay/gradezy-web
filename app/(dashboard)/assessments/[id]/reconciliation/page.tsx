"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";

import {
  calculateSummary,
  reconcileStudents,
  type ActualStudent,
  type ExpectedStudent,
  type ReconciliationResult,
} from "@/lib/reconciliation";

import {
  generateIssuesFromReconciliation,
  type Issue,
} from "@/lib/issues";

import {
  pingExtension,
  requestStudentsFromExtension,
} from "@/lib/extension-communication";

import { AppSidebar } from "@/components/app-sidebar";

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

type EntryMethod = "upload" | "extension" | "api" | "manual";

type FilterType =
  | "all"
  | "matched"
  | "missing"
  | "name_mismatch"
  | "grade_mismatch"
  | "unexpected";

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function normalizeValue(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function getValue(
  row: Record<string, unknown>,
  headers: string[]
): string {
  const normalizedEntries = Object.entries(row).map(
    ([key, value]) => ({
      key: normalizeHeader(key),
      value,
    })
  );

  for (const header of headers) {
    const normalizedHeader = normalizeHeader(header);

    const found = normalizedEntries.find(
      (entry) => entry.key === normalizedHeader
    );

    if (found) {
      return normalizeValue(found.value);
    }
  }

  return "";
}

function normalizeGrade(value: unknown): string {
  const raw = normalizeValue(value);

  if (!raw) {
    return "";
  }

  const numeric = Number(
    raw.replace("%", "").replace(",", "")
  );

  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  return raw.toLowerCase();
}

function gradesMatch(
  expectedGrade: string,
  actualGrade: string
): boolean {
  const expected = normalizeGrade(expectedGrade);
  const actual = normalizeGrade(actualGrade);

  if (!expected || !actual) {
    return false;
  }

  if (expected === actual) {
    return true;
  }

  const expectedNumber = Number(expected);
  const actualNumber = Number(actual);

  if (
    Number.isFinite(expectedNumber) &&
    Number.isFinite(actualNumber)
  ) {
    return Math.abs(expectedNumber - actualNumber) < 0.01;
  }

  return false;
}

function getStatusLabel(
  status: ReconciliationResult["status"]
): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "missing":
      return "Missing";
    case "name_mismatch":
      return "Name mismatch";
    case "grade_mismatch":
      return "Grade mismatch";
    case "unexpected":
      return "Unexpected";
    default:
      return status;
  }
}

function getStatusClasses(
  status: ReconciliationResult["status"]
): string {
  switch (status) {
    case "matched":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "missing":
      return "border-red-200 bg-red-50 text-red-700";

    case "name_mismatch":
    case "grade_mismatch":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "unexpected":
      return "border-slate-200 bg-slate-50 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function ReconciliationPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);

  const [assessment, setAssessment] =
    useState<Assessment | null>(null);

  const [expectedStudents, setExpectedStudents] =
    useState<Student[]>([]);

  const [actualStudents, setActualStudents] =
    useState<ActualStudent[]>([]);

  const [selectedMethod, setSelectedMethod] =
    useState<EntryMethod | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [extensionState, setExtensionState] =
    useState<
      "checking" | "connected" | "not-installed"
    >("checking");

  const [extensionVersion, setExtensionVersion] =
    useState<string | null>(null);

  const [error, setError] = useState("");

  const [reconciliationResults, setReconciliationResults] =
    useState<ReconciliationResult[]>([]);

  const [filter, setFilter] =
    useState<FilterType>("all");

  const [manualRows, setManualRows] = useState<Student[]>([
    {
      ncgId: "",
      firstName: "",
      lastName: "",
      grade: "",
    },
  ]);

  /*
   * Load assessment and expected students.
   */
  useEffect(() => {
    try {
      const storedAssessment =
        localStorage.getItem(
          "gradezy_current_assessment"
        );

      if (!storedAssessment) {
        router.push("/assessments");
        return;
      }

      const parsedAssessment =
        JSON.parse(storedAssessment) as Assessment;

      if (parsedAssessment.id !== assessmentId) {
        router.push("/assessments");
        return;
      }

      setAssessment(parsedAssessment);

      const storedStudents =
        localStorage.getItem(
          `gradezy_students_${assessmentId}`
        );

      if (storedStudents) {
        const parsedStudents =
          JSON.parse(storedStudents) as Student[];

        setExpectedStudents(parsedStudents);
      }
    } catch {
      setError(
        "Could not load this assessment."
      );
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId, router]);

  /*
   * Restore actual students already imported for this assessment.
   */
  useEffect(() => {
    if (!assessmentId) {
      return;
    }

    try {
      const storedActualStudents =
        localStorage.getItem(
          `gradezy_actual_students_${assessmentId}`
        );

      if (!storedActualStudents) {
        return;
      }

      const parsedActualStudents =
        JSON.parse(
          storedActualStudents
        ) as ActualStudent[];

      if (!parsedActualStudents.length) {
        return;
      }

      setActualStudents(parsedActualStudents);

      if (expectedStudents.length) {
        const results = reconcileStudents(
          expectedStudents as ExpectedStudent[],
          parsedActualStudents
        );

        setReconciliationResults(results);
      }
    } catch {
      // Ignore malformed saved data.
    }
  }, [assessmentId, expectedStudents]);

  /*
   * Check whether the actual Gradezy extension responds.
   *
   * We also re-check whenever the user comes back to this tab.
   * This makes the install flow much smoother:
   *
   * Gradezy → Get Extension → install → return to Gradezy
   * → Gradezy detects the extension automatically.
   */
  useEffect(() => {
    let active = true;

    const checkExtension = async () => {
      if (!active) {
        return;
      }

      setExtensionState("checking");

      const result = await pingExtension();

      if (!active) {
        return;
      }

      if (result.available) {
        setExtensionState("connected");
        setExtensionVersion(
          result.version ?? null
        );
      } else {
        setExtensionState("not-installed");
        setExtensionVersion(null);
      }
    };

    void checkExtension();

    const handleFocus = () => {
      void checkExtension();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkExtension();
      }
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      active = false;

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  /*
   * Run reconciliation and persist the imported data.
   */
  const runReconciliation = (
    students: ActualStudent[]
  ) => {
    const results = reconcileStudents(
      expectedStudents as ExpectedStudent[],
      students
    );

    setActualStudents(students);
    setReconciliationResults(results);
    setFilter("all");

    localStorage.setItem(
      `gradezy_actual_students_${assessmentId}`,
      JSON.stringify(students)
    );
  };

  /*
   * Upload expected/actual data.
   */
  const handleFileUpload = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const firstSheetName =
        workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error(
          "The uploaded file does not contain a worksheet."
        );
      }

      const worksheet =
        workbook.Sheets[firstSheetName];

      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          defval: "",
        });

      if (!rows.length) {
        throw new Error(
          "No student records were found in the uploaded file."
        );
      }

      const students: Student[] = rows
        .map((row) => ({
          ncgId: getValue(row, [
            "NCG ID",
            "NCG_ID",
            "NCGID",
            "NCG-ID",
          ]),

          firstName: getValue(row, [
            "First Name",
            "FirstName",
            "Forename",
            "Given Name",
            "GivenName",
          ]),

          lastName: getValue(row, [
            "Last Name",
            "LastName",
            "Surname",
            "Family Name",
            "FamilyName",
          ]),

          grade: getValue(row, [
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
          ]),
        }))
        .filter(
          (student) =>
            student.ncgId ||
            student.firstName ||
            student.lastName
        );

      if (!students.length) {
        throw new Error(
          "The uploaded file does not contain recognisable student records."
        );
      }

      runReconciliation(students);

      setSelectedMethod("upload");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not process the uploaded file."
      );
    } finally {
      setIsProcessing(false);

      event.target.value = "";
    }
  };

  /*
   * Import directly from StaffAdvantage through the extension.
   */
  const handleExtensionImport = async () => {
    if (extensionState !== "connected") {
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const students =
        await requestStudentsFromExtension();

      if (!students.length) {
        throw new Error(
          "No student records were found. Open the StaffAdvantage assessment in another browser tab and try again."
        );
      }

      runReconciliation(students);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import records from StaffAdvantage."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /*
   * Manually add a student row.
   */
  const addManualRow = () => {
    setManualRows((rows) => [
      ...rows,
      {
        ncgId: "",
        firstName: "",
        lastName: "",
        grade: "",
      },
    ]);
  };

  /*
   * Update a manual student row.
   */
  const updateManualRow = (
    index: number,
    field: keyof Student,
    value: string
  ) => {
    setManualRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  /*
   * Remove a manual row.
   */
  const removeManualRow = (index: number) => {
    setManualRows((rows) => {
      if (rows.length === 1) {
        return [
          {
            ncgId: "",
            firstName: "",
            lastName: "",
            grade: "",
          },
        ];
      }

      return rows.filter(
        (_, rowIndex) => rowIndex !== index
      );
    });
  };

  /*
   * Run manual reconciliation.
   */
  const handleManualReconciliation = () => {
    const validRows = manualRows.filter(
      (student) =>
        student.ncgId ||
        student.firstName ||
        student.lastName ||
        student.grade
    );

    if (!validRows.length) {
      setError(
        "Add at least one student before running reconciliation."
      );
      return;
    }

    setError("");
    runReconciliation(validRows);
  };

  /*
   * Clear the current imported dataset.
   */
  const handleImportDifferentData = () => {
    setActualStudents([]);
    setReconciliationResults([]);
    setFilter("all");
    setSelectedMethod(null);
    setError("");

    localStorage.removeItem(
      `gradezy_actual_students_${assessmentId}`
    );
  };

  /*
   * Summary metrics.
   */
  const summary = useMemo(() => {
    if (!reconciliationResults.length) {
      return null;
    }

    return calculateSummary(
      reconciliationResults
    );
  }, [reconciliationResults]);

  /*
   * Generated issues.
   */
  const issues = useMemo<Issue[]>(() => {
    if (!reconciliationResults.length) {
      return [];
    }

    return generateIssuesFromReconciliation(
      reconciliationResults
    );
  }, [reconciliationResults]);

  /*
   * Filter results.
   */
  const filteredResults = useMemo(() => {
    if (filter === "all") {
      return reconciliationResults;
    }

    return reconciliationResults.filter(
      (result) => result.status === filter
    );
  }, [filter, reconciliationResults]);

  const issueCount = issues.length;

  const hasResults =
    reconciliationResults.length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white text-slate-950">
        <AppSidebar />

        <main className="lg:pl-64">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
              Loading reconciliation...
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!assessment) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <AppSidebar
        assessment={{
          id: assessment.id,
          name: assessment.name,
          module: assessment.module,
        }}
      />

      <main className="lg:pl-64">
        {/* Header */}
        <header className="min-h-20 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/assessments/${assessment.id}`
                    )
                  }
                  className="transition hover:text-slate-950"
                >
                  {assessment.name}
                </button>

                <span>/</span>

                <span className="text-slate-500">
                  Reconciliation
                </span>
              </div>

              <h1 className="truncate text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-3xl">
                Reconciliation
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Compare expected students with submitted
                assessment records.
              </p>
            </div>

            {hasResults && (
              <button
                type="button"
                onClick={handleImportDifferentData}
                className="hidden shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:block"
              >
                Import different data
              </button>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {/* Assessment context */}
          <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Assessment
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {assessment.name}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Module
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {assessment.module}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Level
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {assessment.level}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Cohort
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {assessment.cohort}
                </p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-red-900">
                  Something went wrong
                </p>

                <p className="mt-1 text-sm text-red-700">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!hasResults ? (
            <>
              {/* Intro */}
              <div className="mb-8 max-w-2xl">
                <p className="text-sm font-semibold text-indigo-600">
                  Step 1
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  Bring in the assessment records
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Choose how you want Gradezy to receive the
                  student records. Once imported, Gradezy will
                  automatically compare them with the expected
                  student list.
                </p>
              </div>

              {/* Data source cards */}
              <div className="grid gap-5 md:grid-cols-2">
                {/* Upload */}
                <div
                  className={`rounded-3xl border p-6 shadow-sm transition ${
                    selectedMethod === "upload"
                      ? "border-indigo-200 bg-indigo-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      ↑
                    </div>

                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      File
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Upload assessment data
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Upload an Excel or CSV file containing
                    student IDs, names and grades.
                  </p>

                  <label className="mt-6 flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                    {isProcessing
                      ? "Processing..."
                      : "Choose file"}

                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Extension */}
                <div
                  onClick={() =>
                    setSelectedMethod("extension")
                  }
                  className={`cursor-pointer rounded-3xl border p-6 shadow-sm transition ${
                    selectedMethod === "extension"
                      ? "border-indigo-200 bg-indigo-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      ◉
                    </div>

                    {extensionState ===
                    "connected" ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Connected
                      </span>
                    ) : (
                      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        Extension
                      </span>
                    )}
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Connect with Gradezy Extension
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Read student records directly from the
                    assessment system currently open in your
                    browser.
                  </p>

                  {selectedMethod === "extension" && (
                    <div
                      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      {/* Checking */}
                      {extensionState ===
                        "checking" && (
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              Checking for Gradezy
                              Extension
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              Gradezy is checking whether
                              the browser extension is
                              installed and connected.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Connected */}
                      {extensionState ===
                        "connected" && (
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                                ✓
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  Gradezy Extension
                                  connected
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  Your browser extension
                                  is ready to import
                                  assessment records.
                                </p>

                                {extensionVersion && (
                                  <p className="mt-1 text-[11px] text-slate-400">
                                    Version{" "}
                                    {
                                      extensionVersion
                                    }
                                  </p>
                                )}
                              </div>
                            </div>

                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Ready
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={
                              handleExtensionImport
                            }
                            disabled={isProcessing}
                            className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isProcessing
                              ? "Importing from StaffAdvantage..."
                              : "Import from StaffAdvantage"}
                          </button>

                          <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
                            Keep the StaffAdvantage
                            assessment open in another
                            browser tab.
                          </p>
                        </div>
                      )}

                      {/* Not installed */}
                      {extensionState ===
                        "not-installed" && (
                        <div>
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-500">
                              ↓
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                Get the Gradezy Extension
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Install the Gradezy browser
                                extension to import
                                assessment records directly
                                from StaffAdvantage.
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                            <a
                              href="https://microsoftedge.microsoft.com/addons/detail/staffadvantage-grade-fill/iocfhndobdbbiemehcnpfnippohngocn"
                              target="_blank"
                              rel="noreferrer"
                              className="flex flex-1 items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              Get Gradezy Extension
                            </a>

                            <button
                              type="button"
                              onClick={async () => {
                                setExtensionState(
                                  "checking"
                                );

                                const result =
                                  await pingExtension();

                                if (
                                  result.available
                                ) {
                                  setExtensionState(
                                    "connected"
                                  );

                                  setExtensionVersion(
                                    result.version ??
                                      null
                                  );
                                } else {
                                  setExtensionState(
                                    "not-installed"
                                  );
                                }
                              }}
                              className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Check again
                            </button>
                          </div>

                          <p className="mt-3 text-[11px] leading-5 text-slate-400">
                            Already installed? Click
                            “Check again” and Gradezy will
                            reconnect automatically.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* API */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 opacity-80 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      ↔
                    </div>

                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                      Coming soon
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Connect via API
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Connect Gradezy directly to supported
                    assessment systems using an API.
                  </p>

                  <button
                    type="button"
                    disabled
                    className="mt-6 flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                  >
                    Coming soon
                  </button>
                </div>

                {/* Manual */}
                <div
                  onClick={() =>
                    setSelectedMethod("manual")
                  }
                  className={`cursor-pointer rounded-3xl border p-6 shadow-sm transition ${
                    selectedMethod === "manual"
                      ? "border-indigo-200 bg-indigo-50/40"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg">
                      +
                    </div>

                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      Manual
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Enter records manually
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add student records directly when you only
                    have a small number of records to reconcile.
                  </p>

                  {selectedMethod === "manual" && (
                    <div
                      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] text-left">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="pb-3 pr-3 text-xs font-semibold text-slate-500">
                                NCG ID
                              </th>

                              <th className="pb-3 pr-3 text-xs font-semibold text-slate-500">
                                First name
                              </th>

                              <th className="pb-3 pr-3 text-xs font-semibold text-slate-500">
                                Last name
                              </th>

                              <th className="pb-3 pr-3 text-xs font-semibold text-slate-500">
                                Grade
                              </th>

                              <th className="pb-3 text-xs font-semibold text-slate-500">
                                Action
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {manualRows.map(
                              (row, index) => (
                                <tr
                                  key={index}
                                  className="border-b border-slate-200 last:border-0"
                                >
                                  <td className="py-3 pr-3">
                                    <input
                                      value={row.ncgId}
                                      onChange={(event) =>
                                        updateManualRow(
                                          index,
                                          "ncgId",
                                          event.target
                                            .value
                                        )
                                      }
                                      placeholder="NCG12345"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                                    />
                                  </td>

                                  <td className="py-3 pr-3">
                                    <input
                                      value={
                                        row.firstName
                                      }
                                      onChange={(event) =>
                                        updateManualRow(
                                          index,
                                          "firstName",
                                          event.target
                                            .value
                                        )
                                      }
                                      placeholder="First name"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                                    />
                                  </td>

                                  <td className="py-3 pr-3">
                                    <input
                                      value={
                                        row.lastName
                                      }
                                      onChange={(event) =>
                                        updateManualRow(
                                          index,
                                          "lastName",
                                          event.target
                                            .value
                                        )
                                      }
                                      placeholder="Last name"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                                    />
                                  </td>

                                  <td className="py-3 pr-3">
                                    <input
                                      value={row.grade}
                                      onChange={(event) =>
                                        updateManualRow(
                                          index,
                                          "grade",
                                          event.target
                                            .value
                                        )
                                      }
                                      placeholder="Grade"
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                                    />
                                  </td>

                                  <td className="py-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeManualRow(
                                          index
                                        )
                                      }
                                      className="text-xs font-medium text-slate-500 transition hover:text-red-600"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={addManualRow}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          + Add student
                        </button>

                        <button
                          type="button"
                          onClick={
                            handleManualReconciliation
                          }
                          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Run reconciliation
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Expected student count */}
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Expected students
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Students currently loaded for this
                      assessment.
                    </p>
                  </div>

                  <span className="text-2xl font-semibold tracking-tight text-slate-950">
                    {expectedStudents.length}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Results header */}
              <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-semibold text-indigo-600">
                    Step 2
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    Reconciliation results
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Gradezy compared {expectedStudents.length}{" "}
                    expected students with{" "}
                    {actualStudents.length} imported records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleImportDifferentData}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:hidden"
                >
                  Import different data
                </button>
              </div>

              {/* Summary */}
              {summary && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <SummaryCard
                    label="Total expected"
                    value={summary.totalExpected}
                  />

                  <SummaryCard
                    label="Matched"
                    value={summary.matched}
                    tone="success"
                  />

                  <SummaryCard
                    label="Missing"
                    value={summary.missing}
                    tone="danger"
                  />

                  <SummaryCard
                    label="Name mismatches"
                    value={summary.nameMismatches}
                    tone="warning"
                  />

                  <SummaryCard
                    label="Grade mismatches"
                    value={summary.gradeMismatches}
                    tone="warning"
                  />
                </div>
              )}

              {/* Issues banner */}
              {issueCount > 0 && (
                <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                      !
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        {issueCount} issue
                        {issueCount === 1
                          ? ""
                          : "s"} need review
                      </p>

                      <p className="mt-1 text-xs leading-5 text-amber-700">
                        Review the reconciliation issues before
                        marking this assessment ready.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/assessments/${assessment.id}/issues`
                      )
                    }
                    className="shrink-0 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Review issues
                  </button>
                </div>
              )}

              {/* Filters */}
              <div className="mt-8 rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        Student reconciliation
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Review how each imported record compares
                        with the expected list.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["all", "All"],
                          ["matched", "Matched"],
                          ["missing", "Missing"],
                          [
                            "name_mismatch",
                            "Name mismatch",
                          ],
                          [
                            "grade_mismatch",
                            "Grade mismatch",
                          ],
                          [
                            "unexpected",
                            "Unexpected",
                          ],
                        ] as [FilterType, string][]
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setFilter(value)
                          }
                          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            filter === value
                              ? "bg-slate-950 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Student
                        </th>

                        <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          NCG ID
                        </th>

                        <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Expected
                        </th>

                        <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Actual
                        </th>

                        <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredResults.map(
                        (result, index) => {
                          const studentName =
                            result.expected
                              ? `${result.expected.firstName} ${result.expected.lastName}`.trim()
                              : result.actual
                                ? `${result.actual.firstName} ${result.actual.lastName}`.trim()
                                : "Unknown student";

                          return (
                            <tr
                              key={`${result.expected?.ncgId ?? result.actual?.ncgId ?? "row"}-${index}`}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <td className="px-6 py-4">
                                <p className="text-sm font-medium text-slate-950">
                                  {studentName ||
                                    "Unnamed student"}
                                </p>

                                {result.status ===
                                  "name_mismatch" &&
                                  result.expected &&
                                  result.actual && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      Imported as{" "}
                                      {result.actual.firstName}{" "}
                                      {
                                        result.actual
                                          .lastName
                                      }
                                    </p>
                                  )}
                              </td>

                              <td className="px-6 py-4">
                                <span className="font-mono text-xs text-slate-600">
                                  {result.expected
                                    ?.ncgId ??
                                    result.actual
                                      ?.ncgId ??
                                    "—"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-700">
                                  {result.expected
                                    ?.grade || "—"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-sm text-slate-700">
                                  {result.actual?.grade ||
                                    "—"}
                                </span>
                              </td>

                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                    result.status
                                  )}`}
                                >
                                  {getStatusLabel(
                                    result.status
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        }
                      )}

                      {!filteredResults.length && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-12 text-center"
                          >
                            <p className="text-sm font-medium text-slate-700">
                              No students match this filter.
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Try another reconciliation filter.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table footer */}
                <div className="border-t border-slate-200 px-6 py-4">
                  <p className="text-xs text-slate-400">
                    Showing {filteredResults.length} of{" "}
                    {reconciliationResults.length}{" "}
                    reconciliation records
                  </p>
                </div>
              </div>

              {/* Missing data alert */}
              {summary &&
                summary.missing > 0 && (
                  <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-700">
                        !
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-red-900">
                          {summary.missing} student
                          {summary.missing === 1
                            ? ""
                            : "s"} missing from the
                          imported records
                        </p>

                        <p className="mt-1 text-sm leading-6 text-red-700">
                          These students appear on the expected
                          list but were not found in the imported
                          assessment data.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Next steps */}
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm">
                    ✓
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Review issues
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Investigate missing students, mismatched
                    names, grades and unexpected records.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/assessments/${assessment.id}/issues`
                      )
                    }
                    className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Open issues
                  </button>
                </div>

                <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sm shadow-sm">
                    →
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Check assessment readiness
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Once reconciliation is complete, review the
                    remaining checks before publishing.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/assessments/${assessment.id}/readiness`
                      )
                    }
                    className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Review readiness
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    default:
      "border-slate-200 bg-white text-slate-950",
    success:
      "border-emerald-200 bg-emerald-50/60 text-emerald-800",
    warning:
      "border-amber-200 bg-amber-50/60 text-amber-800",
    danger:
      "border-red-200 bg-red-50/60 text-red-800",
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}
    >
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}