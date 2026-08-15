-- 028_cheerleading_config.sql
-- Playlist and other small front-end settings for the cheerleading team.
create table if not exists cheerleading_config (
  id text primary key,
  raw jsonb not null default '{}'::jsonb,
  updated_at text,
  synced_at timestamptz not null default now()
);
