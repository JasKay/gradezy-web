/**
 * Gradezy Extension - Content Script
 * 
 * Runs on assessment system pages (Canvas, Moodle, etc.)
 * Extracts grade data and makes it available to the extension
 */

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractGrades") {
    const grades = extractGradesFromPage();
    sendResponse({ success: true, data: grades });
  } else if (request.action === "extractStudents") {
    const students = extractStudentsFromPage();
    sendResponse({ success: true, data: students });
  } else if (request.action === "getPageInfo") {
    const info = getPageInfo();
    sendResponse({ success: true, data: info });
  }
});

/**
 * Extract grade data from the current page
 * Supports Canvas, Moodle, and other common assessment systems
 */
function extractGradesFromPage() {
  const grades = [];
  
  // Try Canvas LMS gradebook extraction
  const canvasGrades = extractCanvasGrades();
  if (canvasGrades.length > 0) {
    return canvasGrades;
  }

  // Try Moodle grade extraction
  const moodleGrades = extractMoodleGrades();
  if (moodleGrades.length > 0) {
    return moodleGrades;
  }

  // Try generic table extraction
  const tableGrades = extractTableGrades();
  if (tableGrades.length > 0) {
    return tableGrades;
  }

  return [];
}

/**
 * Extract grades from Canvas LMS gradebook
 */
function extractCanvasGrades() {
  const grades = [];

  // Look for Canvas gradebook tables
  const rows = document.querySelectorAll(
    '[data-view-id="gradebook"] table tbody tr, [class*="StudentGradeRow"] tr'
  );

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return;

    // Try to extract student name and grade
    const nameCell = cells[0];
    const gradeCell = cells[cells.length - 1];

    if (nameCell && gradeCell) {
      const name = nameCell.textContent.trim();
      const grade = gradeCell.textContent.trim();

      if (name && grade && !isNaN(parseFloat(grade))) {
        grades.push({
          name,
          grade: parseFloat(grade),
          source: "Canvas",
        });
      }
    }
  });

  return grades;
}

/**
 * Extract grades from Moodle gradebook
 */
function extractMoodleGrades() {
  const grades = [];

  // Look for Moodle gradebook tables
  const rows = document.querySelectorAll(
    "table.gradebook_table tbody tr, .gradebook_table tr[data-user-id]"
  );

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return;

    // First cell typically has student name
    const nameCell = cells[0];
    // Last cell typically has final grade
    const gradeCell = cells[cells.length - 1];

    if (nameCell && gradeCell) {
      const name = nameCell.textContent.trim();
      const grade = gradeCell.textContent.trim();

      // Extract numeric grade
      const numericGrade = parseFloat(grade.replace(/[^\d.-]/g, ""));

      if (name && !isNaN(numericGrade)) {
        grades.push({
          name,
          grade: numericGrade,
          source: "Moodle",
        });
      }
    }
  });

  return grades;
}

/**
 * Extract grades from generic HTML table
 * Fallback for unknown assessment systems
 */
function extractTableGrades() {
  const grades = [];

  // Look for any table that might contain grades
  const tables = document.querySelectorAll("table");

  tables.forEach((table) => {
    const rows = table.querySelectorAll("tbody tr, tr");
    
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td, th");
      if (cells.length < 2) return;

      // Look for columns with names and numeric values
      const potentialNameCell = cells[0];
      const potentialGradeCell = cells[cells.length - 1];

      if (potentialNameCell && potentialGradeCell) {
        const name = potentialNameCell.textContent.trim();
        const gradeText = potentialGradeCell.textContent.trim();
        const numericGrade = parseFloat(gradeText.replace(/[^\d.-]/g, ""));

        // Only add if it looks like a real entry
        if (
          name.length > 2 &&
          !isNaN(numericGrade) &&
          numericGrade >= 0 &&
          numericGrade <= 100
        ) {
          grades.push({
            name,
            grade: numericGrade,
            source: "Table",
          });
        }
      }
    });
  });

  return grades;
}

/**
 * Extract student list from the page
 */
function extractStudentsFromPage() {
  const students = [];

  // Try Canvas
  const canvasStudents = extractCanvasStudents();
  if (canvasStudents.length > 0) return canvasStudents;

  // Try Moodle
  const moodleStudents = extractMoodleStudents();
  if (moodleStudents.length > 0) return moodleStudents;

  return students;
}

/**
 * Extract students from Canvas
 */
function extractCanvasStudents() {
  const students = [];
  const rows = document.querySelectorAll('[data-view-id="gradebook"] table tbody tr');

  rows.forEach((row) => {
    const nameCell = row.querySelector("td");
    if (nameCell) {
      const name = nameCell.textContent.trim();
      if (name && name.length > 2) {
        students.push({ name });
      }
    }
  });

  return students;
}

/**
 * Extract students from Moodle
 */
function extractMoodleStudents() {
  const students = [];
  const rows = document.querySelectorAll("table.gradebook_table tbody tr");

  rows.forEach((row) => {
    const nameCell = row.querySelector("td");
    if (nameCell) {
      const name = nameCell.textContent.trim();
      if (name && name.length > 2) {
        students.push({ name });
      }
    }
  });

  return students;
}

/**
 * Get information about the current page
 */
function getPageInfo() {
  const url = window.location.href;
  const title = document.title;

  // Detect assessment system type
  let systemType = "unknown";
  if (url.includes("canvas")) {
    systemType = "Canvas";
  } else if (url.includes("moodle")) {
    systemType = "Moodle";
  }

  return {
    url,
    title,
    systemType,
    timestamp: new Date().toISOString(),
  };
}

// Optionally inject a script to extract data from protected contexts
function injectExtractionScript() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// Inject on page load if needed for deeper access
injectExtractionScript();
