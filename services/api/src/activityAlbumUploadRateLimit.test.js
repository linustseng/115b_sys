import test from "node:test";
import assert from "node:assert/strict";
import { activityUploadIpHash, recordAndCheckActivityUploadIntent } from "./activityAlbumUploadRateLimit.js";

test("only admitted requests consume quota; both limits and cooldown are enforced", async () => {
  for (const [member_count, ip_count, allowed] of [[0,0,true],[300,600,true],[599,1199,true],[600,700,false],[100,1200,false],[1408,1408,false]]) {
    const calls = [];
    const query = async (sql, params) => {
      calls.push({sql,params});
      return {rows: /select/.test(sql) ? [{member_count,ip_count,retry_after:42}] : []};
    };
    const result = await recordAndCheckActivityUploadIntent({withTransaction: fn => fn({query}), studentId:"a",ipHash:"b"});
    assert.equal(result.allowed,allowed);
    assert.equal(result.retryAfter,42);
    assert.match(calls[0].sql,/LOCK TABLE/);
    assert.match(calls[1].sql,/admitted = true/);
    assert.equal(calls.filter(c=>/insert into/.test(c.sql)).length,allowed ? 1 : 0);
  }
});
test("IP is hashed without exposing the address", () => {
  assert.notEqual(activityUploadIpHash("203.0.113.2","secret"),"203.0.113.2");
});
