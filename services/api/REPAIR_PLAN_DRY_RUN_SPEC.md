# 115b_sys Repair Plan + Dry-Run Backfill Spec

_Last updated: 2026-03-13 Asia/Taipei_

## Context

Current state is **not** a clean one-time cutover from Google Sheets / Apps Script to PostgreSQL.

The new read-only audit (`npm run audit:only`) shows three distinct problems:

1. **Schema gaps**: some legacy Sheets do not have corresponding PostgreSQL tables yet.
2. **Read coverage gaps**: some legacy datasets exist in Apps Script, but no read action / snapshot path exposes them for audit or backfill.
3. **Data drift**: some PostgreSQL tables already contain DB-only rows or field values not present in the legacy source.

This means repair must be done in a **safe, staged** way. We cannot assume:

- Google Sheets is the only truth for every dataset, or
- PostgreSQL is a perfect mirror of Google Sheets, or
- current backfill scripts are safe to run blindly.

---

## Audit Baseline (2026-03-13)

### Summary

- Audited datasets: **17**
- Dataset mismatches: **6**
- Missing expected tables: **5**
- Schema-only sheets / read-path gaps: **6**

### Missing expected tables

The following sheet-backed domains are expected but currently missing in PostgreSQL:

- `directory_logs`
- `admin_users`
- `announcements`
- `line_bindings`
- `agent_audit`

### Datasets with mismatch

- `registrations`: source 144 / db 149 (+5 db-only)
- `group_memberships`: source 87 / db 88 (+1 db-only)
- `finance_requests`: source 11 / db 14 (+3 db-only)
- `fund_payments`: source 47 / db 56 (+9 db-only)
- `softball_players`: source 44 / db 45 (+1 db-only)
- `softball_attendance`: source 152 / db 152 but still drift after ID canonicalization

### Directory special case

- row count matches: 53 / 53
- field-level diff rows: **7**
- examples include:
  - PG blank while Sheet has value
  - phone formatting drift (`912...` vs `0912...`)
  - true content drift (`company`, `title`, `preferredName`, birthday fields)

---

## Safety Warning

## Do NOT treat the current `backfill:cutover` script as a repair script.

Current `scripts/backfillCutover.js` uses **TRUNCATE + replace** semantics for several tables. That is unsafe for mixed-state datasets where PostgreSQL already contains DB-only rows created after cutover.

Unsafe-to-reuse-as-is for repair:

- `finance_requests`
- `finance_actions`
- `fund_events`
- `fund_payments`
- `order_plans`
- `order_responses`
- `softball_players`
- `softball_practices`
- `softball_fields`
- `softball_gear`
- `softball_attendance`
- `softball_config`

Repair must use a **dry-run classification step first**, then dataset-specific apply rules.

---

## Repair Objectives

### Primary objective

Make PostgreSQL reliable enough to be used as the authoritative runtime store **without silently losing legacy data**.

### Secondary objectives

1. Ensure every required legacy sheet has either:
   - a PostgreSQL table, and
   - a read path for audit / backfill,
   or is explicitly marked as deprecated.
2. Separate true DB-native rows from accidental drift.
3. Produce a repair process that is:
   - replayable,
   - inspectable,
   - dry-run first,
   - non-destructive by default.

### Non-goals for first repair pass

- No automatic writes back to Google Sheets.
- No auto-deletion of DB-only rows without explicit review.
- No broad “truncate and reload everything” strategy.

---

## Dataset Classification Policy

Repair should not use one rule for all tables.

### Class A — Mirror-safe datasets

These can be treated as mostly legacy-mirror datasets because audit currently shows no DB-only drift, or drift risk is low.

Recommended policy: **upsert from legacy source; allow optional replace after backup only if needed**.

- `events`
- `students`
- `checkins`
- `finance_category_types`
- `finance_roles`
- `fund_events`
- `order_plans`
- `softball_practices`
- `softball_fields`
- `softball_gear`
- `softball_config` (special singleton handling)

### Class B — Mixed-state datasets

These already contain DB-only rows in PostgreSQL. Repair must preserve and classify them.

Recommended policy: **source-to-DB upsert + preserve DB-only + classify DB-only origin**.

- `registrations`
- `group_memberships`
- `finance_requests`
- `fund_payments`
- `softball_players`
- `softball_attendance`

### Class C — Field-wise merge datasets

Counts match, but content differs at field level.

Recommended policy: **field-level diff + rule-based patch + manual review bucket**.

- `directories`

### Class D — Schema / read-path gap datasets

These cannot be repaired safely until table + read-path coverage exists.

- `directory_logs`
- `admin_users`
- `announcements`
- `notification_reads` (table exists, but no read action yet)
- `line_bindings`
- `agent_audit`

