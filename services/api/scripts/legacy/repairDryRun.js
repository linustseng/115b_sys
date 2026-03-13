import fs from "node:fs/promises";
import path from "node:path";
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

function parseJson(value, fallback = null) {
  if (value && typeof value === "object") {
    return value;
  }
  const raw = String(value == null ? "" : value).trim();
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function quoteIdentifier(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
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

function normalizePhone(value, options = {}) {
  const text = asText(value).replace(/[^0-9]/g, "");
  if (!text) {
    return "";
  }
  if (options.treatPhoneLeadingZeroAsNormalized && text.length === 9 && text[0] !== "0") {
    return `0${text}`;
  }
  return text;
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    asText(value)
  );
}

function toJsonSafe(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => {
      if (item === undefined) {
        return null;
      }
      if (typeof item === "number" && !Number.isFinite(item)) {
        return null;
      }
      return item;
    })
  );
}

function parseArgs(argv) {
  const options = {
    datasets: "all",
    format: "json",
    out: "",
    includeSamples: 20,
    strict: false,
    source: "apps-script",
    treatPhoneLeadingZeroAsNormalized: true,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const eqIndex = arg.indexOf("=");
    const key = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const rawValue = eqIndex >= 0 ? arg.slice(eqIndex + 1) : "1";
    switch (key) {
      case "datasets":
        options.datasets = rawValue || "all";
        break;
      case "format":
        options.format = rawValue || "json";
        break;
      case "out":
        options.out = rawValue || "";
        break;
      case "include-samples":
        options.includeSamples = Number(rawValue) || 20;
        break;
      case "strict":
        options.strict = String(rawValue).trim() === "1";
        break;
      case "source":
        options.source = rawValue || "apps-script";
        break;
      case "treat-phone-leading-zero-as-normalized":
        options.treatPhoneLeadingZeroAsNormalized = String(rawValue).trim() !== "0";
        break;
      default:
        break;
    }
  }

  if (!["json", "markdown"].includes(options.format)) {
    throw new Error(`Unsupported format: ${options.format}`);
  }

  if (options.source !== "apps-script") {
    throw new Error(`Unsupported source: ${options.source}`);
  }

  if (!Number.isFinite(options.includeSamples) || options.includeSamples < 1) {
    options.includeSamples = 20;
  }

  return options;
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
  } catch {
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
  return result.rows.map((row) => asText(row.table_name)).filter(Boolean);
}

async function tableExists(tableName) {
  const result = await query(
    `select 1 from information_schema.tables where table_schema = 'public' and table_name = $1 limit 1`,
    [tableName]
  );
  return result.rows.length > 0;
}

async function listTableRows(tableName, columns = ["id"]) {
  const sql = `select ${columns.map(quoteIdentifier).join(", ")} from ${quoteIdentifier(tableName)} order by 1 nulls last`;
  const result = await query(sql);
  return result.rows;
}

function emptyPlanCounters() {
  return {
    insert_from_source: 0,
    update_from_source: 0,
    normalize_only: 0,
    preserve_db_only: 0,
    db_only_expected_local: 0,
    db_only_unexpected: 0,
    manual_review_required: 0,
    missing_table: 0,
    missing_read_path: 0,
    skip_derived_table: 0,
    no_action: 0,
  };
}

function createDatasetReport(name, policy) {
  return {
    name,
    policy,
    sourceCount: 0,
    dbCount: 0,
    plan: emptyPlanCounters(),
    samples: {
      insert_from_source: [],
      update_from_source: [],
      normalize_only: [],
      preserve_db_only: [],
      db_only_expected_local: [],
      db_only_unexpected: [],
      manual_review_required: [],
      missing_table: [],
      missing_read_path: [],
      skip_derived_table: [],
    },
  };
}

function pushSample(report, type, sample, includeSamples) {
  report.plan[type] = (report.plan[type] || 0) + 1;
  if (!report.samples[type]) {
    report.samples[type] = [];
  }
  if (report.samples[type].length < includeSamples) {
    report.samples[type].push(toJsonSafe(sample));
  }
}

