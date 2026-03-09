-- Todo-capable notifications (stateful unread + dedupe)

alter table notifications
  add column if not exists kind text not null default 'announcement';

alter table notifications
  add column if not exists status text not null default 'open';

alter table notifications
  add column if not exists dedupe_key text;

alter table notifications
  add column if not exists updated_at timestamptz;

update notifications
set updated_at = coalesce(updated_at, synced_at, now())
where updated_at is null;

create index if not exists idx_notifications_status on notifications (status);
create unique index if not exists idx_notifications_dedupe_key
  on notifications (dedupe_key)
  where dedupe_key is not null;

alter table notification_reads
  add column if not exists seen_updated_at timestamptz;

update notification_reads
set seen_updated_at = coalesce(seen_updated_at, read_at)
where seen_updated_at is null;
