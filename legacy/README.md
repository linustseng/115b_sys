# Legacy Google Tooling

This directory contains archived Google-based tooling that is **not part of the production runtime**.

## What lives here

- `google-apps-script/`
  - Archived Apps Script project (`Code.gs`, `.clasp.json`, `appsscript.json`, templates)
  - Historical Google Sheets / Apps Script backend reference

## Policy

- Production traffic should go through Node + PostgreSQL only.
- Do not use this directory as the default implementation path for new features.
- Only use it when you explicitly need legacy migration, historical audit, or one-time reconciliation work.

## Related legacy API scripts

Legacy Google-dependent scripts remain under:

- `services/api/scripts/legacy/`

Run them via `npm run legacy:*` commands from `services/api/`.
