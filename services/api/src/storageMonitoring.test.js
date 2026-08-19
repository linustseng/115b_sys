import test from "node:test";
import assert from "node:assert/strict";
import { buildStorageMonitoringSnapshot, loadStorageMonitoringSnapshot, storageCategory } from "./storageMonitoring.js";

test("storage monitoring uses Supabase Storage metadata rows, not application attachment tables", async () => {
  let sql = "";
  const snapshot = await loadStorageMonitoringSnapshot({
    query: async (statement) => {
      sql = statement;
      return { rows: [
        { bucket: "activity-albums", mime_type: "image/jpeg", size_bytes: "1073741824", object_count: 2 },
        { bucket: "attachments", mime_type: "application/pdf", size_bytes: "536870912", object_count: 1 },
      ] };
    },
    quotaBytes: 4 * 1024 ** 3,
    planLabel: "Approved project allocation",
    now: () => "2026-08-19T00:00:00.000Z",
  });
  assert.match(sql, /from storage\.objects/i);
  assert.doesNotMatch(sql, /activity_photos|attachments/i);
  assert.equal(snapshot.actualUsedBytes, 1610612736);
  assert.equal(snapshot.remainingBytes, 2684354560);
  assert.equal(snapshot.usagePercent, 37.5);
  assert.equal(snapshot.warningLevel, "normal");
  assert.deepEqual(snapshot.buckets.map((item) => item.bucket), ["activity-albums", "attachments"]);
  assert.deepEqual(snapshot.categories.map((item) => item.category), ["image", "document"]);
  assert.equal(snapshot.observedAt, "2026-08-19T00:00:00.000Z");
});

test("storage monitoring does not invent a quota or remaining capacity", () => {
  const snapshot = buildStorageMonitoringSnapshot({ bucketRows: [{ bucket: "private", size_bytes: 42, object_count: 1 }] });
  assert.equal(snapshot.quota.status, "unavailable");
  assert.equal(snapshot.remainingBytes, null);
  assert.equal(snapshot.usagePercent, null);
  assert.equal(snapshot.warningLevel, "unknown");
  assert.deepEqual(snapshot.needsConfiguration, ["SUPABASE_STORAGE_MONITORING_QUOTA_BYTES", "SUPABASE_STORAGE_MONITORING_PLAN_LABEL (optional)"]);
});

test("storage monitoring applies 70/85/95 thresholds and exposes aggregate allowlisted rows only", () => {
  for (const [used, level] of [[69, "normal"], [70, "warning"], [85, "high"], [95, "critical"]]) {
    const snapshot = buildStorageMonitoringSnapshot({
      bucketRows: [{ bucket: "private", size_bytes: used, object_count: 1, storage_path: "must-not-leak" }],
      quotaBytes: 100,
    });
    assert.equal(snapshot.warningLevel, level);
    assert.deepEqual(Object.keys(snapshot.buckets[0]).sort(), ["bucket", "objectCount", "sizeBytes"]);
    assert.equal("storage_path" in snapshot.buckets[0], false);
  }
});

test("storage category labels come only from Storage object metadata", () => {
  assert.equal(storageCategory("image/png"), "image");
  assert.equal(storageCategory("video/mp4"), "video");
  assert.equal(storageCategory("application/pdf"), "document");
  assert.equal(storageCategory("application/octet-stream"), "other");
});
