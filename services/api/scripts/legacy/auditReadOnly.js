import { getConfig } from "../../src/config.js";
import { query, closePool } from "../../src/db.js";

const config = getConfig();

function asText(value) {
  return String(value == null ? "" : value).trim();
}

function asLowerText(value) {
  const text = asText(value);
  return text ? text.toLowerCase() : "";
}

function toCanonicalAttendanceId(value) {
  const text = asText(value);
  if (!text) {
    return "";
  }
  const colonMatch = text.match(/^([^:]+):(.+)$/);
  if (colonMatch) {
    return `${asText(colonMatch[1])}:${asText(colonMatch[2])}`;
  }
  const dashMatch = text.match(/^(.+)-([^:-]+)$/);
  if (dashMatch) {
    return `${asText(dashMatch[1])}:${asText(dashMatch[2])}`;
  }
  return text;
}

function quoteIdentifier(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

async function callAppsScript(action, payload = {}) {
  const requestPayload = {
    action,
    syncToken: config.syncPullToken,
    ...payload,
  };
  const url = new URL(config.appsScriptUrl);
  url.searchParams.set("payload", JSON.stringify(requestPayload));

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Apps Script returned non-JSON for ${action}`);
  }

  if (!json || json.ok !== true) {
    throw new Error((json && json.error) || `${action} failed`);
  }

  return json.data || {};
}

async function listPublicTables() {
  const result = await query(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`
  );
  return result.rows.map((row) => String(row.table_name || "")).filter(Boolean);
}

async function countTableRows(tableName) {
  const result = await query(`select count(*)::int as count from ${quoteIdentifier(tableName)}`);
  return Number(result.rows[0] && result.rows[0].count ? result.rows[0].count : 0);
}

async function listTableIds(tableName) {
  const result = await query(`select id from ${quoteIdentifier(tableName)} order by id`);
  return result.rows.map((row) => asText(row.id)).filter(Boolean);
}

async function listTableRows(tableName, columns = ["id"]) {
  const result = await query(
    `select ${columns.map(quoteIdentifier).join(", ")} from ${quoteIdentifier(tableName)} order by 1 nulls last`
  );
  return result.rows;
}

function buildAgentAuditKey(row) {
  const id = asText(row && row.id);
  if (id) {
    return id;
  }
  return [
    asText(row && (row.createdAt || row.created_at)),
    asText(row && row.action),
    asText(row && (row.lineUserId || row.line_user_id)),
    asText(row && (row.studentId || row.student_id)),
    asText(row && (row.requestId || row.request_id)),
    asText(row && (row.eventId || row.event_id)),
  ].join("::");
}

function buildNotificationReadKey(row) {
  return [
    asText(row && (row.notificationId || row.notification_id)),
    asText(row && (row.readerStudentId || row.student_id)),
  ].join("::");
}

async function fetchDirectoryRows() {
  const result = await query(
    `select id, email, name_zh, name_en, preferred_name, company, title, mobile, backup_phone, emergency_contact, emergency_phone, birthday_month, birthday_day from directories order by id`
  );
  return result.rows;
}

const SHEET_TO_TABLE = {
  Events: "events",
  Registrations: "registrations",
  Students: "students",
  Checkins: "checkins",
  Directory: "directories",
  DirectoryLogs: "directory_logs",
  AdminUsers: "admin_users",
  OrderPlans: "order_plans",
  OrderResponses: "order_responses",
  FinanceRequests: "finance_requests",
  FinanceActions: "finance_actions",
  GroupMemberships: "group_memberships",
  FinanceRoles: "finance_roles",
  FinanceCategoryTypes: "finance_category_types",
  FundEvents: "fund_events",
  FundPayments: "fund_payments",
  SoftballPlayers: "softball_players",
  SoftballPractices: "softball_practices",
  SoftballAttendance: "softball_attendance",
  SoftballFields: "softball_fields",
  SoftballGear: "softball_gear",
  SoftballConfig: "softball_config",
  Announcements: "announcements",
  NotificationReads: "notification_reads",
  LineBindings: "line_bindings",
  AgentAudit: "agent_audit",
};

