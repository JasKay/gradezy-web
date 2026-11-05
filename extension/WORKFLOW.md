# Gradezy unified assessment extension

## Current prototype
The extension opens its existing local CSV matching UI as a persistent Edge/Chrome side panel. This change does **not** enable direct Moodle extraction, Excel Online access, SharePoint writes, or StaffAdvantage automation.

## Planned adapters
- Moodle: inspect authorised Turnitin export or page, capture selected assessment records.
- Excel Online: detect workbook context; use supported workbook APIs only with appropriate permissions.
- SharePoint: identify Progress Tracker, preview deterministic matches and obtain explicit approval before changes.
- StaffAdvantage: integrate existing Grade Fill functionality only after reviewing its source code and permissions.

## Safety
Do not transfer identifiable student data to external services or personal browser profiles without institutional approval. Match on stable identifiers and assessment scope; reject ambiguous matches, log reviewed changes, and never overwrite grades automatically.
