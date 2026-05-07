-- 018_cheerleading_management.sql
-- 啦啦隊練習 / 出席紀錄 / 統計基礎表。先獨立於壘球模組，不抽共用架構。

create table if not exists cheerleading_practices (
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
create index if not exists idx_cheerleading_practices_date on cheerleading_practices (coalesce(date, ''), id);

create table if not exists cheerleading_attendance (
  id text primary key,
  practice_id text,
  student_id text,
  status text,
  notes text,
  raw jsonb not null default '{}'::jsonb,
  created_at text,
  updated_at text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_cheerleading_attendance_practice on cheerleading_attendance (practice_id);
create index if not exists idx_cheerleading_attendance_student on cheerleading_attendance (student_id);

create unique index if not exists uniq_cheerleading_attendance_practice_student
  on cheerleading_attendance (practice_id, student_id);