function finalizeDatasetReport(report) {
  report.planItemCount = Object.entries(report.plan)
    .filter(([key]) => key !== "no_action")
    .reduce((sum, [, value]) => sum + value, 0);
  report.manualReviewCount = report.plan.manual_review_required || 0;
  report.unsafe =
    (report.plan.manual_review_required || 0) > 0 ||
    (report.plan.missing_table || 0) > 0 ||
    (report.plan.missing_read_path || 0) > 0 ||
    (report.plan.db_only_unexpected || 0) > 0;
  return report;
}

async function getSnapshot() {
  return callAppsScript("syncPullSnapshot");
}

async function getSourceRows(snapshot, source) {
  if (source.kind === "snapshot") {
    const rows = snapshot[source.key];
    return Array.isArray(rows) ? rows : [];
  }
  if (source.kind === "action") {
    const data = await callAppsScript(source.action, source.payload || {});
    const rows = data[source.dataKey];
    return Array.isArray(rows) ? rows : [];
  }
  throw new Error(`Unsupported source kind: ${source.kind}`);
}

const DATASETS = {
  events: {
    policy: "mirror_safe",
    table: "events",
    source: { kind: "snapshot", key: "events" },
    rowKey: (row) => asText(row && row.id),
  },
  students: {
    policy: "mirror_safe",
    table: "students",
    source: { kind: "snapshot", key: "students" },
    rowKey: (row) => asText(row && row.id),
  },
  checkins: {
    policy: "mirror_safe",
    table: "checkins",
    source: { kind: "snapshot", key: "checkins" },
    rowKey: (row) => asText(row && row.id),
  },
  finance_category_types: {
    policy: "mirror_safe",
    table: "finance_category_types",
    source: { kind: "action", action: "listFinanceCategoryTypes", dataKey: "categories" },
    rowKey: (row) => asText(row && row.id),
  },
  finance_roles: {
    policy: "mirror_safe",
    table: "finance_roles",
    source: { kind: "snapshot", key: "financeRoles" },
    rowKey: (row) => asText(row && row.id),
  },
  fund_events: {
    policy: "mirror_safe",
    table: "fund_events",
    source: { kind: "action", action: "listFundEvents", dataKey: "events" },
    rowKey: (row) => asText(row && row.id),
  },
  order_plans: {
    policy: "mirror_safe",
    table: "order_plans",
    source: { kind: "action", action: "listOrderPlans", dataKey: "plans" },
    rowKey: (row) => asText(row && row.id),
  },
  softball_practices: {
    policy: "mirror_safe",
    table: "softball_practices",
    source: { kind: "action", action: "listSoftballPractices", dataKey: "practices" },
    rowKey: (row) => asText(row && row.id),
  },
  softball_fields: {
    policy: "mirror_safe",
    table: "softball_fields",
    source: { kind: "action", action: "listSoftballFields", dataKey: "fields" },
    rowKey: (row) => asText(row && row.id),
  },
  softball_gear: {
    policy: "mirror_safe",
    table: "softball_gear",
    source: { kind: "action", action: "listSoftballGear", dataKey: "gear" },
    rowKey: (row) => asText(row && row.id),
  },
  softball_config: {
    policy: "mirror_safe_singleton",
    table: "softball_config",
    source: { kind: "action", action: "listSoftballConfig", dataKey: "config" },
  },
  registrations: {
    policy: "mixed_state",
    table: "registrations",
    source: { kind: "snapshot", key: "registrations" },
    rowKey: (row) => asText(row && row.id),
  },
  group_memberships: {
    policy: "mixed_state",
    table: "group_memberships",
    source: { kind: "snapshot", key: "groupMemberships" },
    rowKey: (row) =>
      asText(row && row.id) ||
      `${asText(row && row.personId)}::${asText(row && row.groupId)}::${asText(row && row.roleInGroup)}`,
  },
  finance_requests: {
    policy: "mixed_state",
    table: "finance_requests",
    source: { kind: "action", action: "listFinanceRequests", dataKey: "requests" },
    rowKey: (row) => asText(row && row.id),
  },
  fund_payments: {
    policy: "mixed_state",
    table: "fund_payments",
    source: { kind: "action", action: "listFundPayments", dataKey: "payments" },
    rowKey: (row) => asText(row && row.id),
  },
  softball_players: {
    policy: "mixed_state",
    table: "softball_players",
    source: { kind: "action", action: "listSoftballPlayers", dataKey: "players" },
    rowKey: (row) => asText(row && row.id),
  },
  softball_attendance: {
    policy: "mixed_state",
    table: "softball_attendance",
    source: { kind: "action", action: "listSoftballAttendance", dataKey: "attendance" },
    rowKey: (row) => toCanonicalAttendanceId(row && row.id),
  },
  directories: {
    policy: "field_merge",
    table: "directories",
    source: { kind: "snapshot", key: "directory" },
    rowKey: (row) => asText(row && row.id),
  },
  directory_logs: {
    policy: "mirror_safe",
    table: "directory_logs",
    source: { kind: "action", action: "listDirectoryLogs", dataKey: "directoryLogs" },
    rowKey: (row) => asText(row && row.id),
  },
  admin_users: {
    policy: "mirror_safe",
    table: "admin_users",
    source: { kind: "action", action: "listAdminUsers", dataKey: "adminUsers" },
    rowKey: (row) => asText(row && row.id),
  },
  announcements: {
    policy: "mirror_safe",
    table: "announcements",
    source: { kind: "action", action: "listAnnouncements", dataKey: "announcements" },
    rowKey: (row) => asText(row && row.id),
  },
  notification_reads: {
    policy: "mixed_state",
    table: "notification_reads",
    source: { kind: "action", action: "listNotificationReads", dataKey: "notificationReads" },
    rowKey: (row) => buildNotificationReadKey(row),
    dbColumns: ["notification_id", "student_id"],
  },
  line_bindings: {
    policy: "mirror_safe",
    table: "line_bindings",
    source: { kind: "action", action: "listLineBindings", dataKey: "lineBindings" },
    rowKey: (row) => asText(row && row.id),
  },
  agent_audit: {
    policy: "mirror_safe",
    table: "agent_audit",
    source: { kind: "action", action: "listAgentAudit", dataKey: "agentAudit" },
    rowKey: (row) => buildAgentAuditKey(row),
    dbColumns: ["id", "created_at", "action", "line_user_id", "student_id", "request_id", "event_id"],
  },
  notifications: {
    policy: "derived_runtime",
    table: "notifications",
  },
  schema_migrations: {
    policy: "derived_runtime",
    table: "schema_migrations",
  },
  sync_runs: {
    policy: "derived_runtime",
    table: "sync_runs",
  },
};

