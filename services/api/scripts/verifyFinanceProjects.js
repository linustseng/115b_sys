// Opt-in integration verification. All DDL, fixtures, audit records and notifications
// stay on one connection in a transaction that is ALWAYS rolled back.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { pool, closePool } from "../src/db.js";
import { dispatchNativeAction } from "../src/nativeActions.js";
if (process.env.RUN_FINANCE_DB_TEST !== "1") throw new Error("Set RUN_FINANCE_DB_TEST=1 to run rollback-only DB verification");
const client = await pool.connect();
const query = client.query.bind(client);
const tag = `test-project-${crypto.randomUUID()}`;
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; console.log(`PASS ${message}`); };
try {
  await query("begin");
  await query("set local lock_timeout = '3s'");
  await query("set local statement_timeout = '20s'");
  const ddl = (await fs.readFile(new URL("../migrations/032_finance_projects.sql", import.meta.url), "utf8")).replace(/^begin;|^commit;/gm, "");
  await query(ddl);
  const roles = (await query(`select person_id, role_in_group from group_memberships where group_id='D' and role_in_group in ('lead','deputy') order by person_id`)).rows;
  const lead = roles.find((r) => r.role_in_group === "lead").person_id;
  const applicant = roles.find((r) => r.role_in_group === "deputy").person_id;
  const member = (await query(`select s.id from students s where coalesce(nullif(s.lifecycle_status,''),'active')='active'
    and not exists (select 1 from group_memberships g where g.person_id=s.id and g.role_in_group in ('lead','deputy'))
    and s.id not in ($1,$2) order by s.id limit 1`, [lead, applicant])).rows[0].id;
  const listMembershipsByStudentId = async (id) => (await query(`select person_id as "personId", group_id as "groupId", role_in_group as "roleInGroup" from group_memberships where person_id=$1`, [id])).rows;
  const findStudentProfileById = async (id) => (await query(`select id,name,google_email as email from students where id=$1`, [id])).rows[0];
  const withTransaction = async (fn) => {
    await query("savepoint verify_mutation");
    try { const result = await fn({ query }); await query("release savepoint verify_mutation"); return result; }
    catch (error) { await query("rollback to savepoint verify_mutation"); throw error; }
  };
  const call = async (actor, action, payload = {}) => dispatchNativeAction({ action, payload, query, withTransaction,
    listMembershipsByStudentId, findStudentProfileById,
    auth: { studentId: actor, profile: await findStudentProfileById(actor) },
  });
  const read = async (id) => (await query(`select * from finance_requests where id=$1`, [id])).rows[0];
  const projectId = `${tag}-config`;
  const saveProject = async (approverId, active = true) => call(lead, "upsertFinanceProject", { data: { id: projectId, name: tag, approverId, active } });
  check((await saveProject(member)).ok, "finance member creates project with ordinary student assignee");
  await assert.rejects(call(member, "upsertFinanceProject", { data: { id: projectId, name: tag, approverId: member } }), /Forbidden/); checks++;
  const create = async (suffix, { type = "payment", selected = projectId, status = "pending_lead", actor = applicant } = {}) => {
    const id = `${tag}-${suffix}`;
    const result = await call(actor, "createFinanceRequest", { data: { id, title: tag, type, status, applicantId: actor,
      applicantDepartment: "D", amountActual: 1000, amountEstimated: 1000, projectId: selected,
      projectApproverId: "forged", projectSkipLead: true, projectNextStatus: "closed", attachments: [] } });
    assert.equal(result.ok, true, result.error); return id;
  };
  const approve = async (actor, id, role = "project", action = "approve") => call(actor, "updateFinanceRequest", {
    id, expectedRevision: (await read(id)).revision_no, requestAction: action, actorRole: role,
  });
  const id = await create("payment");
  check((await read(id)).status === "pending_project", "payment starts with project countersign");
  check((await read(id)).raw.projectApproverId === member, "client-forged routing is overwritten");
  check((await call(member, "listApprovalsOverview")).data.pending >= 1, "ordinary project owner gets pending approval count");
  await assert.rejects(approve(lead, id, "lead"), /Unauthorized/); checks++;
  await saveProject(lead);
  check((await read(id)).raw.projectApproverId === member, "configuration edits preserve submitted assignee snapshot");
  check((await approve(member, id)).data.status === "pending_lead", "ordinary owner forwards to group lead");
  const submitted = await read(id);
  await assert.rejects(call(applicant, "updateFinanceRequest", { id, data: { ...submitted.raw, projectId: "" }, requestAction: "submit" }), /已送出/); checks++;
  const merged = await create("merged", { type: "purchase" });
  check((await read(merged)).raw.projectSkipLead === true, "next group lead role is merged for same assignee");
  check((await approve(lead, merged)).data.status === "closed", "low-value purchase finishes once, without duplicate group signature");
  const self = await create("self", { actor: lead });
  check((await read(self)).status === "pending_rep" && (await read(self)).raw.projectSkipReason === "self", "applicant who is project owner skips self-signing");
  const old = await create("legacy", { selected: "" });
  check((await read(old)).status === "pending_lead" && !(await read(old)).raw.projectApproverId, "no-project request retains original workflow");
  const draft = await create("draft", { status: "draft" });
  check((await read(draft)).status === "draft", "project draft is not submitted prematurely");
  await saveProject(member);
  const draftData = (await read(draft)).raw;
  check((await call(applicant, "updateFinanceRequest", { id: draft, data: draftData, requestAction: "submit" })).ok, "draft submits successfully");
  check((await read(draft)).raw.projectApproverId === member, "draft submission refreshes project assignee");
  check((await approve(member, draft, "project", "return")).data.status === "returned", "project owner can return for supplementary documents");
  await saveProject(lead);
  const returnedData = (await read(draft)).raw;
  await call(applicant, "updateFinanceRequest", { id: draft, data: returnedData, requestAction: "submit" });
  check((await read(draft)).raw.projectApproverId === lead, "returned resubmission refreshes project assignee");
  await saveProject(lead, false);
  await assert.rejects(create("inactive"), /停用/); checks++;
  check((await approve(lead, draft)).ok, "deactivation does not block already-submitted approval");
  const audit = await query(`select count(*)::int as n from audit_events where entity_id like $1`, [`${tag}%`]);
  check(audit.rows[0].n > 0, "workflow actions have audit entries");
  console.log(`Verified ${checks} integration assertions`);
} finally {
  await query("rollback");
  const leftover = await query(`select count(*)::int as n from finance_requests where id like $1`, [`${tag}%`]);
  assert.equal(leftover.rows[0].n, 0);
  client.release(); await closePool();
  console.log("ROLLBACK verified: no test finance requests persisted");
}
