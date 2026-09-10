import { getAssessments, type StoredAssessment } from "@/lib/assessment-store";
import {
  type ActualStudent,
  type ExpectedStudent,
} from "@/lib/reconciliation";

export type StudentAssessmentRecord = {
  assessmentId: string;
  assessmentName: string;
  module: string;
  level: string;
  cohort: string;
  assessmentType: string;
  dueDate: string;

  grade?: number;
  gradeStatus: "recorded" | "missing";
};

export type StudentIndicatorType =
  | "missing_grade"
  | "declining_performance"
  | "low_performance"
  | "below_average";

export type StudentIndicator = {
  type: StudentIndicatorType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
};

export type StudentTrend =
  | "improving"
  | "stable"
  | "declining"
  | "insufficient_data";

export type StudentProfile = {
  ncgId: string;
  firstName: string;
  lastName: string;

  assessments: StudentAssessmentRecord[];

  averageGrade?: number;
  latestGrade?: number;

  completedAssessments: number;
  missingGrades: number;

  trend: StudentTrend;

  indicators: StudentIndicator[];
};

function parseGrade(grade: unknown): number | undefined {
  if (grade === null || grade === undefined || grade === "") {
    return undefined;
  }

  if (typeof grade === "number") {
    return Number.isFinite(grade) ? grade : undefined;
  }

  if (typeof grade === "string") {
    const cleaned = grade.replace("%", "").trim();
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

/**
 * Calculate the performance trend from recorded grades.
 */
export function calculateStudentTrend(
  assessments: StudentAssessmentRecord[]
): StudentTrend {
  const recordedGrades = assessments
    .filter(
      (assessment) =>
        assessment.grade !== undefined &&
        assessment.grade !== null
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate).getTime() -
        new Date(b.dueDate).getTime()
    )
    .map((assessment) => assessment.grade as number);

  if (recordedGrades.length < 3) {
    return "insufficient_data";
  }

  const midpoint = Math.floor(recordedGrades.length / 2);

  const earlierGrades = recordedGrades.slice(0, midpoint);
  const recentGrades = recordedGrades.slice(midpoint);

  const earlierAverage =
    earlierGrades.reduce((sum, grade) => sum + grade, 0) /
    earlierGrades.length;

  const recentAverage =
    recentGrades.reduce((sum, grade) => sum + grade, 0) /
    recentGrades.length;

  const difference = recentAverage - earlierAverage;

  if (difference >= 5) {
    return "improving";
  }

  if (difference <= -5) {
    return "declining";
  }

  return "stable";
}

/**
 * Generate explainable indicators for a student.
 */
export function generateStudentIndicators(
  assessments: StudentAssessmentRecord[],
  averageGrade?: number
): StudentIndicator[] {
  const indicators: StudentIndicator[] = [];

  const missingGrades = assessments.filter(
    (assessment) => assessment.gradeStatus === "missing"
  );

  if (missingGrades.length > 0) {
    indicators.push({
      type: "missing_grade",
      severity: "warning",
      title:
        missingGrades.length === 1
          ? "Missing assessment result"
          : "Missing assessment results",
      description:
        missingGrades.length === 1
          ? `No grade has been recorded for ${missingGrades[0].assessmentName}.`
          : `${missingGrades.length} assessment results have not been recorded.`,
    });
  }

  const trend = calculateStudentTrend(assessments);

  if (trend === "declining") {
    indicators.push({
      type: "declining_performance",
      severity: "warning",
      title: "Performance declining",
      description:
        "Recent assessment performance is lower than earlier recorded results.",
    });
  }

  const recordedGrades = assessments
    .filter((assessment) => assessment.grade !== undefined)
    .map((assessment) => assessment.grade as number);

  const lowGrades = recordedGrades.filter(
    (grade) => grade < 50
  );

  if (lowGrades.length >= 2) {
    indicators.push({
      type: "low_performance",
      severity: "critical",
      title: "Repeated low performance",
      description: `${lowGrades.length} recorded assessment results are below 50%.`,
    });
  }

  if (
    averageGrade !== undefined &&
    recordedGrades.length >= 2 &&
    averageGrade < 50
  ) {
    indicators.push({
      type: "low_performance",
      severity: "warning",
      title: "Low average performance",
      description: `Average recorded assessment performance is ${Math.round(
        averageGrade
      )}%.`,
    });
  }

  return indicators;
}

/**
 * Get all student profiles aggregated across all assessments.
 */
export function getAllStudentProfiles(): StudentProfile[] {
  if (typeof window === "undefined") {
    return [];
  }

  const assessments = getAssessments();

  const studentsMap = new Map<
    string,
    {
      ncgId: string;
      firstName: string;
      lastName: string;
      assessments: StudentAssessmentRecord[];
    }
  >();

  assessments.forEach((assessment: StoredAssessment) => {
    const expectedRaw = localStorage.getItem(
      `gradezy_students_${assessment.id}`
    );

    const actualRaw = localStorage.getItem(
      `gradezy_actual_students_${assessment.id}`
    );

    const expectedStudents: ExpectedStudent[] = expectedRaw
      ? JSON.parse(expectedRaw)
      : [];

    const actualStudents: ActualStudent[] = actualRaw
      ? JSON.parse(actualRaw)
      : [];

    /*
     * Create a lookup table for actual student records.
     */
    const actualByNcgId = new Map<
      string,
      ActualStudent
    >();

    actualStudents.forEach((student) => {
      if (student.ncgId) {
        actualByNcgId.set(
          String(student.ncgId).trim(),
          student
        );
      }
    });

    /*
     * Process expected students first.
     *
     * This gives us the authoritative student list
     * for each assessment.
     */
    expectedStudents.forEach((student) => {
      if (!student.ncgId) return;

      const ncgId = String(student.ncgId).trim();

      if (!ncgId) return;

      const actualStudent =
        actualByNcgId.get(ncgId);

      const grade = actualStudent
        ? parseGrade(actualStudent.grade)
        : undefined;

      const record: StudentAssessmentRecord = {
        assessmentId: assessment.id,
        assessmentName: assessment.name,
        module: assessment.module,
        level: assessment.level,
        cohort: assessment.cohort,
        assessmentType: assessment.assessmentType,
        dueDate: assessment.dueDate,
        grade,
        gradeStatus:
          grade !== undefined
            ? "recorded"
            : "missing",
      };

      const existing = studentsMap.get(ncgId);

      if (existing) {
        existing.assessments.push(record);
      } else {
        studentsMap.set(ncgId, {
          ncgId,
          firstName: student.firstName || "",
          lastName: student.lastName || "",
          assessments: [record],
        });
      }
    });

    /*
     * Also include actual students that weren't
     * present in the expected student list.
     *
     * This prevents Gradezy from hiding students
     * simply because they were unexpected in an
     * assessment reconciliation.
     */
    actualStudents.forEach((student) => {
      if (!student.ncgId) return;

      const ncgId = String(student.ncgId).trim();

      if (!ncgId) return;

      const alreadyExistsInAssessment =
        expectedStudents.some(
          (expected) =>
            String(expected.ncgId).trim() === ncgId
        );

      if (alreadyExistsInAssessment) {
        return;
      }

      const grade = parseGrade(student.grade);

      const record: StudentAssessmentRecord = {
        assessmentId: assessment.id,
        assessmentName: assessment.name,
        module: assessment.module,
        level: assessment.level,
        cohort: assessment.cohort,
        assessmentType: assessment.assessmentType,
        dueDate: assessment.dueDate,
        grade,
        gradeStatus:
          grade !== undefined
            ? "recorded"
            : "missing",
      };

      const existing = studentsMap.get(ncgId);

      if (existing) {
        existing.assessments.push(record);
      } else {
        studentsMap.set(ncgId, {
          ncgId,
          firstName: student.firstName || "",
          lastName: student.lastName || "",
          assessments: [record],
        });
      }
    });
  });

  /*
   * Convert aggregated records into Student Profiles.
   */
  const profiles: StudentProfile[] = [];

  studentsMap.forEach((student) => {
    const recordedGrades = student.assessments
      .filter(
        (assessment) =>
          assessment.grade !== undefined
      )
      .map(
        (assessment) =>
          assessment.grade as number
      );

    const averageGrade =
      recordedGrades.length > 0
        ? recordedGrades.reduce(
            (sum, grade) => sum + grade,
            0
          ) / recordedGrades.length
        : undefined;

    const sortedAssessments = [
      ...student.assessments,
    ].sort(
      (a, b) =>
        new Date(a.dueDate).getTime() -
        new Date(b.dueDate).getTime()
    );

    const latestRecordedAssessment =
      [...sortedAssessments]
        .reverse()
        .find(
          (assessment) =>
            assessment.grade !== undefined
        );

    const missingGrades =
      student.assessments.filter(
        (assessment) =>
          assessment.gradeStatus === "missing"
      ).length;

    const indicators =
      generateStudentIndicators(
        student.assessments,
        averageGrade
      );

    profiles.push({
      ncgId: student.ncgId,
      firstName: student.firstName,
      lastName: student.lastName,
      assessments: sortedAssessments,
      averageGrade,
      latestGrade:
        latestRecordedAssessment?.grade,
      completedAssessments:
        recordedGrades.length,
      missingGrades,
      trend:
        calculateStudentTrend(
          student.assessments
        ),
      indicators,
    });
  });

  return profiles.sort((a, b) => {
    const aName =
      `${a.firstName} ${a.lastName}`.toLowerCase();

    const bName =
      `${b.firstName} ${b.lastName}`.toLowerCase();

    return aName.localeCompare(bName);
  });
}

/**
 * Get a single student profile by NCG ID.
 */
export function getStudentProfile(
  ncgId: string
): StudentProfile | null {
  const target = String(ncgId).trim().toLowerCase();

  const students = getAllStudentProfiles();

  return (
    students.find(
      (student) =>
        student.ncgId.trim().toLowerCase() ===
        target
    ) || null
  );
}

/**
 * Get students who currently have indicators
 * requiring attention.
 */
export function getStudentsNeedingAttention(): StudentProfile[] {
  return getAllStudentProfiles().filter(
    (student) => student.indicators.length > 0
  );
}