import test from "node:test";
import assert from "node:assert/strict";
import { activityUploadIpHash, recordAndCheckActivityUploadIntent } from "./activityAlbumUploadRateLimit.js";

test("upload intent limiting records rejected/deleted attempts and enforces both member and IP limits", async () => {
  const calls = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    if (/select\s+count/i.test(sql)) return { rows: [{ member_count: "601", ip_count: "1200" }] };
    return { rows: [] };
  };
  const result = await recordAndCheckActivityUploadIntent({ query, studentId: "member-1", ipHash: activityUploadIpHash("203.0.113.2", "secret") });
  assert.equal(result.allowed, false);
  assert.equal(result.memberCount, 601);
  assert.match(calls[0].sql, /insert into activity_album_upload_attempts/i);
  assert.match(calls[1].sql, /student_id = \$1/i);
  assert.match(calls[1].sql, /ip_hash = \$2/i);
  assert.notEqual(calls[0].params[1], "203.0.113.2");
});

test("normal batch of hundreds is allowed, shared IP cap still applies", async () => {
  for (const [member_count, ip_count, allowed] of [[300, 600, true], [600, 1200, true], [601, 700, false], [100, 1201, false]]) {
    const query = async (sql) => ({ rows: /select/.test(sql) ? [{ member_count, ip_count }] : [] });
    assert.equal((await recordAndCheckActivityUploadIntent({ query, studentId: "a", ipHash: "b" })).allowed, allowed);
  }
});
