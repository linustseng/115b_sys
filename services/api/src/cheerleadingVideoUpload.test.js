import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanExpiredCheerleadingVideoUploads,
  reserveCheerleadingVideoPending,
  validateCheerleadingVideoIntent,
  validateCompletedCheerleadingVideoObject,
} from "./cheerleadingVideoUpload.js";

test("accepts a 68.8 MB MP4 intent below the configured limit", () => {
  const result = validateCheerleadingVideoIntent({
    fileName: "teaching.mp4",
    mimeType: "video/mp4",
    sizeBytes: 72_142_029,
    maxSizeBytes: 500 * 1024 * 1024,
  });
  assert.deepEqual(result, { ok: true, mimeType: "video/mp4", sizeBytes: 72_142_029 });
});

test("rejects unsupported or oversized video intents", () => {
  assert.equal(validateCheerleadingVideoIntent({ fileName: "a.avi", mimeType: "video/avi", sizeBytes: 1, maxSizeBytes: 10 }).ok, false);
  assert.equal(validateCheerleadingVideoIntent({ fileName: "a.mp4", mimeType: "video/mp4", sizeBytes: 11, maxSizeBytes: 10 }).ok, false);
});

test("completion requires exact storage metadata without downloading the video", () => {
  const valid = validateCompletedCheerleadingVideoObject({
    objectRow: { metadata: { mimetype: "video/mp4", size: 72_142_029 } },
    expectedMimeType: "video/mp4",
    expectedSizeBytes: 72_142_029,
  });
  assert.deepEqual(valid, { ok: true, mimeType: "video/mp4", sizeBytes: 72_142_029 });
  assert.equal(validateCompletedCheerleadingVideoObject({
    objectRow: { metadata: { mimetype: "video/mp4", size: 12 } },
    expectedMimeType: "video/mp4",
    expectedSizeBytes: 13,
  }).ok, false);
});

test("parallel upload intents atomically reserve at most three pending slots", async () => {
  let pendingCount = 0;
  let queue = Promise.resolve();
  const withTransaction = async (callback) => {
    let release;
    const previous = queue;
    queue = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await callback({
        query: async (sql) => {
          if (/count\(\*\)/i.test(sql)) return { rows: [{ count: pendingCount }] };
          return { rows: [{}] };
        },
      });
    } finally {
      release();
    }
  };
  const reservations = await Promise.all(Array.from({ length: 10 }, (_, index) => reserveCheerleadingVideoPending({
    withTransaction,
    studentId: "manager-1",
    maxPending: 3,
    insertPending: async () => {
      pendingCount += 1;
      return { id: `video-${index}` };
    },
  })));
  assert.equal(reservations.filter(Boolean).length, 3);
  assert.equal(pendingCount, 3);
});

test("cleanup never deletes an object when completion wins the atomic pending claim", async () => {
  let removed = false;
  const calls = [];
  await cleanExpiredCheerleadingVideoUploads({
    query: async (sql) => {
      calls.push(sql);
      if (/^select/i.test(sql.trim())) return { rows: [{ id: "v1", bucket: "attachments", storage_path: "v1.mp4", status: "pending" }] };
      if (/returning id,bucket/i.test(sql)) return { rows: [] };
      return { rows: [] };
    },
    removeStorageObject: async () => { removed = true; },
    ttlHours: 3,
  });
  assert.equal(removed, false);
  assert.equal(calls.some((sql) => /status='deleting'/.test(sql)), true);
});

test("cleanup claims pending before removal and restores pending after transient storage failure", async () => {
  const calls = [];
  await cleanExpiredCheerleadingVideoUploads({
    query: async (sql) => {
      calls.push(sql);
      if (/^select/i.test(sql.trim())) return { rows: [{ id: "v2", bucket: "attachments", storage_path: "v2.mp4", status: "pending" }] };
      if (/returning id,bucket/i.test(sql)) return { rows: [{ id: "v2", bucket: "attachments", storage_path: "v2.mp4", status: "deleting" }] };
      return { rows: [] };
    },
    removeStorageObject: async () => { throw new Error("temporary storage failure"); },
    ttlHours: 3,
  });
  assert.equal(calls.some((sql) => /set status='pending'/.test(sql)), true);
  assert.equal(calls.some((sql) => /set status='deleted'/.test(sql)), false);
});