const DEFAULT_DATASET_ORDER = [
  "events",
  "students",
  "checkins",
  "finance_category_types",
  "finance_roles",
  "fund_events",
  "order_plans",
  "softball_practices",
  "softball_fields",
  "softball_gear",
  "softball_config",
  "registrations",
  "group_memberships",
  "finance_requests",
  "fund_payments",
  "softball_players",
  "softball_attendance",
  "directories",
  "directory_logs",
  "admin_users",
  "announcements",
  "notification_reads",
  "line_bindings",
  "agent_audit",
  "notifications",
  "schema_migrations",
  "sync_runs",
];

function resolveDatasetNames(value) {
  if (!value || value === "all") {
    return DEFAULT_DATASET_ORDER.slice();
  }
  const names = value
    .split(",")
    .map((item) => asText(item))
    .filter(Boolean);
  for (const name of names) {
    if (!DATASETS[name]) {
      throw new Error(`Unknown dataset: ${name}`);
    }
  }
  return names;
}

async function planMirrorSafeDataset(name, definition, snapshot, includeSamples) {
  const report = createDatasetReport(name, definition.policy);

  if (!(await tableExists(definition.table))) {
    pushSample(report, "missing_table", { table: definition.table }, includeSamples);
    return finalizeDatasetReport(report);
  }

  const sourceRows = await getSourceRows(snapshot, definition.source);
  const dbRows = await listTableRows(definition.table, definition.dbColumns || ["id"]);
  const sourceMap = new Map();
  const dbMap = new Map();

  for (const row of sourceRows) {
    const key = definition.rowKey(row);
    if (key) {
      sourceMap.set(key, row);
    }
  }
  for (const row of dbRows) {
    const key = definition.rowKey(row);
    if (key) {
      dbMap.set(key, row);
    }
  }

  report.sourceCount = sourceRows.length;
  report.dbCount = dbRows.length;

  for (const [key] of sourceMap) {
    if (!dbMap.has(key)) {
      pushSample(report, "insert_from_source", { id: key }, includeSamples);
    }
  }

  for (const [key] of dbMap) {
    if (!sourceMap.has(key)) {
      pushSample(report, "db_only_expected_local", { id: key, reason: "db_row_missing_in_source_but_local_rows_are_allowed" }, includeSamples);
    }
  }

  return finalizeDatasetReport(report);
}

