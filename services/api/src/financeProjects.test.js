import test from "node:test";
import assert from "node:assert/strict";
import { financeProjectSnapshot, prepareFinanceProject } from "./financeProjects.js";
import { dispatchNativeAction } from "./nativeActions.js";

const project = { id: "p1", name: "啦啦隊", approver_id: "owner", approver_name: "負責人", active: true };
test("project selection snapshots server-owned assignee, and self-application skips countersign", () => {
  assert.equal(financeProjectSnapshot(project, "applicant", "pending_lead").projectSkipReason, "");
  assert.equal(financeProjectSnapshot(project, "owner", "pending_rep").projectSkipReason, "self");
  assert.throws(() => financeProjectSnapshot({ ...project, active: false }, "applicant", "pending_lead"), /停用/);
});
test("purchase and payment route to project first; draft stays draft; no-project and pettycash retain workflow", async () => {
  for (const type of ["purchase", "payment", "pettycash"]) {
    for (const status of ["draft", "pending_lead", "pending_rep"]) {
      const row = { type, status, applicantId: "applicant", raw: { projectId: "p1", projectApproverId: "forged", projectSkipLead: true } };
      await prepareFinanceProject(async () => ({ rows: [project] }), row, "pending_lead");
      assert.equal(row.status, type === "pettycash" || status === "draft" ? status : "pending_project");
      assert.equal(row.raw.projectApproverId, type === "pettycash" ? "" : "owner");
      assert.equal(row.raw.projectSkipLead, false);
    }
  }
  const row = { type: "payment", status: "pending_lead", applicantId: "applicant", raw: { projectApproverId: "forged" } };
  await prepareFinanceProject(async () => { throw new Error("no project should not query DB"); }, row, "pending_lead");
  assert.equal(row.status, "pending_lead"); assert.equal(row.raw.projectApproverId, "");
});
test("resubmission refreshes project config and rejects missing/inactive projects", async () => {
  const row = { type: "payment", status: "pending_lead", applicantId: "applicant", raw: { projectId: "p1", projectApproverId: "old" } };
  await prepareFinanceProject(async () => ({ rows: [project] }), row, "pending_lead");
  assert.equal(row.raw.projectApproverId, "owner");
  await assert.rejects(prepareFinanceProject(async () => ({ rows: [] }), row, "pending_lead"), /找不到/);
  await assert.rejects(prepareFinanceProject(async () => ({ rows: [{ ...project, active: false }] }), row, "pending_lead"), /停用/);
});
test("only finance group can maintain project assignment (information group is not implicitly permitted)", async () => {
  for (const groupId of ["B", "E", "A"]) {
    let wrote = false;
    await assert.rejects(dispatchNativeAction({ action: "upsertFinanceProject", payload: { data: { name: "test", approverId: "owner" } },
      auth: { studentId: "member" }, listMembershipsByStudentId: async () => [{ groupId, roleInGroup: "lead" }],
      query: async () => { wrote = true; return { rows: [] }; },
    }), /Forbidden/);
    assert.equal(wrote, false);
  }
});
