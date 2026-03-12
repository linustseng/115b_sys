import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "../src/config.js";
import { query, withTransaction, closePool } from "../src/db.js";

const config = getConfig();

function asText(value) {
  const text = String(value == null ? "" : value).trim();
  return text || null;
}

function asEmail(value) {
  const text = asText(value);
  return text ? text.toLowerCase() : null;
}

function asNum(value) {
  const raw = String(value == null ? "" : value).replace(/,/g, "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function asInt(value) {
  const n = asNum(value);
  return n == null ? null : Math.trunc(n);
}

function asObj(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asArr(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || ""));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toJsonSafe(value, fallback = {}) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, v) => {
        if (v === undefined) return null;
        if (typeof v === "number" && !Number.isFinite(v)) return null;
        return v;
      })
    );
  } catch {
    return fallback;
  }
}

function parseArgs(argv) {
  const options = {
    datasets: "all",
    outDir: "./reports/repair-backups",
    skipBackup: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eqIndex = arg.indexOf("=");
    const key = eqIndex >= 0 ? arg.slice(2, eqIndex) : arg.slice(2);
    const rawValue = eqIndex >= 0 ? arg.slice(eqIndex + 1) : "1";
    switch (key) {
      case "datasets":
        options.datasets = rawValue || "all";
        break;
      case "out-dir":
        options.outDir = rawValue || options.outDir;
        break;
      case "skip-backup":
        options.skipBackup = String(rawValue).trim() === "1";
        break;
      default:
        break;
    }
  }

  return options;
}

function qid(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${name}"`;
}

function toCanonicalAttendanceId(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  const colonMatch = text.match(/^([^:]+):(.+)$/);
  if (colonMatch) return `${String(colonMatch[1] || "").trim()}:${String(colonMatch[2] || "").trim()}`;
  const dashMatch = text.match(/^(.+)-([^:-]+)$/);
  if (dashMatch) return `${String(dashMatch[1] || "").trim()}:${String(dashMatch[2] || "").trim()}`;
  return text;
}

function buildAgentAuditKey(row) {
  const id = String((row && row.id) || "").trim();
  if (id) return id;
  return [
    String((row && (row.createdAt || row.created_at)) || "").trim(),
    String((row && row.action) || "").trim(),
    String((row && (row.lineUserId || row.line_user_id)) || "").trim(),
    String((row && (row.studentId || row.student_id)) || "").trim(),
    String((row && (row.requestId || row.request_id)) || "").trim(),
    String((row && (row.eventId || row.event_id)) || "").trim(),
  ].join("::");
}

function buildNotificationReadKey(row) {
  return [
    String((row && (row.notificationId || row.notification_id)) || "").trim(),
    String((row && (row.readerStudentId || row.student_id)) || "").trim(),
  ].join("::");
}

