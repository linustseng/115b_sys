# Legacy Google Migration Scripts

These scripts depend on the archived Google Apps Script / Google Sheets source.
They are **not part of the production runtime path**.

## Use cases

- Historical reconciliation
- One-time migration / repair
- Legacy audit against Google source

## Run via npm

From `services/api/`:

- `npm run legacy:sync:pull`
- `npm run legacy:backfill:cutover`
- `npm run legacy:reconcile:snapshot`
- `npm run legacy:audit:only`
- `npm run legacy:repair:dry-run`
- `npm run legacy:repair:apply`

## Notes

- These scripts still rely on `APPS_SCRIPT_URL` and `SYNC_PULL_TOKEN`.
- Do not use them as the default operational path for new work.
