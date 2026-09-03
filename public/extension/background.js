/**
 * Gradezy Extension - Background Service Worker
 * 
 * Manages extension lifecycle and communication with Gradezy app
 */

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendToGradezy") {
    // Forward extracted grades to the Gradezy app
    sendToGradezApp(request.data, sender.url);
    sendResponse({ success: true });
  } else if (request.action === "getStoredData") {
    // Retrieve stored assessment data
    chrome.storage.local.get("currentAssessment", (result) => {
      sendResponse(result);
    });
    return true; // Will respond asynchronously
  }
});

/**
 * Send extracted grade data to the Gradezy app
 */
function sendToGradezApp(data, sourceUrl) {
  // Store the data in chrome storage
  chrome.storage.local.set({
    lastExtractedData: {
      data,
      sourceUrl,
      timestamp: new Date().toISOString(),
    },
  });

  // Try to send to Gradezy via messaging
  chrome.tabs.query({ url: "http://localhost:3000/*" }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(
        tab.id,
        {
          action: "receiveGradesFromExtension",
          data,
          sourceUrl,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.log("Could not reach Gradezy tab");
          } else {
            console.log("Sent grades to Gradezy:", response);
          }
        }
      );
    });
  });
}

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});

/**
 * Listen for messages from the Gradezy web app
 */
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type && event.data.type === "GRADEZY_REQUEST") {
    if (event.data.action === "extractGrades") {
      // Forward to active content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, event.data, (response) => {
          window.postMessage(
            { type: "GRADEZY_RESPONSE", data: response },
            "*"
          );
        });
      });
    }
  }
});