### Class E — Derived / runtime datasets

These are DB-native operational tables rather than direct Google Sheet mirrors.

- `notifications`
- `schema_migrations`
- `sync_runs`

These should **not** be backfilled from legacy sheet data directly.

---

## Source-of-Truth Policy (First Repair Pass)

### Legacy-authoritative for missing values

If the source (Apps Script / Sheet) has a non-empty value and PostgreSQL is empty, then legacy source is authoritative for first-pass repair.

Applies especially to:

- `directories.mobile`
- `directories.preferred_name`
- `directories.company`
- `directories.title`
- birthday fields

### Preserve DB-only rows by default

If a row exists in PostgreSQL but not in source:

- **do not delete in first pass**
- classify as one of:
  - `db_only_expected_local`
  - `db_only_unexpected`

### Preserve DB-only non-empty values if source is blank

For field-wise repair, if:

- source is blank
- DB is non-blank

then default action is:

- **preserve DB value**
- classify for review
- do not auto-clear in first pass

### Conflicting non-empty values require classification

If both source and DB are non-empty and different, classify into:

1. `normalization_only`
   - case difference
   - phone leading-zero formatting
   - whitespace-only difference
2. `source_patch_recommended`
   - source looks complete and DB is obviously degraded / stale
3. `manual_review_required`
   - both look plausible but differ materially

---

## Repair Plan (Phased)

## Phase 0 — Freeze assumptions

Before any apply run:

1. Keep Google Sheets as fallback truth source.
2. Do not remove Apps Script yet.
3. Do not run destructive backfill scripts.
4. Keep a full PostgreSQL backup before the first apply step.

## Phase 1 — Close schema gaps

Create migrations for the missing expected tables:

- `directory_logs`
- `admin_users`
- `announcements`
- `line_bindings`
- `agent_audit`

Notes:

- Preserve `raw jsonb` columns for forward compatibility.
- Add minimal useful indexes only.
- Do **not** add write logic yet in this phase.

## Phase 2 — Close read-path gaps

Add Apps Script read actions (sync-token/internal or restricted admin-only) for:

- `listDirectoryLogs`
- `listAdminUsers`
- `listAnnouncements`
- `listNotificationReads`
- `listLineBindings`
- `listAgentAudit`

Option A:
- extend `syncPullSnapshot`

Option B (preferred):
- keep `syncPullSnapshot` small
- expose dedicated `list*` actions for audit/backfill

Reason:
- dedicated actions are easier to test, paginate, and reason about
- avoids turning one snapshot endpoint into a giant opaque dump

## Phase 3 — Extend audit coverage

Upgrade `audit:only` to include the new tables/actions once Phase 1 + 2 land.

Exit criteria:

- every expected legacy-backed table exists
- every expected legacy-backed table can be audited read-only
- every audit result is categorized (`ok`, `mismatch`, `missing_table`, `manual_review`)

## Phase 4 — Implement dry-run repair planner

Create a new script (proposed name):

```bash
node scripts/repairDryRun.js
```

This script must:

- read source data only
- read PostgreSQL only
- write **nothing** to either side
- emit a structured plan of proposed operations

See spec below.

## Phase 5 — Apply in lowest-risk order

Recommended order:

1. Schema-gap tables with no DB-native drift yet
   - `directory_logs`
   - `admin_users`
   - `announcements`
   - `line_bindings`
   - `agent_audit`
2. Mirror-safe datasets (upsert / safe replace after backup)
3. `directories` (field-level controlled patch)
4. Mixed-state datasets
   - preserve DB-only rows
   - patch source-backed rows
   - do not auto-delete extras

## Phase 6 — Re-audit and decide cutover rules

After first repair apply:

- rerun `npm run audit:only`
- confirm no missing expected tables
- reduce mismatch count
- decide per dataset whether final source-of-truth is:
  - Google legacy mirror,
  - PostgreSQL-native,
  - or dual-write transitional

---

## Dry-Run Backfill Spec

## Script name

Proposed:

```bash
npm run repair:dry-run
```

backed by:

```bash
node scripts/repairDryRun.js
```

## Hard requirements

- No writes to PostgreSQL
- No writes to Google Sheets / Apps Script
- No deletes
- No schema changes
- Deterministic output for the same inputs

## Inputs

### Environment

- existing API env (`DATABASE_URL`, `APPS_SCRIPT_URL`, `SYNC_PULL_TOKEN`, etc.)

### Optional CLI flags

```bash
node scripts/repairDryRun.js \
  --datasets=all \
  --format=json \
  --out=./reports/repair-dry-run.json \
  --include-samples=20 \
  --strict=0
```

Suggested flags:

