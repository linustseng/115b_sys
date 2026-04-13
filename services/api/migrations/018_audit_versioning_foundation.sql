-- 018_audit_versioning_foundation.sql
-- Foundation for audit batches, entity versions, events, restores, and revision metadata.

create table if not exists audit_change_batches (
  id text primary key,
  request_id text,
  source text not null,
  actor_id text,
  actor_name text,
  actor_email text,
  reason text,
  status text not null default 'committed',
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  raw jsonb not null default '{}'::jsonb
);
create index if not exists idx_audit_change_batches_created_at on audit_change_batches (created_at desc);
create index if not exists idx_audit_change_batches_actor_created on audit_change_batches (coalesce(actor_id, ''), created_at desc);
create index if not exists idx_audit_change_batches_request_id on audit_change_batches (coalesce(request_id, ''));

create table if not exists audit_entity_versions (
  id text primary key,
  batch_id text not null references audit_change_batches(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  parent_entity_type text,
  parent_entity_id text,
  action text not null,
  revision_no bigint not null,
  before_data jsonb,
  after_data jsonb,
  changed_fields text[] not null default '{}',
  source_updated_at text,
  actor_id text,
  actor_name text,
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
create index if not exists idx_audit_entity_versions_entity_revision
  on audit_entity_versions (entity_type, entity_id, revision_no desc);
create index if not exists idx_audit_entity_versions_batch_id
  on audit_entity_versions (batch_id);
create index if not exists idx_audit_entity_versions_parent_created
  on audit_entity_versions (coalesce(parent_entity_type, ''), coalesce(parent_entity_id, ''), created_at desc);
create index if not exists idx_audit_entity_versions_changed_fields
  on audit_entity_versions using gin (changed_fields);

create table if not exists audit_events (
  id text primary key,
  batch_id text not null references audit_change_batches(id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  parent_entity_type text,
  parent_entity_id text,
  action text not null,
  actor_id text,
  actor_name text,
  summary text not null,
  diff jsonb not null default '{}'::jsonb,
  severity text not null default 'info',
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
create index if not exists idx_audit_events_entity_created
  on audit_events (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_events_batch_id
  on audit_events (batch_id);
create index if not exists idx_audit_events_severity_created
  on audit_events (severity, created_at desc);

create table if not exists audit_restores (
  id text primary key,
  restore_batch_id text not null references audit_change_batches(id) on delete restrict,
  target_entity_type text not null,
  target_entity_id text not null,
  restored_from_version_id text not null references audit_entity_versions(id) on delete restrict,
  previous_revision_no bigint,
  restored_revision_no bigint,
  actor_id text,
  actor_name text,
  created_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb
);
create index if not exists idx_audit_restores_target_created
  on audit_restores (target_entity_type, target_entity_id, created_at desc);
create index if not exists idx_audit_restores_batch_id
  on audit_restores (restore_batch_id);

alter table order_plans add column if not exists revision_no bigint not null default 1;
alter table order_plans add column if not exists last_change_batch_id text;
alter table order_plans add column if not exists last_changed_at timestamptz;
alter table order_plans add column if not exists last_changed_by text;
alter table order_plans add column if not exists last_changed_by_name text;
create index if not exists idx_order_plans_revision on order_plans (revision_no);
create index if not exists idx_order_plans_last_change_batch_id on order_plans (coalesce(last_change_batch_id, ''));

alter table ordering_public_links add column if not exists revision_no bigint not null default 1;
alter table ordering_public_links add column if not exists last_change_batch_id text;
alter table ordering_public_links add column if not exists last_changed_at timestamptz;
alter table ordering_public_links add column if not exists last_changed_by text;
alter table ordering_public_links add column if not exists last_changed_by_name text;
create index if not exists idx_ordering_public_links_revision on ordering_public_links (revision_no);
create index if not exists idx_ordering_public_links_last_change_batch_id on ordering_public_links (coalesce(last_change_batch_id, ''));

alter table order_responses add column if not exists revision_no bigint not null default 1;
alter table order_responses add column if not exists last_change_batch_id text;
alter table order_responses add column if not exists last_changed_at timestamptz;
alter table order_responses add column if not exists last_changed_by text;
alter table order_responses add column if not exists last_changed_by_name text;

alter table events add column if not exists revision_no bigint not null default 1;
alter table events add column if not exists last_change_batch_id text;
alter table events add column if not exists last_changed_at timestamptz;
alter table events add column if not exists last_changed_by text;
alter table events add column if not exists last_changed_by_name text;

alter table registrations add column if not exists revision_no bigint not null default 1;
alter table registrations add column if not exists last_change_batch_id text;
alter table registrations add column if not exists last_changed_at timestamptz;
alter table registrations add column if not exists last_changed_by text;
alter table registrations add column if not exists last_changed_by_name text;

alter table checkins add column if not exists revision_no bigint not null default 1;
alter table checkins add column if not exists last_change_batch_id text;
alter table checkins add column if not exists last_changed_at timestamptz;
alter table checkins add column if not exists last_changed_by text;
alter table checkins add column if not exists last_changed_by_name text;

alter table finance_requests add column if not exists revision_no bigint not null default 1;
alter table finance_requests add column if not exists last_change_batch_id text;
alter table finance_requests add column if not exists last_changed_at timestamptz;
alter table finance_requests add column if not exists last_changed_by text;
alter table finance_requests add column if not exists last_changed_by_name text;

alter table documents add column if not exists revision_no bigint not null default 1;
alter table documents add column if not exists last_change_batch_id text;
alter table documents add column if not exists last_changed_at timestamptz;
alter table documents add column if not exists last_changed_by text;
alter table documents add column if not exists last_changed_by_name text;
