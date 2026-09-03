/**
 * Gradezy Extension - Popup Script
 * 
 * Handles popup UI interactions and grade extraction
 */

let extractedGrades = [];

// DOM elements
const extractBtn = document.getElementById("extractBtn");
const sendBtn = document.getElementById("sendBtn");
const openOptionsLink = document.getElementById("openOptions");
const systemTypeDiv = document.getElementById("systemType");
const pageTitleDiv = document.getElementById("pageTitle");
const gradesSection = document.getElementById("gradesSection");
const gradesList = document.getElementById("gradesList");
const statusSection = document.getElementById("statusSection");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  getPageInfo();
  extractBtn.addEventListener("click", extractGrades);
  sendBtn.addEventListener("click", sendToGradezy);
  openOptionsLink.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});

/**
 * Get information about the current page
 */
function getPageInfo() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    pageTitleDiv.textContent = tab.title;

    // Detect system type from URL
    let systemType = "Unknown";
    if (tab.url.includes("canvas")) {
      systemType = "Canvas LMS";
    } else if (tab.url.includes("moodle")) {
      systemType = "Moodle";
    }

    systemTypeDiv.textContent = systemType;
  });
}

/**
 * Extract grades from the current page
 */
function extractGrades() {
  extractBtn.disabled = true;
  extractBtn.textContent = "Extracting...";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "extractGrades" },
      (response) => {
        extractBtn.disabled = false;
        extractBtn.textContent = "Extract Grades";

        if (response && response.success) {
          extractedGrades = response.data;

          if (extractedGrades.length > 0) {
            displayGrades();
            showStatus(`Found ${extractedGrades.length} grades`, "success");
            sendBtn.disabled = false;
          } else {
            showStatus("No grades found on this page", "error");
          }
        } else {
          showStatus("Failed to extract grades", "error");
        }
      }
    );
  });
}

/**
 * Display extracted grades
 */
function displayGrades() {
  gradesSection.style.display = "block";
  gradesList.innerHTML = "";

  extractedGrades.slice(0, 10).forEach((grade) => {
    const item = document.createElement("div");
    item.className = "grade-item";
    item.innerHTML = `
      <span class="grade-name">${grade.name}</span>
      <span class="grade-value">${grade.grade}</span>
    `;
    gradesList.appendChild(item);
  });

  if (extractedGrades.length > 10) {
    const more = document.createElement("div");
    more.className = "grade-item";
    more.style.textAlign = "center";
    more.style.color = "#8b8b8b";
    more.textContent = `+${extractedGrades.length - 10} more`;
    gradesList.appendChild(more);
  }
}

/**
 * Send extracted grades to Gradezy
 */
function sendToGradezy() {
  if (extractedGrades.length === 0) {
    showStatus("No grades to send", "error");
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  // Send to background script
  chrome.runtime.sendMessage(
    {
      action: "sendToGradezy",
      data: {
        grades: extractedGrades,
        timestamp: new Date().toISOString(),
      },
    },
    (response) => {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send to Gradezy";

      if (response && response.success) {
        showStatus(`Sent ${extractedGrades.length} grades to Gradezy`, "success");

        // Try to open Gradezy in a new tab
        chrome.tabs.create({ url: "http://localhost:3000" });
      } else {
        showStatus("Failed to send grades", "error");
      }
    }
  );
}

/**
 * Show status message
 */
function showStatus(message, type = "info") {
  const status = document.createElement("div");
  status.className = `status ${type}`;

  let icon = "ℹ";
  if (type === "success") icon = "✓";
  if (type === "error") icon = "✕";

  status.innerHTML = `
    <span class="status-icon">${icon}</span>
    <span>${message}</span>
  `;

  statusSection.innerHTML = "";
  statusSection.appendChild(status);

  // Auto-remove after 5 seconds if success
  if (type === "success") {
    setTimeout(() => {
      status.style.opacity = "0";
      status.style.transition = "opacity 0.3s";
      setTimeout(() => status.remove(), 300);
    }, 3000);
  }
}
