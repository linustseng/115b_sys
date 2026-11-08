// Sign only already-authorized rows. Bounded batches avoid hundreds of
// simultaneous Storage requests while preserving each photo's ordering.
export async function signAlbumPhotoUrls(rows, signBatch) {
  const urls = new Map();
  const groups = new Map();
  for (const row of rows) {
    if (!row.bucket || !row.storage_path) throw new Error("Missing photo storage metadata");
    if (!groups.has(row.bucket)) groups.set(row.bucket, []);
    groups.get(row.bucket).push(row.storage_path);
  }
  for (const [bucket, paths] of groups) {
    for (let offset = 0; offset < paths.length; offset += 100) {
      const batch = paths.slice(offset, offset + 100);
      const data = await signBatch(bucket, batch);
      for (const item of data || []) {
        if (item.error || !item.signedUrl || !item.path) throw new Error("Unable to sign album photo");
        urls.set(bucket + "/" + item.path, item.signedUrl);
      }
      if (batch.some(path => !urls.has(bucket + "/" + path))) throw new Error("Incomplete album photo URLs");
    }
  }
  return rows.map(row => urls.get(row.bucket + "/" + row.storage_path));
}
