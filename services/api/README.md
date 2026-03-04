# 115b_sys API (Migration MVP)

Node.js read-path API for 115b_sys, backed by Postgres.

## What this includes (Day 1 scaffold)

- Express API service
- Postgres schema migration (`migrations/001_init.sql`)
- Internal pull sync from Apps Script (`syncPullSnapshot`)
- Read endpoints:
  - `GET /health`
  - `GET /v1/events`
  - `GET /v1/bootstrap/home?email=...`
- Auth/session endpoints:
  - `POST /v1/auth/verify-google` (input: `idToken`)
  - `POST /v1/auth/create-session` (input: `sessionToken` or `idToken`)
  - `GET/POST /v1/memberships/my` (input: Bearer `sessionToken` or `idToken`)
- Internal endpoints:
  - `POST /internal/sync/pull` (Bearer token)
  - `GET /internal/sync/runs?limit=20` (Bearer token)

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Install packages:

```bash
npm install
```

3. Run migration:

```bash
npm run migrate
```

4. Pull first snapshot from Apps Script:

```bash
npm run sync:pull
```

5. Start API:

```bash
npm run dev
```

## Required Apps Script change

`backend/Code.gs` must support internal action `syncPullSnapshot` and validate `SYNC_PULL_TOKEN` script property.

## Security note

- Keep `SYNC_PULL_TOKEN`, `SESSION_SECRET`, and `DATABASE_URL` in server-side env only.
- Never commit `.env`.
