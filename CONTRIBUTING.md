# Contributing

Use Node 24 LTS and `npm ci`. Run `npm run dev` for development and `npm run check` before submitting changes. For workflow changes, also run `npx playwright install chromium` and `npm run test:e2e`.

Use fictional fixtures only. Never commit real contact backups, contact screenshots, exports, saved session dumps or logs with names, phone numbers or email addresses. Tests and screenshot generation use the included fictional samples.

Keep import/export logic independent of the UI. Preserve unsupported vCard properties, maintain selection IDs across filtering and pagination, and avoid network calls that carry contact data. Changes to saved progress must maintain the clear-data behavior and serialized write order.

Explain the user-visible issue, the resulting behavior, and validation performed in your pull request. Include format-specific fixtures for parser changes. Test responsive behavior and keyboard access for UI changes.
