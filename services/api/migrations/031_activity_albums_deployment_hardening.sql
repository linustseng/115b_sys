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

create table if not exists activity_album_upload_attempts (
  id bigint generated always as identity primary key,
  student_id text not null,
  ip_hash text not null check (length(ip_hash) = 64),
  created_at timestamptz not null default now()
);
create index if not exists idx_activity_album_upload_attempts_member_time on activity_album_upload_attempts(student_id, created_at desc);
create index if not exists idx_activity_album_upload_attempts_ip_time on activity_album_upload_attempts(ip_hash, created_at desc);
alter table activity_album_upload_attempts enable row level security;

-- Supabase owns storage.objects with supabase_storage_admin. Direct database
-- connections commonly run as postgres and cannot alter that table or create
-- policies on it. When the migration role owns storage.objects, add explicit
-- restrictive policies. Otherwise accept only the safe default-deny state:
-- RLS must already be enabled and no Storage policies may exist.
do $$
declare
  storage_owner text;
  storage_rls_enabled boolean;
  storage_policy_count integer;
begin
  select tableowner into storage_owner
  from pg_tables where schemaname = 'storage' and tablename = 'objects';
  select relrowsecurity into storage_rls_enabled
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects';

  if storage_owner = current_user then
    execute 'alter table storage.objects enable row level security';
    execute 'drop policy if exists activity_albums_block_client_select on storage.objects';
    execute 'create policy activity_albums_block_client_select on storage.objects as restrictive for select to anon, authenticated using (bucket_id <> ''activity-albums'')';
    execute 'drop policy if exists activity_albums_block_client_insert on storage.objects';
    execute 'create policy activity_albums_block_client_insert on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id <> ''activity-albums'')';
    execute 'drop policy if exists activity_albums_block_client_update on storage.objects';
    execute 'create policy activity_albums_block_client_update on storage.objects as restrictive for update to anon, authenticated using (bucket_id <> ''activity-albums'') with check (bucket_id <> ''activity-albums'')';
    execute 'drop policy if exists activity_albums_block_client_delete on storage.objects';
    execute 'create policy activity_albums_block_client_delete on storage.objects as restrictive for delete to anon, authenticated using (bucket_id <> ''activity-albums'')';
  else
    select count(*) into storage_policy_count
    from pg_policies where schemaname = 'storage' and tablename = 'objects';
    if not coalesce(storage_rls_enabled, false) or storage_policy_count <> 0 then
      raise exception 'storage.objects must be owner-hardened: owner=%, rls=%, policies=%', storage_owner, storage_rls_enabled, storage_policy_count;
    end if;
  end if;
end $$;

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
