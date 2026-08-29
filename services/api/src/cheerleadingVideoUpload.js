export const CHEERLEADING_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function text(value) {
  return String(value == null ? "" : value).trim();
}

function positiveSafeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function validateCheerleadingVideoIntent({ fileName, mimeType, sizeBytes, maxSizeBytes } = {}) {
  const normalizedMime = text(mimeType).toLowerCase();
  const normalizedSize = positiveSafeInteger(sizeBytes);
  const normalizedMax = positiveSafeInteger(maxSizeBytes);
  if (!text(fileName)) return { ok: false, error: "請選擇影片檔案" };
  if (!CHEERLEADING_VIDEO_MIME_TYPES.has(normalizedMime)) {
    return { ok: false, error: "僅支援 MP4、WebM 或 MOV 影片" };
  }
  if (!normalizedSize || !normalizedMax || normalizedSize > normalizedMax) {
    return { ok: false, error: "影片大小超過限制" };
  }
  return { ok: true, mimeType: normalizedMime, sizeBytes: normalizedSize };
}

export function validateCompletedCheerleadingVideoObject({ objectRow, expectedMimeType, expectedSizeBytes } = {}) {
  if (!objectRow) return { ok: false, error: "尚未收到影片檔案" };
  const metadata = objectRow.metadata && typeof objectRow.metadata === "object" ? objectRow.metadata : {};
  const mimeType = text(metadata.mimetype || metadata.contentType).toLowerCase();
  const sizeBytes = positiveSafeInteger(metadata.size);
  if (!CHEERLEADING_VIDEO_MIME_TYPES.has(mimeType) || mimeType !== text(expectedMimeType).toLowerCase()) {
    return { ok: false, error: "上傳影片格式不符" };
  }
  if (!sizeBytes || sizeBytes !== positiveSafeInteger(expectedSizeBytes)) {
    return { ok: false, error: "上傳影片大小不完整" };
  }
  return { ok: true, mimeType, sizeBytes };
}

export async function reserveCheerleadingVideoPending({
  withTransaction,
  studentId,
  maxPending,
  insertPending,
} = {}) {
  if (typeof withTransaction !== "function" || typeof insertPending !== "function") throw new Error("reservation dependencies are required");
  return withTransaction(async (client) => {
    const lockKey = `cheerleading-video-upload:${text(studentId)}`;
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [lockKey]);
    const pending = await client.query(`select count(*)::int as count from attachments
      where entity_type='cheerleading_video' and status='pending' and uploaded_by=$1`, [text(studentId)]);
    if (Number(pending.rows[0]?.count || 0) >= Number(maxPending || 0)) return null;
    return insertPending(client);
  });
}

export async function cleanExpiredCheerleadingVideoUploads({
  query,
  removeStorageObject,
  studentId = "",
  ttlHours = 3,
  now = () => new Date().toISOString(),
} = {}) {
  if (typeof query !== "function" || typeof removeStorageObject !== "function") throw new Error("cleanup dependencies are required");
  const expired = await query(`select id,bucket,storage_path,status from attachments
    where entity_type='cheerleading_video' and status in ('pending','deleting') and ($1='' or uploaded_by=$1)
      and synced_at < now() - ($2::int * interval '1 hour') limit 20`, [text(studentId), ttlHours]);
  for (const row of expired.rows || []) {
    let claimed = row;
    if (row.status === "pending") {
      const claim = await query(`update attachments set status='deleting',updated_at=$2
        where id=$1 and status='pending' and synced_at < now() - ($3::int * interval '1 hour')
        returning id,bucket,storage_path,status`, [row.id, now(), ttlHours]);
      claimed = claim.rows && claim.rows[0];
    }
    // Another request completed the pending row before cleanup could claim it.
    // Never delete its storage object in that case.
    if (!claimed) continue;
    try {
      await removeStorageObject({ bucket: claimed.bucket, storagePath: claimed.storage_path });
      await query("update attachments set status='deleted',deleted_at=$2,updated_at=$2 where id=$1 and status='deleting'", [claimed.id, now()]);
    } catch {
      await query("update attachments set status='pending',updated_at=$2 where id=$1 and status='deleting'", [claimed.id, now()]);
    }
  }
}
