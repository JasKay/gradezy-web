# Gradezy Assessment Companion — browser extension

**Canonical extension package:** `public/extension/`. The separate top-level `extension/` directory is an earlier local CSV prototype and should not be used for the unified integration.

## Current development build (v1.3.0; draft PR)

Gradezy is a persistent Microsoft Edge / Chrome side-panel workspace. It recognises supported browser tabs and offers the following **user-initiated** operations:

| Site | Supported now | Not yet supported |
| --- | --- | --- |
| Moodle | Capture visible Turnitin Email / Paper ID tables, or stage CSV / TSV exports with an explicit assessment label and first / resubmission attempt | Extraction from hidden Moodle APIs, automatic interception of XLSX downloads |
| SharePoint Progress Tracker | Preview deterministic ESL Email matches against visible tables, or load a CSV / TSV export. Propose blank Paper ID updates, preserve conflicting existing IDs | Direct edits to the live SharePoint list |
| Excel Online | Recognise Excel pages; import an exported CSV / TSV for tracker matching or grade staging | Reading workbook cells through Microsoft Graph / Office APIs without authorised integrations |
| StaffAdvantage | Read visible student records, stage grade CSV data by exact NCG ID, preview matches / conflicts, populate **blank** editable grade inputs only after explicit approval | Clicking Save / Submit, automatic overwrites, unreviewed grade submission |

This package retains the StaffAdvantage extraction and external messaging API used by the existing Gradezy website. The published Microsoft Edge store extension remains unchanged until a new build is reviewed and separately published.

**Known limits:** Moodle and SharePoint page layouts vary. Some tables are virtualised, hidden in frames, or lack the required headers. When Gradezy cannot safely identify a record or destination, it must stop and use the CSV fallback. The browser extension supports CSV/TSV rather than XLSX directly. Neither direct Moodle extraction nor StaffAdvantage grade filling has been verified against live institutional pages.

## Install the development build

1. Check out the `feature/gradezy-unified-sidepanel` branch.
2. Open `edge://extensions` or `chrome://extensions`; enable Developer mode.
3. Choose **Load unpacked** and select the `public/extension/` directory.
4. Pin Gradezy and click its toolbar icon. The persistent side panel opens and identifies the active tab.
5. On a Moodle page, enter the assessment/module and attempt, then capture visible records or choose a CSV export.
6. Switch to the authorised SharePoint Progress Tracker or Excel page. Confirm the assessment scope, preview matches, and optionally download a reviewed CSV.
7. For grade entry, stage a CSV with **NCG ID** and **Grade** columns, open the correct StaffAdvantage assessment, preview exact-ID matches, confirm the student list, and only then choose **Populate reviewed grade fields**. Inspect the on-screen results before any final action.

The unpacked extension has a different extension ID from the published Edge add-on, so the Gradezy website's existing hard-coded store ID will continue to refer to the installed store extension until the published build is upgraded.

## Data protection and scope

- Institutional authorisation is required before accessing student assessment data from a personal browser or workstation.
- Grade and submission records are temporarily staged in `chrome.storage.session`, not uploaded to the Gradezy website by this workflow. The **Clear saved assessment records** button removes stored session data.
- Optional HTTPS site permissions are requested individually when the user explicitly asks to inspect a page. StaffAdvantage retains its existing host permission.
- Paper IDs match by ESL Email only when unambiguous. First-attempt and resubmission destination columns are distinct.
- Grade filling matches by **exact NCG ID**, rejects duplicate IDs, missing / invalid grades and conflicting populated fields, and requires an explicit preview. Approval expires after 5 minutes or a page change.
- Grade filling dispatches input/change events and **does not click Save or Submit**. StaffAdvantage may autosave changes depending on the site's behaviour; review with fictional data before any real use.
- The private Streamlit/Playwright grade-review project's source and credentials have **not** been copied into this public repo. Its NCG ID matching workflow was independently adapted with additional safeguards.

## Development checks

Run `npm test` to execute the extension contract and matching smoke tests along with existing application tests. Validate the unpacked side panel on Edge and Chrome, particularly domain detection, permissions, exported CSV formats, virtualised SharePoint grids, and StaffAdvantage's grade-entry events, before merging or releasing.

## Architecture

`sidepanel.html` / `sidepanel.js` handle current-page awareness, CSV parsing, temporary record staging, and previews. `content.js` exposes StaffAdvantage read and reviewed blank-grade-entry operations; `background.js` retains the website-to-StaffAdvantage bridge and enables side-panel launch. The old `popup.*` files remain only for backwards compatibility and are no longer the toolbar UI.