- `--datasets=all|comma,list`
- `--format=json|markdown`
- `--out=<path>`
- `--include-samples=<n>`
- `--strict=0|1`
- `--treat-phone-leading-zero-as-normalized=1`
- `--source=apps-script`

## Output format

Top-level structure:

```json
{
  "checkedAt": "ISO-8601",
  "summary": {
    "datasetCount": 0,
    "planItemCount": 0,
    "manualReviewCount": 0,
    "unsafeDatasetCount": 0
  },
  "datasets": [
    {
      "name": "directories",
      "policy": "field_merge",
      "sourceCount": 53,
      "dbCount": 53,
      "plan": {
        "insertFromSource": 0,
        "updateFromSource": 0,
        "normalizeOnly": 0,
        "preserveDbOnly": 0,
        "manualReview": 0,
        "deleteFromDb": 0
      },
      "samples": {
        "updateFromSource": [],
        "preserveDbOnly": [],
        "manualReview": []
      }
    }
  ]
}
```

## Operation types

Each proposed action must be classified as one of:

- `insert_from_source`
- `update_from_source`
- `normalize_only`
- `preserve_db_only`
- `db_only_expected_local`
- `db_only_unexpected`
- `manual_review_required`
- `missing_table`
- `missing_read_path`
- `skip_derived_table`

## Dataset-specific dry-run rules

### 1) Directories

Rules:

- If source row missing in DB → `insert_from_source`
- If source non-empty and DB empty → `update_from_source`
- If both non-empty and normalized-equal → `normalize_only`
- If source blank and DB non-empty → `preserve_db_only`
- If both non-empty and materially different → `manual_review_required`

Suggested canonical comparison for phone fields:

- compare trimmed strings
- optionally compare a second normalized form with leading zero restoration
- do **not** auto-drop DB value when source is blank

### 2) Registrations

Rules:

- Source row missing in DB → `insert_from_source`
- Source row exists but source-backed fields differ → `update_from_source`
- DB-only row with `manual_created_by` / local provenance → `db_only_expected_local`
- DB-only row without clear provenance → `db_only_unexpected`

First pass apply rule:

- never auto-delete DB-only registrations

### 3) Group Memberships

Rules:

- Source-backed rows should be upserted from legacy source
- DB-only rows should be classified individually

Special case:

- if a row exists only in DB because a new role system has already diverged from Sheets,
  classify as `db_only_expected_local` and do not auto-delete

### 4) Finance Requests / Fund Payments

Rules:

- preserve DB-only rows by default
- source-backed rows can be patched from source
- DB-only rows should be flagged with provenance markers if available
- if provenance is unclear, `manual_review_required`

### 5) Softball Players / Attendance

Rules:

- canonicalize attendance IDs before comparison
- preserve DB-only rows in first pass
- source-missing / db-extra rows are review candidates, not delete candidates

### 6) Schema-gap datasets

Rules:

- if table missing → `missing_table`
- if table exists but no read action → `missing_read_path`
- no apply actions generated until both are fixed

---

## Apply Strategy (After Dry-Run Review)

This section is intentionally conservative.

### Allowed automatic apply actions in v1

- create missing tables
- insert missing source-backed rows into PostgreSQL
- fill DB blanks from non-blank source values
- apply normalization-only updates

### Not allowed automatically in v1

- delete DB-only rows
- clear DB values because source is blank
- overwrite materially conflicting non-empty values without review
- write DB-only rows back into Google Sheets

---

## Acceptance Criteria

Repair phase is considered successful when:

1. All expected legacy-backed tables exist in PostgreSQL.
2. All expected legacy-backed tables are readable via audit path.
3. `npm run audit:only` reports:
   - `missingExpectedTableCount = 0`
   - `schemaOnlySheetCount = 0` or only explicitly deprecated items remain
4. `directories` has no obvious “source non-empty / db blank” cases left.
5. Mixed-state tables have explicit classifications for all DB-only rows.
6. No destructive action was required to reach the above.

---

## Recommended Immediate Next Steps

1. Add migrations for missing tables.
2. Add restricted Apps Script `list*` actions for schema-gap datasets.
3. Extend `audit:only` to cover those datasets.
4. Implement `repairDryRun.js` using the spec above.
5. Review dry-run output with human approval before any apply step.

---

## Operator Notes

- `notifications` is DB-native / derived. Do not try to mirror it from Sheets directly.
- `notification_reads` already has a table, but still lacks legacy read audit coverage.
- For directories, first-pass repair should prefer **safe patching** over “full replace”.
- For mixed-state tables, preserving DB-only rows is safer than deleting them.
- If an eventual one-way cutover to PostgreSQL is desired, do that only **after** repair + re-audit, not before.
