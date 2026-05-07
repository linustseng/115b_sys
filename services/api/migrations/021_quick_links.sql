-- 021_quick_links.sql
-- Class-wide quick links shown on landing page and maintained from system admin.

create table if not exists quick_links (
  id text primary key,
  title text not null,
  url text not null,
  description text not null default '',
  category text not null default 'general',
  status text not null default 'published',
  sort_order integer not null default 0,
  created_by text,
  created_by_name text,
  created_at text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_quick_links_status_sort
  on quick_links (coalesce(status, ''), sort_order, coalesce(updated_at, ''), id);

insert into quick_links (id, title, url, description, category, status, sort_order, created_at, updated_at, raw)
values
  (
    'ntu-webmail',
    '臺大 Webmail',
    'https://webmail.ntu.edu.tw/',
    '快速開啟臺大信箱，處理學校與課務通知。',
    '學校系統',
    'published',
    10,
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    '{"seeded":true}'::jsonb
  )
on conflict (id) do nothing;
