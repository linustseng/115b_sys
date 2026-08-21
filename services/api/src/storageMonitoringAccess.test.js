import test from "node:test";
import assert from "node:assert/strict";
import { canViewStorageMonitoring, STORAGE_MONITORING_STUDENT_ID } from "./storageMonitoringAccess.js";

test("storage monitoring is restricted to 曾俊豪's stable student id", () => {
  assert.equal(STORAGE_MONITORING_STUDENT_ID, "P15747021");
  assert.equal(canViewStorageMonitoring("P15747021"), true);
  assert.equal(canViewStorageMonitoring(" P15747021 "), true);
  assert.equal(canViewStorageMonitoring("P15747020"), false);
  assert.equal(canViewStorageMonitoring(""), false);
  assert.equal(canViewStorageMonitoring(null), false);
});
