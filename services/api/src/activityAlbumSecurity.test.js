import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { isCurrentActiveActivityMember, canReadActivityPhoto, activityPhotoPublicFields } from "./activityAlbumSecurity.js";
import { isAcceptedActivityAlbumMime, validateActivityAlbumImage } from "./activityAlbumImageValidation.js";

test("activity album guard rejects revoked/old-session members", () => {
  assert.equal(isCurrentActiveActivityMember({ id: "s-1", lifecycleStatus: "active" }), true);
  assert.equal(isCurrentActiveActivityMember({ id: "s-1", lifecycleStatus: "inactive" }), false);
  assert.equal(isCurrentActiveActivityMember(null), false);
});

test("pending and deleted photos never pass read/download policy", () => {
  for (const status of ["pending", "deleted"]) {
    assert.equal(canReadActivityPhoto({ status, canManage: false }), false);
    assert.equal(canReadActivityPhoto({ status, canManage: true }), false);
  }
  assert.equal(canReadActivityPhoto({ status: "ready", canManage: false }), true);
  assert.equal(canReadActivityPhoto({ status: "hidden", canManage: false }), false);
  assert.equal(canReadActivityPhoto({ status: "hidden", canManage: true }), true);
});

test("photo response is allowlisted and excludes storage/internal member fields", () => {
  const payload = activityPhotoPublicFields({ id: "p", bucket: "secret", storage_path: "private/path", uploaded_by: "internal-member", original_name: "a.jpg", mime_type: "image/jpeg", size_bytes: 3, status: "ready" }, "https://signed.example/read");
  assert.deepEqual(Object.keys(payload).sort(), ["capturedAt", "createdAt", "id", "mimeType", "originalName", "signedUrl", "sizeBytes", "status", "uploadedByName"].sort());
  assert.equal("bucket" in payload, false); assert.equal("storage_path" in payload, false); assert.equal("uploaded_by" in payload, false);
});

test("image validation fully decodes JPEG/PNG and rejects marker-only fake JPEGs", async () => {
  const png = await sharp({ create: { width: 1, height: 1, channels: 4, background: "#ff0000" } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 2, height: 3, channels: 3, background: "#00ff00" } }).jpeg().toBuffer();
  assert.deepEqual(await validateActivityAlbumImage(png), { mimeType: "image/png", width: 1, height: 1 });
  assert.deepEqual(await validateActivityAlbumImage(jpeg), { mimeType: "image/jpeg", width: 2, height: 3 });
  // Sol's 18-byte marker-only JPEG: has SOI/SOF/SOS/EOI-looking bytes but no
  // entropy-coded image. A real decoder must reject it.
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
  assert.equal(fakeJpeg.length, 18);
  assert.equal(await validateActivityAlbumImage(fakeJpeg), null);
  assert.equal(isAcceptedActivityAlbumMime("image/heic"), false);
  assert.equal(isAcceptedActivityAlbumMime("image/jpeg"), true);
});
