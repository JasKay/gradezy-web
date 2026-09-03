/**
 * Gradezy Extension - Injected Script
 * 
 * Runs in page context to access protected/API data from assessment systems
 */

(function () {
  // This script runs in the page context and can access page APIs
  
  /**
   * Try to extract grades via Canvas API
   */
  function getCanvasGrades() {
    try {
      if (window.ENV && window.ENV.current_user_id) {
        // Canvas stores grade data in the page environment
        const courseId = window.ENV.course_id;
        if (courseId) {
          // Could make API calls here if authenticated
          console.log("Canvas course:", courseId);
        }
      }
    } catch (e) {
      console.error("Canvas API access failed:", e);
    }
  }

  /**
   * Try to extract grades via Moodle
   */
  function getMoodleGrades() {
    try {
      if (window.M && window.M.cfg) {
        // Moodle stores config in window.M.cfg
        const courseId = window.M.cfg.courseId;
        if (courseId) {
          console.log("Moodle course:", courseId);
        }
      }
    } catch (e) {
      console.error("Moodle API access failed:", e);
    }
  }

  // Initialize on page load
  getCanvasGrades();
  getMoodleGrades();

  // Listen for messages from content script
  window.addEventListener("message", (event) => {
    if (event.data.type === "GRADEZY_EXTRACT_REQUEST") {
      // Process extraction request
      const result = {
        type: "GRADEZY_EXTRACT_RESPONSE",
        data: {
          // Could extract from APIs here
        },
      };
      event.source.postMessage(result, "*");
    }
  });
})();
