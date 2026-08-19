-- Private, class-member activity photo albums. Photo binaries remain in Supabase Storage.

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
  size_bytes bigint not null default 0,
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
create index if not exists idx_activity_albums_active on activity_albums(status, event_date desc, created_at desc);

-- Direct Supabase clients must not read album metadata. The Node API connects
-- with the server database credential and owns all authorization decisions.
alter table activity_albums enable row level security;
alter table activity_photos enable row level security;