const AUDITABLE_DATASETS = [
  { name: "events", sheet: "Events", table: "events", source: { kind: "snapshot", key: "events" } },
  { name: "students", sheet: "Students", table: "students", source: { kind: "snapshot", key: "students" } },
  {
    name: "registrations",
    sheet: "Registrations",
    table: "registrations",
    source: { kind: "snapshot", key: "registrations" },
  },
  { name: "checkins", sheet: "Checkins", table: "checkins", source: { kind: "snapshot", key: "checkins" } },
  { name: "directory", sheet: "Directory", table: "directories", source: { kind: "snapshot", key: "directory" } },
  {
    name: "directory_logs",
    sheet: "DirectoryLogs",
    table: "directory_logs",
    source: { kind: "action", action: "listDirectoryLogs", dataKey: "directoryLogs" },
  },
  {
    name: "admin_users",
    sheet: "AdminUsers",
    table: "admin_users",
    source: { kind: "action", action: "listAdminUsers", dataKey: "adminUsers" },
  },
  {
    name: "announcements",
    sheet: "Announcements",
    table: "announcements",
    source: { kind: "action", action: "listAnnouncements", dataKey: "announcements" },
  },
  {
    name: "notification_reads",
    sheet: "NotificationReads",
    table: "notification_reads",
    source: { kind: "action", action: "listNotificationReads", dataKey: "notificationReads" },
    rowKey: buildNotificationReadKey,
    dbColumns: ["notification_id", "student_id"],
    dbRowKey: buildNotificationReadKey,
  },
  {
    name: "group_memberships",
    sheet: "GroupMemberships",
    table: "group_memberships",
    source: { kind: "snapshot", key: "groupMemberships" },
  },
  {
    name: "finance_category_types",
    sheet: "FinanceCategoryTypes",
    table: "finance_category_types",
    source: { kind: "action", action: "listFinanceCategoryTypes", dataKey: "categories" },
  },
  {
    name: "finance_roles",
    sheet: "FinanceRoles",
    table: "finance_roles",
    source: { kind: "snapshot", key: "financeRoles" },
  },
  {
    name: "finance_requests",
    sheet: "FinanceRequests",
    table: "finance_requests",
    source: { kind: "action", action: "listFinanceRequests", dataKey: "requests" },
  },
  {
    name: "fund_events",
    sheet: "FundEvents",
    table: "fund_events",
    source: { kind: "action", action: "listFundEvents", dataKey: "events" },
  },
  {
    name: "fund_payments",
    sheet: "FundPayments",
    table: "fund_payments",
    source: { kind: "action", action: "listFundPayments", dataKey: "payments" },
  },
  {
    name: "order_plans",
    sheet: "OrderPlans",
    table: "order_plans",
    source: { kind: "action", action: "listOrderPlans", dataKey: "plans" },
  },
  {
    name: "softball_players",
    sheet: "SoftballPlayers",
    table: "softball_players",
    source: { kind: "action", action: "listSoftballPlayers", dataKey: "players" },
  },
  {
    name: "softball_practices",
    sheet: "SoftballPractices",
    table: "softball_practices",
    source: { kind: "action", action: "listSoftballPractices", dataKey: "practices" },
  },
  {
    name: "softball_fields",
    sheet: "SoftballFields",
    table: "softball_fields",
    source: { kind: "action", action: "listSoftballFields", dataKey: "fields" },
  },
  {
    name: "softball_gear",
    sheet: "SoftballGear",
    table: "softball_gear",
    source: { kind: "action", action: "listSoftballGear", dataKey: "gear" },
  },
  {
    name: "softball_attendance",
    sheet: "SoftballAttendance",
    table: "softball_attendance",
    source: { kind: "action", action: "listSoftballAttendance", dataKey: "attendance" },
    normalizeId: toCanonicalAttendanceId,
  },
  {
    name: "line_bindings",
    sheet: "LineBindings",
    table: "line_bindings",
    source: { kind: "action", action: "listLineBindings", dataKey: "lineBindings" },
  },
  {
    name: "agent_audit",
    sheet: "AgentAudit",
    table: "agent_audit",
    source: { kind: "action", action: "listAgentAudit", dataKey: "agentAudit" },
    rowKey: buildAgentAuditKey,
    dbColumns: ["id", "created_at", "action", "line_user_id", "student_id", "request_id", "event_id"],
    dbRowKey: buildAgentAuditKey,
  },
];

const SCHEMA_ONLY_SHEETS = [];

async function getSourceRows(snapshot, dataset) {
  if (dataset.source.kind === "snapshot") {
    const rows = snapshot[dataset.source.key];
    return Array.isArray(rows) ? rows : [];
  }

  if (dataset.source.kind === "action") {
    const data = await callAppsScript(dataset.source.action, dataset.source.payload || {});
    const rows = data[dataset.source.dataKey];
    return Array.isArray(rows) ? rows : [];
  }

  throw new Error(`Unsupported source kind: ${dataset.source.kind}`);
}

