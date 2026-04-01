create table if not exists ordering_public_links (
  id text primary key,
  order_plan_id text not null,
  token text not null unique,
  title text,
  description text,
  close_at text,
  status text not null default 'active',
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_ordering_public_links_order_plan_id
  on ordering_public_links (order_plan_id);

create index if not exists idx_ordering_public_links_status
  on ordering_public_links (coalesce(status, ''), order_plan_id);
