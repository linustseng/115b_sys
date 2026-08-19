export async function cleanExpiredActivityPending({ query, removeStorageObject, studentId, albumId, ttlMinutes = 30 }) {
  const expired = await query(`select id, bucket, storage_path from activity_photos
    where uploaded_by = $1 and album_id = $2 and status = 'pending'
      and created_at < now() - ($3::text || ' minutes')::interval
    for update`, [studentId, albumId, String(ttlMinutes)]);
  for (const row of expired.rows) {
    try { await removeStorageObject({ bucket: row.bucket, storagePath: row.storage_path }); } catch { /* never-uploaded/missing objects are safe to mark deleted */ }
  }
  if (expired.rows.length) {
    await query(`update activity_photos set status = 'deleted', deleted_at = now(), updated_at = now()
      where id = any($1::text[]) and status = 'pending'`, [expired.rows.map((row) => row.id)]);
  }
  return expired.rows.length;
}

// This is intentionally not tied to the member/album that happened to make a
// new request. It is run at startup and on a timer, and removes both expired
// pending rows and objects that have no live metadata row (including a client
// upload that raced a now-expired signed capability).
export async function cleanActivityAlbumOrphans({ query, removeStorageObject, listStoragePaths, bucket, ttlMinutes = 30 }) {
  const expired = await query(`select id, bucket, storage_path from activity_photos
    where status = 'pending' and created_at < now() - ($1::text || ' minutes')::interval`, [String(ttlMinutes)]);
  for (const row of expired.rows) {
    try { await removeStorageObject({ bucket: row.bucket, storagePath: row.storage_path }); } catch { /* retry on next global pass */ }
  }
  if (expired.rows.length) {
    await query(`update activity_photos set status = 'deleted', deleted_at = now(), updated_at = now()
      where id = any($1::text[]) and status = 'pending'`, [expired.rows.map((row) => row.id)]);
  }

  const paths = await listStoragePaths({ bucket, prefix: "activity-albums" });
  if (!paths.length) return { expiredRows: expired.rows.length, orphanObjects: 0 };
  const known = await query(`select storage_path from activity_photos
    where bucket = $1 and storage_path = any($2::text[]) and status in ('pending', 'ready', 'hidden')`, [bucket, paths]);
  const knownPaths = new Set(known.rows.map((row) => row.storage_path));
  const orphanPaths = paths.filter((path) => !knownPaths.has(path));
  for (const storagePath of orphanPaths) {
    try { await removeStorageObject({ bucket, storagePath }); } catch { /* retry on next global pass */ }
  }
  return { expiredRows: expired.rows.length, orphanObjects: orphanPaths.length };
}
