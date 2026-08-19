import test from "node:test";
import assert from "node:assert/strict";
import { activityUploadIpHash, recordAndCheckActivityUploadIntent } from "./activityAlbumUploadRateLimit.js";

test("upload intent limiting records rejected/deleted attempts and enforces both member and IP limits", async () => {
  const calls = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    if (/select\s+count/i.test(sql)) return { rows: [{ member_count: "61", ip_count: "120" }] };
    return { rows: [] };
  };
  const result = await recordAndCheckActivityUploadIntent({ query, studentId: "member-1", ipHash: activityUploadIpHash("203.0.113.2", "secret") });
  assert.equal(result.allowed, false);
  assert.equal(result.memberCount, 61);
  assert.match(calls[0].sql, /insert into activity_album_upload_attempts/i);
  assert.match(calls[1].sql, /student_id = \$1/i);
  assert.match(calls[1].sql, /ip_hash = \$2/i);
  assert.notEqual(calls[0].params[1], "203.0.113.2");
});
