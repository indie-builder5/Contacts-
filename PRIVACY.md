# Privacy in Contacts−

Contacts− processes contact files locally in your browser. It has no contact upload endpoint, account system, analytics, trackers or remote contact API. It does not log contact contents. The original uploaded file is never modified.

## Saved progress

The imported contacts, their original vCard properties, filename, import warnings, selected contact IDs and save timestamp are stored in your browser's IndexedDB (`contacts-minus`, `session` store, `current` record). Autosave runs after imports and selection changes. **Save progress** confirms the latest write. The data is retained so refreshing or closing the tab does not require re-importing and reselecting.

Storage is scoped to your current site URL origin and browser profile. It does not sync between devices. The application does not encrypt it. Anyone with access to your browser profile may access the saved contacts. On shared computers, use **Clear uploaded contacts** when finished.

**Clear selection** removes selection IDs but retains the contact list. **Clear uploaded contacts** removes the saved record and clears contacts, selections and undo history from the current tab. Clearing this site's data through your browser also removes the saved session. A second already-open tab may retain its own in-memory copy and save it again; use one working tab and close other tabs before clearing. Deletion uses the browser's storage API and is not a forensic disk-erasure guarantee.

If browser storage is unavailable, full or removed by the browser, restoration may fail. The app shows save errors and keeps the current in-memory workflow available. Retain the original backup and export your selection before closing if saving fails. Private browsing commonly clears data when its session ends.

## Hosting and exports

Your hosting provider receives ordinary website requests and may retain access metadata such as IP addresses and browser headers under its own policies. These requests do not contain your imported contacts. This repository does not include third-party scripts or hosted font requests.

Export creates a VCF download on your device. That downloaded file is managed by your operating system and is not removed when you clear the app's session. Importing it into Android or Google Contacts is a separate action controlled by you; those apps and accounts have their own data policies.

Never submit real contact files in public issues, screenshots, bug reports or pull requests. Use the included fictional samples or redact identifying fields before sharing diagnostics.
