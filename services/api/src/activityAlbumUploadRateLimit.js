import crypto from "node:crypto";

export const ACTIVITY_UPLOAD_INTENTS_PER_MEMBER_PER_HOUR = 3000;
export const ACTIVITY_UPLOAD_INTENTS_PER_IP_PER_HOUR = 6000;

export function activityUploadIpHash(ip, secret) {
  return crypto.createHmac("sha256", String(secret || ""))
    .update(String(ip || "unknown").trim() || "unknown")
    .digest("hex");
}

// Only admitted attempts consume quota. Invalid files still consume quota once
// admitted, but requests rejected by the limiter never extend the cooldown.
export async function recordAndCheckActivityUploadIntent({ withTransaction, studentId, ipHash }) {
  return withTransaction(async (client) => {
    // Serialize admission decisions across API instances and shared IPs.
    await client.query("LOCK TABLE activity_album_upload_attempts IN SHARE ROW EXCLUSIVE MODE");
    const result = await client.query(`select
      count(*) filter (where student_id = $1)::int as member_count,
      count(*) filter (where ip_hash = $2)::int as ip_count,
      greatest(1, ceil(extract(epoch from (min(created_at) + interval '1 hour' - now()))))::int as retry_after
      from activity_album_upload_attempts
      where admitted = true and created_at > now() - interval '1 hour'
        and (student_id = $1 or ip_hash = $2)`, [studentId, ipHash]);
    const counts = result.rows[0] || {};
    const memberCount = Number(counts.member_count || 0);
    const ipCount = Number(counts.ip_count || 0);
    const allowed = memberCount < ACTIVITY_UPLOAD_INTENTS_PER_MEMBER_PER_HOUR
      && ipCount < ACTIVITY_UPLOAD_INTENTS_PER_IP_PER_HOUR;
    if (allowed) await client.query(
      "insert into activity_album_upload_attempts (student_id, ip_hash, admitted) values ($1, $2, true)", [studentId, ipHash]);
    return { memberCount, ipCount, allowed, retryAfter: Number(counts.retry_after) || 3600 };
  });
}
