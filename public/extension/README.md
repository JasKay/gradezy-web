# Gradezy Browser Extension

The Gradezy Assessment Assistant is a browser extension that enables direct extraction and import of grade data from assessment systems (Canvas, Moodle, StaffAdvantage, etc.) into the Gradezy platform.

## Features

- **Auto-extract grades** from Canvas gradebooks, Moodle grade tables, and other assessment systems
- **Direct import** to Gradezy assessments without manual file export/upload
- **Support multiple systems** with flexible data parsing
- **One-click import** for grades and student records

## Installation

### For Development

1. Navigate to `chrome://extensions/` in your Chrome browser
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `/public/extension` directory from this repository
5. The extension will appear in your browser toolbar

### For Production

The extension will be published to the Chrome Web Store once ready for public release.

## How It Works

### Architecture

```
Assessment System (Canvas/Moodle) ←→ Content Script
                                         ↓
                                  Background Service Worker
                                         ↓
                                   Chrome Storage
                                         ↓
                                   Gradezy App
```

### Components

#### `manifest.json`
- Defines extension permissions, scripts, and UI
- Specifies host permissions for assessment system websites
- Declares content scripts and background service worker

#### `content.js`
- Runs on assessment system pages
- Detects and parses grade tables from different systems
- Extracts student names and grades from HTML
- Responds to extraction requests from the popup

#### `background.js`
- Service worker for extension lifecycle
- Manages communication between content scripts and Gradezy app
- Stores extracted data in Chrome storage

#### `popup.html` / `popup.js`
- User-facing extension popup
- Shows current page information
- Displays extracted grades preview
- Buttons to extract and send grades to Gradezy

#### `injected.js`
- Runs in page context for deeper API access
- Can interact with Canvas/Moodle JavaScript APIs
- Enables access to assessment system data structures

## Usage

### Extracting Grades

1. **Open an assessment system gradebook** (Canvas, Moodle, etc.)
2. **Click the Gradezy extension icon** in your toolbar
3. **Click "Extract Grades"** button
4. View preview of extracted student names and grades
5. **Click "Send to Gradezy"** to import into your assessment

### Supported Systems

#### Canvas LMS
- Automatically detects Canvas gradebooks
- Extracts student names from roster
- Parses final grades from grade column

#### Moodle
- Recognizes Moodle gradebook tables
- Extracts student records and grades
- Supports Moodle 3.x+ interfaces

#### Other Systems
- Falls back to generic HTML table parsing
- Attempts to identify numeric grade columns
- Works with any system that displays data in tables

## Data Extraction Logic

### Grade Detection

The extension uses multiple strategies to find grades:

1. **System-specific selectors** (Canvas, Moodle)
2. **HTML table scanning** looking for student rows and numeric columns
3. **Pattern matching** to identify valid grade values (0-100)

### Student Name Parsing

- Looks for text in first column of grade table rows
- Filters out common headers and empty rows
- Normalizes names by trimming whitespace

### Grade Value Extraction

- Extracts numeric values from grade cells
- Handles different formats (points, percentages, letters)
- Validates that grades are in reasonable range (0-100)

## Integration with Gradezy

### Data Flow

1. Extension extracts grades and sends to background worker
2. Background worker stores data in Chrome storage
3. Gradezy app receives message with extracted grades
4. Grades are parsed into standard student format
5. Student records are stored in assessment workspace
6. Reconciliation automatically runs

### API

The extension provides TypeScript types and utility functions for communication:

```typescript
// Check if extension is available
const available = isExtensionAvailable();

// Request grades from assessment system
const grades = await requestGradesFromExtension();

// Listen for grades sent by extension
listenForExtensionMessages((message) => {
  if (message.type === 'gradesReceived') {
    // Process received grades
  }
});
```

## Security Considerations

### Permissions

The extension requests minimal necessary permissions:

- `scripting` - Execute scripts on assessment system pages
- `activeTab` - Access current tab information
- `storage` - Store extracted data locally
- Host permissions for Canvas and Moodle domains

### Data Storage

- Grade data is stored locally in Chrome storage only
- Data is not transmitted to external servers
- Data is cleared when extension is uninstalled
- No tracking or analytics

### Future Enhancements

- OAuth authentication for direct API access to Canvas/Moodle
- Encrypted storage for sensitive grade data
- Backend sync with optional cloud storage
- User audit logs for data access

## Troubleshooting

### Extension not detecting grades

- Verify you're on a supported assessment system
- Check that the page fully loads (wait for loading indicators)
- Try clicking "Extract Grades" multiple times
- Open DevTools (F12) to check for JavaScript errors

### Grades not importing to Gradezy

- Make sure Gradezy tab is open in browser
- Verify extension is enabled in `chrome://extensions/`
- Try refreshing the Gradezy page
- Check browser console for errors

### Unsupported assessment system

- The extension can attempt to extract from any system with HTML tables
- For specialized systems, contact Gradezy support to add direct API support
- You can always manually export and upload data as CSV/XLSX

## Development

### File Structure

```
public/extension/
├── manifest.json          # Extension configuration
├── content.js             # Content script for page access
├── background.js          # Service worker
├── injected.js            # Page context script
├── popup.html             # Popup UI markup
├── popup.js               # Popup UI logic
└── icons/                 # Extension icons (TODO)

lib/
└── extension-communication.ts  # Shared types and utilities
```

### Testing

1. Load extension unpacked in development mode
2. Open test assessment system page
3. Click extension popup to test UI
4. Check extracted data in popup preview
5. Verify data imports correctly to Gradezy

### Future Work

- [ ] Publish to Chrome Web Store
- [ ] Create extension icons for branding
- [ ] Add Canvas/Moodle direct API integration
- [ ] Support for additional assessment systems
- [ ] Grade validation and conflict detection
- [ ] Bulk import from multiple gradebooks
- [ ] Options page for system configuration
- [ ] Background grade sync from assessment systems

## Support

For issues or feature requests related to the extension:

1. Check this README for troubleshooting
2. Review browser console for error messages
3. Contact Gradezy support with details about your assessment system
4. Share system name, version, and error messages for faster resolution

## License

The Gradezy browser extension is part of the Gradezy Assessment Operations Intelligence Platform.
