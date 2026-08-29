import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.SESSION_SECRET ||= "cheerleading-video-test-secret";
process.env.GOOGLE_CLIENT_ID ||= "cheerleading-video-test-client";

const { app } = await import("./server.js");
const { createSessionToken } = await import("./auth/session.js");

test("direct cheerleading video routes require a valid Bearer session", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;

  for (const path of [
    "/v1/cheerleading/videos/upload-intent",
    "/v1/cheerleading/videos/video-1/complete",
  ]) {
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { ok: false, data: null, error: "Unauthorized" });
  }
});

test("legacy multipart endpoints authenticate before buffering and reject authenticated 68.8 MB bodies from headers", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const sendHeaders = (path, token = "") => new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=probe",
        "Content-Length": "72142029",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }, (result) => {
      let body = "";
      result.setEncoding("utf8");
      result.on("data", (chunk) => { body += chunk; });
      result.on("end", () => {
        request.destroy();
        resolve({ status: result.statusCode, body });
      });
    });
    request.on("error", reject);
    request.flushHeaders();
  });

  for (const path of ["/v1/attachments/upload", "/v1/finance/attachments/upload"]) {
    const unauthenticated = await sendHeaders(path);
    assert.equal(unauthenticated.status, 401, path);
    assert.match(unauthenticated.body, /Unauthorized/);

    const queryToken = await sendHeaders(`${path}?sessionToken=${encodeURIComponent(createSessionToken({ studentId: "member-1" }))}`);
    assert.equal(queryToken.status, 401, `${path} query tokens must not authenticate uploads`);
  }

  const authenticated = await sendHeaders("/v1/attachments/upload", createSessionToken({ studentId: "member-1" }));
  assert.equal(authenticated.status, 413);
  assert.match(authenticated.body, /新版直傳功能/);

  const sendTooManyChunkedFields = () => new Promise((resolve, reject) => {
    const boundary = "chunked-field-probe";
    const request = http.request({
      hostname: "127.0.0.1",
      port: server.address().port,
      path: "/v1/attachments/upload",
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${createSessionToken({ studentId: "member-1" })}`,
      },
    }, (result) => {
      let body = "";
      result.setEncoding("utf8");
      result.on("data", (chunk) => { body += chunk; });
      result.on("end", () => resolve({ status: result.statusCode, body }));
    });
    request.on("error", reject);
    for (let index = 0; index < 13; index += 1) {
      request.write(`--${boundary}\r\nContent-Disposition: form-data; name="field${index}"\r\n\r\nvalue\r\n`);
    }
    request.end(`--${boundary}--\r\n`);
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const chunked = await sendTooManyChunkedFields();
    assert.equal(chunked.status, 400, "each Multer rejection must release its concurrency slot");
  }
});
