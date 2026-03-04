import { getConfig } from "../config.js";
import { query, withTransaction } from "../db.js";

const config = getConfig();

function asText(value) {
  const text = String(value == null ? "" : value).trim();
  return text || null;
}

function asLowerText(value) {
  const text = asText(value);
  return text ? text.toLowerCase() : null;
}

function asInteger(value) {
  const normalized = String(value == null ? "" : value).trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function asJson(value, fallback = {}) {
  if (value && typeof value === "object") {
    return value;
  }
  const raw = String(value == null ? "" : value).trim();
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

function quoteIdentifier(name) {
  if (!/^[a-z_]+$/i.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

async function replaceTableRows(client, tableName, rows) {
  const tableSql = quoteIdentifier(tableName);
  await client.query(`TRUNCATE TABLE ${tableSql}`);
  if (!rows.length) {
    return;
  }

  for (const row of rows) {
    const columns = Object.keys(row);
    if (!columns.length) {
      continue;
    }
    const quotedColumns = columns.map(quoteIdentifier).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) =>
      Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null
    );
    const sql = `INSERT INTO ${tableSql} (${quotedColumns}) VALUES (${placeholders})`;
    await client.query(sql, values);
  }
}

async function callAppsScript(action, payload = {}) {
  const requestPayload = {
    action,
    syncToken: config.syncPullToken,
    ...payload,
  };

  const url = new URL(config.appsScriptUrl);
  url.searchParams.set("payload", JSON.stringify(requestPayload));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.appsScriptTimeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (error) {
      throw new Error(`Apps Script returned non-JSON response for ${action}`);
    }

    if (!json || json.ok !== true) {
      throw new Error(json && json.error ? json.error : `Apps Script action failed: ${action}`);
    }

    return json.data || {};
  } finally {
    clearTimeout(timeout);
  }
}

function buildEventRows(sourceRows) {
  return sourceRows
    .map((item) => ({
      id: asText(item.id),
      title: asText(item.title),
      description: asText(item.description),
      start_at: asText(item.startAt),
      end_at: asText(item.endAt),
      location: asText(item.location),
      address: asText(item.address),
      registration_open_at: asText(item.registrationOpenAt),
      registration_close_at: asText(item.registrationCloseAt),
      checkin_open_at: asText(item.checkinOpenAt),
      checkin_close_at: asText(item.checkinCloseAt),
      register_url: asText(item.registerUrl),
      checkin_url: asText(item.checkinUrl),
      capacity: asInteger(item.capacity),
      status: asText(item.status),
      category: asText(item.category),
      form_schema: asJson(item.formSchema, {}),
      raw: item || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((row) => row.id);
}

function buildStudentRows(sourceRows) {
  return sourceRows
    .map((item) => ({
      id: asText(item.id),
      name: asText(item.name),
      google_sub: asText(item.googleSub),
      google_email: asLowerText(item.googleEmail),
      raw: item || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((row) => row.id);
}

function buildRegistrationRows(sourceRows) {
  return sourceRows
    .map((item) => ({
      id: asText(item.id),
      event_id: asText(item.eventId),
      student_id: asText(item.studentId),
      user_name: asText(item.userName),
      user_email: asLowerText(item.userEmail),
      user_phone: asText(item.userPhone),
      class_year: asText(item.classYear),
      custom_fields: asJson(item.customFields, {}),
      status: asText(item.status),
      created_at: asText(item.createdAt),
      updated_at: asText(item.updatedAt),
      manual_created_by: asText(item.manualCreatedBy),
      manual_created_by_name: asText(item.manualCreatedByName),
      manual_created_at: asText(item.manualCreatedAt),
      raw: item || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((row) => row.id);
}

function buildCheckinRows(sourceRows) {
  return sourceRows
    .map((item) => ({
      id: asText(item.id),
      event_id: asText(item.eventId),
      registration_id: asText(item.registrationId),
      checkin_at: asText(item.checkinAt),
      checkin_method: asText(item.checkinMethod),
      raw: item || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((row) => row.id);
}

function buildDirectoryRows(sourceRows) {
  return sourceRows
    .map((item) => ({
      id: asText(item.id),
      group_id: asText(item.group),
      email: asLowerText(item.email),
      name_zh: asText(item.nameZh),
      name_en: asText(item.nameEn),
      preferred_name: asText(item.preferredName),
      company: asText(item.company),
      title: asText(item.title),
      social_url: asText(item.socialUrl),
      mobile: asText(item.mobile),
      backup_phone: asText(item.backupPhone),
      emergency_contact: asText(item.emergencyContact),
      emergency_phone: asText(item.emergencyPhone),
      dietary_restrictions: asText(item.dietaryRestrictions),
      photo_url: asText(item.photoUrl),
      birthday_month: asText(item.birthdayMonth),
      birthday_day: asText(item.birthdayDay),
      raw: item || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((row) => row.id);
}

function buildGroupMembershipRows(sourceRows) {
  return sourceRows
    .map((item) => ({
      id: asText(item.id),
      person_id: asText(item.personId),
      person_name: asText(item.personName),
      group_id: asText(item.groupId),
      role_in_group: asText(item.roleInGroup),
      notes: asText(item.notes),
      created_at: asText(item.createdAt),
      updated_at: asText(item.updatedAt),
      raw: item || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((row) => row.id);
}

const TABLE_SYNC_MAP = [
  { key: "events", table: "events", buildRows: buildEventRows },
  { key: "students", table: "students", buildRows: buildStudentRows },
  { key: "registrations", table: "registrations", buildRows: buildRegistrationRows },
  { key: "checkins", table: "checkins", buildRows: buildCheckinRows },
  { key: "directory", table: "directories", buildRows: buildDirectoryRows },
  { key: "groupMemberships", table: "group_memberships", buildRows: buildGroupMembershipRows },
];

export async function syncFromAppsScript() {
  const runStart = await query(
    "INSERT INTO sync_runs (status, summary) VALUES ('running', '{}'::jsonb) RETURNING id"
  );
  const runId = runStart.rows[0].id;

  try {
    const snapshot = await callAppsScript("syncPullSnapshot");

    const tablePayloads = TABLE_SYNC_MAP.map((item) => {
      const sourceRows = Array.isArray(snapshot[item.key]) ? snapshot[item.key] : [];
      return {
        key: item.key,
        table: item.table,
        rows: item.buildRows(sourceRows),
        sourceCount: sourceRows.length,
      };
    });

    await withTransaction(async (client) => {
      for (const payload of tablePayloads) {
        await replaceTableRows(client, payload.table, payload.rows);
      }
    });

    const summary = {
      pulledAt: snapshot.pulledAt || new Date().toISOString(),
      tables: tablePayloads.map((item) => ({
        key: item.key,
        sourceCount: item.sourceCount,
        storedCount: item.rows.length,
      })),
    };

    await query(
      "UPDATE sync_runs SET finished_at = now(), status = 'success', summary = $2::jsonb WHERE id = $1",
      [runId, JSON.stringify(summary)]
    );

    return {
      runId,
      summary,
    };
  } catch (error) {
    await query(
      "UPDATE sync_runs SET finished_at = now(), status = 'failed', error = $2 WHERE id = $1",
      [runId, String(error && error.message ? error.message : error)]
    );
    throw error;
  }
}
