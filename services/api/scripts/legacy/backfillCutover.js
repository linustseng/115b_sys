import { getConfig } from "../../src/config.js";
import { query, withTransaction, closePool } from "../../src/db.js";

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

function qid(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error(`Unsafe table name: ${name}`);
  return `"${name}"`;
}

async function replaceRows(client, tableName, rows) {
  await client.query(`TRUNCATE TABLE ${qid(tableName)}`);
  if (!rows.length) return;
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((c) => {
      const v = row[c];
      if (["raw", "attachments", "group_ids", "items", "response", "positions"].includes(c)) {
        const safe = toJsonSafe(
          v,
          c === "response" || c === "items" || c === "attachments" || c === "group_ids" || c === "positions" ? [] : {}
        );
        return JSON.stringify(safe);
      }
      return v;
    });
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(",");
    const sql = `INSERT INTO ${qid(tableName)} (${columns.map((c) => qid(c)).join(",")}) VALUES (${placeholders})`;
    try {
      await client.query(sql, values);
    } catch (error) {
      console.error(`[backfill] insert failed table=${tableName} id=${row.id || "(no-id)"} error=${error.message}`);
      throw error;
    }
  }
}

function dedupeRowsById(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = asText(row && row.id);
    if (!id) continue;
    map.set(id, row);
  }
  return Array.from(map.values());
}

