-- Legacy sheet-backed support tables required for audit/backfill parity

create table if not exists directory_logs (
  id text primary key,
  created_at text,
  actor_email text,
  target_id text,
  target_email text,
  action text,
  changes text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_directory_logs_target_id on directory_logs (target_id);
create index if not exists idx_directory_logs_target_email on directory_logs (lower(coalesce(target_email, '')));

create table if not exists admin_users (
  id text primary key,
  name text,
  email text,
  role text,
  password_hash text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_admin_users_email on admin_users (lower(coalesce(email, '')));

create table if not exists announcements (
  id text primary key,
  type text,
  scope text,
  target_key text,
  title text,
  message text,
  level text,
  cta_label text,
  cta_url text,
  status text,
  start_at text,
  end_at text,
  created_at text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_announcements_status on announcements (coalesce(status, ''), id);
create index if not exists idx_announcements_scope_target on announcements (coalesce(scope, ''), coalesce(target_key, ''));

create table if not exists line_bindings (
  id text primary key,
  line_user_id text,
  student_id text,
  status text,
  role text,
  group_id text,
  display_name text,
  picture_url text,
  source text,
  bound_at text,
  created_at text,
  updated_at text,
  bound_by_type text,
  bound_by_student_id text,
  note text,
  metadata text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create unique index if not exists idx_line_bindings_line_user_id on line_bindings (line_user_id);
create index if not exists idx_line_bindings_student_id on line_bindings (student_id);
create index if not exists idx_line_bindings_status on line_bindings (coalesce(status, ''), id);

create table if not exists agent_audit (
  id text primary key,
  action text,
  channel text,
  line_user_id text,
  student_id text,
  request_id text,
  event_id text,
  status text,
  error text,
  payload text,
  result text,
  created_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_agent_audit_student_id on agent_audit (student_id);
create index if not exists idx_agent_audit_action on agent_audit (coalesce(action, ''), id);
