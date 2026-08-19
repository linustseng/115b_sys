import test from "node:test";
import assert from "node:assert/strict";
import { cleanActivityAlbumOrphans, cleanExpiredActivityPending } from "./activityAlbumPendingCleanup.js";

test("expired pending cleanup removes objects and marks rows deleted even if one object is already absent", async () => {
  const calls = []; const removed = [];
  const query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.trim().startsWith("select")) return { rows: [{ id: "p1", bucket: "activity-albums", storage_path: "a/p1" }, { id: "p2", bucket: "activity-albums", storage_path: "a/p2" }] };
    return { rows: [] };
  };
  const count = await cleanExpiredActivityPending({ query, studentId: "student", albumId: "album", removeStorageObject: async (row) => { removed.push(row.storagePath); if (row.storagePath === "a/p2") throw new Error("not found"); } });
  assert.equal(count, 2); assert.deepEqual(removed, ["a/p1", "a/p2"]);
  assert.deepEqual(calls[1].params, [["p1", "p2"]]);
});

test("global cleanup removes expired pending rows and objects without live metadata across every member and album", async () => {
  const removed = [];
  const query = async (sql) => {
    if (/where status = 'pending'/i.test(sql)) return { rows: [{ id: "expired", bucket: "activity-albums", storage_path: "activity-albums/a/expired" }] };
    if (/select storage_path/i.test(sql)) return { rows: [{ storage_path: "activity-albums/a/ready" }] };
    return { rows: [] };
  };
  const result = await cleanActivityAlbumOrphans({
    query, bucket: "activity-albums",
    listStoragePaths: async () => ["activity-albums/a/ready", "activity-albums/other/raced-after-expiry"],
    removeStorageObject: async ({ storagePath }) => removed.push(storagePath),
  });
  assert.deepEqual(removed.sort(), ["activity-albums/a/expired", "activity-albums/other/raced-after-expiry"]);
  assert.deepEqual(result, { expiredRows: 1, orphanObjects: 1 });
});