async function run() {
  console.log("[backfill] start");
  const [
    financeRequestsData,
    financeRolesData,
    financeCategoryTypesData,
    fundEventsData,
    fundPaymentsData,
    orderPlansData,
    softballPlayersData,
    softballPracticesData,
    softballFieldsData,
    softballGearData,
    softballConfigData,
    softballAttendanceData,
  ] = await Promise.all([
    callAppsScript("listFinanceRequests"),
    callAppsScript("listFinanceRoles"),
    callAppsScript("listFinanceCategoryTypes"),
    callAppsScript("listFundEvents"),
    callAppsScript("listFundPayments"),
    callAppsScript("listOrderPlans"),
    callAppsScript("listSoftballPlayers"),
    callAppsScript("listSoftballPractices"),
    callAppsScript("listSoftballFields"),
    callAppsScript("listSoftballGear"),
    callAppsScript("listSoftballConfig"),
    callAppsScript("listSoftballAttendance"),
  ]);

  const requests = Array.isArray(financeRequestsData.requests) ? financeRequestsData.requests : [];
  const financeActionsRaw = [];
  for (const req of requests) {
    const requestId = asText(req && req.id);
    if (!requestId) continue;
    try {
      const data = await callAppsScript("listFinanceActions", { requestId });
      const list = Array.isArray(data.actions) ? data.actions : [];
      for (const item of list) financeActionsRaw.push(item);
    } catch (error) {
      console.warn(`[backfill] listFinanceActions failed for ${requestId}: ${error.message}`);
    }
  }

  const plans = Array.isArray(orderPlansData.plans) ? orderPlansData.plans : [];
  const orderResponses = [];
  for (const plan of plans) {
    const orderId = asText(plan && (plan.id || plan.orderId));
    if (!orderId) continue;
    try {
      const data = await callAppsScript("listOrderResponses", { orderId });
      const list = Array.isArray(data.responses) ? data.responses : [];
      for (const item of list) orderResponses.push(item);
    } catch (error) {
      console.warn(`[backfill] listOrderResponses failed for ${orderId}: ${error.message}`);
    }
  }

  const financeRequests = requests
    .map((r) => ({
      id: asText(r.id),
      type: asText(r.type),
      title: asText(r.title),
      description: asText(r.description),
      category_type: asText(r.categoryType),
      amount_estimated: asNum(r.amountEstimated),
      amount_actual: asNum(r.amountActual),
      currency: asText(r.currency),
      payment_method: asText(r.paymentMethod),
      vendor_name: asText(r.vendorName),
      payee_name: asText(r.payeeName),
      payee_bank: asText(r.payeeBank),
      payee_account: asText(r.payeeAccount),
      related_purchase_id: asText(r.relatedPurchaseId),
      no_purchase_reason: asText(r.noPurchaseReason),
      expected_clear_date: asText(r.expectedClearDate),
      attachments: asArr(r.attachments),
      status: asText(r.status),
      applicant_id: asText(r.applicantId),
      applicant_name: asText(r.applicantName),
      applicant_department: asText(r.applicantDepartment),
      created_at: asText(r.createdAt),
      updated_at: asText(r.updatedAt),
      raw: r || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((r) => r.id);

  const financeActions = financeActionsRaw
    .map((a) => ({
      id: asText(a.id),
      request_id: asText(a.requestId),
      actor_id: asText(a.actorId),
      actor_name: asText(a.actorName),
      action_type: asText(a.actionType),
      from_status: asText(a.fromStatus),
      to_status: asText(a.toStatus),
      notes: asText(a.notes),
      created_at: asText(a.createdAt),
      raw: a || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((a) => a.id);

  const financeRoles = (Array.isArray(financeRolesData.roles) ? financeRolesData.roles : [])
    .map((r) => ({
      id: asText(r.id),
      role: asText(r.role),
      student_id: asText(r.studentId),
      student_name: asText(r.studentName),
      group_ids: asArr(r.groupIds),
      raw: r || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((r) => r.id);

  const financeCategoryTypes = (Array.isArray(financeCategoryTypesData.categoryTypes)
    ? financeCategoryTypesData.categoryTypes
    : []
  )
    .map((c) => ({
      id: asText(c.id),
      label: asText(c.label),
      notes: asText(c.notes),
      raw: c || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((c) => c.id);

  const fundEvents = (Array.isArray(fundEventsData.events) ? fundEventsData.events : [])
    .map((e) => ({
      id: asText(e.id),
      title: asText(e.title),
      description: asText(e.description),
      due_date: asText(e.dueDate),
      amount_general: asNum(e.amountGeneral),
      amount_sponsor: asNum(e.amountSponsor),
      expected_general_count: asInt(e.expectedGeneralCount),
      expected_sponsor_count: asInt(e.expectedSponsorCount),
      status: asText(e.status),
      notes: asText(e.notes),
      raw: e || {},
      created_at: asText(e.createdAt),
      updated_at: asText(e.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((e) => e.id);

  const fundPayments = (Array.isArray(fundPaymentsData.payments) ? fundPaymentsData.payments : [])
    .map((p) => ({
      id: asText(p.id),
      event_id: asText(p.eventId),
      payer_id: asText(p.payerId),
      payer_name: asText(p.payerName),
      payer_email: asEmail(p.payerEmail),
      payer_type: asText(p.payerType),
      amount: asNum(p.amount),
      method: asText(p.method),
      transfer_last5: asText(p.transferLast5),
      received_at: asText(p.receivedAt),
      accounted_at: asText(p.accountedAt),
      confirmed_at: asText(p.confirmedAt),
      notes: asText(p.notes),
      raw: p || {},
      created_at: asText(p.createdAt),
      updated_at: asText(p.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((p) => p.id);

  const orderPlanRows = plans
    .map((p) => ({
      id: asText(p.id),
      date: asText(p.date),
      title: asText(p.title),
      description: asText(p.description),
      close_at: asText(p.closeAt),
      vendor: asText(p.vendor),
      items: asArr(p.items),
      status: asText(p.status),
      raw: p || {},
      created_at: asText(p.createdAt),
      updated_at: asText(p.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((p) => p.id);

  const orderResponseRows = orderResponses
    .map((r) => ({
      id: asText(r.id),
      order_id: asText(r.orderId),
      student_id: asText(r.studentId),
      student_name: asText(r.studentName),
      student_email: asEmail(r.studentEmail),
      response: asObj(r.response || r),
      total_amount: asNum(r.totalAmount),
      created_at: asText(r.createdAt),
      updated_at: asText(r.updatedAt),
      raw: r || {},
      synced_at: new Date().toISOString(),
    }))
    .filter((r) => r.id);

  const softballPlayers = (Array.isArray(softballPlayersData.players) ? softballPlayersData.players : [])
    .map((p) => ({
      id: asText(p.id),
      name: asText(p.name),
      email: asEmail(p.email),
      phone: asText(p.phone),
      jersey_no: asText(p.jerseyNo || p.jerseyNumber),
      jersey_size: asText(p.jerseySize),
      positions: asArr(p.positions),
      raw: p || {},
      created_at: asText(p.createdAt),
      updated_at: asText(p.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((p) => p.id);

  const softballPractices = (Array.isArray(softballPracticesData.practices) ? softballPracticesData.practices : [])
    .map((p) => ({
      id: asText(p.id),
      date: asText(p.date),
      title: asText(p.title),
      location: asText(p.location),
      start_at: asText(p.startAt),
      end_at: asText(p.endAt),
      notes: asText(p.notes),
      raw: p || {},
      created_at: asText(p.createdAt),
      updated_at: asText(p.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((p) => p.id);

  const softballFields = (Array.isArray(softballFieldsData.fields) ? softballFieldsData.fields : [])
    .map((f) => ({
      id: asText(f.id),
      name: asText(f.name),
      address: asText(f.address),
      map_url: asText(f.mapUrl || f.map_url),
      raw: f || {},
      created_at: asText(f.createdAt),
      updated_at: asText(f.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((f) => f.id);

  const softballGear = (Array.isArray(softballGearData.gear) ? softballGearData.gear : [])
    .map((g) => ({
      id: asText(g.id),
      name: asText(g.name),
      notes: asText(g.notes),
      raw: g || {},
      created_at: asText(g.createdAt),
      updated_at: asText(g.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((g) => g.id);

  const softballAttendance = (Array.isArray(softballAttendanceData.attendance)
    ? softballAttendanceData.attendance
    : []
  )
    .map((a) => ({
      id: asText(a.id) || `${asText(a.practiceId)}:${asText(a.playerId || a.studentId)}`,
      practice_id: asText(a.practiceId),
      player_id: asText(a.playerId || a.studentId),
      status: asText(a.status),
      notes: asText(a.notes || a.note),
      raw: a || {},
      created_at: asText(a.createdAt),
      updated_at: asText(a.updatedAt),
      synced_at: new Date().toISOString(),
    }))
    .filter((a) => a.id && a.practice_id && a.player_id);

  const softballConfig = asObj(softballConfigData.config);

  await withTransaction(async (client) => {
    await replaceRows(client, "finance_requests", dedupeRowsById(financeRequests));
    await replaceRows(client, "finance_actions", dedupeRowsById(financeActions));
    await replaceRows(client, "finance_roles", dedupeRowsById(financeRoles));
    await replaceRows(client, "finance_category_types", dedupeRowsById(financeCategoryTypes));

    await replaceRows(client, "fund_events", dedupeRowsById(fundEvents));
    await replaceRows(client, "fund_payments", dedupeRowsById(fundPayments));

    await replaceRows(client, "order_plans", dedupeRowsById(orderPlanRows));
    await replaceRows(client, "order_responses", dedupeRowsById(orderResponseRows));

    await replaceRows(client, "softball_players", dedupeRowsById(softballPlayers));
    await replaceRows(client, "softball_practices", dedupeRowsById(softballPractices));
    await replaceRows(client, "softball_fields", dedupeRowsById(softballFields));
    await replaceRows(client, "softball_gear", dedupeRowsById(softballGear));
    await replaceRows(client, "softball_attendance", dedupeRowsById(softballAttendance));

    await client.query(`TRUNCATE TABLE softball_config`);
    await client.query(
      `insert into softball_config (id, raw, updated_at, synced_at) values ('singleton',$1,$2,now())`,
      [JSON.stringify(toJsonSafe(softballConfig, {})), new Date().toISOString()]
    );
  });

  console.log("[backfill] done", {
    financeRequests: financeRequests.length,
    financeActions: financeActions.length,
    financeRoles: financeRoles.length,
    financeCategoryTypes: financeCategoryTypes.length,
    fundEvents: fundEvents.length,
    fundPayments: fundPayments.length,
    orderPlans: orderPlanRows.length,
    orderResponses: orderResponseRows.length,
    softballPlayers: softballPlayers.length,
    softballPractices: softballPractices.length,
    softballFields: softballFields.length,
    softballGear: softballGear.length,
    softballAttendance: softballAttendance.length,
  });
}

run()
  .catch((error) => {
    console.error("[backfill] failed", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