async function planSingletonDataset(name, definition, snapshot, includeSamples) {
  const report = createDatasetReport(name, definition.policy);

  if (!(await tableExists(definition.table))) {
    pushSample(report, "missing_table", { table: definition.table }, includeSamples);
    return finalizeDatasetReport(report);
  }

  const data = await callAppsScript(definition.source.action, definition.source.payload || {});
  const sourceConfig = data[definition.source.dataKey] || {};
  const dbRows = await listTableRows(definition.table, ["id", "raw"]);

  report.sourceCount = sourceConfig && Object.keys(sourceConfig).length ? 1 : 0;
  report.dbCount = dbRows.length;

  if (!dbRows.length && report.sourceCount) {
    pushSample(report, "insert_from_source", { id: "singleton" }, includeSamples);
  } else if (dbRows.length > 1) {
    pushSample(
      report,
      "manual_review_required",
      { reason: "singleton_table_has_multiple_rows", rowCount: dbRows.length },
      includeSamples
    );
  } else if (dbRows.length === 1) {
    const dbRaw = parseJson(dbRows[0].raw, {});
    if (JSON.stringify(toJsonSafe(dbRaw || {})) !== JSON.stringify(toJsonSafe(sourceConfig || {}))) {
      pushSample(report, "update_from_source", { id: asText(dbRows[0].id) || "singleton" }, includeSamples);
    }
  }

  return finalizeDatasetReport(report);
}

function classifyDbOnlyMixedState(name, row) {
  if (name === "registrations") {
    const manualCreatedBy = asText(row.manual_created_by);
    const manualCreatedAt = asText(row.manual_created_at);
    if (manualCreatedBy || manualCreatedAt) {
      return {
        type: "db_only_expected_local",
        reason: "registration_has_manual_created_metadata",
      };
    }
    return {
      type: "db_only_expected_local",
      reason: "registration_missing_in_source_but_db_local_rows_are_allowed",
    };
  }

  if (name === "group_memberships") {
    const role = asText(row.role_in_group).toLowerCase();
    if (role === "manager") {
      return {
        type: "db_only_expected_local",
        reason: "manager_role_exists_only_in_db_role_model",
      };
    }
    return {
      type: "db_only_expected_local",
      reason: "group_membership_missing_in_source_but_db_local_rows_are_allowed",
    };
  }

  if (name === "finance_requests") {
    if (isUuid(row.id)) {
      return {
        type: "db_only_expected_local",
        reason: "uuid_request_exists_only_in_db_after_local_runtime_changes",
      };
    }
    return {
      type: "db_only_expected_local",
      reason: "finance_request_missing_in_source_but_db_local_rows_are_allowed",
    };
  }

  if (name === "fund_payments") {
    return {
      type: "db_only_expected_local",
      reason: "fund_payment_missing_in_source_but_db_local_rows_are_allowed",
    };
  }

  if (name === "softball_players") {
    return {
      type: "db_only_expected_local",
      reason: "softball_player_missing_in_source_but_db_local_rows_are_allowed",
    };
  }

  if (name === "softball_attendance") {
    return {
      type: "db_only_expected_local",
      reason: "softball_attendance_missing_in_source_after_local_runtime_changes",
    };
  }

  if (name === "notification_reads") {
    return {
      type: "db_only_expected_local",
      reason: "notification_read_exists_only_in_db_runtime_state",
    };
  }

  return {
    type: "db_only_expected_local",
    reason: "db_only_row_allowed",
  };
}

