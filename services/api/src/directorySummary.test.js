import assert from "node:assert/strict";
import test from "node:test";
import { toDirectorySummaryEntry } from "./directorySummary.js";

test("directory summary allowlists only non-sensitive fields", () => {
  const result = toDirectorySummaryEntry({
    id: "P001",
    name_zh: " 王小明 ",
    group_id: "A",
    company: "範例公司",
    title: "執行長",
    email: "private@example.com",
    mobile: "0912345678",
    emergency_phone: "0212345678",
  });

  assert.deepEqual(result, {
    nameZh: "王小明",
    group: "A",
    company: "範例公司",
    title: "執行長",
  });
  assert.equal(Object.hasOwn(result, "email"), false);
  assert.equal(Object.hasOwn(result, "mobile"), false);
});
