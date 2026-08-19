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

## Local docs / guardrails

- `JSONB_WRITE_RULES.md` — JSON / JSONB 寫入規範
- `MIGRATION_SAFETY_TEMPLATE.md` — 既有資料先清洗、再加 constraint 的 migration 模板

## Attachment storage env

Attachment v1 uses Supabase Storage (private bucket).

Required / recommended env:

- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only; never expose to frontend
- `SUPABASE_ATTACHMENT_BUCKET` — defaults to `attachments`
- `SUPABASE_ACTIVITY_ALBUM_BUCKET` — defaults to the private `activity-albums` bucket
- `SUPABASE_STORAGE_MONITORING_QUOTA_BYTES` — optional, approved project-scoped quota in bytes; required before remaining capacity/percentage is calculated
- `SUPABASE_STORAGE_MONITORING_PLAN_LABEL` — optional label for that approved project quota
- `ATTACHMENT_SIGNED_URL_TTL_SECONDS` — defaults to `1800`
- `ATTACHMENT_MAX_FILE_SIZE_BYTES` — defaults to `20971520` (20 MB)

Activity album uploads use a Supabase signed upload capability fixed by Supabase at 2 hours (7,200 seconds), with overwrite disabled. It is not immediately revocable after issuance; the API blocks revoked members from complete/read operations and the global orphan sweep eventually removes uncompleted objects.

Runtime notes:

- bucket should be **private**
- backend signs read URLs dynamically
- frontend must never receive the service role key

## Storage monitoring

The management screen calls the admin-only `GET /v1/admin/storage-monitoring` route. Its used-byte value is an actual Supabase Storage `storage.objects` metadata snapshot across the current project's buckets, not a sum of `activity_photos` or `attachments` rows. The response contains only aggregate bucket/type information (never object paths, names, or credentials), current usage, a snapshot time, and 70/85/95% statuses.

The existing server database connection reads the Supabase Storage system catalog. A quota is deliberately unavailable until Mary/Linus configures the approved, project-scoped `SUPABASE_STORAGE_MONITORING_QUOTA_BYTES` value; the service does not guess an organization billing quota from a plan name. No service or management key is exposed to the browser.

## Security note

- Keep `SESSION_SECRET`, `DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in server-side env only.
- Never commit `.env`.
