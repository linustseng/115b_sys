-- 007_softball_supply_management.sql

create table if not exists softball_angel_roster (
  id text primary key,
  student_id text not null,
  status text,
  notes text,
  joined_at text,
  created_at text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create unique index if not exists uniq_softball_angel_roster_student_id on softball_angel_roster (student_id);
create index if not exists idx_softball_angel_roster_status on softball_angel_roster (coalesce(status, ''));

create table if not exists softball_supply_vendors (
  id text primary key,
  name text,
  category text,
  phone text,
  contact text,
  delivery_note text,
  min_order_amount numeric,
  status text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_softball_supply_vendors_name on softball_supply_vendors (coalesce(name, ''), id);
create index if not exists idx_softball_supply_vendors_status on softball_supply_vendors (coalesce(status, ''));

create table if not exists softball_supply_cases (
  id text primary key,
  practice_id text not null,
  angel_roster_id text,
  angel_student_id text,
  vendor_id text,
  angel_status text,
  order_status text,
  planned_headcount integer,
  total_amount numeric,
  ordered_at text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create unique index if not exists uniq_softball_supply_cases_practice_id on softball_supply_cases (practice_id);
create index if not exists idx_softball_supply_cases_order_status on softball_supply_cases (coalesce(order_status, ''));
create index if not exists idx_softball_supply_cases_angel_student_id on softball_supply_cases (coalesce(angel_student_id, ''));
create index if not exists idx_softball_supply_cases_vendor_id on softball_supply_cases (coalesce(vendor_id, ''));