async function planMixedStateDataset(name, definition, snapshot, includeSamples) {
  const report = createDatasetReport(name, definition.policy);

  if (!(await tableExists(definition.table))) {
    pushSample(report, "missing_table", { table: definition.table }, includeSamples);
    return finalizeDatasetReport(report);
  }

  const sourceRows = await getSourceRows(snapshot, definition.source);
  const dbColumnMap = {
    registrations: ["id", "manual_created_by", "manual_created_at"],
    group_memberships: ["id", "person_id", "group_id", "role_in_group"],
    finance_requests: ["id", "created_at", "updated_at"],
    fund_payments: ["id", "created_at", "updated_at"],
    softball_players: ["id", "created_at", "updated_at"],
    softball_attendance: ["id", "practice_id", "player_id", "created_at", "updated_at"],
    notification_reads: ["notification_id", "student_id", "read_at", "seen_updated_at"],
  };
  const dbRows = await listTableRows(definition.table, dbColumnMap[name] || ["id"]);

  report.sourceCount = sourceRows.length;
  report.dbCount = dbRows.length;

  const sourceMap = new Map();
  for (const row of sourceRows) {
    const key = definition.rowKey(row);
    if (key) {
      sourceMap.set(key, row);
    }
  }

  const dbMap = new Map();
  for (const row of dbRows) {
    const key = definition.rowKey(row);
    if (key) {
      dbMap.set(key, row);
    }
  }

  for (const [key] of sourceMap) {
    if (!dbMap.has(key)) {
      pushSample(report, "insert_from_source", { id: key }, includeSamples);
    }
  }

  for (const [key, row] of dbMap) {
    if (!sourceMap.has(key)) {
      const classification = classifyDbOnlyMixedState(name, row);
      pushSample(
        report,
        classification.type,
        {
          id: key,
          reason: classification.reason,
        },
        includeSamples
      );
    }
  }

  return finalizeDatasetReport(report);
}

