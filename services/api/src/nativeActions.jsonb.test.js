import test from "node:test";
import assert from "node:assert/strict";
import { dispatchNativeAction } from "./nativeActions.js";

function createQueryStub(handlers = []) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    for (const handler of handlers) {
      const matched = typeof handler.match === "function" ? handler.match(sql, params) : handler.match.test(sql);
      if (matched) {
        return typeof handler.result === "function" ? handler.result(sql, params, calls) : handler.result;
      }
    }
    return { rows: [] };
  };
  return { query, calls };
}

function buildBaseDeps(query) {
  return {
    query,
    withTransaction: async (fn) => fn({ query }),
    verifyGoogleIdToken: async () => ({}),
    createSessionToken: () => "session-token",
    createRefreshToken: () => "refresh-token",
    verifyRefreshToken: () => ({}),
    findStudentProfileById: async () => null,
  };
}

test("createSoftballSupplyCase serializes vendorIds/raw JSONB params before SQL write", async () => {
  const { query, calls } = createQueryStub([
    {
      match: /select \* from softball_supply_cases where practice_id = \$1 limit 1/i,
      result: { rows: [] },
    },
  ]);

  await dispatchNativeAction({
    action: "createSoftballSupplyCase",
    payload: {
      data: {
        id: "case-1",
        practiceId: "practice-1",
        vendorIds: ["vendor-a", "vendor-b"],
        angelStatus: "assigned",
        orderStatus: "ordered",
        notes: "test",
      },
    },
    auth: { studentId: "admin-1", profile: { name: "Admin" } },
    listMembershipsByStudentId: async () => [{ personId: "admin-1", groupId: "E", roleInGroup: "member" }],
    ...buildBaseDeps(query),
  });

  const insertCall = calls.find((call) => /insert into softball_supply_cases/i.test(call.sql));
  assert.ok(insertCall, "expected insert query for softball_supply_cases");
  assert.equal(typeof insertCall.params[6], "string");
  assert.deepEqual(JSON.parse(insertCall.params[6]), ["vendor-a", "vendor-b"]);
  assert.equal(typeof insertCall.params[13], "string");
  assert.deepEqual(JSON.parse(insertCall.params[13]).vendorIds, ["vendor-a", "vendor-b"]);
});

test("upsertFinanceRole serializes group_ids/raw JSONB params before SQL write", async () => {
  const { query, calls } = createQueryStub();

  await dispatchNativeAction({
    action: "upsertFinanceRole",
    payload: {
      data: {
        id: "role-1",
        role: "accounting",
        studentId: "s-1",
        studentName: "Mary",
        groupIds: ["D", "E"],
      },
    },
    auth: { studentId: "admin-1", profile: { name: "Admin" } },
    listMembershipsByStudentId: async () => [{ personId: "admin-1", groupId: "E", roleInGroup: "member" }],
    ...buildBaseDeps(query),
  });

  const insertCall = calls.find((call) => /insert into finance_roles/i.test(call.sql));
  assert.ok(insertCall, "expected insert query for finance_roles");
  assert.equal(typeof insertCall.params[4], "string");
  assert.deepEqual(JSON.parse(insertCall.params[4]), ["D", "E"]);
  assert.equal(typeof insertCall.params[5], "string");
  assert.deepEqual(JSON.parse(insertCall.params[5]).groupIds, ["D", "E"]);
});

test("updateSoftballConfig serializes raw JSONB param before SQL write", async () => {
  const { query, calls } = createQueryStub();

  await dispatchNativeAction({
    action: "updateSoftballConfig",
    payload: {
      data: {
        attendanceCutoffHours: 12,
        managers: ["u1", "u2"],
      },
    },
    auth: { studentId: "admin-1", profile: { name: "Admin" } },
    listMembershipsByStudentId: async () => [{ personId: "admin-1", groupId: "E", roleInGroup: "member" }],
    ...buildBaseDeps(query),
  });

  const insertCall = calls.find((call) => /insert into softball_config/i.test(call.sql));
  assert.ok(insertCall, "expected insert query for softball_config");
  assert.equal(typeof insertCall.params[0], "string");
  assert.deepEqual(JSON.parse(insertCall.params[0]), {
    attendanceCutoffHours: 12,
    managers: ["u1", "u2"],
  });
});
