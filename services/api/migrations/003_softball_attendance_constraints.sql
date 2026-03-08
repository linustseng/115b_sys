-- 003_softball_attendance_constraints.sql
--
-- Goal: eliminate duplicate attendance rows and enforce a single row per (practice_id, player_id).
-- This fixes legacy id formats ("practice-player") coexisting with canonical ("practice:player").

-- 1) Backfill practice_id / player_id from raw + id when missing.
update softball_attendance
set
  practice_id = nullif(
    coalesce(
      nullif(practice_id, ''),
      nullif(raw->>'practiceId', ''),
      nullif(raw->>'practice_id', ''),
      nullif(split_part(id, ':', 1), ''),
      nullif(split_part(id, '-', 1), '')
    ),
    ''
  ),
  player_id = nullif(
    coalesce(
      nullif(player_id, ''),
      nullif(raw->>'playerId', ''),
      nullif(raw->>'studentId', ''),
      nullif(raw->>'player_id', ''),
      nullif(split_part(id, ':', 2), ''),
      nullif(split_part(id, '-', 2), '')
    ),
    ''
  )
where
  practice_id is null
  or practice_id = ''
  or player_id is null
  or player_id = '';

-- 2) Drop rows we still cannot identify.
delete from softball_attendance
where coalesce(practice_id, '') = '' or coalesce(player_id, '') = '';

-- 3) De-dupe: keep the latest row per (practice_id, player_id).
with ranked as (
  select
    id,
    practice_id,
    player_id,
    row_number() over (
      partition by practice_id, player_id
      order by coalesce(updated_at, '') desc, synced_at desc, id desc
    ) as rn
  from softball_attendance
)
delete from softball_attendance a
using ranked r
where a.id = r.id and r.rn > 1;

-- 4) Enforce constraints.
alter table softball_attendance
  alter column practice_id set not null,
  alter column player_id set not null;

create unique index if not exists uniq_softball_attendance_practice_player
  on softball_attendance (practice_id, player_id);
