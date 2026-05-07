-- 020_cheerleading_name_normalization.sql
-- Normalize cheerleading display text from「拉拉隊」to「啦啦隊」in existing records.

update cheerleading_practices
set
  title = replace(coalesce(title, ''), '拉拉隊', '啦啦隊'),
  raw = jsonb_set(
    coalesce(raw, '{}'::jsonb),
    '{title}',
    to_jsonb(replace(coalesce(raw->>'title', title, ''), '拉拉隊', '啦啦隊')),
    true
  ),
  updated_at = now()::text,
  synced_at = now()
where coalesce(title, '') like '%拉拉隊%'
   or coalesce(raw->>'title', '') like '%拉拉隊%';

update cheerleading_attendance
set
  raw = replace(coalesce(raw, '{}'::jsonb)::text, '拉拉隊', '啦啦隊')::jsonb,
  updated_at = now()::text,
  synced_at = now()
where coalesce(raw, '{}'::jsonb)::text like '%拉拉隊%';

update group_memberships
set
  notes = replace(coalesce(notes, ''), '拉拉隊', '啦啦隊'),
  raw = replace(coalesce(raw, '{}'::jsonb)::text, '拉拉隊', '啦啦隊')::jsonb,
  updated_at = now()::text,
  synced_at = now()
where coalesce(notes, '') like '%拉拉隊%'
   or coalesce(raw, '{}'::jsonb)::text like '%拉拉隊%';