function compareIds(sourceIds, dbIds) {
  const sourceSet = new Set(sourceIds);
  const dbSet = new Set(dbIds);
  return {
    missingInDb: sourceIds.filter((id) => !dbSet.has(id)),
    extraInDb: dbIds.filter((id) => !sourceSet.has(id)),
  };
}

async function auditDataset(snapshot, existingTables, dataset) {
  const output = {
    name: dataset.name,
    sheet: dataset.sheet,
    table: dataset.table,
  };

  const sourceRows = await getSourceRows(snapshot, dataset);
  output.sourceCount = sourceRows.length;

  if (!existingTables.has(dataset.table)) {
    output.tableExists = false;
    output.dbCount = null;
    output.status = "missing_table";
    return output;
  }

  output.tableExists = true;
  output.dbCount = await countTableRows(dataset.table);

  const normalizer = typeof dataset.normalizeId === "function" ? dataset.normalizeId : asText;
  const sourceKey = typeof dataset.rowKey === "function" ? dataset.rowKey : (row) => normalizer(row && row.id);
  const dbRowKey = typeof dataset.dbRowKey === "function" ? dataset.dbRowKey : (row) => normalizer(row && row.id);

  const sourceIds = sourceRows.map((row) => sourceKey(row)).filter(Boolean).sort();
  const dbIds = dataset.dbColumns || dataset.dbRowKey
    ? (await listTableRows(dataset.table, dataset.dbColumns || ["id"]))
        .map((row) => dbRowKey(row))
        .filter(Boolean)
        .sort()
    : (await listTableIds(dataset.table)).map((id) => normalizer(id)).filter(Boolean).sort();
  const diff = compareIds(sourceIds, dbIds);

  output.missingInDbCount = diff.missingInDb.length;
  output.extraInDbCount = diff.extraInDb.length;
  output.missingInDb = diff.missingInDb.slice(0, 20);
  output.extraInDb = diff.extraInDb.slice(0, 20);
  output.status = diff.missingInDb.length ? "mismatch" : "ok";

  return output;
}

async function auditDirectory(snapshot) {
  const sourceRows = Array.isArray(snapshot.directory) ? snapshot.directory : [];
  const sourceById = new Map(sourceRows.map((row) => [asText(row && row.id), row]));
  const dbRows = await fetchDirectoryRows();

  const fields = [
    ["email", "email", asLowerText],
    ["nameZh", "name_zh", asText],
    ["nameEn", "name_en", asText],
    ["preferredName", "preferred_name", asText],
    ["company", "company", asText],
    ["title", "title", asText],
    ["mobile", "mobile", asText],
    ["backupPhone", "backup_phone", asText],
    ["emergencyContact", "emergency_contact", asText],
    ["emergencyPhone", "emergency_phone", asText],
    ["birthdayMonth", "birthday_month", asText],
    ["birthdayDay", "birthday_day", asText],
  ];

  const diffs = [];
  const sourceNonEmpty = {};
  const dbNonEmpty = {};

  for (const [sourceKey, dbKey] of fields) {
    sourceNonEmpty[sourceKey] = 0;
    dbNonEmpty[dbKey] = 0;
  }

  for (const source of sourceRows) {
    for (const [sourceKey, _dbKey, normalize] of fields) {
      if (normalize(source && source[sourceKey])) {
        sourceNonEmpty[sourceKey] += 1;
      }
    }
  }

  for (const row of dbRows) {
    for (const [_sourceKey, dbKey, normalize] of fields) {
      if (normalize(row && row[dbKey])) {
        dbNonEmpty[dbKey] += 1;
      }
    }

    const source = sourceById.get(asText(row.id));
    if (!source) {
      continue;
    }

    const fieldDiffs = [];
    for (const [sourceKey, dbKey, normalize] of fields) {
      const left = normalize(source[sourceKey]);
      const right = normalize(row[dbKey]);
      if (left !== right) {
        fieldDiffs.push({
          field: sourceKey,
          source: left,
          db: right,
        });
      }
    }

    if (fieldDiffs.length) {
      diffs.push({
        id: asText(row.id),
        diffs: fieldDiffs,
      });
    }
  }

  return {
    sourceCount: sourceRows.length,
    dbCount: dbRows.length,
    fieldDiffRowCount: diffs.length,
    sampleDiffs: diffs.slice(0, 20),
    completeness: {
      sourceNonEmpty,
      dbNonEmpty,
    },
  };
}

