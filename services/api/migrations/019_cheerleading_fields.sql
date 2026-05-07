-- 019_cheerleading_fields.sql
-- 啦啦隊練習地點管理；先獨立於壘球場地表。

create table if not exists cheerleading_fields (
  id text primary key,
  name text,
  address text,
  map_url text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_cheerleading_fields_name on cheerleading_fields (coalesce(name, ''), id);
