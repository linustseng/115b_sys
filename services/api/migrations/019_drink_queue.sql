create table if not exists drink_queue_entries (
  id text primary key,
  offender_id text,
  offender_name text not null default '',
  offender_email text not null default '',
  incident_at text not null default '',
  next_class_date text not null default '',
  reason text not null default '',
  drink_theme text not null default '',
  pledge_text text not null default '',
  status text not null default 'queued',
  served_at text not null default '',
  served_note text not null default '',
  created_by_id text not null default '',
  created_by_name text not null default '',
  created_by_email text not null default '',
  raw jsonb not null default '{}'::jsonb,
  created_at text not null default '',
  updated_at text not null default '',
  synced_at timestamptz not null default now()
);

create index if not exists idx_drink_queue_status_next_class on drink_queue_entries (status, next_class_date, created_at);
create index if not exists idx_drink_queue_offender on drink_queue_entries (offender_id, offender_email);
