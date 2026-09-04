"use client";

import { useEffect, useMemo, useState } from "react";
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

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeValue(value: unknown) {
  return String(value ?? "").trim();
}

function getValue(
  row: Record<string, unknown>,
  headers: string[],
) {
  const entry = Object.entries(row).find(([key]) =>
    headers.includes(normalizeHeader(key)),
  );

  return entry ? entry[1] : "";
}

function normalizeGrade(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/%/g, "")
    .replace(",", ".");
}

function gradesMatch(expected: string, actual: string) {
  const expectedNumber = Number(normalizeGrade(expected));
  const actualNumber = Number(normalizeGrade(actual));

  if (
    Number.isFinite(expectedNumber) &&
    Number.isFinite(actualNumber)
  ) {
    return expectedNumber === actualNumber;
  }

  return (
    normalizeGrade(expected).toLowerCase() ===
    normalizeGrade(actual).toLowerCase()
  );
}

function getStatusLabel(result: ReconciliationResult) {
  switch (result.status) {
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
      return result.status;
  }
}

function getStatusClasses(result: ReconciliationResult) {
  switch (result.status) {
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
  const [isProcessing, setIsProcessing] = useState(false);

  const [extensionState, setExtensionState] = useState<
    "checking" | "connected" | "not-installed"
  >("checking");

  const [extensionVersion, setExtensionVersion] =
    useState<string | undefined>();

  const [error, setError] = useState("");

  const [reconciliationResults, setReconciliationResults] =
    useState<ReconciliationResult[]>([]);

  const [filter, setFilter] = useState<FilterType>("all");

  const [manualRows, setManualRows] = useState<Student[]>([
    {
      ncgId: "",
      firstName: "",
      lastName: "",
      grade: "",
    },
  ]);

  const checkExtension = async () => {
    setExtensionState("checking");

    try {
      const result = await pingExtension();

      if (result.available) {
        setExtensionState("connected");
        setExtensionVersion(result.version);
      } else {
        setExtensionState("not-installed");
        setExtensionVersion(undefined);
      }
    } catch {
      setExtensionState("not-installed");
      setExtensionVersion(undefined);
    }
  };

  useEffect(() => {
    const loadAssessment = () => {
      try {
        const storedAssessment =
          localStorage.getItem("gradezy_current_assessment");

        if (storedAssessment) {
          const parsed = JSON.parse(storedAssessment);

          if (parsed?.id === assessmentId) {
            setAssessment(parsed);
          }
        }

        const storedStudents = localStorage.getItem(
          `gradezy_students_${assessmentId}`,
        );

        if (storedStudents) {
          setExpectedStudents(JSON.parse(storedStudents));
        }

        const storedActualStudents = localStorage.getItem(
          `gradezy_actual_students_${assessmentId}`,
        );

        if (storedActualStudents) {
          const parsedActual = JSON.parse(
            storedActualStudents,
          );

          setActualStudents(parsedActual);

          if (storedStudents) {
            const expected = JSON.parse(storedStudents);

            const results = reconcileStudents(
              expected as ExpectedStudent[],
              parsedActual,
            );

            setReconciliationResults(results);
          }
        }
      } catch {
        setError("Could not load assessment data.");
      } finally {
        setIsLoading(false);
      }
    };

    loadAssessment();
    checkExtension();
  }, [assessmentId]);

  useEffect(() => {
    const handleFocus = () => {
      checkExtension();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkExtension();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  const runReconciliation = (
    students: ActualStudent[],
  ) => {
    if (!expectedStudents.length) {
      setError(
        "No expected student list was found for this assessment.",
      );
      return;
    }

    const results = reconcileStudents(
      expectedStudents as ExpectedStudent[],
      students,
    );

    setActualStudents(students);
    setReconciliationResults(results);
    setFilter("all");

    localStorage.setItem(
      `gradezy_actual_students_${assessmentId}`,
      JSON.stringify(students),
    );
  };

  const handleExtensionImport = async () => {
    setIsProcessing(true);
    setError("");

    try {
      const students = await requestStudentsFromExtension();

      if (!students.length) {
        throw new Error(
          "No student records were found. Open the StaffAdvantage assessment in another tab and try again.",
        );
      }

      runReconciliation(students);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Could not import records from StaffAdvantage.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsProcessing(true);
    setError("");
    setSelectedMethod("upload");

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const firstSheet = workbook.Sheets[
        workbook.SheetNames[0]
      ];

      if (!firstSheet) {
        throw new Error("The uploaded file does not contain any data.");
      }

      const rows = XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(firstSheet, {
        defval: "",
      });

      if (!rows.length) {
        throw new Error("The uploaded file contains no student records.");
      }

      const students: Student[] = rows
        .map((row) => ({
          ncgId: normalizeValue(
            getValue(row, [
              "ncg id",
              "ncg_id",
              "ncgid",
              "ncg-id",
            ]),
          ),
          firstName: normalizeValue(
            getValue(row, [
              "first name",
              "firstname",
              "forename",
              "given name",
              "givenname",
            ]),
          ),
          lastName: normalizeValue(
            getValue(row, [
              "last name",
              "lastname",
              "surname",
              "family name",
              "familyname",
            ]),
          ),
          grade: normalizeGrade(
            getValue(row, [
              "grade",
              "grades",
              "mark",
              "marks",
              "score",
              "percentage",
              "final grade",
              "finalgrade",
              "final mark",
              "finalmark",
            ]),
          ),
        }))
        .filter(
          (student) =>
            student.ncgId ||
            student.firstName ||
            student.lastName,
        );

      if (!students.length) {
        throw new Error(
          "No valid student records could be found in the uploaded file.",
        );
      }

      runReconciliation(students);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not process the uploaded file.",
      );
    } finally {
      setIsProcessing(false);
      event.target.value = "";
    }
  };

  const handleManualChange = (
    index: number,
    field: keyof Student,
    value: string,
  ) => {
    setManualRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    );
  };

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

  const handleManualImport = () => {
    const validRows = manualRows.filter(
      (row) =>
        row.ncgId ||
        row.firstName ||
        row.lastName ||
        row.grade,
    );

    if (!validRows.length) {
      setError("Add at least one student before importing.");
      return;
    }

    setError("");
    setSelectedMethod("manual");
    runReconciliation(validRows);
  };

  const clearResults = () => {
    setReconciliationResults([]);
    setActualStudents([]);
    setSelectedMethod(null);
    setFilter("all");

    localStorage.removeItem(
      `gradezy_actual_students_${assessmentId}`,
    );
  };

  const summary = useMemo(() => {
    if (!reconciliationResults.length) return null;

    return calculateSummary(reconciliationResults);
  }, [reconciliationResults]);

  const issues = useMemo<Issue[]>(() => {
    if (!reconciliationResults.length) return [];

    return generateIssuesFromReconciliation(
      reconciliationResults,
    );
  }, [reconciliationResults]);

  const filteredResults = useMemo(() => {
    if (filter === "all") {
      return reconciliationResults;
    }

    return reconciliationResults.filter(
      (result) => result.status === filter,
    );
  }, [filter, reconciliationResults]);

  const hasIssues = issues.length > 0;

  if (isLoading) {
    return (
      <>
        <AppSidebar />

        <main className="min-h-screen bg-white lg:pl-64">
          <div className="flex min-h-screen items-center justify-center">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
              Loading assessment...
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppSidebar
        assessment={
          assessment
            ? {
                id: assessment.id,
                name: assessment.name,
                module: assessment.module,
              }
            : undefined
        }
      />

      <main className="min-h-screen bg-white lg:pl-64">
        <header className="min-h-20 border-b border-slate-200 bg-white px-6 py-5 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() =>
                  router.push(`/assessments/${assessmentId}`)
                }
                className="w-fit text-sm text-slate-400 transition hover:text-slate-700"
              >
                ← {assessment?.name ?? "Assessment"}
              </button>

              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-4xl">
                Reconciliation
              </h1>

              <p className="text-sm text-slate-500">
                Compare expected students against submitted
                assessment data.
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
          {assessment && (
            <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
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
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {assessment.module}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Level
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {assessment.level}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Cohort
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {assessment.cohort}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Expected students
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {expectedStudents.length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                !
              </div>

              <div>
                <p className="text-sm font-semibold text-red-800">
                  Something needs your attention
                </p>

                <p className="mt-1 text-sm leading-6 text-red-700">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!reconciliationResults.length ? (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Bring in assessment data
                </h2>

                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                  Choose how you want to bring student results
                  into Gradezy. Once imported, Gradezy will
                  automatically identify mismatches and missing
                  records.
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {/* Upload */}
                <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <UploadIcon />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Upload assessment data
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Upload an Excel or CSV file containing the
                    student results.
                  </p>

                  <label className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                    {isProcessing &&
                    selectedMethod === "upload"
                      ? "Processing..."
                      : "Choose file"}

                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                  </label>
                </div>

                {/* Extension */}
                <div
                  className={`rounded-3xl border p-7 shadow-sm transition-all duration-500 ${
                    extensionState === "connected"
                      ? "border-emerald-200 bg-emerald-50/60 shadow-emerald-100"
                      : extensionState === "checking"
                        ? "border-indigo-200 bg-indigo-50/30"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-500 ${
                        extensionState === "connected"
                          ? "bg-emerald-100 text-emerald-700"
                          : extensionState === "checking"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {extensionState === "connected" ? (
                        <CheckIcon />
                      ) : extensionState === "checking" ? (
                        <SpinnerIcon />
                      ) : (
                        <ExtensionIcon />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-950">
                          Gradezy Extension
                        </h3>

                        {extensionState === "connected" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                            Connected
                          </span>
                        )}

                        {extensionState === "checking" && (
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                            Checking...
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Import student results directly from
                        StaffAdvantage.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    {extensionState === "checking" && (
                      <div className="rounded-xl border border-indigo-100 bg-white px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-indigo-500" />

                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Checking your browser
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              Looking for the Gradezy Extension...
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {extensionState === "connected" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-emerald-200 bg-white px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <CheckIcon small />
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-950">
                                Connected and ready
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Gradezy can now communicate with
                                StaffAdvantage.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              ✓
                            </span>
                            Extension detected
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              ✓
                            </span>
                            Connection verified
                          </div>
                        </div>

                        {extensionVersion && (
                          <p className="text-[11px] text-slate-400">
                            Extension version {extensionVersion}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={handleExtensionImport}
                          disabled={isProcessing}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isProcessing ? (
                            <>
                              <SpinnerIcon />
                              Importing...
                            </>
                          ) : (
                            <>
                              Import from StaffAdvantage
                              <span aria-hidden="true">→</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {extensionState === "not-installed" && (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Extension not connected yet
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Install the Gradezy Extension, then
                            return to this page. Gradezy will
                            automatically detect it.
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <a
                            href="https://microsoftedge.microsoft.com/addons/detail/staffadvantage-grade-fill/iocfhndobdbbiemehcnpfnippohngocn"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Get Gradezy Extension
                            <span aria-hidden="true">↗</span>
                          </a>

                          <button
                            type="button"
                            onClick={checkExtension}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Check again
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* API */}
                <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <ApiIcon />
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-950">
                      API connection
                    </h3>

                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Coming soon
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Connect Gradezy directly to your assessment
                    system through an API.
                  </p>

                  <button
                    type="button"
                    disabled
                    className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-400"
                  >
                    API connection
                  </button>
                </div>

                {/* Manual */}
                <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <EditIcon />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    Enter manually
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add student records manually when you only
                    have a small number of results.
                  </p>

                  <div className="mt-6 space-y-3">
                    {manualRows.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-2 sm:grid-cols-4"
                      >
                        <input
                          value={row.ncgId}
                          onChange={(event) =>
                            handleManualChange(
                              index,
                              "ncgId",
                              event.target.value,
                            )
                          }
                          placeholder="NCG ID"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />

                        <input
                          value={row.firstName}
                          onChange={(event) =>
                            handleManualChange(
                              index,
                              "firstName",
                              event.target.value,
                            )
                          }
                          placeholder="First name"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />

                        <input
                          value={row.lastName}
                          onChange={(event) =>
                            handleManualChange(
                              index,
                              "lastName",
                              event.target.value,
                            )
                          }
                          placeholder="Last name"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />

                        <input
                          value={row.grade}
                          onChange={(event) =>
                            handleManualChange(
                              index,
                              "grade",
                              event.target.value,
                            )
                          }
                          placeholder="Grade"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={addManualRow}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        + Add student
                      </button>

                      <button
                        type="button"
                        onClick={handleManualImport}
                        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Reconcile data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Results header */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Reconciliation complete
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    Assessment data overview
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Gradezy compared {expectedStudents.length} expected
                    students against {actualStudents.length} imported
                    records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={clearResults}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Import different data
                </button>
              </div>

              {/* Summary */}
              {summary && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <SummaryCard
                    label="Expected"
                    value={summary.expected}
                    description="Students expected"
                  />

                  <SummaryCard
                    label="Matched"
                    value={summary.matched}
                    description="Records aligned"
                    tone="success"
                  />

                  <SummaryCard
                    label="Needs review"
                    value={
                      summary.missing +
                      summary.nameMismatches +
                      summary.gradeMismatches
                    }
                    description="Potential issues"
                    tone="warning"
                  />

                  <SummaryCard
                    label="Unexpected"
                    value={summary.unexpected}
                    description="Not on expected list"
                    tone="neutral"
                  />
                </div>
              )}

              {/* Issue banner */}
              {hasIssues ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertIcon />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-950">
                        {issues.length} issue
                        {issues.length === 1 ? "" : "s"} need
                        review
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-amber-800/80">
                        Gradezy found records that may need to be
                        corrected before the assessment is ready.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/assessments/${assessmentId}/issues`,
                        )
                      }
                      className="hidden rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:block"
                    >
                      Review issues
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <CheckIcon />
                    </div>

                    <div>
                      <h3 className="font-semibold text-emerald-950">
                        Everything reconciled
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                        All imported records align with the
                        expected student list.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="rounded-2xl border border-slate-200 bg-white p-2">
                <div className="flex gap-1 overflow-x-auto">
                  <FilterButton
                    active={filter === "all"}
                    onClick={() => setFilter("all")}
                    label="All"
                    count={reconciliationResults.length}
                  />

                  <FilterButton
                    active={filter === "matched"}
                    onClick={() => setFilter("matched")}
                    label="Matched"
                    count={summary?.matched ?? 0}
                  />

                  <FilterButton
                    active={filter === "missing"}
                    onClick={() => setFilter("missing")}
                    label="Missing"
                    count={summary?.missing ?? 0}
                  />

                  <FilterButton
                    active={filter === "name_mismatch"}
                    onClick={() => setFilter("name_mismatch")}
                    label="Name mismatch"
                    count={summary?.nameMismatches ?? 0}
                  />

                  <FilterButton
                    active={filter === "grade_mismatch"}
                    onClick={() => setFilter("grade_mismatch")}
                    label="Grade mismatch"
                    count={summary?.gradeMismatches ?? 0}
                  />

                  <FilterButton
                    active={filter === "unexpected"}
                    onClick={() => setFilter("unexpected")}
                    label="Unexpected"
                    count={summary?.unexpected ?? 0}
                  />
                </div>
              </div>

              {/* Student table */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        Student reconciliation
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {filteredResults.length} record
                        {filteredResults.length === 1 ? "" : "s"}
                        shown
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Student
                        </th>

                        <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          NCG ID
                        </th>

                        <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Expected grade
                        </th>

                        <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Imported grade
                        </th>

                        <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filteredResults.map((result, index) => {
                        const expected = result.expected;
                        const actual = result.actual;

                        const firstName =
                          expected?.firstName ??
                          actual?.firstName ??
                          "";

                        const lastName =
                          expected?.lastName ??
                          actual?.lastName ??
                          "";

                        const ncgId =
                          expected?.ncgId ??
                          actual?.ncgId ??
                          "";

                        const expectedGrade =
                          expected?.grade ?? "";

                        const actualGrade =
                          actual?.grade ?? "";

                        return (
                          <tr
                            key={`${ncgId}-${index}`}
                            className="transition hover:bg-slate-50/70"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                  {(
                                    firstName?.[0] ?? "?"
                                  ).toUpperCase()}
                                  {(
                                    lastName?.[0] ?? ""
                                  ).toUpperCase()}
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    {firstName} {lastName}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-sm text-slate-600">
                              {ncgId || "—"}
                            </td>

                            <td className="px-6 py-4 text-sm font-medium text-slate-700">
                              {expectedGrade || "—"}
                            </td>

                            <td className="px-6 py-4 text-sm font-medium text-slate-700">
                              {actualGrade || "—"}
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClasses(
                                  result,
                                )}`}
                              >
                                {getStatusLabel(result)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {!filteredResults.length && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      No records match this filter.
                    </p>

                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className="mt-2 text-sm font-semibold text-slate-600 underline underline-offset-4"
                    >
                      Show all records
                    </button>
                  </div>
                )}
              </div>

              {/* Missing students */}
              {summary && summary.missing > 0 && (
                <div className="rounded-3xl border border-red-200 bg-red-50/60 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                      <AlertIcon />
                    </div>

                    <div>
                      <h3 className="font-semibold text-red-950">
                        {summary.missing} student
                        {summary.missing === 1 ? "" : "s"} missing
                        from imported data
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-red-800/80">
                        These students appear on the expected list
                        but were not found in the imported results.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next steps */}
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Continue with this assessment
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Use the reconciliation results to move through
                  the remaining assessment checks.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/assessments/${assessmentId}/issues`,
                    )
                  }
                  className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <AlertIcon />
                    </div>

                    <span className="text-slate-400 transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>

                  <h4 className="mt-5 font-semibold text-slate-950">
                    Review issues
                  </h4>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Review mismatches, missing students and other
                    reconciliation findings.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/assessments/${assessmentId}/readiness`,
                    )
                  }
                  className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <CheckIcon />
                    </div>

                    <span className="text-slate-400 transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>

                  <h4 className="mt-5 font-semibold text-slate-950">
                    Check readiness
                  </h4>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Run the final checks before publishing the
                    assessment.
                  </p>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function SummaryCard({
  label,
  value,
  description,
  tone = "default",
}: {
  label: string;
  value: number;
  description: string;
  tone?: "default" | "success" | "warning" | "neutral";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "neutral"
          ? "text-slate-700"
          : "text-slate-950";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">
        {label}
      </p>

      <p
        className={`mt-3 text-3xl font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {label}

      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active
            ? "bg-white/15 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 16V4m0 0 4 4m-4-4L8 8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExtensionIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M9 3v3a2 2 0 0 1-2 2H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h3a2 2 0 0 1 2 2v3h6v-3a2 2 0 0 1 2-2h3a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-3a2 2 0 0 1-2-2V3H9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path
        d="m8.2 10.8 7.5-3.6M8.2 13.2l7.5 3.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M12 20h9"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <svg
      className={small ? "h-3.5 w-3.5" : "h-5 w-5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path
        d="m5 12 4 4L19 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        className="opacity-25"
      />

      <path
        d="M21 12a9 9 0 0 0-9-9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        d="M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12 9v4"
        strokeLinecap="round"
      />

      <path
        d="M12 17h.01"
        strokeLinecap="round"
      />
    </svg>
  );
}