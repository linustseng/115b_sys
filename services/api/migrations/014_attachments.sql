-- 014_attachments.sql
-- Shared attachment infrastructure for documents / finance / academics / future modules.

create table if not exists attachments (
  id text primary key,
  entity_type text not null,
  entity_id text not null,
  bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  attachment_kind text not null default 'general',
  visibility text not null default 'private',
  uploaded_by text,
  uploaded_by_name text,
  status text not null default 'pending',
  created_at text,
  updated_at text,
  completed_at text,
  deleted_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create index if not exists idx_attachments_entity
  on attachments (entity_type, entity_id, coalesce(status, ''), coalesce(created_at, ''), id);

create index if not exists idx_attachments_uploaded_by
  on attachments (coalesce(uploaded_by, ''), coalesce(created_at, ''), id);

create unique index if not exists uq_attachments_bucket_path
  on attachments (bucket, storage_path);
