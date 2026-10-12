# Security

Do not attach real contacts to public issues. Report parser problems with a minimal fictional fixture and your browser/version.

For a vulnerability that could expose contact contents, contact the maintainer privately at **ashokkyadav200@gmail.com** with a description and a fictional reproduction. Do not email real contact backups.

Contacts− has no backend or account system. Its main security boundaries are local file parsing, React's safe text rendering, local browser storage and static site delivery. Progress is intentionally saved to IndexedDB and is not application-encrypted. Deploy over HTTPS and keep dependencies updated.