async function planDirectoriesDataset(definition, snapshot, includeSamples, options) {
  const report = createDatasetReport("directories", definition.policy);

  if (!(await tableExists(definition.table))) {
    pushSample(report, "missing_table", { table: definition.table }, includeSamples);
    return finalizeDatasetReport(report);
  }

  const sourceRows = await getSourceRows(snapshot, definition.source);
  const dbRows = await listTableRows(definition.table, [
    "id",
    "email",
    "name_zh",
    "name_en",
    "preferred_name",
    "company",
    "title",
    "mobile",
    "backup_phone",
    "emergency_contact",
    "emergency_phone",
    "birthday_month",
    "birthday_day",
  ]);

  report.sourceCount = sourceRows.length;
  report.dbCount = dbRows.length;

  const sourceMap = new Map();
  for (const row of sourceRows) {
    const key = definition.rowKey(row);
    if (key) {
      sourceMap.set(key, row);
    }
  }
  const dbMap = new Map();
  for (const row of dbRows) {
    const key = definition.rowKey(row);
    if (key) {
      dbMap.set(key, row);
    }
  }

  const fieldDefs = [
    { source: "email", db: "email", normalize: (value) => asLowerText(value) },
    { source: "nameZh", db: "name_zh", normalize: (value) => asText(value) },
    { source: "nameEn", db: "name_en", normalize: (value) => asLowerText(value) },
    { source: "preferredName", db: "preferred_name", normalize: (value) => asText(value) },
    { source: "company", db: "company", normalize: (value) => asText(value) },
    { source: "title", db: "title", normalize: (value) => asText(value) },
    {
      source: "mobile",
      db: "mobile",
      normalize: (value) => normalizePhone(value, options),
    },
    {
      source: "backupPhone",
      db: "backup_phone",
      normalize: (value) => normalizePhone(value, options),
    },
    { source: "emergencyContact", db: "emergency_contact", normalize: (value) => asText(value) },
    {
      source: "emergencyPhone",
      db: "emergency_phone",
      normalize: (value) => normalizePhone(value, options),
    },
    { source: "birthdayMonth", db: "birthday_month", normalize: (value) => asText(value) },
    { source: "birthdayDay", db: "birthday_day", normalize: (value) => asText(value) },
  ];

  for (const [key, sourceRow] of sourceMap) {
    const dbRow = dbMap.get(key);
    if (!dbRow) {
      pushSample(report, "insert_from_source", { id: key }, includeSamples);
      continue;
    }

    const updateFields = [];
    const normalizeFields = [];
    const preserveFields = [];
    const conflictFields = [];

    for (const field of fieldDefs) {
      const sourceRaw = asText(sourceRow[field.source]);
      const dbRaw = asText(dbRow[field.db]);
      const sourceNormalized = field.normalize(sourceRaw);
      const dbNormalized = field.normalize(dbRaw);

      if (sourceRaw === dbRaw) {
        continue;
      }

      if (sourceNormalized === dbNormalized) {
        normalizeFields.push({
          field: field.source,
          source: sourceRaw,
          db: dbRaw,
        });
        continue;
      }

      if (sourceNormalized && !dbNormalized) {
        updateFields.push({
          field: field.source,
          source: sourceRaw,
          db: dbRaw,
          reason: "source_non_empty_db_empty",
        });
        continue;
      }

      if (!sourceNormalized && dbNormalized) {
        preserveFields.push({
          field: field.source,
          source: sourceRaw,
          db: dbRaw,
          reason: "source_blank_db_non_empty",
        });
        continue;
      }

      conflictFields.push({
        field: field.source,
        source: sourceRaw,
        db: dbRaw,
        reason: "both_non_empty_materially_different",
      });
    }

    if (normalizeFields.length) {
      pushSample(report, "normalize_only", { id: key, fields: normalizeFields }, includeSamples);
    }
    if (updateFields.length) {
      pushSample(report, "update_from_source", { id: key, fields: updateFields }, includeSamples);
    }
    if (preserveFields.length) {
      pushSample(report, "preserve_db_only", { id: key, fields: preserveFields }, includeSamples);
    }
    if (conflictFields.length) {
      pushSample(report, "manual_review_required", { id: key, fields: conflictFields }, includeSamples);
    }
  }

  for (const [key] of dbMap) {
    if (!sourceMap.has(key)) {
      pushSample(report, "preserve_db_only", { id: key, reason: "db_row_missing_in_source" }, includeSamples);
    }
  }

  return finalizeDatasetReport(report);
}

async function planSchemaGapDataset(name, definition, includeSamples) {
  const report = createDatasetReport(name, definition.policy);
  const exists = await tableExists(definition.table);
  report.sourceCount = null;
  report.dbCount = exists ? await query(`select count(*)::int as count from ${quoteIdentifier(definition.table)}`).then((r) => Number(r.rows[0]?.count || 0)) : null;

  if (!exists) {
    pushSample(report, "missing_table", { table: definition.table }, includeSamples);
  }
  if (!definition.readPath) {
    pushSample(report, "missing_read_path", { table: definition.table }, includeSamples);
  }

  return finalizeDatasetReport(report);
}

async function planDerivedRuntimeDataset(name, definition, includeSamples) {
  const report = createDatasetReport(name, definition.policy);
  report.sourceCount = null;
  report.dbCount = (await tableExists(definition.table)) ? await query(`select count(*)::int as count from ${quoteIdentifier(definition.table)}`).then((r) => Number(r.rows[0]?.count || 0)) : null;
  pushSample(report, "skip_derived_table", { table: definition.table, reason: "db_native_runtime_table" }, includeSamples);
  return finalizeDatasetReport(report);
}

