import test from "node:test";
import assert from "node:assert/strict";
import { dispatchNativeAction } from "./nativeActions.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFinanceWorkflowHarness() {
  const calls = [];
  const financeRequests = new Map();
  const financeActions = [];
  const auditEvents = [];
  const auditVersions = [];
  const auditBatches = [];

  const memberships = [
    {
      id: "gm-1",
      person_id: "approver-1",
      person_name: "Accounting Approver",
      group_id: "D",
      role_in_group: "lead",
      notes: "",
      created_at: "",
      updated_at: "",
    },
  ];
  const financeRoles = [
    {
      id: "fr-1",
      role: "accounting",
      student_id: "approver-1",
      student_name: "Accounting Approver",
      group_ids: JSON.stringify([]),
      raw: { role: "accounting", studentId: "approver-1", studentName: "Accounting Approver", groupIds: [] },
    },
  ];
  const students = [{ id: "approver-1", google_email: "accounting@example.com" }];
  const directories = [];

  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();

    if (normalized.startsWith("insert into audit_change_batches")) {
      auditBatches.push({ id: params[0], source: params[1], reason: params[5], status: params[6] });
      return { rows: [] };
    }
    if (normalized.startsWith("update audit_change_batches")) {
      const batch = auditBatches.find((item) => item.id === params[0]);
      if (batch) {
        batch.status = "committed";
      }
      return { rows: [] };
    }
    if (normalized.includes("from group_memberships")) {
      return { rows: clone(memberships) };
    }
    if (normalized.includes("from finance_roles")) {
      return { rows: clone(financeRoles) };
    }
    if (normalized.includes("from students order by")) {
      return { rows: clone(students) };
    }
    if (normalized.includes("from directories order by")) {
      return { rows: clone(directories) };
    }
    if (normalized.startsWith("select * from finance_requests where id = $1 limit 1 for update")) {
      return { rows: financeRequests.has(params[0]) ? [clone(financeRequests.get(params[0]))] : [] };
    }
    if (normalized.startsWith("select * from finance_requests where id = $1 limit 1")) {
      return { rows: financeRequests.has(params[0]) ? [clone(financeRequests.get(params[0]))] : [] };
    }
    if (normalized.startsWith("update finance_requests set status=$2")) {
      const current = financeRequests.get(params[0]);
      assert.ok(current, "expected finance request before workflow update");
      current.status = params[1];
      current.updated_at = params[2];
      current.raw = JSON.parse(params[3]);
      current.revision_no = params[4];
      current.last_change_batch_id = params[5];
      current.last_changed_at = params[6];
      current.last_changed_by = params[7];
      current.last_changed_by_name = params[8];
      return { rows: [] };
    }
    if (normalized.startsWith("insert into finance_actions")) {
      financeActions.push({
        id: params[0],
        requestId: params[1],
        actorId: params[2],
        actorName: params[3],
        actionType: params[4],
        fromStatus: params[5],
        toStatus: params[6],
      });
      return { rows: [] };
    }
    if (normalized.startsWith("insert into audit_entity_versions")) {
      auditVersions.push({ id: params[0], entityId: params[3], action: params[6], revisionNo: params[7] });
      return { rows: [] };
    }
    if (normalized.startsWith("insert into audit_events")) {
      auditEvents.push({ id: params[0], entityId: params[3], action: params[6], summary: params[9] });
      return { rows: [] };
    }
    return { rows: [] };
  };

  const withTransaction = async (fn) => fn({ query });

  return {
    calls,
    financeRequests,
    financeActions,
    auditEvents,
    auditVersions,
    query,
    withTransaction,
  };
}

