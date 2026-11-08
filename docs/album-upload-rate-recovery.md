# Album upload rate recovery (2026-11-08)

The deployed 600/hour limit still rejected a member with 1,408 legacy attempts:
old code recorded every rejection, turning retries into additional quota usage.
There is no 60-photo album capacity limit.

Migration 033 preserves all historical audit records, marking them non-admitted;
the corrected quota starts fresh once at rollout. New admitted attempts alone
consume 3,000/member/hour and 6,000/IP/hour (raised by Linus on 2026-11-08). Validation failures after admission
still consume quota. Rejected quota requests neither insert nor extend cooldown.
A transaction/table lock serializes admission across processes/shared IPs.
The API returns Retry-After and exposes admitted-v2 plus Render revision at /health.

Do not roll back the migration or erase audit/photo records. Old frontend queues
may still have a one-hour in-memory pause; reloading loses their file references.
After release, users can reopen the page and select only previously failed files.

Validation: limiter boundary unit tests; existing auth/security route tests;
rollback-only PostgreSQL temporary-table test of 600 admissions and request 601.

## Large album read recovery
677 ready rows exposed a false empty state while the photo request was pending.
The old API fired one Storage signing request per photo at once. Now it signs
authorized rows in sequential batches of 100 (677 photos = 7 calls), checks
missing/failed signatures, and preserves row order. No photo/permission changes.
The UI distinguishes loading/error/empty, offers retry, clears stale photos,
and ignores responses from an album opened before the current selection.
Verification: nine API tests; Vite production build; 390x844 Chromium fixture
loading -> API failure -> retry -> rendered photo (no false empty state).