async function planDataset(name, snapshot, includeSamples, options) {
  const definition = DATASETS[name];
  if (!definition) {
    throw new Error(`Unknown dataset: ${name}`);
  }

  switch (definition.policy) {
    case "mirror_safe":
      return planMirrorSafeDataset(name, definition, snapshot, includeSamples);
    case "mirror_safe_singleton":
      return planSingletonDataset(name, definition, snapshot, includeSamples);
    case "mixed_state":
      return planMixedStateDataset(name, definition, snapshot, includeSamples);
    case "field_merge":
      return planDirectoriesDataset(definition, snapshot, includeSamples, options);
    case "schema_gap":
      return planSchemaGapDataset(name, definition, includeSamples);
    case "derived_runtime":
      return planDerivedRuntimeDataset(name, definition, includeSamples);
    default:
      throw new Error(`Unsupported policy: ${definition.policy}`);
  }
}

function summarizeReport(report) {
  const summary = {
    datasetCount: report.datasets.length,
    planItemCount: 0,
    manualReviewCount: 0,
    unsafeDatasetCount: 0,
  };

  for (const dataset of report.datasets) {
    summary.planItemCount += dataset.planItemCount || 0;
    summary.manualReviewCount += dataset.manualReviewCount || 0;
    if (dataset.unsafe) {
      summary.unsafeDatasetCount += 1;
    }
  }

  return summary;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# 115b_sys Repair Dry-Run");
  lines.push("");
  lines.push(`- checkedAt: ${report.checkedAt}`);
  lines.push(`- pulledAt: ${report.pulledAt || ""}`);
  lines.push(`- datasetCount: ${report.summary.datasetCount}`);
  lines.push(`- planItemCount: ${report.summary.planItemCount}`);
  lines.push(`- manualReviewCount: ${report.summary.manualReviewCount}`);
  lines.push(`- unsafeDatasetCount: ${report.summary.unsafeDatasetCount}`);
  lines.push("");

  for (const dataset of report.datasets) {
    lines.push(`## ${dataset.name}`);
    lines.push("");
    lines.push(`- policy: ${dataset.policy}`);
    lines.push(`- sourceCount: ${dataset.sourceCount}`);
    lines.push(`- dbCount: ${dataset.dbCount}`);
    lines.push(`- planItemCount: ${dataset.planItemCount}`);
    lines.push(`- manualReviewCount: ${dataset.manualReviewCount}`);
    lines.push(`- unsafe: ${dataset.unsafe ? "yes" : "no"}`);
    lines.push("");
    lines.push("### Plan counts");
    lines.push("");
    for (const [key, value] of Object.entries(dataset.plan)) {
      if (!value) {
        continue;
      }
      lines.push(`- ${key}: ${value}`);
    }
    lines.push("");

    for (const [key, samples] of Object.entries(dataset.samples || {})) {
      if (!samples || !samples.length) {
        continue;
      }
      lines.push(`### Samples: ${key}`);
      lines.push("");
      for (const sample of samples) {
        lines.push("```json");
        lines.push(JSON.stringify(sample, null, 2));
        lines.push("```");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function maybeWriteOutput(filePath, content) {
  if (!filePath) {
    return;
  }
  const absolutePath = path.resolve(process.cwd(), filePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const datasetNames = resolveDatasetNames(options.datasets);
  const snapshot = await getSnapshot();
  const publicTables = await listPublicTables();

  const report = {
    checkedAt: new Date().toISOString(),
    pulledAt: asText(snapshot.pulledAt),
    source: options.source,
    options: {
      datasets: datasetNames,
      includeSamples: options.includeSamples,
      strict: options.strict,
      treatPhoneLeadingZeroAsNormalized: options.treatPhoneLeadingZeroAsNormalized,
      format: options.format,
      out: options.out,
    },
    database: {
      publicTables,
    },
    datasets: [],
  };

  for (const name of datasetNames) {
    const datasetReport = await planDataset(name, snapshot, options.includeSamples, options);
    report.datasets.push(datasetReport);
  }

  report.summary = summarizeReport(report);

  const output = options.format === "markdown" ? renderMarkdown(report) : JSON.stringify(report, null, 2);
  console.log(output);
  await maybeWriteOutput(options.out, output + (options.format === "markdown" ? "\n" : "\n"));

  if (options.strict && (report.summary.manualReviewCount > 0 || report.summary.unsafeDatasetCount > 0)) {
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    console.error("repair:dry-run failed:", error && error.message ? error.message : String(error));
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
