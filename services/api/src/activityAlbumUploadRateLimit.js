import crypto from "node:crypto";

export const ACTIVITY_UPLOAD_INTENTS_PER_MEMBER_PER_HOUR = 60;
export const ACTIVITY_UPLOAD_INTENTS_PER_IP_PER_HOUR = 120;

export function activityUploadIpHash(ip, secret) {
  return crypto.createHmac("sha256", String(secret || ""))
    .update(String(ip || "unknown").trim() || "unknown")
    .digest("hex");
}

// Every authenticated intent is recorded before album/file validation. This
// deliberately includes rejected filenames, MIME values, sizes, and intents
// that later become deleted, so those requests cannot be used as free CPU or
// Storage-signing probes.
export async function recordAndCheckActivityUploadIntent({ query, studentId, ipHash }) {
  await query("insert into activity_album_upload_attempts (student_id, ip_hash) values ($1, $2)", [studentId, ipHash]);
  const result = await query(`select
      count(*) filter (where student_id = $1)::int as member_count,
      count(*) filter (where ip_hash = $2)::int as ip_count
    from activity_album_upload_attempts
    where created_at > now() - interval '1 hour'`, [studentId, ipHash]);
  const counts = result.rows[0] || {};
  return {
    memberCount: Number(counts.member_count || 0),
    ipCount: Number(counts.ip_count || 0),
    allowed: Number(counts.member_count || 0) <= ACTIVITY_UPLOAD_INTENTS_PER_MEMBER_PER_HOUR
      && Number(counts.ip_count || 0) <= ACTIVITY_UPLOAD_INTENTS_PER_IP_PER_HOUR,
  };
}
