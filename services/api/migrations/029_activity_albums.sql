-- Activity albums are API-owned metadata and private Storage objects.
-- The Node API uses a database credential/service role; anon/authenticated
-- Supabase clients have no direct table/object policy for this feature.

create table if not exists activity_albums (
  id text primary key,
  title text not null,
  description text not null default '',
  event_date date,
  location text not null default '',
  cover_photo_id text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_photos (
  id text primary key,
  album_id text not null references activity_albums(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0 and size_bytes <= 15728640),
  captured_at timestamptz,
  uploaded_by text not null,
  uploaded_by_name text not null default '',
  status text not null default 'pending' check (status in ('pending', 'ready', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists uq_activity_photos_bucket_path on activity_photos(bucket, storage_path);
create index if not exists idx_activity_photos_album_visible on activity_photos(album_id, status, created_at desc);
create index if not exists idx_activity_photos_pending_cleanup on activity_photos(uploaded_by, album_id, created_at) where status = 'pending';
create index if not exists idx_activity_photos_rate_limit on activity_photos(uploaded_by, created_at) where status <> 'deleted';
create index if not exists idx_activity_albums_active on activity_albums(status, event_date desc, created_at desc);

-- Create/reassert the exact private bucket used by SUPABASE_ACTIVITY_ALBUM_BUCKET.
-- Deployment must set it to `activity-albums`; this migration establishes the
-- production safety invariant rather than relying on a dashboard checkbox.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-albums', 'activity-albums', false, 15728640, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg', 'image/png'];

alter table activity_albums enable row level security;
alter table activity_photos enable row level security;
-- storage.objects is owned and RLS-managed by Supabase. Migration 031 verifies
-- its safe state without assuming this database role owns the Storage table.
