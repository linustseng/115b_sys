-- 016_academics_courses.sql
-- Academics regular-course layer: shared course notes + per-session tasks.

create table if not exists academic_courses (
  id text primary key,
  course_key text not null,
  title text,
  status text not null default 'active',
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);

create unique index if not exists uq_academic_courses_course_key
  on academic_courses (course_key);

create index if not exists idx_academic_courses_status
  on academic_courses (coalesce(status, ''), coalesce(title, ''), id);

create table if not exists academic_course_sessions (
  course_id text not null,
  session_id text not null,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now(),
  primary key (course_id, session_id)
);

create unique index if not exists uq_academic_course_sessions_session_id
  on academic_course_sessions (session_id);

create index if not exists idx_academic_course_sessions_course_id
  on academic_course_sessions (course_id, session_id);

create table if not exists academic_course_notes (
  id text primary key,
  course_id text not null,
  title text,
  summary text,
  link_url text,
  link_label text,
  updated_by text,
  updated_by_name text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create unique index if not exists uq_academic_course_notes_course_id
  on academic_course_notes (course_id);

create table if not exists academic_session_tasks (
  id text primary key,
  session_id text not null,
  homework_notice text,
  quiz_notice text,
  updated_by text,
  updated_by_name text,
  updated_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create unique index if not exists uq_academic_session_tasks_session_id
  on academic_session_tasks (session_id);
