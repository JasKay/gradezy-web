/* Gradezy MV3 service worker: connects Gradezy web to StaffAdvantage tabs. */
function activeStaffAdvantageTab() {
  return new Promise((resolve) => chrome.tabs.query({ url: "https://staffadv.ncgrp.co.uk/*" }, (tabs) => {
    const ordered = [...tabs].sort((left, right) => (right.lastAccessed || 0) - (left.lastAccessed || 0));
    resolve(ordered[0] || null);
  }));
}
function sendToStaffAdvantage(action) {
  return activeStaffAdvantageTab().then((tab) => new Promise((resolve) => {
    if (!tab?.id) { resolve({ success: false, error: "Open the StaffAdvantage assessment page, then try again." }); return; }
    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
      if (chrome.runtime.lastError) { resolve({ success: false, error: "Gradezy could not access the StaffAdvantage page. Refresh it and try again." }); return; }
      resolve(response || { success: false, error: "No response from StaffAdvantage." });
    });
  }));
}
chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
  if (request.action === "gradezyPing") { sendResponse({ success: true, data: { extension: "Gradezy", version: "1.2.0" } }); return; }
  if (request.action === "readStaffAdvantageStudents" || request.action === "getStaffAdvantagePageInfo") { sendToStaffAdvantage(request.action).then(sendResponse); return true; }
  sendResponse({ success: false, error: "Unsupported Gradezy request." });
});
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (["extractGrades", "extractStudents", "getPageInfo", "readStaffAdvantageStudents", "getStaffAdvantagePageInfo"].includes(request.action)) { sendToStaffAdvantage(request.action).then(sendResponse); return true; }
});
