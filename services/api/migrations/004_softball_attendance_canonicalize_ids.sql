-- 004_softball_attendance_canonicalize_ids.sql
--
-- Canonicalize legacy attendance ids from "practice-player" to "practice:player".
-- Keep data by upserting into the canonical id, then remove legacy rows.

-- Only target ids that match the legacy pattern.
with legacy as (
  select
    id as legacy_id,
    split_part(id, '-', 1) as practice_part,
    split_part(id, '-', 2) as player_part,
    practice_id,
    player_id,
    status,
    notes,
    raw,
    created_at,
    updated_at
  from softball_attendance
  where id ~ '^[0-9]{8}-[A-Za-z0-9]+'
)
insert into softball_attendance (id, practice_id, player_id, status, notes, raw, created_at, updated_at)
select
  legacy.practice_part || ':' || legacy.player_part as id,
  coalesce(nullif(legacy.practice_id, ''), legacy.practice_part) as practice_id,
  coalesce(nullif(legacy.player_id, ''), legacy.player_part) as player_id,
  legacy.status,
  legacy.notes,
  -- ensure raw contains the normalized keys for the frontend
  coalesce(legacy.raw, '{}'::jsonb) || jsonb_build_object(
    'practiceId', legacy.practice_part,
    'playerId', legacy.player_part,
    'studentId', legacy.player_part
  ) as raw,
  legacy.created_at,
  legacy.updated_at
from legacy
on conflict (id) do update set
  status = excluded.status,
  notes = excluded.notes,
  raw = excluded.raw,
  updated_at = excluded.updated_at,
  synced_at = now();

-- Remove legacy rows after upsert.
delete from softball_attendance
where id ~ '^[0-9]{8}-[A-Za-z0-9]+';
