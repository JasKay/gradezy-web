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

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(value);
  }

  return String(value).trim().replace(/\.0$/, "");
}

function getValue(
  row: Record<string, unknown>,
  possibleNames: string[]
): unknown {
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

function normalizeGrade(value: string) {
  return value.trim().toLowerCase().replace("%", "");
}

function gradesMatch(expected: string, actual: string) {
  if (!expected || !actual) return true;

  return normalizeGrade(expected) === normalizeGrade(actual);
}

function getStatusLabel(status: ReconciliationResult["status"]) {
  switch (status) {
    case "matched":
      return "Matched";
    case "missing":
      return "Missing";
    case "unexpected":
      return "Unexpected";
    case "name_mismatch":
      return "Name mismatch";
    case "duplicate":
      return "Duplicate";
    case "missing_id":
      return "Missing ID";
    default:
      return status;
  }
}

function getStatusClasses(status: ReconciliationResult["status"]) {
  switch (status) {
    case "matched":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "missing":
      return "bg-red-50 text-red-700 border-red-200";

    case "unexpected":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "name_mismatch":
      return "bg-orange-50 text-orange-700 border-orange-200";

    case "duplicate":
      return "bg-red-50 text-red-700 border-red-200";

    case "missing_id":
      return "bg-orange-50 text-orange-700 border-orange-200";

    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function ReconciliationPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = String(params.id);

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [expectedStudents, setExpectedStudents] = useState<Student[]>([]);
  const [actualStudents, setActualStudents] = useState<ActualStudent[]>([]);

  const [selectedMethod, setSelectedMethod] =
    useState<EntryMethod | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extensionState, setExtensionState] = useState<
    "checking" | "available" | "unavailable"
  >("checking");
  const [error, setError] = useState("");

  const [reconciliationResults, setReconciliationResults] = useState<
    ReconciliationResult[]
  >([]);

  const [filter, setFilter] = useState<FilterType>("all");

  const [manualRows, setManualRows] = useState<Student[]>([
    {
      ncgId: "",
      firstName: "",
      lastName: "",
      grade: "",
    },
  ]);

  useEffect(() => {
    try {
      const storedAssessment = localStorage.getItem(
        "gradezy_current_assessment"
      );

      const storedStudents = localStorage.getItem(
        `gradezy_students_${assessmentId}`
      );

      if (!storedAssessment) {
        setError("We couldn't find this assessment.");
        setIsLoading(false);
        return;
      }

      const parsedAssessment = JSON.parse(storedAssessment) as Assessment;

      if (parsedAssessment.id !== assessmentId) {
        setError("This assessment could not be matched.");
        setIsLoading(false);
        return;
      }

      setAssessment(parsedAssessment);

      if (storedStudents) {
        const parsedStudents = JSON.parse(storedStudents) as Student[];

        setExpectedStudents(parsedStudents);
      }
    } catch {
      setError("We couldn't load this assessment.");
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  const runReconciliation = (students: ActualStudent[]) => {
    if (!expectedStudents.length) {
      setError(
        "No expected students were found. Upload your Progress Tracker first."
      );
      return;
    }

    setError("");

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

  useEffect(() => {
    if (!assessmentId) return;

    const storedActualStudents = localStorage.getItem(
      `gradezy_actual_students_${assessmentId}`
    );

    if (!storedActualStudents) return;

    try {
      const parsed = JSON.parse(
        storedActualStudents
      ) as ActualStudent[];

      if (Array.isArray(parsed) && parsed.length > 0) {
        setActualStudents(parsed);

        if (expectedStudents.length > 0) {
          const results = reconcileStudents(
            expectedStudents as ExpectedStudent[],
            parsed
          );

          setReconciliationResults(results);
        }
      }
    } catch {
      // Ignore invalid stored reconciliation data.
    }
  }, [assessmentId, expectedStudents]);

  useEffect(() => {
    let active = true;

    pingExtension().then((available) => {
      if (active) setExtensionState(available ? "available" : "unavailable");
    });

    return () => {
      active = false;
    };
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setIsProcessing(true);
    setError("");

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("The uploaded file does not contain a worksheet.");
      }

      const firstSheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        {
          defval: "",
        }
      );

      if (!rows.length) {
        throw new Error("The uploaded file does not contain any student data.");
      }

      const students: ActualStudent[] = rows
        .map((row) => {
          const ncgId = normalizeValue(
            getValue(row, [
              "NCG ID",
              "NCGID",
              "Student ID",
              "StudentID",
              "ID",
            ])
          );

          const firstName = normalizeValue(
            getValue(row, [
              "First Name",
              "Firstname",
              "Given Name",
              "Forename",
            ])
          );

          const lastName = normalizeValue(
            getValue(row, [
              "Last Name",
              "Lastname",
              "Surname",
              "Family Name",
            ])
          );

          const grade = normalizeValue(
            getValue(row, [
              "Grade",
              "Final Grade",
              "Percentage",
              "Mark",
              "Score",
            ])
          );

          return {
            ncgId,
            firstName,
            lastName,
            grade,
          };
        })
        .filter(
          (student) =>
            student.ncgId ||
            student.firstName ||
            student.lastName ||
            student.grade
        );

      if (!students.length) {
        throw new Error(
          "No usable student records were found in the uploaded file."
        );
      }

      runReconciliation(students);
      setSelectedMethod("upload");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "We couldn't read this file."
      );
    } finally {
      setIsProcessing(false);
      event.target.value = "";
    }
  };

  const handleExtensionImport = async () => {
    setIsProcessing(true);
    setError("");

    try {
      const students = await requestStudentsFromExtension();

      if (!students.length) {
        throw new Error("No student records were found on the open StaffAdvantage page.");
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

  const updateManualRow = (
    index: number,
    field: keyof Student,
    value: string
  ) => {
    setManualRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  const addManualRow = () => {
    setManualRows((current) => [
      ...current,
      {
        ncgId: "",
        firstName: "",
        lastName: "",
        grade: "",
      },
    ]);
  };

  const removeManualRow = (index: number) => {
    setManualRows((current) => {
      if (current.length === 1) {
        return [
          {
            ncgId: "",
            firstName: "",
            lastName: "",
            grade: "",
          },
        ];
      }

      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleManualReconciliation = () => {
    const validRows = manualRows
      .map((student) => ({
        ncgId: student.ncgId.trim(),
        firstName: student.firstName.trim(),
        lastName: student.lastName.trim(),
        grade: student.grade.trim(),
      }))
      .filter(
        (student) =>
          student.ncgId ||
          student.firstName ||
          student.lastName ||
          student.grade
      );

    if (!validRows.length) {
      setError("Add at least one student before continuing.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      runReconciliation(validRows);
      setSelectedMethod("manual");
    } finally {
      setIsProcessing(false);
    }
  };

  const summary = useMemo(() => {
    if (!reconciliationResults.length) {
      return {
        total: 0,
        matched: 0,
        missing: 0,
        unexpected: 0,
        nameMismatch: 0,
        duplicate: 0,
        missingId: 0,
      };
    }

    const calculated = calculateSummary(reconciliationResults);

    return {
      total: calculated.total,
      matched: calculated.matched,
      missing: calculated.missing,
      unexpected: calculated.unexpected,
      nameMismatch: calculated.nameMismatch,
      duplicate: calculated.duplicate,
      missingId: calculated.missingId,
    };
  }, [reconciliationResults]);

  const gradeMismatchCount = useMemo(() => {
    return reconciliationResults.filter((result) => {
      if (result.status !== "matched") return false;

      return !gradesMatch(
        result.expectedStudent?.grade ?? "",
        result.actualStudents[0]?.grade ?? ""
      );
    }).length;
  }, [reconciliationResults]);

  const issues = useMemo(() => {
    if (!reconciliationResults.length) return [];

    const generatedIssues = generateIssuesFromReconciliation(
      assessmentId,
      reconciliationResults
    );

    return generatedIssues;
  }, [assessmentId, reconciliationResults]);

  const filteredResults = useMemo(() => {
    return reconciliationResults.filter((result) => {
      if (filter === "all") return true;

      if (filter === "grade_mismatch") {
        return (
          result.status === "matched" &&
          !gradesMatch(
            result.expectedStudent?.grade ?? "",
            result.actualStudents[0]?.grade ?? ""
          )
        );
      }

      return result.status === filter;
    });
  }, [filter, reconciliationResults]);

  const matchedPercentage =
    summary.total > 0
      ? Math.round((summary.matched / summary.total) * 100)
      : 0;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse">
            <div className="h-8 w-64 rounded bg-slate-200" />
            <div className="mt-3 h-4 w-96 rounded bg-slate-100" />
          </div>
        </div>
      </main>
    );
  }

  if (error && !assessment) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => router.back()}
            className="mb-8 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-semibold text-red-900">
              Something went wrong
            </h1>

            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  const hasResults = reconciliationResults.length > 0;

  return (
    <main className="min-h-screen bg-white lg:pl-64">
      {assessment && <AppSidebar assessment={assessment} />}
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-5 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Back to assessment
          </button>

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-medium text-indigo-600">
                Reconciliation
              </p>

              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                {assessment?.name}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Compare your expected assessment data against the records in
                your assessment system.
              </p>
            </div>

            {hasResults && (
              <button
                onClick={() =>
                  router.push(`/assessments/${assessmentId}/issues`)
                }
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Review issues →
              </button>
            )}
          </div>
        </div>

        {!hasResults ? (
          <section>
            <div className="mb-8 max-w-3xl">
              <h2 className="text-xl font-semibold text-slate-950">
                Bring in your assessment system data
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose how you want to provide the student records Gradezy
                should reconcile against your expected students.
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Upload */}
              <div
                onClick={() => setSelectedMethod("upload")}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMethod("upload");
                  }
                }}
                className={`group cursor-pointer rounded-2xl border p-6 text-left transition ${
                  selectedMethod === "upload"
                    ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    ↑
                  </div>

                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Available
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold text-slate-950">
                  Upload an export
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Upload an XLSX, XLS or CSV export from StaffAdvantage or
                  another assessment system.
                </p>

                {selectedMethod === "upload" && (
                  <div
                    className="mt-5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                      {isProcessing ? "Processing..." : "Choose file"}

                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        disabled={isProcessing}
                        onChange={handleFileUpload}
                      />
                    </label>

                    <p className="mt-3 text-xs text-slate-400">
                      Your file is processed locally in this prototype.
                    </p>
                  </div>
                )}
              </div>

              {/* Extension */}
              <div
                onClick={() => setSelectedMethod("extension")}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMethod("extension");
                  }
                }}
                className={`group cursor-pointer rounded-2xl border p-6 text-left transition ${
                  selectedMethod === "extension"
                    ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    ◉
                  </div>

                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    Extension
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold text-slate-950">
                  Connect with Gradezy Extension
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Read student records directly from the assessment system
                  currently open in your browser.
                </p>

                {selectedMethod === "extension" && (
                  <div
                    className="mt-5 rounded-xl border border-indigo-100 bg-white p-4"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-sm font-medium text-slate-900">
                      Browser connection
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      The Gradezy browser extension will allow this assessment
                      to receive records directly from supported systems.
                    </p>

                    <button
                      type="button"
                      onClick={handleExtensionImport}
                      disabled={isProcessing || extensionState !== "available"}
                      className="mt-4 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {extensionState === "checking"
                        ? "Checking for extension..."
                        : extensionState === "available"
                          ? "Connect StaffAdvantage"
                          : "Extension not detected"}
                    </button>
                  </div>
                )}
              </div>

              {/* API */}
              <div
                onClick={() => setSelectedMethod("api")}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMethod("api");
                  }
                }}
                className={`group cursor-pointer rounded-2xl border p-6 text-left transition ${
                  selectedMethod === "api"
                    ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    ↔
                  </div>

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    Coming soon
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold text-slate-950">
                  Connect an API
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Connect Gradezy directly to an assessment platform through
                  its API.
                </p>

                {selectedMethod === "api" && (
                  <div
                    className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-sm font-medium text-slate-900">
                      Direct system connection
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      API connections will allow Gradezy to retrieve assessment
                      data without requiring an export.
                    </p>
                  </div>
                )}
              </div>

              {/* Manual */}
              <div
                onClick={() => setSelectedMethod("manual")}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMethod("manual");
                  }
                }}
                className={`group rounded-2xl border p-6 text-left transition ${
                  selectedMethod === "manual"
                    ? "border-indigo-300 bg-indigo-50/50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl">
                    +
                  </div>

                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    Available
                  </span>
                </div>

                <h3 className="mt-5 text-base font-semibold text-slate-950">
                  Enter records manually
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Add student records directly when an export or connection
                  isn't available.
                </p>

                {selectedMethod === "manual" && (
                  <div
                    className="mt-5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="overflow-x-auto">
                        <table className="min-w-[720px] w-full text-left">
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                                NCG ID
                              </th>

                              <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                                First name
                              </th>

                              <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                                Last name
                              </th>

                              <th className="px-3 py-2 text-xs font-semibold text-slate-500">
                                Grade
                              </th>

                              <th className="w-10 px-2" />
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-slate-100">
                            {manualRows.map((row, index) => (
                              <tr key={index}>
                                <td className="p-2">
                                  <input
                                    value={row.ncgId}
                                    onChange={(event) =>
                                      updateManualRow(
                                        index,
                                        "ncgId",
                                        event.target.value
                                      )
                                    }
                                    placeholder="NCG ID"
                                    className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  />
                                </td>

                                <td className="p-2">
                                  <input
                                    value={row.firstName}
                                    onChange={(event) =>
                                      updateManualRow(
                                        index,
                                        "firstName",
                                        event.target.value
                                      )
                                    }
                                    placeholder="First name"
                                    className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  />
                                </td>

                                <td className="p-2">
                                  <input
                                    value={row.lastName}
                                    onChange={(event) =>
                                      updateManualRow(
                                        index,
                                        "lastName",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Last name"
                                    className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  />
                                </td>

                                <td className="p-2">
                                  <input
                                    value={row.grade}
                                    onChange={(event) =>
                                      updateManualRow(
                                        index,
                                        "grade",
                                        event.target.value
                                      )
                                    }
                                    placeholder="Grade"
                                    className="w-full rounded-md border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                  />
                                </td>

                                <td className="p-2">
                                  <button
                                    type="button"
                                    onClick={() => removeManualRow(index)}
                                    className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    aria-label="Remove row"
                                  >
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={addManualRow}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        + Add student
                      </button>

                      <button
                        type="button"
                        onClick={handleManualReconciliation}
                        disabled={isProcessing}
                        className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing
                          ? "Reconciling..."
                          : "Reconcile records"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex gap-3">
                <div className="mt-0.5 text-sm">ⓘ</div>

                <div>
                  <p className="text-sm font-medium text-slate-900">
                    One reconciliation engine
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    No matter how the data enters Gradezy, it is normalized
                    and compared against the same expected student data.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Reconciliation overview
                    </p>

                    <div className="mt-2 flex items-end gap-3">
                      <span className="text-4xl font-semibold tracking-tight text-slate-950">
                        {matchedPercentage}%
                      </span>

                      <span className="pb-1 text-sm text-slate-500">
                        matched
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {summary.matched} of {summary.total} expected students
                      matched.
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Records received
                    </p>

                    <p className="mt-1 text-xl font-semibold text-slate-900">
                      {actualStudents.length}
                    </p>
                  </div>
                </div>

                <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{
                      width: `${matchedPercentage}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-sm font-medium text-slate-500">
                  Issues detected
                </p>

                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {issues.length}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {issues.filter((issue) => issue.severity === "critical")
                    .length > 0 && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                      {
                        issues.filter(
                          (issue) => issue.severity === "critical"
                        ).length
                      }{" "}
                      critical
                    </span>
                  )}

                  {issues.filter((issue) => issue.severity === "warning")
                    .length > 0 && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                      {
                        issues.filter(
                          (issue) => issue.severity === "warning"
                        ).length
                      }{" "}
                      warnings
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  key: "all" as FilterType,
                  label: "Expected",
                  value: summary.total,
                },
                {
                  key: "matched" as FilterType,
                  label: "Matched",
                  value: summary.matched,
                },
                {
                  key: "missing" as FilterType,
                  label: "Missing",
                  value: summary.missing,
                },
                {
                  key: "name_mismatch" as FilterType,
                  label: "Name mismatch",
                  value: summary.nameMismatch,
                },
                {
                  key: "grade_mismatch" as FilterType,
                  label: "Grade mismatch",
                  value: gradeMismatchCount,
                },
                {
                  key: "unexpected" as FilterType,
                  label: "Unexpected",
                  value: summary.unexpected,
                },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`rounded-xl border p-4 text-left transition ${
                    filter === item.key
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500">
                    {item.label}
                  </p>

                  <p className="mt-2 text-2xl font-semibold text-slate-950">
                    {item.value}
                  </p>
                </button>
              ))}
            </div>

            {summary.missing > 0 && (
              <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-5 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    {summary.missing} expected{" "}
                    {summary.missing === 1 ? "student is" : "students are"}{" "}
                    missing
                  </p>

                  <p className="mt-1 text-sm text-red-700">
                    These students appear in your expected data but were not
                    found in the assessment system records.
                  </p>
                </div>

                <button
                  onClick={() => setFilter("missing")}
                  className="shrink-0 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  View missing students
                </button>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <h2 className="font-semibold text-slate-950">
                      Student reconciliation
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Showing {filteredResults.length} of{" "}
                      {reconciliationResults.length} records.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedMethod(null);
                      setReconciliationResults([]);
                      setActualStudents([]);
                      setFilter("all");
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                  >
                    Import different data
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Expected student
                      </th>

                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        NCG ID
                      </th>

                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Assessment system
                      </th>

                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Expected grade
                      </th>

                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actual grade
                      </th>

                      <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.map((result) => {
                      const expectedName = result.expectedStudent
                        ? `${result.expectedStudent.firstName} ${result.expectedStudent.lastName}`.trim()
                        : "—";

                      const actualStudent = result.actualStudents[0];
                      const actualName = actualStudent
                        ? `${actualStudent.firstName} ${actualStudent.lastName}`.trim()
                        : "—";

                      const isGradeMismatch =
                        result.status === "matched" &&
                        !gradesMatch(
                          result.expectedStudent?.grade ?? "",
                          actualStudent?.grade ?? ""
                        );

                      return (
                        <tr
                          key={result.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-slate-900">
                              {expectedName}
                            </p>

                            {result.status === "name_mismatch" && (
                              <p className="mt-1 text-xs text-orange-600">
                                Assessment system: {actualName}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {result.expectedStudent?.ncgId ||
                              actualStudent?.ncgId ||
                              "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {actualName}
                          </td>

                          <td className="px-6 py-4 text-sm text-slate-600">
                            {result.expectedStudent?.grade || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm">
                            <span
                              className={
                                isGradeMismatch
                                  ? "font-medium text-orange-600"
                                  : "text-slate-600"
                              }
                            >
                              {actualStudent?.grade || "—"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                result.status
                              )}`}
                            >
                              {isGradeMismatch
                                ? "Grade mismatch"
                                : getStatusLabel(result.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredResults.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-slate-500"
                        >
                          No records match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 md:flex-row md:items-center">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Reconciliation complete
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Gradezy has identified the records that need attention.
                  Continue to Issues to review them.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    router.push(`/assessments/${assessmentId}/issues`)
                  }
                  className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Review issues
                </button>

                <button
                  onClick={() =>
                    router.push(`/assessments/${assessmentId}/readiness`)
                  }
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Check readiness
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
