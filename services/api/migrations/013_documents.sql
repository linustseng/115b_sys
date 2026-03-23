-- 013_documents.sql
-- Documents center: class governance docs, meeting minutes, and version history.

create table if not exists documents (
  id text primary key,
  slug text not null,
  title text not null,
  doc_type text not null,
  owner_group_id text not null,
  visibility text not null default 'class',
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  pin_order integer not null default 0,
  latest_version_number integer not null default 1,
  latest_version_id text,
  status text not null default 'published',
  created_by text,
  created_by_name text,
  created_at text,
  updated_at text,
  archived_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create unique index if not exists uq_documents_slug on documents (slug);
create index if not exists idx_documents_status_updated on documents (coalesce(status, ''), coalesce(updated_at, ''), id);
create index if not exists idx_documents_owner_type on documents (coalesce(owner_group_id, ''), coalesce(doc_type, ''), id);
create index if not exists idx_documents_pinned on documents (is_pinned, pin_order, coalesce(updated_at, ''), id);
create index if not exists idx_documents_tags on documents using gin (tags);

create table if not exists document_versions (
  id text primary key,
  document_id text not null references documents(id) on delete cascade,
  version_number integer not null,
  title_snapshot text,
  summary_snapshot text,
  content_snapshot text,
  change_summary text,
  meeting_date text,
  effective_date text,
  attachments jsonb not null default '[]'::jsonb,
  created_by text,
  created_by_name text,
  created_at text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now()
);

create unique index if not exists uq_document_versions_doc_version
  on document_versions (document_id, version_number);

create index if not exists idx_document_versions_doc_created
  on document_versions (document_id, coalesce(created_at, ''), version_number desc);
