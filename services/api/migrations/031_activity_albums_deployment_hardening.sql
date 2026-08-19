-- Reassert the activity-album invariants on databases that already recorded
-- 029/030. This migration is deliberately scoped: it changes only this bucket
-- and adds restrictive policies for anon/authenticated, leaving other Storage
-- buckets and their policies intact.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-albums', 'activity-albums', false, 15728640, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = array['image/jpeg', 'image/png'];

alter table if exists activity_albums enable row level security;
alter table if exists activity_photos enable row level security;
alter table storage.objects enable row level security;

create table if not exists activity_album_upload_attempts (
  id bigint generated always as identity primary key,
  student_id text not null,
  ip_hash text not null check (length(ip_hash) = 64),
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_album_upload_attempts_member_time on activity_album_upload_attempts(student_id, created_at desc);
create index if not exists idx_activity_album_upload_attempts_ip_time on activity_album_upload_attempts(ip_hash, created_at desc);
alter table activity_album_upload_attempts enable row level security;

-- These restrictive policies protect against pre-existing broad policies. A
-- restrictive policy combines with any permissive policy, so anon/authenticated
-- cannot directly read, list, create, overwrite, update, or delete an
-- activity-albums object while policies for every other bucket still work.
drop policy if exists activity_albums_block_client_select on storage.objects;
create policy activity_albums_block_client_select on storage.objects as restrictive
  for select to anon, authenticated using (bucket_id <> 'activity-albums');
drop policy if exists activity_albums_block_client_insert on storage.objects;
create policy activity_albums_block_client_insert on storage.objects as restrictive
  for insert to anon, authenticated with check (bucket_id <> 'activity-albums');
drop policy if exists activity_albums_block_client_update on storage.objects;
create policy activity_albums_block_client_update on storage.objects as restrictive
  for update to anon, authenticated using (bucket_id <> 'activity-albums') with check (bucket_id <> 'activity-albums');
drop policy if exists activity_albums_block_client_delete on storage.objects;
create policy activity_albums_block_client_delete on storage.objects as restrictive
  for delete to anon, authenticated using (bucket_id <> 'activity-albums');

-- The metadata/rate tables are API-owned too. Restrictive deny policies make
-- that true even if a prior broad public-table policy exists.
drop policy if exists activity_albums_block_client_all on activity_albums;
create policy activity_albums_block_client_all on activity_albums as restrictive
  for all to anon, authenticated using (false) with check (false);
drop policy if exists activity_photos_block_client_all on activity_photos;
create policy activity_photos_block_client_all on activity_photos as restrictive
  for all to anon, authenticated using (false) with check (false);
drop policy if exists activity_album_upload_attempts_block_client_all on activity_album_upload_attempts;
create policy activity_album_upload_attempts_block_client_all on activity_album_upload_attempts as restrictive
  for all to anon, authenticated using (false) with check (false);
