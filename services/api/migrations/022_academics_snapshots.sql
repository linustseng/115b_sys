-- 022_academics_snapshots.sql
-- Precomputed read models for student-facing academics pages.

create table if not exists academic_snapshots (
  id text primary key,
  scope text not null,
  data jsonb not null default '{}'::jsonb,
  built_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_academic_snapshots_scope_synced
  on academic_snapshots (scope, synced_at desc);
