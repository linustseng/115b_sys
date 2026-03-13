# 115b_sys API

Node.js runtime API for 115b_sys, backed by PostgreSQL.

## What this includes

- Express API service
- Postgres schema migration (`migrations/001_init.sql`)
- Node-only runtime endpoints
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
- Write endpoints (Node DB only):
  - `POST /v1/register`
  - `POST /v1/checkin`
  - `POST /v1/update-registration`
- Auth/session endpoints:
  - `POST /v1/auth/verify-google` (input: `idToken`)
  - `POST /v1/auth/create-session` (input: `sessionToken` or `idToken`)
  - `GET/POST /v1/memberships/my` (input: Bearer `sessionToken` or `idToken`)
- Internal sync endpoints removed from runtime

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

4. Start API:

```bash
npm run dev
```

## Optional ops scripts

- Quick latency benchmark:

```bash
BENCH_API_V2_URL=https://one15b-sys.onrender.com BENCH_ITERATIONS=10 npm run bench:reads
```

## Legacy Google tooling

Legacy Google migration / reconciliation tooling has been moved under:

- `services/api/scripts/legacy/`
- `legacy/google-apps-script/`

If you need to audit or backfill against the archived Google source, use the `legacy:*` npm scripts.

## Security note

- Keep `SESSION_SECRET` and `DATABASE_URL` in server-side env only.
- `SYNC_PULL_TOKEN` is only needed for legacy Google migration tooling.
- Never commit `.env`.
