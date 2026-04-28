import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrderCutoffAt,
  isEventAttendanceConfirmed,
  isEventTodoExpired,
  isOrderPlanOpen,
  isSoftballAttendanceConfirmed,
} from "./nativeActions.js";

const NOW_MS = Date.parse("2026-04-28T05:00:00.000Z");

test("event attendance confirmation only accepts 出席 / 不克出席", () => {
  for (const value of ["", null, undefined, "尚未確定", "未定", " unknown "]) {
    assert.equal(isEventAttendanceConfirmed(value), false, `${String(value)} should not be confirmed`);
  }

  assert.equal(isEventAttendanceConfirmed("出席"), true);
  assert.equal(isEventAttendanceConfirmed(" 不克出席 "), true);
});

test("event todo expires after registration_close_at or end_at", () => {
  assert.equal(
    isEventTodoExpired({ status: "open", registration_close_at: "2026-04-28T04:59:00.000Z" }, { nowMs: NOW_MS }),
    true
  );
  assert.equal(
    isEventTodoExpired({ status: "open", end_at: "2026-04-28T04:59:00.000Z" }, { nowMs: NOW_MS }),
    true
  );
  assert.equal(
    isEventTodoExpired(
      { status: "open", registration_close_at: "2026-04-28T05:01:00.000Z", end_at: "2026-04-28T06:00:00.000Z" },
      { nowMs: NOW_MS }
    ),
    false
  );
});

test("event todo expires when event status is not open", () => {
  assert.equal(isEventTodoExpired({ status: "closed" }, { nowMs: NOW_MS }), true);
  assert.equal(isEventTodoExpired({ status: "cancelled" }, { nowMs: NOW_MS }), true);
  assert.equal(isEventTodoExpired({ status: "open" }, { nowMs: NOW_MS }), false);
});

test("order plan open/closed uses cutoffAt, closeAt, close_at, then date fallback", () => {
  assert.equal(
    isOrderPlanOpen({ raw: { cutoffAt: "2026-04-28T05:01:00.000Z" } }, { nowMs: NOW_MS }),
    true
  );
  assert.equal(
    isOrderPlanOpen({ raw: { cutoffAt: "2026-04-28T04:59:00.000Z" } }, { nowMs: NOW_MS }),
    false
  );
  assert.equal(
    isOrderPlanOpen({ raw: { closeAt: "2026-04-28T05:01:00.000Z" } }, { nowMs: NOW_MS }),
    true
  );
  assert.equal(
    isOrderPlanOpen({ close_at: "2026-04-28T04:59:00.000Z" }, { nowMs: NOW_MS }),
    false
  );

  const fallbackCutoff = getOrderCutoffAt({ date: "2026-04-30" });
  assert.ok(fallbackCutoff instanceof Date);
  assert.equal(fallbackCutoff.getHours(), 23);
  assert.equal(fallbackCutoff.getMinutes(), 59);
  assert.equal(isOrderPlanOpen({ date: "2026-04-29" }, { nowMs: Date.parse("2026-04-27T00:00:00.000Z") }), true);
  assert.equal(isOrderPlanOpen({ date: "2026-04-29" }, { nowMs: Date.parse("2026-04-29T00:00:00.000Z") }), false);
});

test("order plan status other than open is closed", () => {
  assert.equal(isOrderPlanOpen({ status: "closed", raw: { cutoffAt: "2026-04-28T05:01:00.000Z" } }, { nowMs: NOW_MS }), false);
  assert.equal(isOrderPlanOpen({ raw: { status: "cancelled", cutoffAt: "2026-04-28T05:01:00.000Z" } }, { nowMs: NOW_MS }), false);
});

test("softball attendance preserves existing unknown semantics", () => {
  assert.equal(isSoftballAttendanceConfirmed(""), false);
  assert.equal(isSoftballAttendanceConfirmed(null), false);
  assert.equal(isSoftballAttendanceConfirmed("unknown"), false);
  assert.equal(isSoftballAttendanceConfirmed(" UNKNOWN "), false);
  assert.equal(isSoftballAttendanceConfirmed("attend"), true);
  assert.equal(isSoftballAttendanceConfirmed("absent"), true);
  assert.equal(isSoftballAttendanceConfirmed("late"), true);
});