async function auditRegistrationExtras(snapshot) {
  const sourceRows = Array.isArray(snapshot.registrations) ? snapshot.registrations : [];
  const sourceIds = new Set(sourceRows.map((row) => asText(row && row.id)).filter(Boolean));
  const result = await query(
    `select id, manual_created_by, manual_created_at from registrations where id is not null order by id`
  );

  const extraInDb = result.rows
    .filter((row) => !sourceIds.has(asText(row.id)))
    .map((row) => ({
      id: asText(row.id),
      manual_created_by: asText(row.manual_created_by),
      manual_created_at: asText(row.manual_created_at),
    }));

  return {
    sourceCount: sourceRows.length,
    dbCount: result.rows.length,
    missingInDb: [],
    extraInDb,
  };
}

async function auditGroupMembershipExtras() {
  const data = await callAppsScript("listGroupMemberships");
  const sourceRows = Array.isArray(data.memberships) ? data.memberships : [];
  const sourceIds = new Set(
    sourceRows
      .map((row) => asText(row && row.id) || `${asText(row && row.personId)}::${asText(row && row.groupId)}::${asText(row && row.roleInGroup)}`)
      .filter(Boolean)
  );

  const result = await query(
    `select id, person_id, group_id, role_in_group from group_memberships order by id`
  );

  const extraInDb = result.rows
    .filter((row) => {
      const composite = asText(row.id) || `${asText(row.person_id)}::${asText(row.group_id)}::${asText(row.role_in_group)}`;
      return !sourceIds.has(composite);
    })
    .map((row) => ({
      id: asText(row.id),
      person_id: asText(row.person_id),
      group_id: asText(row.group_id),
      role_in_group: asText(row.role_in_group),
    }));

  return {
    sourceCount: sourceRows.length,
    dbCount: result.rows.length,
    extraInDb,
  };
}

async function run() {
  const snapshot = await callAppsScript("syncPullSnapshot");
  const publicTables = await listPublicTables();
  const existingTables = new Set(publicTables);

  const report = {
    checkedAt: new Date().toISOString(),
    pulledAt: asText(snapshot.pulledAt),
    database: {
      publicTables,
      dbOnlyTables: publicTables.filter((table) => !Object.values(SHEET_TO_TABLE).includes(table)),
    },
    coverage: {
      sheetToTable: SHEET_TO_TABLE,
      schemaOnlySheets: SCHEMA_ONLY_SHEETS.map((item) => ({
        sheet: item.sheet,
        table: item.table,
        tableExists: existingTables.has(item.table),
        reason: item.reason,
      })),
      missingExpectedTables: Object.entries(SHEET_TO_TABLE)
        .filter(([_sheet, table]) => !existingTables.has(table))
        .map(([sheet, table]) => ({ sheet, table })),
    },
    datasets: [],
  };

  for (const dataset of AUDITABLE_DATASETS) {
    const result = await auditDataset(snapshot, existingTables, dataset);
    report.datasets.push(result);
  }

  report.directory = existingTables.has("directories") ? await auditDirectory(snapshot) : null;
  report.registrations = existingTables.has("registrations")
    ? await auditRegistrationExtras(snapshot)
    : null;
  report.groupMemberships = existingTables.has("group_memberships")
    ? await auditGroupMembershipExtras()
    : null;

  const mismatchCount = report.datasets.filter((item) => item.status === "mismatch").length;
  const missingTableCount = report.datasets.filter((item) => item.status === "missing_table").length;

  report.summary = {
    auditedDatasetCount: report.datasets.length,
    mismatchCount,
    missingTableCount,
    schemaOnlySheetCount: report.coverage.schemaOnlySheets.length,
    missingExpectedTableCount: report.coverage.missingExpectedTables.length,
  };

  console.log(JSON.stringify(report, null, 2));

  if (String(process.env.AUDIT_STRICT || "").trim() === "1") {
    if (mismatchCount > 0 || missingTableCount > 0 || report.coverage.missingExpectedTables.length > 0) {
      process.exitCode = 1;
    }
  }
}

run()
  .catch((error) => {
    console.error("audit:read-only failed:", error && error.message ? error.message : String(error));
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
