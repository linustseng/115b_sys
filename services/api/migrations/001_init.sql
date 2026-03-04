create table if not exists sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  summary jsonb not null default '{}'::jsonb,
  error text
);

create table if not exists events (
  id text primary key,
  title text,
  description text,
  start_at text,
  end_at text,
  location text,
  address text,
  registration_open_at text,
  registration_close_at text,
  checkin_open_at text,
  checkin_close_at text,
  register_url text,
  checkin_url text,
  capacity integer,
  status text,
  category text,
  form_schema jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists students (
  id text primary key,
  name text,
  google_sub text,
  google_email text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists registrations (
  id text primary key,
  event_id text,
  student_id text,
  user_name text,
  user_email text,
  user_phone text,
  class_year text,
  custom_fields jsonb,
  status text,
  created_at text,
  updated_at text,
  manual_created_by text,
  manual_created_by_name text,
  manual_created_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_registrations_user_email on registrations (lower(user_email));
create index if not exists idx_registrations_event_id on registrations (event_id);

create table if not exists checkins (
  id text primary key,
  event_id text,
  registration_id text,
  checkin_at text,
  checkin_method text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_checkins_registration_id on checkins (registration_id);
create index if not exists idx_checkins_event_id on checkins (event_id);

create table if not exists directories (
  id text primary key,
  group_id text,
  email text,
  name_zh text,
  name_en text,
  preferred_name text,
  company text,
  title text,
  social_url text,
  mobile text,
  backup_phone text,
  emergency_contact text,
  emergency_phone text,
  dietary_restrictions text,
  photo_url text,
  birthday_month text,
  birthday_day text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_directories_email on directories (lower(email));

create table if not exists group_memberships (
  id text primary key,
  person_id text,
  person_name text,
  group_id text,
  role_in_group text,
  notes text,
  created_at text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_group_memberships_person_id on group_memberships (person_id);
create index if not exists idx_group_memberships_group_id on group_memberships (group_id);
