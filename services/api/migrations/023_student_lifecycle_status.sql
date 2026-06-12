alter table students
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists lifecycle_updated_at text,
  add column if not exists lifecycle_reason text,
  add column if not exists lifecycle_notes text;

create index if not exists idx_students_lifecycle_status
  on students (coalesce(lifecycle_status, 'active'), id);
