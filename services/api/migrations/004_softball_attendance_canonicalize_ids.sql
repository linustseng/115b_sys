-- 004_softball_attendance_canonicalize_ids.sql
--
-- Canonicalize legacy attendance ids from "practice-player" to "practice:player".
-- This migration is designed to be safe even when a unique index on (practice_id, player_id) already exists.

-- 0) De-dupe legacy rows by parsed (practice, player) first (keep latest).
with legacy as (
  select
    id,
    split_part(id, '-', 1) as practice_part,
    split_part(id, '-', 2) as player_part,
    row_number() over (
      partition by split_part(id, '-', 1), split_part(id, '-', 2)
      order by coalesce(updated_at, '') desc, synced_at desc, id desc
    ) as rn
  from softball_attendance
  where id ~ '^[0-9]{8}-[A-Za-z0-9]+'
)
delete from softball_attendance a
using legacy l
where a.id = l.id and l.rn > 1;

-- 1) If a canonical row already exists for the same parsed id, drop the legacy row.
delete from softball_attendance l
using softball_attendance c
where
  l.id ~ '^[0-9]{8}-[A-Za-z0-9]+'
  and c.id = split_part(l.id, '-', 1) || ':' || split_part(l.id, '-', 2);

-- 2) Rename remaining legacy ids in-place (primary key update).
update softball_attendance
set
  id = split_part(id, '-', 1) || ':' || split_part(id, '-', 2),
  practice_id = coalesce(nullif(practice_id, ''), split_part(id, '-', 1)),
  player_id = coalesce(nullif(player_id, ''), split_part(id, '-', 2)),
  raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object(
    'practiceId', split_part(id, '-', 1),
    'playerId', split_part(id, '-', 2),
    'studentId', split_part(id, '-', 2)
  )
where id ~ '^[0-9]{8}-[A-Za-z0-9]+';
