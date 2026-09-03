export type StoredAssessment = {
  id: string;
  name: string;
  module: string;
  level: string;
  cohort: string;
  assessmentType: string;
  dueDate: string;
  createdAt: string;
  updatedAt?: string;
  status?: string;
  readyAt?: string;
};

const key = "gradezy_assessments";

export function saveAssessment(assessment: StoredAssessment) {
  const current = JSON.parse(localStorage.getItem(key) || "[]") as StoredAssessment[];
  const next = [assessment, ...current.filter((item) => item.id !== assessment.id)];
  localStorage.setItem(key, JSON.stringify(next));
  localStorage.setItem("gradezy_current_assessment", JSON.stringify(assessment));
}

export function getAssessments(): StoredAssessment[] {
  return JSON.parse(localStorage.getItem(key) || "[]") as StoredAssessment[];
}
