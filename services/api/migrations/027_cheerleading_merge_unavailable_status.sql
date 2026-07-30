-- 027_cheerleading_merge_unavailable_status.sql
-- Cheerleading treats legacy "excused" attendance as the same status as "absent".

update cheerleading_attendance
set
  status = 'absent',
  raw = jsonb_set(coalesce(raw, '{}'::jsonb), '{status}', '"absent"'::jsonb, true),
  updated_at = now()::text,
  synced_at = now()
where lower(coalesce(status, '')) = 'excused'
   or lower(coalesce(raw->>'status', '')) = 'excused';
