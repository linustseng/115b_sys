-- Additive only: existing requests and workflow snapshots are not modified.
begin;
create table if not exists finance_projects (
  id text primary key,
  name text not null check (length(trim(name)) between 1 and 120),
  approver_id text not null references students(id),
  approver_name text not null,
  active boolean not null default true,
  updated_by text not null,
  updated_at timestamptz not null default now()
);
alter table finance_projects enable row level security;
-- No public policies. Authenticated Node actions enforce finance-group writes.
commit;
