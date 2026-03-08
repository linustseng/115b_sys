-- 002_full_cutover.sql
-- Add tables required for full cutover (finance / ordering / softball / notifications)

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

-- Ordering
create table if not exists order_plans (
  id text primary key,
  date text,
  title text,
  description text,
  close_at text,
  vendor text,
  items jsonb,
  status text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_order_plans_date on order_plans (coalesce(date, ''), id);

create table if not exists order_responses (
  id text primary key,
  order_id text,
  student_id text,
  student_name text,
  student_email text,
  response jsonb,
  total_amount numeric,
  created_at text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_order_responses_order_id on order_responses (order_id);
create index if not exists idx_order_responses_student_id on order_responses (student_id);

-- Finance
create table if not exists finance_category_types (
  id text primary key,
  label text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists finance_roles (
  id text primary key,
  role text,
  student_id text,
  student_name text,
  group_ids jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_finance_roles_student_id on finance_roles (student_id);

create table if not exists finance_requests (
  id text primary key,
  type text,
  title text,
  description text,
  category_type text,
  amount_estimated numeric,
  amount_actual numeric,
  currency text,
  payment_method text,
  vendor_name text,
  payee_name text,
  payee_bank text,
  payee_account text,
  related_purchase_id text,
  no_purchase_reason text,
  expected_clear_date text,
  attachments jsonb,
  status text,
  applicant_id text,
  applicant_name text,
  applicant_department text,
  created_at text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_finance_requests_applicant_id on finance_requests (applicant_id);
create index if not exists idx_finance_requests_status on finance_requests (coalesce(status, ''), id);

create table if not exists finance_actions (
  id text primary key,
  request_id text,
  actor_id text,
  actor_name text,
  action_type text,
  from_status text,
  to_status text,
  notes text,
  created_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_finance_actions_request_id on finance_actions (request_id);
create index if not exists idx_finance_actions_actor_id on finance_actions (actor_id);

-- Fundraising
create table if not exists fund_events (
  id text primary key,
  title text,
  description text,
  due_date text,
  amount_general numeric,
  amount_sponsor numeric,
  expected_general_count integer,
  expected_sponsor_count integer,
  status text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);

create table if not exists fund_payments (
  id text primary key,
  event_id text,
  payer_id text,
  payer_name text,
  payer_email text,
  payer_type text,
  amount numeric,
  method text,
  transfer_last5 text,
  received_at text,
  accounted_at text,
  confirmed_at text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_fund_payments_event_id on fund_payments (event_id);
create index if not exists idx_fund_payments_payer_id on fund_payments (payer_id);

-- Softball
create table if not exists softball_config (
  id text primary key,
  raw jsonb not null default '{}'::jsonb,
  updated_at text,
  synced_at timestamptz not null default now()
);

create table if not exists softball_players (
  id text primary key,
  name text,
  email text,
  phone text,
  jersey_no text,
  jersey_size text,
  positions jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_softball_players_email on softball_players (lower(coalesce(email, '')));

create table if not exists softball_practices (
  id text primary key,
  date text,
  title text,
  location text,
  start_at text,
  end_at text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_softball_practices_date on softball_practices (coalesce(date, ''), id);

create table if not exists softball_attendance (
  id text primary key,
  practice_id text,
  player_id text,
  status text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_softball_attendance_practice on softball_attendance (practice_id);
create index if not exists idx_softball_attendance_player on softball_attendance (player_id);

create table if not exists softball_fields (
  id text primary key,
  name text,
  address text,
  map_url text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);

create table if not exists softball_gear (
  id text primary key,
  name text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);

-- Notifications
create table if not exists notifications (
  id text primary key,
  target_student_id text,
  target_group_id text,
  title text,
  body text,
  url text,
  created_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);
create index if not exists idx_notifications_target_student on notifications (target_student_id);
create index if not exists idx_notifications_target_group on notifications (target_group_id);

create table if not exists notification_reads (
  id bigserial primary key,
  notification_id text not null,
  student_id text not null,
  read_at timestamptz not null default now(),
  unique(notification_id, student_id)
);
create index if not exists idx_notification_reads_student on notification_reads (student_id);