async function callAppsScript(action, payload = {}) {
  const requestPayload = {
    action,
    syncToken: config.syncPullToken,
    ...payload,
  };
  const url = new URL(config.appsScriptUrl);
  url.searchParams.set("payload", JSON.stringify(requestPayload));
  const response = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Apps Script non-JSON for ${action}`);
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : `Apps Script failed: ${action}`);
  }
  return json.data || {};
}

async function listTableRows(tableName) {
  const result = await query(`select * from ${qid(tableName)} order by 1 nulls last`);
  return result.rows;
}

function dedupeByKey(rows, keyFn) {
  const map = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (!key) continue;
    map.set(key, row);
  }
  return Array.from(map.values());
}

function prepareDbValue(column, value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "object") {
    return JSON.stringify(toJsonSafe(value, Array.isArray(value) ? [] : {}));
  }
  return value;
}

async function upsertRows(client, tableName, rows, options = {}) {
  const conflictColumns = options.conflictColumns || ["id"];
  if (!rows.length) return 0;

  let processed = 0;
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => prepareDbValue(column, row[column]));
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const conflictSql = `(${conflictColumns.map(qid).join(", ")})`;
    const updateColumns = (options.updateColumns || columns.filter((column) => !conflictColumns.includes(column))).filter(
      (column) => columns.includes(column)
    );
    let sql = `insert into ${qid(tableName)} (${columns.map(qid).join(", ")}) values (${placeholders})`;
    if (options.onConflictDoNothing) {
      sql += ` on conflict ${conflictSql} do nothing`;
    } else if (updateColumns.length) {
      sql += ` on conflict ${conflictSql} do update set ${updateColumns
        .map((column) => `${qid(column)} = excluded.${qid(column)}`)
        .join(", ")}`;
    } else {
      sql += ` on conflict ${conflictSql} do nothing`;
    }
    await client.query(sql, values);
    processed += 1;
  }
  return processed;
}

async function upsertNotificationReads(client, rows) {
  if (!rows.length) return 0;
  let processed = 0;
  for (const row of rows) {
    if (!row.notification_id || !row.student_id) continue;
    await client.query(
      `insert into notification_reads (notification_id, student_id, read_at, seen_updated_at)
       values ($1, $2, $3::timestamptz, $4::timestamptz)
       on conflict (notification_id, student_id) do update set
         read_at = least(notification_reads.read_at, excluded.read_at),
         seen_updated_at = greatest(
           coalesce(notification_reads.seen_updated_at, notification_reads.read_at),
           coalesce(excluded.seen_updated_at, excluded.read_at)
         )`,
      [row.notification_id, row.student_id, row.read_at, row.seen_updated_at]
    );
    processed += 1;
  }
  return processed;
}

async function backupTables(tableNames, outDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const absoluteDir = path.resolve(process.cwd(), outDir);
  await fs.mkdir(absoluteDir, { recursive: true });
  const payload = {
    createdAt: new Date().toISOString(),
    tables: {},
  };
  for (const tableName of tableNames) {
    const rows = await listTableRows(tableName);
    payload.tables[tableName] = {
      count: rows.length,
      rows,
    };
  }
  const filePath = path.join(absoluteDir, `repair-apply-backup-${timestamp}.json`);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  return filePath;
}

const APPLY_DATASET_ORDER = [
  "events",
  "students",
  "registrations",
  "checkins",
  "directories",
  "group_memberships",
  "finance_category_types",
  "finance_roles",
  "finance_requests",
  "finance_actions",
  "fund_events",
  "fund_payments",
  "order_plans",
  "order_responses",
  "softball_players",
  "softball_practices",
  "softball_fields",
  "softball_gear",
  "softball_config",
  "softball_attendance",
  "directory_logs",
  "admin_users",
  "announcements",
  "notification_reads",
  "line_bindings",
  "agent_audit",
];

const TABLES_BY_DATASET = {
  events: "events",
  students: "students",
  registrations: "registrations",
  checkins: "checkins",
  directories: "directories",
  group_memberships: "group_memberships",
  finance_category_types: "finance_category_types",
  finance_roles: "finance_roles",
  finance_requests: "finance_requests",
  finance_actions: "finance_actions",
  fund_events: "fund_events",
  fund_payments: "fund_payments",
  order_plans: "order_plans",
  order_responses: "order_responses",
  softball_players: "softball_players",
  softball_practices: "softball_practices",
  softball_fields: "softball_fields",
  softball_gear: "softball_gear",
  softball_config: "softball_config",
  softball_attendance: "softball_attendance",
  directory_logs: "directory_logs",
  admin_users: "admin_users",
  announcements: "announcements",
  notification_reads: "notification_reads",
  line_bindings: "line_bindings",
  agent_audit: "agent_audit",
};

function resolveDatasets(value) {
  if (!value || value === "all") return APPLY_DATASET_ORDER.slice();
  const list = value.split(",").map((item) => String(item || "").trim()).filter(Boolean);
  for (const name of list) {
    if (!TABLES_BY_DATASET[name]) throw new Error(`Unknown dataset: ${name}`);
  }
  return list;
}

function mapEvent(row, syncedAt) {
  return {
    id: asText(row.id),
    title: asText(row.title),
    description: asText(row.description),
    start_at: asText(row.startAt),
    end_at: asText(row.endAt),
    location: asText(row.location),
    address: asText(row.address),
    registration_open_at: asText(row.registrationOpenAt),
    registration_close_at: asText(row.registrationCloseAt),
    checkin_open_at: asText(row.checkinOpenAt),
    checkin_close_at: asText(row.checkinCloseAt),
    register_url: asText(row.registerUrl),
    checkin_url: asText(row.checkinUrl),
    capacity: asInt(row.capacity),
    status: asText(row.status),
    category: asText(row.category),
    form_schema: asObj(row.formSchema),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapStudent(row, syncedAt) {
  return {
    id: asText(row.id),
    name: asText(row.name),
    google_sub: asText(row.googleSub),
    google_email: asEmail(row.googleEmail),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapRegistration(row, syncedAt) {
  return {
    id: asText(row.id),
    event_id: asText(row.eventId),
    student_id: asText(row.studentId),
    user_name: asText(row.userName),
    user_email: asEmail(row.userEmail),
    user_phone: asText(row.userPhone),
    class_year: asText(row.classYear),
    custom_fields: asObj(row.customFields),
    status: asText(row.status),
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    manual_created_by: asText(row.manualCreatedBy),
    manual_created_by_name: asText(row.manualCreatedByName),
    manual_created_at: asText(row.manualCreatedAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapCheckin(row, syncedAt) {
  return {
    id: asText(row.id),
    event_id: asText(row.eventId),
    registration_id: asText(row.registrationId),
    checkin_at: asText(row.checkinAt),
    checkin_method: asText(row.checkinMethod),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapDirectorySource(row, syncedAt) {
  return {
    id: asText(row.id),
    group_id: asText(row.group),
    email: asEmail(row.email),
    name_zh: asText(row.nameZh),
    name_en: asText(row.nameEn),
    preferred_name: asText(row.preferredName),
    company: asText(row.company),
    title: asText(row.title),
    social_url: asText(row.socialUrl),
    mobile: asText(row.mobile),
    backup_phone: asText(row.backupPhone),
    emergency_contact: asText(row.emergencyContact),
    emergency_phone: asText(row.emergencyPhone),
    dietary_restrictions: asText(row.dietaryRestrictions),
    photo_url: asText(row.photoUrl),
    birthday_month: asText(row.birthdayMonth),
    birthday_day: asText(row.birthdayDay),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mergeDirectoryRow(existingRow, sourceRow) {
  if (!existingRow) return sourceRow;
  const merged = { ...existingRow };
  const sourceWinsIfNonEmpty = [
    "group_id",
    "email",
    "name_zh",
    "name_en",
    "preferred_name",
    "company",
    "title",
    "social_url",
    "mobile",
    "backup_phone",
    "emergency_contact",
    "emergency_phone",
    "dietary_restrictions",
    "photo_url",
    "birthday_month",
    "birthday_day",
  ];
  for (const column of sourceWinsIfNonEmpty) {
    const sourceValue = sourceRow[column];
    if (sourceValue !== null && sourceValue !== "") {
      merged[column] = sourceValue;
    }
  }
  merged.raw = sourceRow.raw;
  merged.synced_at = sourceRow.synced_at;
  merged.id = sourceRow.id;
  return merged;
}

function mapGroupMembership(row, syncedAt) {
  return {
    id: asText(row.id) || `${asText(row.personId)}::${asText(row.groupId)}::${asText(row.roleInGroup)}`,
    person_id: asText(row.personId),
    person_name: asText(row.personName),
    group_id: asText(row.groupId),
    role_in_group: asText(row.roleInGroup),
    notes: asText(row.notes),
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapFinanceCategoryType(row, syncedAt) {
  return {
    id: asText(row.id),
    label: asText(row.label),
    notes: asText(row.notes),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapFinanceRole(row, syncedAt) {
  return {
    id: asText(row.id),
    role: asText(row.role),
    student_id: asText(row.studentId),
    student_name: asText(row.studentName),
    group_ids: asArr(row.groupIds),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapFinanceRequest(row, syncedAt) {
  return {
    id: asText(row.id),
    type: asText(row.type),
    title: asText(row.title),
    description: asText(row.description),
    category_type: asText(row.categoryType),
    amount_estimated: asNum(row.amountEstimated),
    amount_actual: asNum(row.amountActual),
    currency: asText(row.currency),
    payment_method: asText(row.paymentMethod),
    vendor_name: asText(row.vendorName),
    payee_name: asText(row.payeeName),
    payee_bank: asText(row.payeeBank),
    payee_account: asText(row.payeeAccount),
    related_purchase_id: asText(row.relatedPurchaseId),
    no_purchase_reason: asText(row.noPurchaseReason),
    expected_clear_date: asText(row.expectedClearDate),
    attachments: asArr(row.attachments),
    status: asText(row.status),
    applicant_id: asText(row.applicantId),
    applicant_name: asText(row.applicantName),
    applicant_department: asText(row.applicantDepartment),
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapFinanceAction(row, syncedAt) {
  return {
    id: asText(row.id),
    request_id: asText(row.requestId),
    actor_id: asText(row.actorId),
    actor_name: asText(row.actorName),
    action_type: asText(row.actionType),
    from_status: asText(row.fromStatus),
    to_status: asText(row.toStatus),
    notes: asText(row.notes),
    created_at: asText(row.createdAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapFundEvent(row, syncedAt) {
  return {
    id: asText(row.id),
    title: asText(row.title),
    description: asText(row.description),
    due_date: asText(row.dueDate),
    amount_general: asNum(row.amountGeneral),
    amount_sponsor: asNum(row.amountSponsor),
    expected_general_count: asInt(row.expectedGeneralCount),
    expected_sponsor_count: asInt(row.expectedSponsorCount),
    status: asText(row.status),
    notes: asText(row.notes),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapFundPayment(row, syncedAt) {
  return {
    id: asText(row.id),
    event_id: asText(row.eventId),
    payer_id: asText(row.payerId),
    payer_name: asText(row.payerName),
    payer_email: asEmail(row.payerEmail),
    payer_type: asText(row.payerType),
    amount: asNum(row.amount),
    method: asText(row.method),
    transfer_last5: asText(row.transferLast5),
    received_at: asText(row.receivedAt),
    accounted_at: asText(row.accountedAt),
    confirmed_at: asText(row.confirmedAt),
    notes: asText(row.notes),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapOrderPlan(row, syncedAt) {
  return {
    id: asText(row.id),
    date: asText(row.date),
    title: asText(row.title),
    description: asText(row.description),
    close_at: asText(row.closeAt),
    vendor: asText(row.vendor),
    items: asArr(row.items),
    status: asText(row.status),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapOrderResponse(row, syncedAt) {
  return {
    id: asText(row.id),
    order_id: asText(row.orderId),
    student_id: asText(row.studentId),
    student_name: asText(row.studentName),
    student_email: asEmail(row.studentEmail),
    response: asObj(row.response || row),
    total_amount: asNum(row.totalAmount),
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapSoftballPlayer(row, syncedAt) {
  return {
    id: asText(row.id),
    name: asText(row.name),
    email: asEmail(row.email),
    phone: asText(row.phone),
    jersey_no: asText(row.jerseyNo || row.jerseyNumber),
    jersey_size: asText(row.jerseySize),
    positions: asArr(row.positions),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapSoftballPractice(row, syncedAt) {
  return {
    id: asText(row.id),
    date: asText(row.date),
    title: asText(row.title),
    location: asText(row.location),
    start_at: asText(row.startAt),
    end_at: asText(row.endAt),
    notes: asText(row.notes),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapSoftballField(row, syncedAt) {
  return {
    id: asText(row.id),
    name: asText(row.name),
    address: asText(row.address),
    map_url: asText(row.mapUrl || row.map_url),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapSoftballGear(row, syncedAt) {
  return {
    id: asText(row.id),
    name: asText(row.name),
    notes: asText(row.notes),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapSoftballAttendance(row, syncedAt) {
  return {
    id: asText(row.id) || `${asText(row.practiceId)}:${asText(row.playerId || row.studentId)}`,
    practice_id: asText(row.practiceId),
    player_id: asText(row.playerId || row.studentId),
    status: asText(row.status),
    notes: asText(row.notes || row.note),
    raw: row || {},
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    synced_at: syncedAt,
  };
}

function mapDirectoryLog(row, syncedAt) {
  return {
    id: asText(row.id),
    created_at: asText(row.createdAt),
    actor_email: asEmail(row.actorEmail),
    target_id: asText(row.targetId),
    target_email: asEmail(row.targetEmail),
    action: asText(row.action),
    changes: asText(row.changes),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapAdminUser(row, syncedAt) {
  return {
    id: asText(row.id),
    name: asText(row.name),
    email: asEmail(row.email),
    role: asText(row.role),
    password_hash: asText(row.passwordHash),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapAnnouncement(row, syncedAt) {
  return {
    id: asText(row.id),
    type: asText(row.type),
    scope: asText(row.scope),
    target_key: asText(row.targetKey),
    title: asText(row.title),
    message: asText(row.message),
    level: asText(row.level),
    cta_label: asText(row.ctaLabel),
    cta_url: asText(row.ctaUrl),
    status: asText(row.status),
    start_at: asText(row.startAt),
    end_at: asText(row.endAt),
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapLineBinding(row, syncedAt) {
  return {
    id: asText(row.id),
    line_user_id: asText(row.lineUserId),
    student_id: asText(row.studentId),
    status: asText(row.status),
    role: asText(row.role),
    group_id: asText(row.groupId),
    display_name: asText(row.displayName),
    picture_url: asText(row.pictureUrl),
    source: asText(row.source),
    bound_at: asText(row.boundAt),
    created_at: asText(row.createdAt),
    updated_at: asText(row.updatedAt),
    bound_by_type: asText(row.boundByType),
    bound_by_student_id: asText(row.boundByStudentId),
    note: asText(row.note),
    metadata: typeof row.metadata === "string" ? row.metadata : JSON.stringify(toJsonSafe(row.metadata, {})),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapAgentAudit(row, syncedAt) {
  return {
    id: buildAgentAuditKey(row),
    action: asText(row.action),
    channel: asText(row.channel),
    line_user_id: asText(row.lineUserId),
    student_id: asText(row.studentId),
    request_id: asText(row.requestId),
    event_id: asText(row.eventId),
    status: asText(row.status),
    error: asText(row.error),
    payload: asText(row.payload),
    result: asText(row.result),
    created_at: asText(row.createdAt),
    raw: row || {},
    synced_at: syncedAt,
  };
}

function mapNotificationRead(row) {
  return {
    notification_id: asText(row.notificationId),
    student_id: asText(row.readerStudentId),
    read_at: asText(row.readAt),
    seen_updated_at: asText(row.readAt),
  };
}

async function fetchAllSourceData() {
  const snapshot = await callAppsScript("syncPullSnapshot");
  const [
    financeRequestsData,
    fundEventsData,
    fundPaymentsData,
    orderPlansData,
    softballPlayersData,
    softballPracticesData,
    softballFieldsData,
    softballGearData,
    softballConfigData,
    softballAttendanceData,
    directoryLogsData,
    adminUsersData,
    announcementsData,
    notificationReadsData,
    lineBindingsData,
    agentAuditData,
  ] = await Promise.all([
    callAppsScript("listFinanceRequests"),
    callAppsScript("listFundEvents"),
    callAppsScript("listFundPayments"),
    callAppsScript("listOrderPlans"),
    callAppsScript("listSoftballPlayers"),
    callAppsScript("listSoftballPractices"),
    callAppsScript("listSoftballFields"),
    callAppsScript("listSoftballGear"),
    callAppsScript("listSoftballConfig"),
    callAppsScript("listSoftballAttendance"),
    callAppsScript("listDirectoryLogs"),
    callAppsScript("listAdminUsers"),
    callAppsScript("listAnnouncements"),
    callAppsScript("listNotificationReads"),
    callAppsScript("listLineBindings"),
    callAppsScript("listAgentAudit"),
  ]);

  const requests = Array.isArray(financeRequestsData.requests) ? financeRequestsData.requests : [];
  const plans = Array.isArray(orderPlansData.plans) ? orderPlansData.plans : [];

  const financeActionsRaw = [];
  for (const req of requests) {
    const requestId = asText(req && req.id);
    if (!requestId) continue;
    try {
      const data = await callAppsScript("listFinanceActions", { requestId });
      const list = Array.isArray(data.actions) ? data.actions : [];
      for (const item of list) financeActionsRaw.push(item);
    } catch (error) {
      console.warn(`[repair:apply] listFinanceActions failed for ${requestId}: ${error.message}`);
    }
  }

  const orderResponsesRaw = [];
  for (const plan of plans) {
    const orderId = asText(plan && (plan.id || plan.orderId));
    if (!orderId) continue;
    try {
      const data = await callAppsScript("listOrderResponses", { orderId });
      const list = Array.isArray(data.responses) ? data.responses : [];
      for (const item of list) orderResponsesRaw.push(item);
    } catch (error) {
      console.warn(`[repair:apply] listOrderResponses failed for ${orderId}: ${error.message}`);
    }
  }

  return {
    snapshot,
    financeRequests: requests,
    financeActions: financeActionsRaw,
    fundEvents: Array.isArray(fundEventsData.events) ? fundEventsData.events : [],
    fundPayments: Array.isArray(fundPaymentsData.payments) ? fundPaymentsData.payments : [],
    orderPlans: plans,
    orderResponses: orderResponsesRaw,
    softballPlayers: Array.isArray(softballPlayersData.players) ? softballPlayersData.players : [],
    softballPractices: Array.isArray(softballPracticesData.practices) ? softballPracticesData.practices : [],
    softballFields: Array.isArray(softballFieldsData.fields) ? softballFieldsData.fields : [],
    softballGear: Array.isArray(softballGearData.gear) ? softballGearData.gear : [],
    softballConfig: softballConfigData.config || {},
    softballAttendance: Array.isArray(softballAttendanceData.attendance) ? softballAttendanceData.attendance : [],
    directoryLogs: Array.isArray(directoryLogsData.directoryLogs) ? directoryLogsData.directoryLogs : [],
    adminUsers: Array.isArray(adminUsersData.adminUsers) ? adminUsersData.adminUsers : [],
    announcements: Array.isArray(announcementsData.announcements) ? announcementsData.announcements : [],
    notificationReads: Array.isArray(notificationReadsData.notificationReads) ? notificationReadsData.notificationReads : [],
    lineBindings: Array.isArray(lineBindingsData.lineBindings) ? lineBindingsData.lineBindings : [],
    agentAudit: Array.isArray(agentAuditData.agentAudit) ? agentAuditData.agentAudit : [],
  };
}

async function applyDirectories(client, sourceRows, syncedAt) {
  const existingRows = await client.query(`select * from directories order by id`);
  const existingMap = new Map(existingRows.rows.map((row) => [String(row.id || "").trim(), row]));
  const mapped = sourceRows
    .map((row) => mapDirectorySource(row, syncedAt))
    .filter((row) => row.id)
    .map((sourceRow) => mergeDirectoryRow(existingMap.get(sourceRow.id), sourceRow));
  return upsertRows(client, "directories", dedupeByKey(mapped, (row) => row.id));
}

async function applySoftballConfig(client, sourceConfig, syncedAt) {
  await client.query(
    `insert into softball_config (id, raw, updated_at, synced_at)
     values ('singleton', $1::jsonb, $2, $3::timestamptz)
     on conflict (id) do update set raw = excluded.raw, updated_at = excluded.updated_at, synced_at = excluded.synced_at`,
    [JSON.stringify(toJsonSafe(sourceConfig || {}, {})), syncedAt, syncedAt]
  );
  return 1;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const datasets = resolveDatasets(options.datasets);
  const tablesToBackup = Array.from(new Set(datasets.map((name) => TABLES_BY_DATASET[name])));

  const backupPath = options.skipBackup ? null : await backupTables(tablesToBackup, options.outDir);
  console.log(`[repair:apply] backup ${backupPath || 'skipped'}`);

  const source = await fetchAllSourceData();
  const syncedAt = new Date().toISOString();
  const summary = {
    backupPath,
    syncedAt,
    datasets: {},
  };

  await withTransaction(async (client) => {
    for (const dataset of datasets) {
      let count = 0;
      switch (dataset) {
        case "events": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.events) ? source.snapshot.events : []).map((row) => mapEvent(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "events", rows);
          break;
        }
        case "students": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.students) ? source.snapshot.students : []).map((row) => mapStudent(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "students", rows);
          break;
        }
        case "registrations": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.registrations) ? source.snapshot.registrations : []).map((row) => mapRegistration(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "registrations", rows);
          break;
        }
        case "checkins": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.checkins) ? source.snapshot.checkins : []).map((row) => mapCheckin(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "checkins", rows);
          break;
        }
        case "directories": {
          count = await applyDirectories(client, Array.isArray(source.snapshot.directory) ? source.snapshot.directory : [], syncedAt);
          break;
        }
        case "group_memberships": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.groupMemberships) ? source.snapshot.groupMemberships : []).map((row) => mapGroupMembership(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "group_memberships", rows);
          break;
        }
        case "finance_category_types": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.financeCategoryTypes) ? source.snapshot.financeCategoryTypes : []).map((row) => mapFinanceCategoryType(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "finance_category_types", rows);
          break;
        }
        case "finance_roles": {
          const rows = dedupeByKey((Array.isArray(source.snapshot.financeRoles) ? source.snapshot.financeRoles : []).map((row) => mapFinanceRole(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "finance_roles", rows);
          break;
        }
        case "finance_requests": {
          const rows = dedupeByKey(source.financeRequests.map((row) => mapFinanceRequest(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "finance_requests", rows);
          break;
        }
        case "finance_actions": {
          const rows = dedupeByKey(source.financeActions.map((row) => mapFinanceAction(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "finance_actions", rows);
          break;
        }
        case "fund_events": {
          const rows = dedupeByKey(source.fundEvents.map((row) => mapFundEvent(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "fund_events", rows);
          break;
        }
        case "fund_payments": {
          const rows = dedupeByKey(source.fundPayments.map((row) => mapFundPayment(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "fund_payments", rows);
          break;
        }
        case "order_plans": {
          const rows = dedupeByKey(source.orderPlans.map((row) => mapOrderPlan(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "order_plans", rows);
          break;
        }
        case "order_responses": {
          const rows = dedupeByKey(source.orderResponses.map((row) => mapOrderResponse(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "order_responses", rows);
          break;
        }
        case "softball_players": {
          const rows = dedupeByKey(source.softballPlayers.map((row) => mapSoftballPlayer(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "softball_players", rows);
          break;
        }
        case "softball_practices": {
          const rows = dedupeByKey(source.softballPractices.map((row) => mapSoftballPractice(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "softball_practices", rows);
          break;
        }
        case "softball_fields": {
          const rows = dedupeByKey(source.softballFields.map((row) => mapSoftballField(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "softball_fields", rows);
          break;
        }
        case "softball_gear": {
          const rows = dedupeByKey(source.softballGear.map((row) => mapSoftballGear(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "softball_gear", rows);
          break;
        }
        case "softball_config": {
          count = await applySoftballConfig(client, source.softballConfig, syncedAt);
          break;
        }
        case "softball_attendance": {
          const rows = dedupeByKey(
            source.softballAttendance
              .map((row) => mapSoftballAttendance(row, syncedAt))
              .filter((row) => row.id && row.practice_id && row.player_id),
            (row) => `${row.practice_id}::${row.player_id}`
          );
          count = await upsertRows(client, "softball_attendance", rows, {
            conflictColumns: ["practice_id", "player_id"],
          });
          break;
        }
        case "directory_logs": {
          const rows = dedupeByKey(source.directoryLogs.map((row) => mapDirectoryLog(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "directory_logs", rows);
          break;
        }
        case "admin_users": {
          const rows = dedupeByKey(source.adminUsers.map((row) => mapAdminUser(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "admin_users", rows);
          break;
        }
        case "announcements": {
          const rows = dedupeByKey(source.announcements.map((row) => mapAnnouncement(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "announcements", rows);
          break;
        }
        case "notification_reads": {
          const rows = dedupeByKey(source.notificationReads.map((row) => mapNotificationRead(row)).filter((row) => row.notification_id && row.student_id), (row) => buildNotificationReadKey({ notificationId: row.notification_id, readerStudentId: row.student_id }));
          count = await upsertNotificationReads(client, rows);
          break;
        }
        case "line_bindings": {
          const rows = dedupeByKey(source.lineBindings.map((row) => mapLineBinding(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "line_bindings", rows);
          break;
        }
        case "agent_audit": {
          const rows = dedupeByKey(source.agentAudit.map((row) => mapAgentAudit(row, syncedAt)).filter((row) => row.id), (row) => row.id);
          count = await upsertRows(client, "agent_audit", rows);
          break;
        }
        default:
          throw new Error(`Unsupported dataset: ${dataset}`);
      }
      summary.datasets[dataset] = { appliedRows: count };
      console.log(`[repair:apply] ${dataset} applied ${count}`);
    }
  });

  console.log(JSON.stringify(summary, null, 2));
}

run()
  .catch((error) => {
    console.error("repair:apply failed:", error && error.message ? error.message : String(error));
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
