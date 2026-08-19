-- Reassert RLS for installations where 029 may have existed before the
-- feature was reverted. There are intentionally no anon/authenticated
-- policies: all reads/signing and signed upload issuance go through Node.
alter table if exists activity_albums enable row level security;
alter table if exists activity_photos enable row level security;
alter table storage.objects enable row level security;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    update storage.buckets set public = false,
      file_size_limit = 15728640,
      allowed_mime_types = array['image/jpeg', 'image/png']
    where id = 'activity-albums';
  end if;
end $$;
