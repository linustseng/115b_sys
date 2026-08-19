import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ||= "activity-album-test-secret";
process.env.GOOGLE_CLIENT_ID ||= "activity-album-test-client";

const { app } = await import("./server.js");
const { createSessionToken } = await import("./auth/session.js");

test("activity album API routes reject unauthenticated requests before any storage URL is issued", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const requests = [
    ["GET", "/v1/activity-albums"], ["POST", "/v1/activity-albums"], ["PATCH", "/v1/activity-albums/a"],
    ["GET", "/v1/activity-albums/a/photos"], ["POST", "/v1/activity-albums/a/upload-intent"],
    ["POST", "/v1/activity-photos/p/complete"], ["GET", "/v1/activity-photos/p/download"],
    ["PATCH", "/v1/activity-photos/p"], ["DELETE", "/v1/activity-photos/p"],
    ["GET", "/v1/admin/storage-monitoring"],
  ];
  for (const [method, path] of requests) {
    const response = await fetch(`${origin}${path}`, { method, headers: { "Content-Type": "application/json" }, body: ["POST", "PATCH"].includes(method) ? "{}" : undefined });
    assert.equal(response.status, 401, `${method} ${path}`);
    assert.deepEqual(await response.json(), { ok: false, data: null, error: "Unauthorized" });
  }
});

test("album routes reject body/query tokens and never fall back from an invalid Bearer token", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const validToken = createSessionToken({ studentId: "member-1" });
  for (const request of [
    fetch(`${origin}/v1/activity-albums?sessionToken=${encodeURIComponent(validToken)}`),
    fetch(`${origin}/v1/activity-albums?sessionToken=${encodeURIComponent(validToken)}`, { headers: { Authorization: "Bearer definitely-invalid" } }),
    fetch(`${origin}/v1/activity-albums`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionToken: validToken }) }),
  ]) {
    const response = await request;
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, data: null, error: "Unauthorized" });
  }
});
