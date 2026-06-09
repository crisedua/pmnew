# Walkthrough: Bug Fixes

## 1. Bug Fix: Document Upload Error
We resolved the `invalid input syntax for type uuid` error when uploading documents.
- **Cause:** The `uploaded_by` field was hardcoded to a string `'Usuario Actual'`.
- **Fix:** We updated `DocumentsTab.jsx` to fetch the authenticated user's ID and use that instead.

## Verification
-   [x] Upload a document to verify the fix.