function seedFinanceRequest(harness, id, overrides = {}) {
  const base = {
    id,
    type: "reimbursement",
    title: "測試財務申請",
    description: "",
    category_type: "",
    amount_estimated: 1000,
    amount_actual: null,
    currency: "TWD",
    payment_method: "bank_transfer",
    vendor_name: "",
    payee_name: "",
    payee_bank: "",
    payee_account: "",
    related_purchase_id: "",
    no_purchase_reason: "",
    expected_clear_date: "",
    attachments: [],
    status: "pending_accounting",
    applicant_id: "applicant-1",
    applicant_name: "Applicant",
    applicant_department: "D",
    created_at: "2026-04-13T00:00:00.000Z",
    updated_at: "2026-04-13T00:00:00.000Z",
    revision_no: 1,
    last_change_batch_id: "batch-0",
    last_changed_at: "2026-04-13T00:00:00.000Z",
    last_changed_by: "applicant-1",
    last_changed_by_name: "Applicant",
    raw: {
      id,
      type: "reimbursement",
      title: "測試財務申請",
      description: "",
      categoryType: "",
      amountEstimated: 1000,
      amountActual: "",
      currency: "TWD",
      paymentMethod: "bank_transfer",
      vendorName: "",
      payeeName: "",
      payeeBank: "",
      payeeBankCode: "",
      payeeAccount: "",
      relatedPurchaseId: "",
      noPurchaseReason: "",
      expectedClearDate: "",
      attachments: [],
      status: "pending_accounting",
      applicantId: "applicant-1",
      applicantName: "Applicant",
      applicantDepartment: "D",
      applicantRole: "",
      applicantEmail: "applicant@example.com",
      workflowCreatedByRole: "",
      submittedAt: "2026-04-13T00:00:00.000Z",
      createdAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
      revisionNo: 1,
      lastChangeBatchId: "batch-0",
      lastChangedAt: "2026-04-13T00:00:00.000Z",
      lastChangedBy: "applicant-1",
      lastChangedByName: "Applicant",
    },
  };
  const row = { ...base, ...overrides, raw: { ...base.raw, ...(overrides.raw || {}) } };
  harness.financeRequests.set(id, row);
  return row;
}

function buildDeps(harness) {
  return {
    query: harness.query,
    withTransaction: harness.withTransaction,
    verifyGoogleIdToken: async () => null,
    createSessionToken: async () => null,
    createRefreshToken: async () => null,
    verifyRefreshToken: async () => null,
    findStudentProfileById: async (studentId) => ({ id: studentId, name: studentId, email: `${studentId}@example.com` }),
    listMembershipsByStudentId: async (studentId) => {
      if (studentId === "approver-1") {
        return [{ personId: "approver-1", personName: "Accounting Approver", groupId: "D", roleInGroup: "lead" }];
      }
      return [];
    },
    auth: {
      studentId: "approver-1",
      profile: { name: "Accounting Approver", email: "accounting@example.com" },
    },
  };
}

test("updateFinanceRequest approve and return honor finance-role permissions and write audit versions", async () => {
  const harness = createFinanceWorkflowHarness();
  const deps = buildDeps(harness);

  seedFinanceRequest(harness, "finance-approve-1", {
    status: "pending_accounting",
    raw: { status: "pending_accounting" },
  });
  const approveResult = await dispatchNativeAction({
    action: "updateFinanceRequest",
    payload: {
      id: "finance-approve-1",
      expectedRevision: 1,
      requestAction: "approve",
      actorRole: "accounting",
      actorName: "Accounting Approver",
    },
    ...deps,
  });

  assert.equal(approveResult.ok, true);
  assert.equal(approveResult.data.status, "pending_cashier");
  assert.equal(harness.financeRequests.get("finance-approve-1").status, "pending_cashier");
  assert.equal(harness.financeRequests.get("finance-approve-1").revision_no, 2);
  assert.ok(harness.financeActions.some((item) => item.requestId === "finance-approve-1" && item.actionType === "approve" && item.toStatus === "pending_cashier"));
  assert.ok(harness.auditVersions.some((item) => item.entityId === "finance-approve-1" && item.revisionNo === 2));
  assert.ok(harness.auditEvents.some((item) => item.entityId === "finance-approve-1" && /核准財務申請/.test(item.summary)));

  seedFinanceRequest(harness, "finance-return-1", {
    status: "pending_accounting",
    raw: { status: "pending_accounting" },
  });
  const returnResult = await dispatchNativeAction({
    action: "updateFinanceRequest",
    payload: {
      id: "finance-return-1",
      expectedRevision: 1,
      requestAction: "return",
      actorRole: "accounting",
      actorName: "Accounting Approver",
      actorNote: "缺附件",
    },
    ...deps,
  });

  assert.equal(returnResult.ok, true);
  assert.equal(returnResult.data.status, "returned");
  assert.equal(harness.financeRequests.get("finance-return-1").status, "returned");
  assert.equal(harness.financeRequests.get("finance-return-1").revision_no, 2);
  assert.ok(harness.financeActions.some((item) => item.requestId === "finance-return-1" && item.actionType === "return" && item.toStatus === "returned"));
  assert.ok(harness.auditVersions.some((item) => item.entityId === "finance-return-1" && item.revisionNo === 2));
  assert.ok(harness.auditEvents.some((item) => item.entityId === "finance-return-1" && /退回財務申請/.test(item.summary)));
});
