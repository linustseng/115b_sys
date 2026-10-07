const text = (value) => String(value ?? "").trim();
export const PROJECT_FIELDS = ["projectId", "projectName", "projectApproverId", "projectApproverName", "projectNextStatus", "projectSkipReason", "projectSkipLead"];

export function mapFinanceProject(row) {
  return { id: row.id, name: row.name, approverId: row.approver_id, approverName: row.approver_name, active: row.active };
}

// Always derive routing and assignee from server-owned project configuration.
// An empty selection also clears any client-supplied approval metadata.
export function financeProjectSnapshot(project, applicantId, initialStatus) {
  const fields = Object.fromEntries(PROJECT_FIELDS.map((key) => [key, ""]));
  fields.projectSkipLead = false;
  if (!project) return fields;
  if (!project.active) throw new Error("此專案已停用，請重新選擇專案項目");
  if (!text(project.approver_id)) throw new Error("此專案尚未設定負責人");
  return {
    ...fields,
    projectId: project.id,
    projectName: project.name,
    projectApproverId: project.approver_id,
    projectApproverName: project.approver_name,
    projectNextStatus: initialStatus,
    projectSkipReason: text(project.approver_id) === text(applicantId) ? "self" : "",
  };
}

export async function prepareFinanceProject(query, row, initialStatus) {
  const projectId = ["purchase", "payment"].includes(row.type) ? text(row.raw?.projectId) : "";
  let project = null;
  if (projectId) {
    const result = await query(`select * from finance_projects where id = $1`, [projectId]);
    project = result.rows[0];
    if (!project) throw new Error("找不到專案項目，請重新選擇");
  }
  const snapshot = financeProjectSnapshot(project, row.applicantId, initialStatus);
  row.raw = { ...row.raw, ...snapshot };
  if (row.status !== "draft" && project && !snapshot.projectSkipReason) row.status = "pending_project";
}
