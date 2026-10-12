# SmartSync
SmartSync appears under Integrations alongside the existing source register. It uses real Microsoft Graph calls; no successful connection or write is simulated. Local sample mode exercises the matching algorithm only and cannot write to Microsoft.

## Microsoft setup
Register a single-tenant confidential web app in Microsoft Entra. Add delegated Microsoft Graph Files.ReadWrite and User.Read permissions, obtain institutional consent as required, and register the exact web redirect URI `<SMARTSYNC_ORIGIN>/api/smartsync/callback`.
Set these server-only environment variables:
- MICROSOFT_CLIENT_ID
- MICROSOFT_CLIENT_SECRET
- MICROSOFT_TENANT_ID (institution tenant UUID)
- SMARTSYNC_ORIGIN (trusted app origin, HTTPS in production; localhost for development)
- SMARTSYNC_SECRET (random secret of at least 32 characters, generated outside version control)

OAuth uses state validation and PKCE. Access tokens are encrypted in HttpOnly SameSite cookies, never returned to JavaScript or localStorage. Reconnect after the access token expires; offline refresh is intentionally not enabled. Use an HTTPS deployment and restrict access to institutional staff with your deployment's authentication gateway. The current app has no server-side staff account model. The Moodle adapter additionally requires an explicit allowlist of Microsoft staff object IDs and verifies the signed-in account through Graph before using the institution service token. Saved profiles are local to the browser, not shared between staff.

Only .xlsx files in SharePoint or OneDrive for Business are supported. Paste the workbook sharing link, open it, choose the worksheet and map columns. First used row must contain headers. Identity columns must be distinct from output columns. Keep student IDs as text in Excel to retain leading zeroes. Similarity output values are numbers 0–100; choose a column with a compatible existing number format (not Excel's fractional percentage format).

## CSV and assessment scoping
Required case-insensitive headers: Email, Student ID, Turnitin User ID, Similarity Score, Assessment, Attempt.
User ID is the actual Turnitin user identifier, not a submission/paper ID. One or both identity fields must match. If both are present they must agree. Exact assessment and attempt filter prevents mixing first submissions with resubmissions. Source duplicates, workbook duplicates, identity conflicts, missing students, invalid scores and target formulas block sync. All flags must be resolved first.
Use public/samples/smartsync-turnitin.csv or the local test button. For a real workbook test, create a disposable .xlsx with those four output/identity headers and two students, then remove the missing record from the CSV. Confirm preview, sync, and verify unrelated formulas and formats manually.

## Authorized Moodle adapter
Core Moodle grade services do not establish that a Turnitin user ID and similarity report are exposed. An institution administrator must inspect its live web-service API documentation and installed Turnitin plugin.
Configure:
- SMARTSYNC_MOODLE_URL: fixed HTTPS Moodle REST service URL (e.g. https://moodle.example.edu/webservice/rest/server.php)
- SMARTSYNC_MOODLE_TOKEN: least-privilege read-only institutional service token
- SMARTSYNC_MOODLE_FUNCTION: an authorized installed function exposing the contract below
- SMARTSYNC_MOODLE_ALLOWED_USER_IDS: comma-separated Microsoft Entra object IDs of authorized staff; absent means retrieval is disabled

The adapter sends a POST with wstoken, wsfunction, moodlewsrestformat=json, module, assessment, attempt. Your function must enforce staff authorization and module access, and return:
```json
{"results":[{"email":"ada@example.edu","studentId":"00123","userId":"TI1001","similarity":"12","assessment":"Essay","attempt":"1"}]}
```
All fields are strings. This is an explicit custom adapter contract, not a claimed built-in Moodle or Turnitin function. Until the institution supplies it, automatic retrieval is unavailable. Direct Turnitin API credentials and license scopes need institutional approval and verification; no unsupported direct API is used.

## Browser extension investigation
The current public/extension manifest allows only StaffAdvantage; it has no Moodle or Turnitin host permission. Its current extraction does not guarantee Turnitin user IDs, similarity scores, assessment IDs or attempts and must not feed SmartSync automatically. A fallback would need narrowly scoped institution host permissions, explicit user-triggered extraction from an already-authorized page, identity/assessment/attempt metadata, validated messaging to the Gradezy origin, and the same conflict preview. DOM selectors must be tested on the institution's actual Moodle/Turnitin plugin and version. No credential bypass or extension automation is claimed to work.

## Write limitations
Preview tickets are encrypted, tied to the Microsoft access token and expire after ten minutes. The server re-reads the used range in a persistent workbook session and compares a fingerprint before writing only the approved single-cell values. It never uploads/replaces the workbook or patches formatting. A concurrent edit after that check is still possible: Graph does not provide a workbook-wide transaction or lock in this implementation. Avoid simultaneous editing during sync. Network failures can result in partial writes; the app reports confirmed updates and requires a new preview. There is no automatic rollback, retry or background sync. Maximum 10,000 rows, 200 columns, 1,000 cell updates per preview; large datasets require smaller batches.

Sources:
- https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/workbook-createsession?view=graph-rest-1.0
- https://docs.moodle.org/dev/Web_services
- https://developers.turnitin.com/turnitin-core-api/certification-review
