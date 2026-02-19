// Rename this file to "config.js" and paste your Google Apps Script Web App URL here.
// DO NOT commit the "config.js" file to your repository if it's public.
export const SCRIPT_URL = 'https://europe-west6-keen-surfer-465508-f2.cloudfunctions.net/assignmentHandler';

// ✅ NEW: ORG_PREFIX split into Content (Read) and Submission (Write)
// CONTENT_ORG: Where to read the assignment definitions from (Shared folder)
export const CONTENT_ORG = 'HFP';

// SUBMISSION_ORG: Where to write student submissions to (Private folder)
export const SUBMISSION_ORG = 'HFP_ALT';

// Keep ORG_PREFIX for backward compatibility if needed, but we should migrate away.
export const ORG_PREFIX = SUBMISSION_ORG;