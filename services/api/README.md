# 115b_sys API (Migration MVP)

Node.js read-path API for 115b_sys, backed by Postgres.

## What this includes (Day 3)

- Express API service
- Postgres schema migration (`migrations/001_init.sql`)
- Internal pull sync from Apps Script (`syncPullSnapshot`)
- Read endpoints:
  - `GET /health`
  - `GET /v1/events`
  - `GET /v1/students`
  - `GET /v1/group-memberships`
  - `GET /v1/lookup-student?email=...`
  - `GET /v1/bootstrap/home?email=...`
  - `GET /v1/bootstrap/registration?eventId=...&email=...`
  - `GET /v1/bootstrap/checkin?eventId=...&email=...`
  - `GET/POST /v1/checkin-status`
- Write endpoints (Node DB write + mirror to Apps Script):
  - `POST /v1/register`
  - `POST /v1/checkin`
  - `POST /v1/update-registration`
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

## Optional ops scripts

- Reconcile Apps Script snapshot counts vs Postgres:

```bash
npm run reconcile:snapshot
```

- Quick latency benchmark (Node vs Apps Script read path):

```bash
BENCH_API_V2_URL=https://one15b-sys.onrender.com BENCH_ITERATIONS=10 npm run bench:reads
```

## Required Apps Script change

`backend/Code.gs` must support internal action `syncPullSnapshot` and validate `SYNC_PULL_TOKEN` script property.

## Security note

- Keep `SYNC_PULL_TOKEN`, `SESSION_SECRET`, and `DATABASE_URL` in server-side env only.
- Never commit `.env`.
