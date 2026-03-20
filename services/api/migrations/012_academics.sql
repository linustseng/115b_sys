-- 012_academics.sql
-- Academics module: weekend sessions, makeup requests, and session notes.

create table if not exists academic_sessions (
  id text primary key,
  source_type text,
  source_uid text,
  source_recurrence_id text,
  class_kind text,
  class_group text,
  title text,
  teacher text,
  location text,
  session_date text,
  starts_at text,
  ends_at text,
  registration_deadline text,
  status text,
  is_visible boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);

create index if not exists idx_academic_sessions_kind_date
  on academic_sessions (coalesce(class_kind, ''), coalesce(session_date, ''), id);

create index if not exists idx_academic_sessions_source_uid
  on academic_sessions (coalesce(source_uid, ''), coalesce(source_recurrence_id, ''), id);

create unique index if not exists uq_academic_sessions_source_occurrence
  on academic_sessions (coalesce(source_type, ''), coalesce(source_uid, ''), coalesce(source_recurrence_id, ''));

create table if not exists makeup_requests (
  id text primary key,
  student_id text,
  student_name text,
  student_email text,
  missed_session_id text,
  target_session_id text,
  need_meal boolean not null default false,
  need_handout boolean not null default false,
  reason text,
  note text,
  admin_note text,
  status text not null default 'submitted',
  created_at text,
  updated_at text,
  cancelled_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_makeup_requests_student
  on makeup_requests (coalesce(student_id, ''), coalesce(created_at, ''), id);

create index if not exists idx_makeup_requests_target
  on makeup_requests (coalesce(target_session_id, ''), coalesce(status, ''), id);

create index if not exists idx_makeup_requests_missed
  on makeup_requests (coalesce(missed_session_id, ''), coalesce(status, ''), id);

create table if not exists session_notes (
  id text primary key,
  session_id text not null,
  title text,
  summary text,
  link_url text,
  link_label text,
  status text not null default 'draft',
  published_at text,
  created_by text,
  created_by_name text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create unique index if not exists uq_session_notes_session_id
  on session_notes (session_id);

create index if not exists idx_session_notes_status_published
  on session_notes (coalesce(status, ''), coalesce(published_at, ''), session_id);
