import test from "node:test";
import assert from "node:assert/strict";
import { jsonbParam } from "./jsonb.js";

test("jsonbParam serializes arrays as valid JSON instead of postgres array syntax", () => {
  assert.equal(jsonbParam(["vendor-a", "vendor-b"], []), '["vendor-a","vendor-b"]');
});

test("jsonbParam serializes objects as valid JSON", () => {
  assert.equal(jsonbParam({ ok: true, count: 2 }, {}), '{"ok":true,"count":2}');
});

test("jsonbParam falls back when value is nullish", () => {
  assert.equal(jsonbParam(undefined, []), '[]');
  assert.equal(jsonbParam(null, {}), '{}');
});
