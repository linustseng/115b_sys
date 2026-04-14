import crypto from "node:crypto";
import {
  ACADEMICS_PARSER_VERSION,
  buildGeneratedThursdaySessionFromId,
  buildGeneratedThursdaySessions,
  loadAcademicSessionsFromIcs,
  mapAcademicSessionRow,
  mapMakeupRequestRow,
  mapSessionNoteRow,
} from "./academics.js";
import { jsonbParam } from "./jsonb.js";
import {
  claimAttachments,
  createSignedReadUrlForAttachment,
  extractAttachmentIds,
  hydrateAttachmentItems,
  normalizeAttachmentItems,
} from "./attachments.js";
import { applyVersionedMutation } from "./versioning.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function firstText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback || "").trim();
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const text = String(value == null ? "" : value).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeJsonObject(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapDirectoryProfile(row) {
  if (!row) {
    return null;
  }
  const preferredName = String(row.preferred_name || "").trim();
  const mobile = String(row.mobile || "").trim();
  return {
    id: String(row.id || "").trim(),
    email: normalizeEmail(row.email || ""),
    nameZh: String(row.name_zh || "").trim(),
    nameEn: String(row.name_en || "").trim(),
    preferredName,
    // Alias for old/new frontend compatibility.
    displayName: preferredName,
    company: String(row.company || "").trim(),
    title: String(row.title || "").trim(),
    mobile,
    // Alias for old/new frontend compatibility.
    phone: mobile,
    backupPhone: String(row.backup_phone || "").trim(),
    emergencyContact: String(row.emergency_contact || "").trim(),
    emergencyPhone: String(row.emergency_phone || "").trim(),
    dietaryRestrictions: String(row.dietary_restrictions || "").trim(),
    birthdayMonth: String(row.birthday_month || "").trim(),
    birthdayDay: String(row.birthday_day || "").trim(),
    group: String(row.group_id || "").trim(),
    photoUrl: String(row.photo_url || "").trim(),
  };
}

function mapFinanceRoleRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  const role = firstText(raw.role, row && row.role ? row.role : "");
  const personId = firstText(raw.personId, firstText(raw.studentId, row && row.student_id ? row.student_id : ""));
  const personName = firstText(raw.personName, firstText(raw.studentName, row && row.student_name ? row.student_name : ""));
  const personEmail = normalizeEmail(
    firstText(raw.personEmail, firstText(raw.studentEmail, row && row.person_email ? row.person_email : ""))
  );
  const groupIds = Array.isArray(raw.groupIds)
    ? raw.groupIds
    : Array.isArray(row && row.group_ids)
    ? row.group_ids
    : safeJsonArray(row && row.group_ids);
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    role,
    personId,
    studentId: personId,
    personName,
    studentName: personName,
    personEmail,
    studentEmail: personEmail,
    groupIds,
  };
}

function mapFundEventRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  const id = firstText(row && row.id ? row.id : raw.id);
  return {
    ...raw,
    id,
    title: firstText(raw.title, row && row.title ? row.title : ""),
    description: firstText(raw.description, row && row.description ? row.description : ""),
    dueDate: firstText(raw.dueDate, row && row.due_date ? row.due_date : ""),
    amountGeneral:
      raw.amountGeneral != null && raw.amountGeneral !== ""
        ? raw.amountGeneral
        : row && row.amount_general != null
        ? row.amount_general
        : "",
    amountSponsor:
      raw.amountSponsor != null && raw.amountSponsor !== ""
        ? raw.amountSponsor
        : row && row.amount_sponsor != null
        ? row.amount_sponsor
        : "",
    expectedGeneralCount:
      raw.expectedGeneralCount != null && raw.expectedGeneralCount !== ""
        ? raw.expectedGeneralCount
        : row && row.expected_general_count != null
        ? row.expected_general_count
        : "",
    expectedSponsorCount:
      raw.expectedSponsorCount != null && raw.expectedSponsorCount !== ""
        ? raw.expectedSponsorCount
        : row && row.expected_sponsor_count != null
        ? row.expected_sponsor_count
        : "",
    status: firstText(raw.status, row && row.status ? row.status : ""),
    notes: firstText(raw.notes, row && row.notes ? row.notes : ""),
  };
}

function mapFundPaymentRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    eventId: firstText(raw.eventId, row && row.event_id ? row.event_id : ""),
    payerId: firstText(raw.payerId, row && row.payer_id ? row.payer_id : ""),
    payerName: firstText(raw.payerName, row && row.payer_name ? row.payer_name : ""),
    payerEmail: firstText(raw.payerEmail, row && row.payer_email ? row.payer_email : ""),
    payerType: firstText(raw.payerType, row && row.payer_type ? row.payer_type : ""),
    amount:
      raw.amount != null && raw.amount !== ""
        ? raw.amount
        : row && row.amount != null
        ? row.amount
        : "",
    method: firstText(raw.method, row && row.method ? row.method : ""),
    transferLast5: firstText(raw.transferLast5, row && row.transfer_last5 ? row.transfer_last5 : ""),
    receivedAt: firstText(raw.receivedAt, row && row.received_at ? row.received_at : ""),
    accountedAt: firstText(raw.accountedAt, row && row.accounted_at ? row.accounted_at : ""),
    confirmedAt: firstText(raw.confirmedAt, row && row.confirmed_at ? row.confirmed_at : ""),
    notes: firstText(raw.notes, row && row.notes ? row.notes : ""),
  };
}

function canAccessByGroups(memberships, allowedGroupIds = []) {
  const list = asArray(memberships);
  return list.some((item) => {
    const groupId = String(item.groupId || item.group_id || "").trim();
    const role = String(item.roleInGroup || item.role_in_group || "").trim();
    if (allowedGroupIds.includes(groupId)) {
      return true;
    }
    // A(班代) lead/deputy counts as admin for most backoffice.
    if (groupId === "A" && (role === "lead" || role === "deputy")) {
      return true;
    }
    return false;
  });
}

function toFinanceRequestRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    type: firstText(raw.type),
    title: firstText(raw.title),
    description: firstText(raw.description),
    categoryType: firstText(raw.categoryType),
    amountEstimated: raw.amountEstimated == null || raw.amountEstimated === "" ? null : Number(String(raw.amountEstimated).replace(/,/g, "")),
    amountActual: raw.amountActual == null || raw.amountActual === "" ? null : Number(String(raw.amountActual).replace(/,/g, "")),
    currency: firstText(raw.currency, "TWD"),
    paymentMethod: firstText(raw.paymentMethod),
    vendorName: firstText(raw.vendorName),
    payeeName: firstText(raw.payeeName),
    payeeBank: firstText(raw.payeeBankCode, raw.payeeBank),
    payeeAccount: firstText(raw.payeeAccount),
    relatedPurchaseId: firstText(raw.relatedPurchaseId),
    noPurchaseReason: firstText(raw.noPurchaseReason),
    expectedClearDate: firstText(raw.expectedClearDate),
    attachments: raw.attachments && Array.isArray(raw.attachments) ? raw.attachments : safeJsonArray(raw.attachments),
    status: firstText(raw.status, "draft"),
    applicantId: firstText(raw.applicantId),
    applicantName: firstText(raw.applicantName),
    applicantDepartment: firstText(raw.applicantDepartment),
    createdAt,
    updatedAt,
    raw,
  };
}

function normalizeFinanceRequestRowForClient_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id, raw.id),
    type: firstText(raw.type, row && row.type),
    title: firstText(raw.title, row && row.title),
    description: firstText(raw.description, row && row.description),
    categoryType: firstText(raw.categoryType, row && row.category_type),
    amountEstimated:
      raw.amountEstimated != null && raw.amountEstimated !== ""
        ? raw.amountEstimated
        : row && row.amount_estimated != null
        ? row.amount_estimated
        : "",
    amountActual:
      raw.amountActual != null && raw.amountActual !== ""
        ? raw.amountActual
        : row && row.amount_actual != null
        ? row.amount_actual
        : "",
    currency: firstText(raw.currency, row && row.currency, "TWD"),
    paymentMethod: firstText(raw.paymentMethod, row && row.payment_method),
    vendorName: firstText(raw.vendorName, row && row.vendor_name),
    payeeName: firstText(raw.payeeName, row && row.payee_name),
    payeeBank: firstText(raw.payeeBank, row && row.payee_bank),
    payeeBankCode: firstText(raw.payeeBankCode, raw.payeeBank, row && row.payee_bank),
    payeeAccount: firstText(raw.payeeAccount, row && row.payee_account),
    relatedPurchaseId: firstText(raw.relatedPurchaseId, row && row.related_purchase_id),
    noPurchaseReason: firstText(raw.noPurchaseReason, row && row.no_purchase_reason),
    expectedClearDate: firstText(raw.expectedClearDate, row && row.expected_clear_date),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : safeJsonArray(row && row.attachments),
    status: firstText(raw.status, row && row.status),
    applicantId: firstText(raw.applicantId, row && row.applicant_id),
    applicantName: firstText(raw.applicantName, row && row.applicant_name),
    applicantRole: firstText(raw.applicantRole),
    applicantDepartment: firstText(raw.applicantDepartment, row && row.applicant_department),
    applicantEmail: normalizeEmail(firstText(raw.applicantEmail)),
    workflowCreatedByRole: firstText(raw.workflowCreatedByRole),
    manualCreatedBy: firstText(raw.manualCreatedBy),
    manualCreatedByName: firstText(raw.manualCreatedByName),
    manualCreatedAt: firstText(raw.manualCreatedAt),
    submittedAt: firstText(raw.submittedAt),
    createdAt: firstText(raw.createdAt, row && row.created_at),
    updatedAt: firstText(raw.updatedAt, row && row.updated_at),
    revisionNo: Number((row && row.revision_no) || raw.revisionNo || 0) || 0,
    lastChangeBatchId: firstText(row && row.last_change_batch_id, raw.lastChangeBatchId),
    lastChangedAt: asIsoText_(row && row.last_changed_at, raw.lastChangedAt),
    lastChangedBy: firstText(row && row.last_changed_by, raw.lastChangedBy),
    lastChangedByName: firstText(row && row.last_changed_by_name, raw.lastChangedByName),
  };
}

function buildFinanceRequestRowFromSnapshot_(snapshot = {}, currentRow = null, nextRevision = 1, batchId = "", actor = null) {
  const currentSnapshot = currentRow ? normalizeFinanceRequestRowForClient_(currentRow) : {};
  const raw = safeJsonObject(snapshot);
  const updatedAt = nowIso();
  const createdAt = firstNonEmptyText(currentSnapshot.createdAt, raw.createdAt, snapshot.createdAt, updatedAt);
  const applicantEmail = normalizeEmail(firstText(raw.applicantEmail, currentSnapshot.applicantEmail));
  return {
    id: firstText(snapshot.id, currentRow && currentRow.id),
    type: firstText(snapshot.type, currentSnapshot.type),
    title: firstText(snapshot.title, currentSnapshot.title),
    description: firstText(snapshot.description, currentSnapshot.description),
    categoryType: firstText(snapshot.categoryType, currentSnapshot.categoryType),
    amountEstimated:
      snapshot.amountEstimated == null || snapshot.amountEstimated === ""
        ? currentSnapshot.amountEstimated == null || currentSnapshot.amountEstimated === ""
          ? null
          : Number(String(currentSnapshot.amountEstimated).replace(/,/g, ""))
        : Number(String(snapshot.amountEstimated).replace(/,/g, "")),
    amountActual:
      snapshot.amountActual == null || snapshot.amountActual === ""
        ? currentSnapshot.amountActual == null || currentSnapshot.amountActual === ""
          ? null
          : Number(String(currentSnapshot.amountActual).replace(/,/g, ""))
        : Number(String(snapshot.amountActual).replace(/,/g, "")),
    currency: firstNonEmptyText(snapshot.currency, currentSnapshot.currency, "TWD"),
    paymentMethod: firstText(snapshot.paymentMethod, currentSnapshot.paymentMethod),
    vendorName: firstText(snapshot.vendorName, currentSnapshot.vendorName),
    payeeName: firstText(snapshot.payeeName, currentSnapshot.payeeName),
    payeeBank: firstNonEmptyText(snapshot.payeeBankCode, snapshot.payeeBank, currentSnapshot.payeeBankCode, currentSnapshot.payeeBank),
    payeeAccount: firstText(snapshot.payeeAccount, currentSnapshot.payeeAccount),
    relatedPurchaseId: firstText(snapshot.relatedPurchaseId, currentSnapshot.relatedPurchaseId),
    noPurchaseReason: firstText(snapshot.noPurchaseReason, currentSnapshot.noPurchaseReason),
    expectedClearDate: firstText(snapshot.expectedClearDate, currentSnapshot.expectedClearDate),
    attachments: Array.isArray(snapshot.attachments) ? snapshot.attachments : safeJsonArray(snapshot.attachments || currentSnapshot.attachments),
    status: firstNonEmptyText(snapshot.status, currentSnapshot.status, "draft"),
    applicantId: firstText(snapshot.applicantId, currentSnapshot.applicantId),
    applicantName: firstText(snapshot.applicantName, currentSnapshot.applicantName),
    applicantDepartment: firstText(snapshot.applicantDepartment, currentSnapshot.applicantDepartment),
    createdAt,
    updatedAt,
    revisionNo: nextRevision,
    lastChangeBatchId: batchId,
    lastChangedBy: firstText(actor && actor.actorId),
    lastChangedByName: firstText(actor && actor.actorName),
    raw: {
      ...currentSnapshot,
      ...raw,
      id: firstText(snapshot.id, currentRow && currentRow.id),
      applicantEmail,
      createdAt,
      updatedAt,
      revisionNo: nextRevision,
      lastChangeBatchId: batchId,
      lastChangedAt: updatedAt,
      lastChangedBy: firstText(actor && actor.actorId),
      lastChangedByName: firstText(actor && actor.actorName),
    },
  };
}

function toOrderPlanRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    date: firstText(raw.date),
    title: firstText(raw.title),
    description: firstText(raw.description),
    closeAt: firstText(raw.closeAt),
    vendor: firstText(raw.vendor),
    items: raw.items && Array.isArray(raw.items) ? raw.items : safeJsonArray(raw.items),
    status: firstText(raw.status),
    createdAt,
    updatedAt,
    raw,
  };
}

function asIsoText_(value, fallback = "") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return firstText(value, fallback);
}

function normalizeOrderingPublicLinkRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id, raw.id),
    orderPlanId: firstText(row && row.order_plan_id, raw.orderPlanId),
    token: firstText(row && row.token, raw.token),
    title: firstText(row && row.title, raw.title),
    description: firstText(row && row.description, raw.description),
    closeAt: firstText(row && row.close_at, raw.closeAt),
    status: firstText(row && row.status, raw.status || "active"),
    createdAt: firstText(row && row.created_at, raw.createdAt),
    updatedAt: firstText(row && row.updated_at, raw.updatedAt),
    revisionNo: row && row.revision_no != null ? Number(row.revision_no) || 1 : 1,
    lastChangeBatchId: firstText(row && row.last_change_batch_id, raw.lastChangeBatchId),
    lastChangedAt: asIsoText_(row && row.last_changed_at, raw.lastChangedAt),
    lastChangedBy: firstText(row && row.last_changed_by, raw.lastChangedBy),
    lastChangedByName: firstText(row && row.last_changed_by_name, raw.lastChangedByName),
  };
}

function generateOrderingPublicToken_() {
  return crypto.randomBytes(18).toString("base64url");
}

function diffSnapshotsForAudit_(beforeSnapshot = {}, afterSnapshot = {}) {
  const before = beforeSnapshot && typeof beforeSnapshot === "object" ? beforeSnapshot : {};
  const after = afterSnapshot && typeof afterSnapshot === "object" ? afterSnapshot : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort((a, b) => a.localeCompare(b, "en"));
  const changedFields = [];
  const diff = {};
  for (const key of keys) {
    const beforeValue = JSON.stringify(before[key] ?? null);
    const afterValue = JSON.stringify(after[key] ?? null);
    if (beforeValue === afterValue) {
      continue;
    }
    changedFields.push(key);
    diff[key] = {
      before: before[key] ?? null,
      after: after[key] ?? null,
    };
  }
  return { changedFields, diff };
}

function buildOrderPlanRowFromSnapshot_(snapshot = {}, currentRow = null, nextRevision = 1, batchId = "", actor = null) {
  const raw = safeJsonObject(snapshot);
  const updatedAt = nowIso();
  return {
    id: firstText(snapshot.id, currentRow && currentRow.id),
    date: firstText(snapshot.date),
    title: firstText(snapshot.title),
    description: firstText(snapshot.description),
    closeAt: firstText(snapshot.closeAt),
    vendor: firstText(snapshot.vendor),
    items: Array.isArray(snapshot.items) ? snapshot.items : safeJsonArray(snapshot.items),
    status: firstText(snapshot.status),
    createdAt: firstNonEmptyText(currentRow && currentRow.created_at, snapshot.createdAt, updatedAt),
    updatedAt,
    raw,
    revisionNo: nextRevision,
    lastChangeBatchId: batchId,
    lastChangedBy: firstText(actor && actor.actorId),
    lastChangedByName: firstText(actor && actor.actorName),
  };
}

function buildOrderingPublicLinkRowFromSnapshot_(snapshot = {}, currentRow = null, nextRevision = 1, batchId = "", actor = null) {
  const raw = safeJsonObject(snapshot);
  const updatedAt = nowIso();
  return {
    id: firstText(snapshot.id, currentRow && currentRow.id),
    orderPlanId: firstText(snapshot.orderPlanId, currentRow && currentRow.order_plan_id),
    token: firstNonEmptyText(snapshot.token, currentRow && currentRow.token, generateOrderingPublicToken_()),
    title: firstText(snapshot.title),
    description: firstText(snapshot.description),
    closeAt: firstText(snapshot.closeAt),
    status: firstText(snapshot.status, "active"),
    createdAt: firstNonEmptyText(currentRow && currentRow.created_at, snapshot.createdAt, updatedAt),
    updatedAt,
    raw,
    revisionNo: nextRevision,
    lastChangeBatchId: batchId,
    lastChangedBy: firstText(actor && actor.actorId),
    lastChangedByName: firstText(actor && actor.actorName),
  };
}

function normalizeEventRowForClient_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id, raw.id),
    title: firstText(row && row.title, raw.title),
    description: firstText(row && row.description, raw.description),
    startAt: firstText(row && row.start_at, raw.startAt || raw.start_at),
    endAt: firstText(row && row.end_at, raw.endAt || raw.end_at),
    location: firstText(row && row.location, raw.location),
    address: firstText(row && row.address, raw.address),
    registrationOpenAt: firstText(row && row.registration_open_at, raw.registrationOpenAt || raw.registration_open_at),
    registrationCloseAt: firstText(row && row.registration_close_at, raw.registrationCloseAt || raw.registration_close_at),
    checkinOpenAt: firstText(row && row.checkin_open_at, raw.checkinOpenAt || raw.checkin_open_at),
    checkinCloseAt: firstText(row && row.checkin_close_at, raw.checkinCloseAt || raw.checkin_close_at),
    registerUrl: firstText(row && row.register_url, raw.registerUrl || raw.register_url),
    checkinUrl: firstText(row && row.checkin_url, raw.checkinUrl || raw.checkin_url),
    capacity: row && row.capacity == null ? firstText(raw.capacity) : String(row && row.capacity != null ? row.capacity : ""),
    status: firstText(row && row.status, raw.status),
    category: firstText(row && row.category, raw.category),
    formSchema: row && row.form_schema && typeof row.form_schema === "object" ? row.form_schema : safeJsonObject(raw.formSchema || raw.form_schema),
    revisionNo: Number((row && row.revision_no) || raw.revisionNo || 0) || 0,
    lastChangeBatchId: firstText(row && row.last_change_batch_id, raw.lastChangeBatchId),
    lastChangedAt: asIsoText_(row && row.last_changed_at) || firstText(raw.lastChangedAt),
    lastChangedBy: firstText(row && row.last_changed_by, raw.lastChangedBy),
    lastChangedByName: firstText(row && row.last_changed_by_name, raw.lastChangedByName),
  };
}

function buildEventRowFromSnapshot_(snapshot = {}, currentRow = null, nextRevision = 1, batchId = "", actor = null) {
  const raw = safeJsonObject(snapshot);
  const updatedAt = nowIso();
  const capacityText = firstText(snapshot.capacity, currentRow && currentRow.capacity);
  const createdAt = firstNonEmptyText(raw.createdAt, snapshot.createdAt, updatedAt);
  return {
    id: firstText(snapshot.id, currentRow && currentRow.id),
    title: firstText(snapshot.title),
    description: firstText(snapshot.description),
    startAt: firstText(snapshot.startAt || snapshot.start_at),
    endAt: firstText(snapshot.endAt || snapshot.end_at),
    location: firstText(snapshot.location),
    address: firstText(snapshot.address),
    registrationOpenAt: firstText(snapshot.registrationOpenAt || snapshot.registration_open_at),
    registrationCloseAt: firstText(snapshot.registrationCloseAt || snapshot.registration_close_at),
    checkinOpenAt: firstText(snapshot.checkinOpenAt || snapshot.checkin_open_at),
    checkinCloseAt: firstText(snapshot.checkinCloseAt || snapshot.checkin_close_at),
    registerUrl: firstText(snapshot.registerUrl || snapshot.register_url),
    checkinUrl: firstText(snapshot.checkinUrl || snapshot.checkin_url),
    capacity: capacityText === "" ? null : Number(capacityText),
    status: firstText(snapshot.status),
    category: firstText(snapshot.category),
    formSchema: safeJsonObject(snapshot.formSchema || snapshot.form_schema),
    raw: { ...raw, createdAt, updatedAt },
    revisionNo: nextRevision,
    updatedAt,
    lastChangeBatchId: batchId,
    lastChangedBy: firstText(actor && actor.actorId),
    lastChangedByName: firstText(actor && actor.actorName),
  };
}

function buildOrderPlanForClient_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: row && row.id ? row.id : "",
    date: row && row.date ? row.date : "",
    title: row && row.title ? row.title : "",
    description: row && row.description ? row.description : "",
    closeAt: row && row.close_at ? row.close_at : "",
    vendor: row && row.vendor ? row.vendor : "",
    items: row && Array.isArray(row.items) ? row.items : [],
    status: row && row.status ? row.status : "",
    createdAt: row && row.created_at ? row.created_at : "",
    updatedAt: row && row.updated_at ? row.updated_at : "",
    revisionNo: row && row.revision_no != null ? Number(row.revision_no) || 1 : 1,
    lastChangeBatchId: firstText(row && row.last_change_batch_id, raw.lastChangeBatchId),
    lastChangedAt: asIsoText_(row && row.last_changed_at, raw.lastChangedAt),
    lastChangedBy: firstText(row && row.last_changed_by, raw.lastChangedBy),
    lastChangedByName: firstText(row && row.last_changed_by_name, raw.lastChangedByName),
  };
}

function getOrderChoicesForPlan_(plan) {
  const hasVegetarianChoice = Boolean(
    firstText(plan && plan.optionVegetarian, plan && plan.optionVegetarianImage)
  );
  return [
    { value: "A", label: firstText(plan && plan.optionA, "A 餐"), image: firstText(plan && plan.optionAImage) },
    { value: "B", label: firstText(plan && plan.optionB, "B 餐"), image: firstText(plan && plan.optionBImage) },
    { value: "C", label: firstText(plan && plan.optionC, hasVegetarianChoice ? "C 餐" : "素食餐"), image: firstText(plan && plan.optionCImage) },
    ...(hasVegetarianChoice
      ? [{ value: "VEG", label: firstText(plan && plan.optionVegetarian, "素食餐"), image: firstText(plan && plan.optionVegetarianImage) }]
      : []),
    { value: "NONE", label: "不吃", image: "" },
  ];
}

function isOrderPlanClosed_(plan, overrideCloseAt = "") {
  if (!plan) {
    return true;
  }
  if (firstText(plan.status).toLowerCase() === "closed") {
    return true;
  }

  const now = Date.now();
  const cutoffText = firstText(overrideCloseAt, plan.closeAt, plan.cutoffAt);
  if (cutoffText) {
    const normalized =
      /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(cutoffText)
        ? cutoffText.replace(/\//g, "-").replace(" ", "T")
        : cutoffText;
    const cutoff = new Date(normalized);
    if (!Number.isNaN(cutoff.getTime()) && now > cutoff.getTime()) {
      return true;
    }
  }

  const planDateText = firstText(plan.date);
  if (planDateText) {
    const mealDate = new Date(`${planDateText}T23:59:59+08:00`);
    if (!Number.isNaN(mealDate.getTime()) && now > mealDate.getTime()) {
      return true;
    }
  }

  return false;
}

function normalizeDuplicateKey_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function toFundEventRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    title: firstText(raw.title),
    description: firstText(raw.description),
    dueDate: firstText(raw.dueDate),
    amountGeneral: raw.amountGeneral == null || raw.amountGeneral === "" ? null : Number(String(raw.amountGeneral).replace(/,/g, "")),
    amountSponsor: raw.amountSponsor == null || raw.amountSponsor === "" ? null : Number(String(raw.amountSponsor).replace(/,/g, "")),
    expectedGeneralCount: raw.expectedGeneralCount == null || raw.expectedGeneralCount === "" ? null : Number(raw.expectedGeneralCount),
    expectedSponsorCount: raw.expectedSponsorCount == null || raw.expectedSponsorCount === "" ? null : Number(raw.expectedSponsorCount),
    status: firstText(raw.status),
    notes: firstText(raw.notes),
    createdAt,
    updatedAt,
    raw,
  };
}

function toFundPaymentRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    eventId: firstText(raw.eventId),
    payerId: firstText(raw.payerId),
    payerName: firstText(raw.payerName),
    payerEmail: normalizeEmail(raw.payerEmail),
    payerType: firstText(raw.payerType),
    amount: raw.amount == null || raw.amount === "" ? null : Number(String(raw.amount).replace(/,/g, "")),
    method: firstText(raw.method),
    transferLast5: firstText(raw.transferLast5),
    receivedAt: firstText(raw.receivedAt),
    accountedAt: firstText(raw.accountedAt),
    confirmedAt: firstText(raw.confirmedAt),
    notes: firstText(raw.notes),
    createdAt,
    updatedAt,
    raw,
  };
}

function toSoftballPlayerRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    name: firstText(raw.name),
    email: normalizeEmail(raw.email),
    phone: firstText(raw.phone),
    jerseyNo: firstText(raw.jerseyNo),
    jerseySize: firstText(raw.jerseySize),
    positions: raw.positions && Array.isArray(raw.positions) ? raw.positions : safeJsonArray(raw.positions),
    createdAt,
    updatedAt,
    raw,
  };
}

function toSoftballPracticeRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    date: firstText(raw.date),
    title: firstText(raw.title),
    location: firstText(raw.location),
    startAt: firstText(raw.startAt),
    endAt: firstText(raw.endAt),
    notes: firstText(raw.notes),
    createdAt,
    updatedAt,
    raw,
  };
}

function toSoftballAngelRosterRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    studentId: firstText(raw.studentId, raw.personId),
    status: firstText(raw.status, "active"),
    notes: firstText(raw.notes),
    joinedAt: firstText(raw.joinedAt, createdAt),
    createdAt,
    updatedAt,
    raw,
  };
}

function toSoftballSupplyVendorRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  return {
    id,
    name: firstText(raw.name),
    category: firstText(raw.category),
    phone: firstText(raw.phone),
    contact: firstText(raw.contact),
    deliveryNote: firstText(raw.deliveryNote),
    minOrderAmount:
      raw.minOrderAmount == null || raw.minOrderAmount === "" ? null : Number(String(raw.minOrderAmount).replace(/,/g, "")),
    status: firstText(raw.status, "active"),
    notes: firstText(raw.notes),
    createdAt,
    updatedAt,
    raw,
  };
}

function toSoftballSupplyCaseRow(input) {
  const raw = safeJsonObject(input);
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  const vendorIds = (Array.isArray(raw.vendorIds) ? raw.vendorIds : safeJsonArray(raw.vendorIds))
    .map((value) => firstText(value))
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 3);
  const vendorId = firstText(raw.vendorId, vendorIds[0] || "");
  return {
    id,
    title: firstText(raw.title),
    practiceId: firstText(raw.practiceId),
    angelRosterId: firstText(raw.angelRosterId),
    angelStudentId: firstText(raw.angelStudentId),
    vendorId,
    vendorIds,
    angelStatus: firstText(raw.angelStatus, "unassigned"),
    orderStatus: firstText(raw.orderStatus, "not_started"),
    plannedHeadcount:
      raw.plannedHeadcount == null || raw.plannedHeadcount === "" ? null : Number(raw.plannedHeadcount),
    totalAmount:
      raw.totalAmount == null || raw.totalAmount === "" ? null : Number(String(raw.totalAmount).replace(/,/g, "")),
    orderedAt: firstText(raw.orderedAt),
    notes: firstText(raw.notes),
    raw: {
      ...raw,
      vendorId,
      vendorIds,
      items: Array.isArray(raw.items) ? raw.items : safeJsonArray(raw.items),
    },
    createdAt,
    updatedAt,
  };
}

function rowOrNull(result) {
  return result && result.rows && result.rows.length ? result.rows[0] : null;
}

const ACADEMICS_ALLOWED_GROUPS = ["E", "F"];

function todayDateText_() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysDateText_(dateText, days) {
  const base = new Date(`${String(dateText || "").trim()}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return "";
  }
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

function academicSessionToDbRow_(input) {
  const row = input || {};
  const raw = row.raw && typeof row.raw === "object" ? row.raw : { ...row };
  const now = nowIso();
  return {
    id: firstText(row.id),
    sourceType: firstText(row.sourceType),
    sourceUid: firstText(row.sourceUid),
    sourceRecurrenceId: firstText(row.sourceRecurrenceId),
    classKind: firstText(row.classKind),
    classGroup: firstText(row.classGroup),
    title: firstText(row.title),
    teacher: firstText(row.teacher),
    location: firstText(row.location),
    sessionDate: firstText(row.sessionDate),
    startsAt: firstText(row.startsAt),
    endsAt: firstText(row.endsAt),
    registrationDeadline: firstText(row.registrationDeadline),
    status: firstText(row.status, "published"),
    isVisible: Object.prototype.hasOwnProperty.call(row, "isVisible") ? Boolean(row.isVisible) : true,
    raw: {
      ...raw,
      id: firstText(raw.id, row.id),
      sourceType: firstText(raw.sourceType, row.sourceType),
      sourceUid: firstText(raw.sourceUid, row.sourceUid),
      sourceRecurrenceId: firstText(raw.sourceRecurrenceId, row.sourceRecurrenceId),
      classKind: firstText(raw.classKind, row.classKind),
      classGroup: firstText(raw.classGroup, row.classGroup),
      title: firstText(raw.title, row.title),
      teacher: firstText(raw.teacher, row.teacher),
      location: firstText(raw.location, row.location),
      sessionDate: firstText(raw.sessionDate, row.sessionDate),
      startsAt: firstText(raw.startsAt, row.startsAt),
      endsAt: firstText(raw.endsAt, row.endsAt),
      registrationDeadline: firstText(raw.registrationDeadline, row.registrationDeadline),
      status: firstText(raw.status, row.status || "published"),
      isVisible: Object.prototype.hasOwnProperty.call(raw, "isVisible") ? Boolean(raw.isVisible) : Object.prototype.hasOwnProperty.call(row, "isVisible") ? Boolean(row.isVisible) : true,
    },
    createdAt: firstText(row.createdAt, now),
    updatedAt: firstText(row.updatedAt, now),
  };
}

async function upsertAcademicSession_(query, input) {
  const row = academicSessionToDbRow_(input);
  await query(
    `insert into academic_sessions (
       id, source_type, source_uid, source_recurrence_id,
       class_kind, class_group, title, teacher, location,
       session_date, starts_at, ends_at, registration_deadline,
       status, is_visible, raw, created_at, updated_at
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18
     )
     on conflict (id) do update set
       source_type = excluded.source_type,
       source_uid = excluded.source_uid,
       source_recurrence_id = excluded.source_recurrence_id,
       class_kind = excluded.class_kind,
       class_group = excluded.class_group,
       title = excluded.title,
       teacher = excluded.teacher,
       location = excluded.location,
       session_date = excluded.session_date,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       registration_deadline = excluded.registration_deadline,
       status = excluded.status,
       is_visible = excluded.is_visible,
       raw = excluded.raw,
       updated_at = excluded.updated_at,
       synced_at = now()`,
    [
      row.id,
      row.sourceType,
      row.sourceUid,
      row.sourceRecurrenceId,
      row.classKind,
      row.classGroup,
      row.title,
      row.teacher,
      row.location,
      row.sessionDate,
      row.startsAt,
      row.endsAt,
      row.registrationDeadline,
      row.status,
      row.isVisible,
      jsonbParam(row.raw, {}),
      row.createdAt,
      row.updatedAt,
    ]
  );
  return row;
}

async function loadAcademicSessionsInRange_(query, { fromDate, toDate } = {}) {
  const conditions = [`coalesce(is_visible, true) = true`];
  const values = [];
  if (fromDate) {
    values.push(String(fromDate));
    conditions.push(`coalesce(session_date, '') >= $${values.length}`);
  }
  if (toDate) {
    values.push(String(toDate));
    conditions.push(`coalesce(session_date, '') <= $${values.length}`);
  }
  const result = await query(
    `select * from academic_sessions
     where ${conditions.join(" and ")}
     order by coalesce(session_date,''), coalesce(starts_at,''), id`,
    values
  );
  return result.rows.map((row) => mapAcademicSessionRow(row));
}

async function loadAcademicSessionsByIds_(query, ids = []) {
  const normalizedIds = Array.from(
    new Set((Array.isArray(ids) ? ids : []).map((value) => firstText(value)).filter(Boolean))
  );
  if (!normalizedIds.length) {
    return [];
  }
  const result = await query(
    `select * from academic_sessions where id = any($1::text[]) order by coalesce(session_date,''), coalesce(starts_at,''), id`,
    [normalizedIds]
  );
  const rows = result.rows.map((row) => mapAcademicSessionRow(row));
  const rowIds = new Set(rows.map((item) => item.id));
  normalizedIds.forEach((id) => {
    if (rowIds.has(id)) {
      return;
    }
    const generated = buildGeneratedThursdaySessionFromId(id);
    if (generated) {
      rows.push(generated);
    }
  });
  return rows;
}

async function ensureGeneratedMakeupTargetSession_(query, sessionId) {
  const generated = buildGeneratedThursdaySessionFromId(sessionId);
  if (!generated) {
    return null;
  }
  await upsertAcademicSession_(query, generated);
  const result = await query(`select * from academic_sessions where id = $1 limit 1`, [generated.id]);
  return rowOrNull(result);
}

async function syncAcademicSessionsFromIcs_(query, withTransaction, icsUrl) {
  const url = firstText(icsUrl);
  if (!url) {
    return { configured: false, didSync: false, count: 0 };
  }
  const sessions = await loadAcademicSessionsFromIcs(url, {
    rangeStart: addDaysDateText_(todayDateText_(), -120),
    rangeEnd: addDaysDateText_(todayDateText_(), 365),
  });
  await withTransaction(async (client) => {
    await client.query(`delete from academic_sessions where coalesce(source_type,'') = 'calendar_ics'`);
    for (const item of sessions) {
      await upsertAcademicSession_(client.query.bind(client), item);
    }
  });
  return { configured: true, didSync: true, count: sessions.length };
}

async function getAcademicRegularStats_(query) {
  const row = rowOrNull(
    await query(
      `select
         count(*)::int as total_count,
         count(*) filter (where coalesce(is_visible, true) = true)::int as visible_count
       from academic_sessions
       where coalesce(source_type,'') = 'calendar_ics'
         and coalesce(class_kind,'') = 'regular'`
    )
  );
  return {
    totalCount: Number(row && row.total_count ? row.total_count : 0),
    visibleCount: Number(row && row.visible_count ? row.visible_count : 0),
  };
}

async function getAcademicRegularCount_(query) {
  const stats = await getAcademicRegularStats_(query);
  return stats.visibleCount;
}

async function reconcileAcademicSessionsWithSource_(query, withTransaction) {
  const configuredUrl = firstText(process.env.ACADEMICS_ICS_URL || "");
  if (!configuredUrl) {
    const stats = await getAcademicRegularStats_(query);
    return {
      configured: false,
      sourceCount: null,
      dbCount: stats.visibleCount,
      dbRawCount: stats.totalCount,
      syncedByReconcile: false,
      sourcePreview: [],
      error: null,
    };
  }

  try {
    const parsedRows = await loadAcademicSessionsFromIcs(configuredUrl, {
      rangeStart: addDaysDateText_(todayDateText_(), -120),
      rangeEnd: addDaysDateText_(todayDateText_(), 365),
    });
    const sourcePreview = parsedRows.slice(0, 8).map((row) => ({
      sessionDate: firstText(row && row.sessionDate),
      title: firstText(row && row.title),
      startsAt: firstText(row && row.startsAt),
    }));
    const sourceCount = parsedRows.length;
    const dbStatsBefore = await getAcademicRegularStats_(query);
    const dbCountBefore = dbStatsBefore.visibleCount;
    if (sourceCount > 0 && dbCountBefore !== sourceCount) {
      await syncAcademicSessionsFromIcs_(query, withTransaction, configuredUrl);
      const dbStatsAfter = await getAcademicRegularStats_(query);
      return {
        configured: true,
        sourceCount,
        dbCount: dbStatsAfter.visibleCount,
        dbRawCount: dbStatsAfter.totalCount,
        syncedByReconcile: true,
        sourcePreview,
        error: null,
      };
    }
    return {
      configured: true,
      sourceCount,
      dbCount: dbCountBefore,
      dbRawCount: dbStatsBefore.totalCount,
      syncedByReconcile: false,
      sourcePreview,
      error: null,
    };
  } catch (error) {
    const stats = await getAcademicRegularStats_(query);
    return {
      configured: true,
      sourceCount: null,
      dbCount: stats.visibleCount,
      dbRawCount: stats.totalCount,
      syncedByReconcile: false,
      sourcePreview: [],
      error: String((error && error.message) || error || "unknown error"),
    };
  }
}

async function ensureAcademicSessionsFresh_(query, withTransaction, { force = false } = {}) {
  const configuredUrl = firstText(process.env.ACADEMICS_ICS_URL || "");
  if (!configuredUrl) {
    return { configured: false, didSync: false, count: 0 };
  }
  if (!force) {
    const legacyCheck = rowOrNull(
      await query(
        `select count(*)::int as count
         from academic_sessions
         where coalesce(source_type,'') = 'calendar_ics'
           and (
             coalesce(raw->>'courseGroupTitle','') = ''
             or coalesce(raw->>'courseGroupKey','') = ''
             or coalesce(raw->>'parserVersion','') <> $1
           )`,
        [ACADEMICS_PARSER_VERSION]
      )
    );
    if (Number(legacyCheck && legacyCheck.count ? legacyCheck.count : 0) > 0) {
      return syncAcademicSessionsFromIcs_(query, withTransaction, configuredUrl);
    }

    const healthCheck = rowOrNull(
      await query(
        `select
           count(*)::int as total_count,
           max(synced_at) as latest_synced_at
         from academic_sessions
         where coalesce(source_type,'') = 'calendar_ics'
           and coalesce(is_visible, true) = true`
      )
    );
    const totalCount = Number(healthCheck && healthCheck.total_count ? healthCheck.total_count : 0);
    if (totalCount > 0 && totalCount <= 3) {
      return syncAcademicSessionsFromIcs_(query, withTransaction, configuredUrl);
    }

    const latestSyncedAt = firstText(healthCheck && healthCheck.latest_synced_at ? healthCheck.latest_synced_at : "");
    if (latestSyncedAt) {
      const latestMs = Date.parse(latestSyncedAt);
      if (!Number.isNaN(latestMs) && Date.now() - latestMs < 6 * 60 * 60 * 1000) {
        return { configured: true, didSync: false, count: 0 };
      }
    }
  }
  return syncAcademicSessionsFromIcs_(query, withTransaction, configuredUrl);
}

export async function runAcademicAutoSync({ query, withTransaction, force = false } = {}) {
  if (typeof query !== "function" || typeof withTransaction !== "function") {
    throw new Error("runAcademicAutoSync requires query and withTransaction functions");
  }
  return ensureAcademicSessionsFresh_(query, withTransaction, { force: Boolean(force) });
}

function sessionNoteToDbRow_(input, actor = null) {
  const raw = safeJsonObject(input);
  const linkedActor = actor && typeof actor === "object" ? actor : {};
  const id = firstText(raw.id, crypto.randomUUID());
  const updatedAt = nowIso();
  const createdBy = firstText(raw.createdBy, linkedActor.id || "");
  const createdByName = firstText(
    raw.createdByName,
    linkedActor.preferredName || linkedActor.nameZh || linkedActor.name || ""
  );
  const normalizedStatus = firstText(raw.status, "draft").toLowerCase() === "published" ? "published" : "draft";
  const publishedAt = normalizedStatus === "published" ? firstText(raw.publishedAt, updatedAt) : "";
  const homeworkNotice = firstText(raw.homeworkNotice);
  const quizNotice = firstText(raw.quizNotice);
  return {
    id,
    sessionId: firstText(raw.sessionId),
    title: firstText(raw.title),
    summary: firstText(raw.summary),
    linkUrl: firstText(raw.linkUrl),
    linkLabel: firstText(raw.linkLabel, raw.linkUrl ? "NotebookLM / 筆記連結" : ""),
    homeworkNotice,
    quizNotice,
    status: normalizedStatus,
    publishedAt,
    createdBy,
    createdByName,
    updatedAt,
    raw: {
      ...raw,
      id,
      sessionId: firstText(raw.sessionId),
      title: firstText(raw.title),
      summary: firstText(raw.summary),
      linkUrl: firstText(raw.linkUrl),
      linkLabel: firstText(raw.linkLabel, raw.linkUrl ? "NotebookLM / 筆記連結" : ""),
      homeworkNotice,
      quizNotice,
      status: normalizedStatus,
      publishedAt,
      createdBy,
      createdByName,
      updatedAt,
    },
  };
}

function parseTextLines_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeLegacyLinkItems_(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const items = Array.isArray(source.linkItems)
    ? source.linkItems
        .map((item) => ({
          label: firstText(item && item.label),
          url: firstText(item && item.url),
        }))
        .filter((item) => /^https?:\/\//i.test(item.url))
    : [];
  if (items.length) {
    return items;
  }
  const linkUrl = firstText(source.linkUrl);
  if (!/^https?:\/\//i.test(linkUrl)) {
    return [];
  }
  return [
    {
      label: firstText(source.linkLabel),
      url: linkUrl,
    },
  ];
}

function uniqTextItems_(items = []) {
  return Array.from(new Set((Array.isArray(items) ? items : []).map((item) => firstText(item)).filter(Boolean)));
}

function uniqLinkItems_(items = []) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const label = firstText(item && item.label);
    const url = firstText(item && item.url);
    if (!/^https?:\/\//i.test(url)) {
      return false;
    }
    const key = `${label}::${url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).map((item) => ({
    label: firstText(item && item.label),
    url: firstText(item && item.url),
  }));
}

function mapAcademicCourseRow_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id, raw.id),
    courseKey: firstText(row && row.course_key, raw.courseKey),
    title: firstText(row && row.title, raw.title),
    status: firstText(row && row.status, raw.status || "active"),
    createdAt: firstText(row && row.created_at, raw.createdAt),
    updatedAt: firstText(row && row.updated_at, raw.updatedAt),
  };
}

function mapAcademicCourseSessionRow_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    courseId: firstText(row && row.course_id, raw.courseId),
    sessionId: firstText(row && row.session_id, raw.sessionId),
    createdAt: firstText(row && row.created_at, raw.createdAt),
    updatedAt: firstText(row && row.updated_at, raw.updatedAt),
  };
}

function mapAcademicCourseNoteRow_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id, raw.id),
    courseId: firstText(row && row.course_id, raw.courseId),
    title: firstText(row && row.title, raw.title),
    summary: firstText(row && row.summary, raw.summary),
    linkUrl: firstText(row && row.link_url, raw.linkUrl),
    linkLabel: firstText(row && row.link_label, raw.linkLabel),
    updatedBy: firstText(row && row.updated_by, raw.updatedBy),
    updatedByName: firstText(row && row.updated_by_name, raw.updatedByName),
    updatedAt: firstText(row && row.updated_at, raw.updatedAt),
    summaryItems: uniqTextItems_(Array.isArray(raw.summaryItems) ? raw.summaryItems : parseTextLines_(raw.summary || row && row.summary)),
    linkItems: uniqLinkItems_(normalizeLegacyLinkItems_(raw)),
  };
}

function mapAcademicSessionTaskRow_(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id, raw.id),
    sessionId: firstText(row && row.session_id, raw.sessionId),
    homeworkNotice: firstText(row && row.homework_notice, raw.homeworkNotice),
    quizNotice: firstText(row && row.quiz_notice, raw.quizNotice),
    updatedBy: firstText(row && row.updated_by, raw.updatedBy),
    updatedByName: firstText(row && row.updated_by_name, raw.updatedByName),
    updatedAt: firstText(row && row.updated_at, raw.updatedAt),
    homeworkItems: uniqTextItems_(Array.isArray(raw.homeworkItems) ? raw.homeworkItems : parseTextLines_(raw.homeworkNotice || row && row.homework_notice)),
    quizItems: uniqTextItems_(Array.isArray(raw.quizItems) ? raw.quizItems : parseTextLines_(raw.quizNotice || row && row.quiz_notice)),
  };
}

function academicCourseToDbRow_(input, actor = null) {
  const raw = safeJsonObject(input);
  const linkedActor = actor && typeof actor === "object" ? actor : {};
  const id = firstText(raw.id, crypto.randomUUID());
  const updatedAt = nowIso();
  const updatedBy = firstText(raw.updatedBy, linkedActor.id || "");
  const updatedByName = firstText(raw.updatedByName, linkedActor.preferredName || linkedActor.nameZh || linkedActor.name || "");
  const summaryItems = uniqTextItems_(Array.isArray(raw.summaryItems) ? raw.summaryItems : parseTextLines_(raw.summary));
  const linkItems = uniqLinkItems_(Array.isArray(raw.linkItems) ? raw.linkItems : normalizeLegacyLinkItems_(raw));
  const firstLink = linkItems[0] || null;
  return {
    id,
    courseId: firstText(raw.courseId),
    title: firstText(raw.title),
    summary: firstText(raw.summary),
    linkUrl: firstText(raw.linkUrl, firstLink && firstLink.url),
    linkLabel: firstText(raw.linkLabel, firstLink && firstLink.label ? firstLink.label : raw.linkUrl ? "NotebookLM / 筆記連結" : ""),
    updatedBy,
    updatedByName,
    updatedAt,
    raw: {
      ...raw,
      id,
      courseId: firstText(raw.courseId),
      title: firstText(raw.title),
      summary: firstText(raw.summary),
      linkUrl: firstText(raw.linkUrl, firstLink && firstLink.url),
      linkLabel: firstText(raw.linkLabel, firstLink && firstLink.label ? firstLink.label : raw.linkUrl ? "NotebookLM / 筆記連結" : ""),
      summaryItems,
      linkItems,
      updatedBy,
      updatedByName,
      updatedAt,
    },
  };
}

function academicSessionTaskToDbRow_(input, actor = null) {
  const raw = safeJsonObject(input);
  const linkedActor = actor && typeof actor === "object" ? actor : {};
  const id = firstText(raw.id, crypto.randomUUID());
  const updatedAt = nowIso();
  const updatedBy = firstText(raw.updatedBy, linkedActor.id || "");
  const updatedByName = firstText(raw.updatedByName, linkedActor.preferredName || linkedActor.nameZh || linkedActor.name || "");
  const homeworkItems = uniqTextItems_(Array.isArray(raw.homeworkItems) ? raw.homeworkItems : parseTextLines_(raw.homeworkNotice));
  const quizItems = uniqTextItems_(Array.isArray(raw.quizItems) ? raw.quizItems : parseTextLines_(raw.quizNotice));
  return {
    id,
    sessionId: firstText(raw.sessionId),
    homeworkNotice: firstText(raw.homeworkNotice),
    quizNotice: firstText(raw.quizNotice),
    updatedBy,
    updatedByName,
    updatedAt,
    raw: {
      ...raw,
      id,
      sessionId: firstText(raw.sessionId),
      homeworkNotice: firstText(raw.homeworkNotice),
      quizNotice: firstText(raw.quizNotice),
      homeworkItems,
      quizItems,
      updatedBy,
      updatedByName,
      updatedAt,
    },
  };
}

async function ensureAcademicCourseLayerFresh_(query, sessions = []) {
  const regularSessions = (Array.isArray(sessions) ? sessions : []).filter((session) => firstText(session && session.classKind) === "regular");
  if (!regularSessions.length) {
    return;
  }

  const now = nowIso();
  const courseMap = new Map();
  regularSessions.forEach((session) => {
    const courseKey = firstText(session && session.courseGroupKey, firstText(session && session.courseGroupTitle, firstText(session && session.title)));
    if (!courseKey) {
      return;
    }
    if (!courseMap.has(courseKey)) {
      courseMap.set(courseKey, {
        id: `acad-course:${courseKey}`,
        courseKey,
        title: firstText(session && session.courseGroupTitle, firstText(session && session.title)),
      });
    }
  });

  for (const course of courseMap.values()) {
    await query(
      `insert into academic_courses (id, course_key, title, status, raw, created_at, updated_at)
       values ($1,$2,$3,'active',$4::jsonb,$5,$6)
       on conflict (course_key) do update set
         title = excluded.title,
         raw = academic_courses.raw || excluded.raw,
         updated_at = excluded.updated_at,
         synced_at = now()`,
      [
        course.id,
        course.courseKey,
        course.title,
        jsonbParam({ id: course.id, courseKey: course.courseKey, title: course.title }, {}),
        now,
        now,
      ]
    );
  }

  for (const session of regularSessions) {
    const courseKey = firstText(session && session.courseGroupKey, firstText(session && session.courseGroupTitle, firstText(session && session.title)));
    const course = courseMap.get(courseKey);
    if (!course || !firstText(session && session.id)) {
      continue;
    }
    await query(
      `insert into academic_course_sessions (course_id, session_id, raw, created_at, updated_at)
       values ($1,$2,$3::jsonb,$4,$5)
       on conflict (session_id) do update set
         course_id = excluded.course_id,
         raw = academic_course_sessions.raw || excluded.raw,
         updated_at = excluded.updated_at,
         synced_at = now()`,
      [
        course.id,
        session.id,
        jsonbParam({ courseId: course.id, sessionId: session.id, courseKey }, {}),
        now,
        now,
      ]
    );
  }

  const legacyNoteResult = await query(
    `select n.*, s.class_kind, s.raw as session_raw
       from session_notes n
       join academic_sessions s on s.id = n.session_id
      where coalesce(s.class_kind,'') = 'regular'`
  );
  const existingCourseNotes = new Map(
    (await query(`select * from academic_course_notes`)).rows.map((row) => {
      const item = mapAcademicCourseNoteRow_(row);
      return [item.courseId, item];
    })
  );
  const existingSessionTasks = new Map(
    (await query(`select * from academic_session_tasks`)).rows.map((row) => {
      const item = mapAcademicSessionTaskRow_(row);
      return [item.sessionId, item];
    })
  );

  const courseNoteCandidates = new Map();
  for (const row of legacyNoteResult.rows) {
    const note = mapSessionNoteRow(row);
    const session = regularSessions.find((item) => item.id === note.sessionId);
    if (!session) {
      continue;
    }
    const courseKey = firstText(session.courseGroupKey, firstText(session.courseGroupTitle, firstText(session.title)));
    const course = courseMap.get(courseKey);
    if (!course) {
      continue;
    }
    const raw = safeJsonObject(note.raw);
    const summaryItems = uniqTextItems_(Array.isArray(raw.summaryItems) ? raw.summaryItems : parseTextLines_(note.summary));
    const linkItems = uniqLinkItems_(normalizeLegacyLinkItems_(raw));
    const previous = courseNoteCandidates.get(course.id) || existingCourseNotes.get(course.id) || null;
    const merged = {
      courseId: course.id,
      id: firstText(previous && previous.id, `acad-course-note:${course.id}`),
      title: firstNonEmptyText(note.title, previous && previous.title, course.title),
      summary: firstNonEmptyText(note.summary, previous && previous.summary),
      linkUrl: firstNonEmptyText(note.linkUrl, previous && previous.linkUrl),
      linkLabel: firstNonEmptyText(note.linkLabel, previous && previous.linkLabel),
      summaryItems: uniqTextItems_([...(previous && previous.summaryItems ? previous.summaryItems : []), ...summaryItems]),
      linkItems: uniqLinkItems_([...(previous && previous.linkItems ? previous.linkItems : []), ...linkItems]),
      updatedBy: firstNonEmptyText(note.createdBy, previous && previous.updatedBy),
      updatedByName: firstNonEmptyText(note.createdByName, previous && previous.updatedByName),
      updatedAt: firstNonEmptyText(note.updatedAt, previous && previous.updatedAt, now),
    };
    courseNoteCandidates.set(course.id, merged);

    const homeworkItems = uniqTextItems_(Array.isArray(raw.homeworkItems) ? raw.homeworkItems : parseTextLines_(note.homeworkNotice));
    const quizItems = uniqTextItems_(Array.isArray(raw.quizItems) ? raw.quizItems : parseTextLines_(note.quizNotice));
    if (homeworkItems.length || quizItems.length || firstText(note.homeworkNotice) || firstText(note.quizNotice)) {
      const previousTask = existingSessionTasks.get(note.sessionId) || null;
      existingSessionTasks.set(note.sessionId, {
        sessionId: note.sessionId,
        id: firstText(previousTask && previousTask.id, `acad-session-task:${note.sessionId}`),
        homeworkNotice: firstNonEmptyText(note.homeworkNotice, previousTask && previousTask.homeworkNotice),
        quizNotice: firstNonEmptyText(note.quizNotice, previousTask && previousTask.quizNotice),
        homeworkItems: uniqTextItems_([...(previousTask && previousTask.homeworkItems ? previousTask.homeworkItems : []), ...homeworkItems]),
        quizItems: uniqTextItems_([...(previousTask && previousTask.quizItems ? previousTask.quizItems : []), ...quizItems]),
        updatedBy: firstNonEmptyText(note.createdBy, previousTask && previousTask.updatedBy),
        updatedByName: firstNonEmptyText(note.createdByName, previousTask && previousTask.updatedByName),
        updatedAt: firstNonEmptyText(note.updatedAt, previousTask && previousTask.updatedAt, now),
      });
    }
  }

  for (const candidate of courseNoteCandidates.values()) {
    const row = academicCourseToDbRow_(candidate, null);
    await query(
      `insert into academic_course_notes (
         id, course_id, title, summary, link_url, link_label,
         updated_by, updated_by_name, updated_at, raw
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb
       )
       on conflict (course_id) do update set
         id = excluded.id,
         title = excluded.title,
         summary = excluded.summary,
         link_url = excluded.link_url,
         link_label = excluded.link_label,
         updated_by = excluded.updated_by,
         updated_by_name = excluded.updated_by_name,
         updated_at = excluded.updated_at,
         raw = excluded.raw,
         synced_at = now()`,
      [row.id, row.courseId, row.title, row.summary, row.linkUrl, row.linkLabel, row.updatedBy, row.updatedByName, row.updatedAt, jsonbParam(row.raw, {})]
    );
  }

  for (const task of existingSessionTasks.values()) {
    const row = academicSessionTaskToDbRow_(task, null);
    await query(
      `insert into academic_session_tasks (
         id, session_id, homework_notice, quiz_notice,
         updated_by, updated_by_name, updated_at, raw
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8::jsonb
       )
       on conflict (session_id) do update set
         id = excluded.id,
         homework_notice = excluded.homework_notice,
         quiz_notice = excluded.quiz_notice,
         updated_by = excluded.updated_by,
         updated_by_name = excluded.updated_by_name,
         updated_at = excluded.updated_at,
         raw = excluded.raw,
         synced_at = now()`,
      [row.id, row.sessionId, row.homeworkNotice, row.quizNotice, row.updatedBy, row.updatedByName, row.updatedAt, jsonbParam(row.raw, {})]
    );
  }
}

async function loadAcademicCourseLayer_(query, sessions = [], { includeDraftMakeupNotes = false } = {}) {
  await ensureAcademicCourseLayerFresh_(query, sessions);
  const courses = (await query(`select * from academic_courses order by coalesce(title,''), id`)).rows.map(mapAcademicCourseRow_);
  const courseSessions = (await query(`select * from academic_course_sessions order by coalesce(course_id,''), coalesce(session_id,'')`)).rows.map(mapAcademicCourseSessionRow_);
  const courseNotes = (await query(`select * from academic_course_notes order by coalesce(updated_at,'' ) desc, id desc`)).rows.map(mapAcademicCourseNoteRow_);
  const sessionTasks = (await query(`select * from academic_session_tasks order by coalesce(updated_at,'' ) desc, id desc`)).rows.map(mapAcademicSessionTaskRow_);
  const makeupNotesQuery = includeDraftMakeupNotes
    ? `select n.*, s.class_kind from session_notes n join academic_sessions s on s.id = n.session_id where coalesce(s.class_kind,'') = 'makeup_target' order by coalesce(n.updated_at,'' ) desc, n.id desc`
    : `select n.*, s.class_kind from session_notes n join academic_sessions s on s.id = n.session_id where coalesce(s.class_kind,'') = 'makeup_target' and coalesce(n.status,'draft') = 'published' order by coalesce(n.published_at,'' ) desc, coalesce(n.updated_at,'' ) desc, n.id desc`;
  const makeupNotes = (await query(makeupNotesQuery)).rows.map((row) => mapSessionNoteRow(row));
  return { courses, courseSessions, courseNotes, sessionTasks, makeupNotes };
}

function makeupRequestToDbRow_(input, actor) {
  const raw = safeJsonObject(input);
  const student = actor && typeof actor === "object" ? actor : {};
  const id = firstText(raw.id, crypto.randomUUID());
  const createdAt = firstText(raw.createdAt, nowIso());
  const updatedAt = nowIso();
  const studentName = firstText(student.preferredName, firstText(student.nameZh, student.name || ""));
  return {
    id,
    studentId: firstText(student.id),
    studentName,
    studentEmail: normalizeEmail(firstText(student.email)),
    missedSessionId: firstText(raw.missedSessionId),
    targetSessionId: firstText(raw.targetSessionId),
    needMeal: Boolean(raw.needMeal),
    needHandout: Object.prototype.hasOwnProperty.call(raw, "needHandout") ? Boolean(raw.needHandout) : true,
    reason: firstText(raw.reason),
    note: firstText(raw.note),
    adminNote: firstText(raw.adminNote),
    status: firstText(raw.status, "submitted"),
    createdAt,
    updatedAt,
    cancelledAt: firstText(raw.cancelledAt),
    raw: {
      ...raw,
      id,
      studentId: firstText(student.id),
      studentName,
      studentEmail: normalizeEmail(firstText(student.email)),
      missedSessionId: firstText(raw.missedSessionId),
      targetSessionId: firstText(raw.targetSessionId),
      needMeal: Boolean(raw.needMeal),
      needHandout: Object.prototype.hasOwnProperty.call(raw, "needHandout") ? Boolean(raw.needHandout) : true,
      reason: firstText(raw.reason),
      note: firstText(raw.note),
      adminNote: firstText(raw.adminNote),
      status: firstText(raw.status, "submitted"),
      createdAt,
      updatedAt,
      cancelledAt: firstText(raw.cancelledAt),
    },
  };
}

function normalizeRegularSessionsByDayCourse_(sessions = []) {
  const groups = new Map();
  (Array.isArray(sessions) ? sessions : []).forEach((session) => {
    const classKind = firstText(session && session.classKind);
    if (classKind !== 'regular') {
      return;
    }
    const sessionDate = firstText(session && session.sessionDate);
    const courseGroupKey = firstText(
      session && session.courseGroupKey,
      firstText(session && session.courseGroupTitle, firstText(session && session.title))
    );
    if (!sessionDate || !courseGroupKey) {
      return;
    }
    const key = `${sessionDate}__${courseGroupKey}`;
    if (!groups.has(key)) {
      groups.set(key, {
        ...session,
        courseGroupKey,
        courseGroupTitle: firstText(session && session.courseGroupTitle, firstText(session && session.title)),
        slotCount: Number((session && session.raw && session.raw.slotCount) || 1),
      });
      return;
    }
    const item = groups.get(key);
    const startsAt = firstText(session && session.startsAt);
    const endsAt = firstText(session && session.endsAt);
    if (!item.startsAt || (startsAt && startsAt < item.startsAt)) {
      item.startsAt = startsAt;
    }
    if (!item.endsAt || (endsAt && endsAt > item.endsAt)) {
      item.endsAt = endsAt;
    }
    if (!item.location) {
      item.location = firstText(session && session.location);
    }
    item.slotCount = Number(item.slotCount || 0) + Number((session && session.raw && session.raw.slotCount) || 1);
  });

  return Array.from(groups.values()).sort((a, b) => {
    const left = `${firstText(a.sessionDate)} ${firstText(a.startsAt)} ${firstText(a.courseGroupTitle)}`;
    const right = `${firstText(b.sessionDate)} ${firstText(b.startsAt)} ${firstText(b.courseGroupTitle)}`;
    return left.localeCompare(right, 'zh-Hant', { numeric: true, sensitivity: 'base' });
  });
}

function buildMakeupSummaryByTarget_(requests = []) {
  const map = new Map();
  requests.forEach((item) => {
    const targetId = firstText(item && item.targetSessionId);
    if (!targetId) {
      return;
    }
    if (!map.has(targetId)) {
      map.set(targetId, {
        targetSessionId: targetId,
        targetSession: item.targetSession || null,
        total: 0,
        active: 0,
        needMeal: 0,
        needHandout: 0,
        statuses: {},
        requests: [],
      });
    }
    const bucket = map.get(targetId);
    const status = firstText(item && item.status, "submitted");
    const active = status !== "cancelled";
    bucket.total += 1;
    if (active) {
      bucket.active += 1;
      if (item && item.needMeal) {
        bucket.needMeal += 1;
      }
      if (item && item.needHandout) {
        bucket.needHandout += 1;
      }
    }
    bucket.statuses[status] = Number(bucket.statuses[status] || 0) + 1;
    if (active) {
      bucket.requests.push(item);
    }
  });
  return Array.from(map.values()).sort((left, right) => {
    const a = `${firstText(left.targetSession && left.targetSession.sessionDate)} ${firstText(left.targetSessionId)}`;
    const b = `${firstText(right.targetSession && right.targetSession.sessionDate)} ${firstText(right.targetSessionId)}`;
    return a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" });
  });
}

async function listAcademicStudentOptions_(query) {
  const result = await query(
    `select
       s.id as student_id,
       s.name as student_name,
       s.google_email,
       d.email as directory_email,
       d.name_zh,
       d.name_en,
       d.preferred_name,
       d.group_id
     from students s
     left join directories d on d.id = s.id
     order by coalesce(d.group_id,''), coalesce(d.preferred_name,''), coalesce(d.name_zh,''), coalesce(s.name,''), s.id`
  );
  return result.rows.map((row) => ({
    id: firstText(row.student_id),
    name: firstText(row.preferred_name, firstText(row.name_zh, firstText(row.student_name, row.name_en || ""))),
    email: normalizeEmail(firstText(row.directory_email, row.google_email || "")),
    group: firstText(row.group_id),
  })).filter((item) => item.id);
}

function normalizeGroupId_(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }
  const match = raw.match(/[A-Z0-9]+/);
  return match ? match[0] : raw;
}

function normalizeMembershipGroupIds_(memberships) {
  const ids = [];
  (memberships || []).forEach((item) => {
    const groupId = normalizeGroupId_(item && (item.groupId || item.group_id || ""));
    if (groupId && !ids.includes(groupId)) {
      ids.push(groupId);
    }
  });
  return ids;
}

function ensureFinanceApplicantDepartmentAllowed_(row, memberships) {
  if (!row || typeof row !== "object") {
    return { ok: false, error: "申請資料格式錯誤" };
  }
  const allowedGroupIds = normalizeMembershipGroupIds_(memberships);
  const requestedGroupId = normalizeGroupId_(row.applicantDepartment);

  if (!allowedGroupIds.length) {
    return { ok: false, error: "查無申請人所屬組別，請先設定組別資料" };
  }

  if (!requestedGroupId) {
    if (allowedGroupIds.length === 1) {
      row.applicantDepartment = allowedGroupIds[0];
      return { ok: true, allowedGroupIds };
    }
    return { ok: false, error: "請選擇申請組別" };
  }

  if (!allowedGroupIds.includes(requestedGroupId)) {
    return { ok: false, error: "申請組別必須為申請人所屬組別" };
  }

  row.applicantDepartment = requestedGroupId;
  return { ok: true, allowedGroupIds };
}

function parseFinanceAmount_(value) {
  const raw = String(value || "")
    .replace(/,/g, "")
    .trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPettyCashRequest_(record) {
  const type = String((record && record.type) || "")
    .trim()
    .toLowerCase();
  const method = String((record && record.paymentMethod) || "")
    .trim()
    .toLowerCase();
  return type === "pettycash" || method === "pettycash";
}

function isPurchaseRequest_(record) {
  const type = String((record && record.type) || "")
    .trim()
    .toLowerCase();
  return type === "purchase";
}

function requiresRepresentative_(record) {
  return parseFinanceAmount_(record && (record.amountActual || record.amountEstimated)) > 50000;
}

function requiresCommittee_(record) {
  const amount = parseFinanceAmount_(record && (record.amountActual || record.amountEstimated));
  const categoryType = String((record && record.categoryType) || "")
    .trim()
    .toLowerCase();
  return amount >= 200000 || categoryType === "special";
}

function buildStudentIdByEmailMap_(rows) {
  const map = {};
  (rows || []).forEach((row) => {
    const studentId = String((row && row.id) || "").trim();
    if (!studentId) {
      return;
    }
    const emailList = [
      normalizeEmail((row && row.google_email) || ""),
      normalizeEmail((row && row.email) || ""),
    ].filter(Boolean);
    emailList.forEach((email) => {
      map[email] = studentId;
    });
  });
  return map;
}

function mapFinanceRequestRow(row) {
  return normalizeFinanceRequestRowForClient_(row);
}

function mapFinanceActionRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    requestId: firstText(raw.requestId, row && row.request_id ? row.request_id : ""),
    actorId: firstText(raw.actorId, row && row.actor_id ? row.actor_id : ""),
    actorName: firstText(raw.actorName, row && row.actor_name ? row.actor_name : ""),
    actorRole: firstText(raw.actorRole),
    action: firstText(raw.action, firstText(raw.actionType, row && row.action_type ? row.action_type : "")),
    actionType: firstText(raw.actionType, firstText(raw.action, row && row.action_type ? row.action_type : "")),
    fromStatus: firstText(raw.fromStatus, row && row.from_status ? row.from_status : ""),
    toStatus: firstText(raw.toStatus, row && row.to_status ? row.to_status : ""),
    notes: firstText(raw.notes, row && row.notes ? row.notes : ""),
    note: firstText(raw.note, firstText(raw.notes, row && row.notes ? row.notes : "")),
    createdAt: firstText(raw.createdAt, row && row.created_at ? row.created_at : ""),
  };
}

function resolveApplicantGroupRoleByMemberships_(record, memberships, studentIdByEmail = {}) {
  let applicantId = String((record && record.applicantId) || "").trim();
  if (!applicantId) {
    const applicantEmail = normalizeEmail(record && record.applicantEmail);
    applicantId = applicantEmail && studentIdByEmail[applicantEmail] ? String(studentIdByEmail[applicantEmail]).trim() : "";
  }
  if (!applicantId) {
    return "";
  }
  const groupId = normalizeGroupId_(record && record.applicantDepartment);
  for (const item of memberships || []) {
    if (String(item.personId || "").trim() !== applicantId) {
      continue;
    }
    if (groupId && normalizeGroupId_(item.groupId || "") !== groupId) {
      continue;
    }
    return String(item.roleInGroup || "")
      .trim()
      .toLowerCase();
  }
  return "";
}

function resolveFinanceInitialStatus_(record, memberships, studentIdByEmail = {}) {
  let applicantRole = String((record && record.applicantRole) || "")
    .trim()
    .toLowerCase();
  if (!applicantRole) {
    applicantRole = resolveApplicantGroupRoleByMemberships_(record, memberships, studentIdByEmail);
  }
  return applicantRole === "lead" ? "pending_rep" : "pending_lead";
}

function resolveApplicantIdentity_(record, studentIdByEmail = {}) {
  const applicantEmail = normalizeEmail((record && record.applicantEmail) || "");
  let applicantId = String((record && record.applicantId) || "").trim();
  if (!applicantId && applicantEmail && studentIdByEmail[applicantEmail]) {
    applicantId = String(studentIdByEmail[applicantEmail]).trim();
  }
  return { applicantId, applicantEmail };
}

function isSameApplicant_(record, actorId, actorEmail, studentIdByEmail = {}) {
  const { applicantId, applicantEmail } = resolveApplicantIdentity_(record, studentIdByEmail);
  let resolvedActorId = String(actorId || "").trim();
  const normalizedActorEmail = normalizeEmail(actorEmail || "");
  if (!resolvedActorId && normalizedActorEmail && studentIdByEmail[normalizedActorEmail]) {
    resolvedActorId = String(studentIdByEmail[normalizedActorEmail]).trim();
  }
  if (applicantId) {
    return Boolean(resolvedActorId && applicantId && resolvedActorId === applicantId);
  }
  if (normalizedActorEmail && applicantEmail && normalizedActorEmail === applicantEmail) {
    return true;
  }
  return false;
}

function actorHasGroupRole_(memberships, actorId, groupId, roleList) {
  const normalizedGroup = normalizeGroupId_(groupId || "");
  const roleSet = new Set((roleList || []).map((item) => String(item || "").trim().toLowerCase()));
  for (const item of memberships || []) {
    if (String(item.personId || "").trim() !== actorId) {
      continue;
    }
    if (normalizedGroup && normalizeGroupId_(item.groupId || "") !== normalizedGroup) {
      continue;
    }
    const roleInGroup = String(item.roleInGroup || "")
      .trim()
      .toLowerCase();
    if (roleSet.has(roleInGroup)) {
      return true;
    }
  }
  return false;
}

function actorHasFinanceRole_(roles, actorId, actorEmail, targetRole) {
  const target = String(targetRole || "")
    .trim()
    .toLowerCase();
  const normalizedEmail = normalizeEmail(actorEmail || "");
  return (roles || []).some((item) => {
    const role = String(item.role || "")
      .trim()
      .toLowerCase();
    if (role !== target) {
      return false;
    }
    const personId = String(item.personId || item.studentId || "").trim();
    const personEmail = normalizeEmail(item.personEmail || item.studentEmail || "");
    if (actorId && personId && actorId === personId) {
      return true;
    }
    if (normalizedEmail && personEmail && normalizedEmail === personEmail) {
      return true;
    }
    return false;
  });
}

function canFinanceActorApprove_(record, actorRole, actorId, actorEmail, memberships, financeRoles, studentIdByEmail = {}) {
  const status = String((record && record.status) || "")
    .trim()
    .toLowerCase();
  const role = String(actorRole || "")
    .trim()
    .toLowerCase();
  if (!status || !status.startsWith("pending_")) {
    return false;
  }

  let resolvedActorId = String(actorId || "").trim();
  if (!resolvedActorId) {
    const normalizedActorEmail = normalizeEmail(actorEmail || "");
    resolvedActorId = normalizedActorEmail && studentIdByEmail[normalizedActorEmail] ? String(studentIdByEmail[normalizedActorEmail]).trim() : "";
  }

  if (isSameApplicant_(record, resolvedActorId, actorEmail, studentIdByEmail)) {
    return false;
  }

  if (status === "pending_lead") {
    if (role !== "lead") {
      return false;
    }
    let applicantRole = String((record && record.applicantRole) || "")
      .trim()
      .toLowerCase();
    if (!applicantRole) {
      applicantRole = resolveApplicantGroupRoleByMemberships_(record, memberships, studentIdByEmail);
    }
    const groupId = String((record && record.applicantDepartment) || "").trim();
    if (applicantRole === "deputy") {
      return actorHasGroupRole_(memberships, resolvedActorId, groupId, ["lead"]);
    }
    return actorHasGroupRole_(memberships, resolvedActorId, groupId, ["lead", "deputy"]);
  }

  if (status === "pending_rep") {
    if (role !== "rep") {
      return false;
    }
    return actorHasGroupRole_(memberships, resolvedActorId, "A", ["lead", "deputy"]);
  }

  if (status === "pending_committee") {
    if (role !== "committee") {
      return false;
    }
    return actorHasGroupRole_(memberships, resolvedActorId, "", ["lead", "deputy"]);
  }

  if (status === "pending_accounting") {
    if (role !== "accounting") {
      return false;
    }
    return actorHasFinanceRole_(financeRoles, resolvedActorId, actorEmail, "accounting");
  }

  if (status === "pending_cashier") {
    if (role !== "cashier") {
      return false;
    }
    return actorHasFinanceRole_(financeRoles, resolvedActorId, actorEmail, "cashier");
  }

  return false;
}

function canApproveFinanceRequestForIdentity_(record, actorId, actorEmail, memberships, financeRoles, studentIdByEmail = {}) {
  const roles = ["lead", "rep", "committee", "accounting", "cashier"];
  return roles.some((role) =>
    canFinanceActorApprove_(record, role, actorId, actorEmail, memberships, financeRoles, studentIdByEmail)
  );
}

function applicantHasFinanceRole_(record, financeRoles, studentIdByEmail = {}, targetRole) {
  const { applicantId, applicantEmail } = resolveApplicantIdentity_(record, studentIdByEmail);
  return actorHasFinanceRole_(financeRoles, applicantId, applicantEmail, targetRole);
}

function resolveWorkflowCreatedByRole_(record, financeRoles = []) {
  const raw = record && record.raw && typeof record.raw === "object" ? record.raw : record || {};
  const explicitRole = firstText(raw.workflowCreatedByRole);
  if (explicitRole) {
    return explicitRole.trim().toLowerCase();
  }
  const manualCreatedBy = firstText(raw.manualCreatedBy);
  if (manualCreatedBy && actorHasFinanceRole_(financeRoles, manualCreatedBy, "", "accounting")) {
    return "accounting";
  }
  if (manualCreatedBy && actorHasFinanceRole_(financeRoles, manualCreatedBy, "", "cashier")) {
    return "cashier";
  }
  return "";
}

async function resolveFinanceWorkflowRoleForActor_(query, actorId) {
  const studentId = String(actorId || "").trim();
  if (!studentId) {
    return "";
  }
  const result = await query(`select * from finance_roles where student_id = $1`, [studentId]);
  const roles = result.rows.map((row) => mapFinanceRoleRow(row));
  if (actorHasFinanceRole_(roles, studentId, "", "accounting")) {
    return "accounting";
  }
  if (actorHasFinanceRole_(roles, studentId, "", "cashier")) {
    return "cashier";
  }
  return "";
}

function shouldAutoFixFinanceWorkflow_(record, financeRoles = []) {
  if (!record) {
    return false;
  }
  const status = firstText(record.status).toLowerCase();
  if (status !== "pending_accounting") {
    return false;
  }
  const type = firstText(record.type).toLowerCase();
  const paymentMethod = firstText(record.paymentMethod, record && record.raw && record.raw.paymentMethod).toLowerCase();
  if (type === "purchase" || type === "pettycash" || paymentMethod === "pettycash") {
    return false;
  }
  return resolveWorkflowCreatedByRole_(record, financeRoles) === "accounting";
}

async function autoFixFinanceWorkflowIfNeeded_(query, row, financeRoles = []) {
  const record = mapFinanceRequestRow(row);
  if (!shouldAutoFixFinanceWorkflow_(record, financeRoles)) {
    return row;
  }
  const now = nowIso();
  const raw = {
    ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
    status: "pending_cashier",
    updatedAt: now,
    workflowCreatedByRole: firstText(
      row.raw && row.raw.workflowCreatedByRole,
      resolveWorkflowCreatedByRole_(record, financeRoles) || "accounting"
    ),
  };
  await query(
    `update finance_requests
        set status = 'pending_cashier',
            updated_at = $2,
            raw = $3::jsonb,
            synced_at = now()
      where id = $1`,
    [row.id, now, jsonbParam(raw, {})]
  );
  await query(
    `insert into finance_actions (id, request_id, actor_id, actor_name, action_type, from_status, to_status, notes, created_at, raw)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     on conflict (id) do nothing`,
    [
      `sys-fix-finance-workflow-runtime-${row.id}`,
      row.id,
      null,
      "system",
      "system_fix",
      "pending_accounting",
      "pending_cashier",
      "Auto-fix accounting-created request routed to cashier on read",
      now,
      jsonbParam(
        {
          id: `sys-fix-finance-workflow-runtime-${row.id}`,
          requestId: row.id,
          actorName: "system",
          actionType: "system_fix",
          fromStatus: "pending_accounting",
          toStatus: "pending_cashier",
          notes: "Auto-fix accounting-created request routed to cashier on read",
          createdAt: now,
        },
        {}
      ),
    ]
  );
  const refreshed = await query(`select * from finance_requests where id = $1 limit 1`, [row.id]);
  return rowOrNull(refreshed) || row;
}

function resolveFinanceNextStatus_(record, actorRole, financeRoles = [], studentIdByEmail = {}) {
  const role = String(actorRole || "")
    .trim()
    .toLowerCase();
  const status = String((record && record.status) || "")
    .trim()
    .toLowerCase();
  const needsRep = requiresRepresentative_(record);
  const needsCommittee = requiresCommittee_(record);
  const isPettyCash = isPettyCashRequest_(record);
  const isPurchase = isPurchaseRequest_(record);
  const applicantIsAccounting = applicantHasFinanceRole_(record, financeRoles, studentIdByEmail, "accounting");
  const workflowCreatedByRole = resolveWorkflowCreatedByRole_(record, financeRoles);
  const workflowCreatedByAccounting = workflowCreatedByRole === "accounting";

  if (role === "lead") {
    if (needsRep || needsCommittee) {
      return "pending_rep";
    }
    if (isPurchase) {
      return "closed";
    }
    return applicantIsAccounting || workflowCreatedByAccounting || isPettyCash ? "pending_cashier" : "pending_accounting";
  }

  if (role === "rep") {
    if (needsCommittee) {
      return "pending_committee";
    }
    if (isPurchase) {
      return "closed";
    }
    return applicantIsAccounting || workflowCreatedByAccounting || isPettyCash ? "pending_cashier" : "pending_accounting";
  }

  if (role === "committee") {
    if (isPurchase) {
      return "closed";
    }
    return applicantIsAccounting || workflowCreatedByAccounting || isPettyCash ? "pending_cashier" : "pending_accounting";
  }

  if (role === "accounting") {
    return isPettyCash ? "closed" : "pending_cashier";
  }

  if (role === "cashier") {
    if (status === "pending_cashier" && isPettyCash) {
      return "pending_accounting";
    }
    return "closed";
  }

  return String((record && record.status) || "").trim();
}


function slugifyDocumentTitle_(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || `doc-${Date.now()}`;
}

function normalizeDocumentTags_(value) {
  const input = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const seen = new Set();
  return input
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function normalizeDocumentAttachments_(value) {
  return normalizeAttachmentItems(value);
}

function mapDocumentVersionRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: firstText(row.id),
    documentId: firstText(row.document_id),
    versionNumber: Number(row.version_number || 0),
    title: firstText(row.title_snapshot),
    summary: firstText(row.summary_snapshot),
    content: firstText(row.content_snapshot),
    changeSummary: firstText(row.change_summary),
    meetingDate: firstText(row.meeting_date),
    effectiveDate: firstText(row.effective_date),
    attachments: normalizeDocumentAttachments_(row.attachments),
    createdBy: firstText(row.created_by),
    createdByName: firstText(row.created_by_name),
    createdAt: firstText(row.created_at),
  };
}

function mapDocumentRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: firstText(row.id),
    slug: firstText(row.slug),
    title: firstText(row.title),
    docType: firstText(row.doc_type),
    ownerGroupId: firstText(row.owner_group_id),
    visibility: firstText(row.visibility, "class"),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => firstText(item)).filter(Boolean) : [],
    isPinned: Boolean(row.is_pinned),
    pinOrder: Number(row.pin_order || 0),
    latestVersionNumber: Number(row.latest_version_number || 0),
    latestVersionId: firstText(row.latest_version_id),
    status: firstText(row.status, "published"),
    createdBy: firstText(row.created_by),
    createdByName: firstText(row.created_by_name),
    createdAt: firstText(row.created_at),
    updatedAt: firstText(row.updated_at),
    archivedAt: firstText(row.archived_at),
    latestSummary: firstText(row.latest_summary),
    latestChangeSummary: firstText(row.latest_change_summary),
    latestMeetingDate: firstText(row.latest_meeting_date),
    latestEffectiveDate: firstText(row.latest_effective_date),
    latestVersionCreatedAt: firstText(row.latest_version_created_at),
    latestAttachments: normalizeDocumentAttachments_(row.latest_attachments),
  };
}

function canManageDocumentsGlobal_(memberships) {
  return asArray(memberships).some((item) => {
    const role = firstText(item.roleInGroup || item.role_in_group).toLowerCase();
    return role === "lead" || role === "deputy";
  });
}

function getEditableDocumentGroupIds_(memberships) {
  const editable = new Set();
  asArray(memberships).forEach((item) => {
    const groupId = firstText(item.groupId || item.group_id);
    const role = firstText(item.roleInGroup || item.role_in_group).toLowerCase();
    if (!groupId) {
      return;
    }
    if (groupId === "E") {
      editable.add(groupId);
      return;
    }
    if (groupId === "A" || role === "lead" || role === "deputy") {
      editable.add(groupId);
    }
  });
  return Array.from(editable);
}

function canEditDocumentWithMemberships_(documentRow, memberships) {
  if (!documentRow) {
    return false;
  }
  if (canManageDocumentsGlobal_(memberships)) {
    return true;
  }
  const ownerGroupId = firstText(documentRow.owner_group_id || documentRow.ownerGroupId);
  return getEditableDocumentGroupIds_(memberships).includes(ownerGroupId);
}

export async function dispatchNativeAction({
  action,
  payload,
  auth,
  query,
  withTransaction,
  verifyGoogleIdToken,
  createSessionToken,
  createRefreshToken,
  verifyRefreshToken,
  listMembershipsByStudentId,
  findStudentProfileById,
}) {
  const name = String(action || "").trim();
  const body = payload && typeof payload === "object" ? payload : {};

  const PUBLIC_ACTIONS = new Set([
    "verifyGoogle",
    "linkGoogleStudent",
    "refreshSession",
    // Public event list is used by unauthenticated event homepage / registration fallback.
    "listEvents",
    // Landing can render without login; it will return empty private sections when unauthenticated.
    "listLandingBootstrap",
    "listOrderPlans",
    "getOrderPublicPage",
    "submitOrderPublicResponse",
  ]);

  // Helpers
  const requireAuth = () => {
    if (!auth || !auth.studentId) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    }
  };

  const requireGroupAccess = async (allowedGroupIds) => {
    requireAuth();
    const memberships = await listMembershipsByStudentId(auth.studentId);
    if (!canAccessByGroups(memberships, allowedGroupIds)) {
      const error = new Error("Forbidden");
      error.statusCode = 403;
      throw error;
    }
    return memberships;
  };

  let financeApprovalContextCache = null;
  const loadFinanceApprovalContext_ = async () => {
    if (financeApprovalContextCache) {
      return financeApprovalContextCache;
    }
    const [membershipsResult, rolesResult, studentsResult, directoriesResult] = await Promise.all([
      query(`select * from group_memberships order by coalesce(group_id,''), coalesce(person_id,''), id`),
      query(`select * from finance_roles order by coalesce(role,''), coalesce(student_id,''), id`),
      query(`select id, google_email from students order by coalesce(id,'')`),
      query(`select id, email from directories order by coalesce(id,'')`),
    ]);

    financeApprovalContextCache = {
      memberships: membershipsResult.rows.map((row) => ({
        id: row.id || "",
        personId: row.person_id || "",
        personName: row.person_name || "",
        groupId: row.group_id || "",
        roleInGroup: row.role_in_group || "",
        notes: row.notes || "",
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || "",
      })),
      financeRoles: rolesResult.rows.map((row) => mapFinanceRoleRow(row)),
      studentIdByEmail: {
        ...buildStudentIdByEmailMap_(studentsResult.rows),
        ...buildStudentIdByEmailMap_(directoriesResult.rows),
      },
    };
    return financeApprovalContextCache;
  };

  const canViewFinanceRequest_ = async (requestRecord) => {
    requireAuth();
    if (!requestRecord || !requestRecord.id) {
      return false;
    }

    const actorEmail = normalizeEmail(auth && auth.profile && auth.profile.email ? auth.profile.email : "");
    if (isSameApplicant_(requestRecord, auth.studentId, actorEmail)) {
      return true;
    }

    const context = await loadFinanceApprovalContext_();
    if (
      canApproveFinanceRequestForIdentity_(
        requestRecord,
        auth.studentId,
        actorEmail,
        context.memberships,
        context.financeRoles,
        context.studentIdByEmail
      )
    ) {
      return true;
    }

    const ownMemberships = await listMembershipsByStudentId(auth.studentId);
    const studentProfile = await findStudentProfileById(auth.studentId);
    const ownNameCandidates = new Set([
      firstText(auth && auth.profile && auth.profile.name ? auth.profile.name : "").toLowerCase(),
      firstText(studentProfile && studentProfile.name ? studentProfile.name : "").toLowerCase(),
    ]);
    ownMemberships.forEach((item) => {
      const value = firstText(item.personName).toLowerCase();
      if (value) {
        ownNameCandidates.add(value);
      }
    });
    const ownNames = Array.from(ownNameCandidates).filter(Boolean);

    const signedResult = ownNames.length
      ? await query(
          `select 1
           from finance_actions
           where request_id = $1
             and (actor_id = $2 or lower(coalesce(actor_name,'')) = any($3::text[]))
           limit 1`,
          [String(requestRecord.id || "").trim(), auth.studentId, ownNames]
        )
      : await query(`select 1 from finance_actions where request_id = $1 and actor_id = $2 limit 1`, [
          String(requestRecord.id || "").trim(),
          auth.studentId,
        ]);
    return Boolean(rowOrNull(signedResult));
  };

  let softballManagerCache = null;
  const normalizePositions_ = (value) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      return value
        .split(/[,，]/)
        .map((item) => String(item || "").trim())
        .filter(Boolean);
    }
    return [];
  };

  const isSoftballManager_ = async () => {
    requireAuth();
    if (softballManagerCache != null) {
      return softballManagerCache;
    }
    try {
      const result = await query(`select status, request_status, positions, raw from softball_players where id = $1 limit 1`, [auth.studentId]);
      const row = rowOrNull(result);
      if (!row) {
        softballManagerCache = false;
        return softballManagerCache;
      }
      const status = String((row.status || (row.raw && row.raw.status) || "active") || "").trim().toLowerCase();
      const requestStatus = String((row.request_status || (row.raw && row.raw.requestStatus) || "") || "").trim().toLowerCase();
      if (status && status !== "active") {
        softballManagerCache = false;
        return softballManagerCache;
      }
      if (requestStatus === "pending") {
        softballManagerCache = false;
        return softballManagerCache;
      }
      const positions = normalizePositions_(row.positions).concat(normalizePositions_(row.raw && row.raw.positions));
      softballManagerCache = positions.some((item) => String(item || "").trim() === "球隊經理");
      return softballManagerCache;
    } catch (error) {
      softballManagerCache = false;
      return softballManagerCache;
    }
  };

  const hasSoftballTeamRole_ = (memberships) => {
    const list = asArray(memberships);
    return list.some((item) => {
      const groupId = normalizeGroupId_(item.groupId || item.group_id || "");
      if (groupId !== "K") {
        return false;
      }
      const role = String(item.roleInGroup || item.role_in_group || "").trim().toLowerCase();
      // K 組的 manager/lead/deputy 有後台權限
      return role === "manager" || role === "lead" || role === "deputy";
    });
  };

  const getSoftballAdminAccess_ = async (membershipsInput = null) => {
    requireAuth();
    const memberships = membershipsInput || (await listMembershipsByStudentId(auth.studentId));
    const byGroup = canAccessByGroups(memberships, ["E", "H"]);
    const byTeamRole = byGroup ? false : hasSoftballTeamRole_(memberships);
    const byManager = byGroup || byTeamRole ? false : await isSoftballManager_();
    return {
      memberships,
      allowed: Boolean(byGroup || byTeamRole || byManager),
      source: byGroup ? "group" : byTeamRole ? "team-role" : byManager ? "manager" : "",
    };
  };

  const requireSoftballAdminAccess = async () => {
    const access = await getSoftballAdminAccess_();
    if (access.allowed) {
      return access.memberships;
    }
    const error = new Error("Forbidden");
    error.statusCode = 403;
    throw error;
  };

  if (!PUBLIC_ACTIONS.has(name)) {
    requireAuth();
  }

  switch (name) {
    case "listRegistrations": {
      await requireGroupAccess(["C", "E"]);
      const result = await query(
        `select * from registrations order by coalesce(created_at, ''), id`
      );
      return { ok: true, data: { registrations: result.rows.map((row) => ({
        id: row.id,
        eventId: row.event_id || "",
        studentId: row.student_id || "",
        userName: row.user_name || "",
        userEmail: row.user_email || "",
        userPhone: row.user_phone || "",
        classYear: row.class_year || "",
        customFields: row.custom_fields || {},
        status: row.status || "",
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || "",
        manualCreatedBy: row.manual_created_by || "",
        manualCreatedByName: row.manual_created_by_name || "",
        manualCreatedAt: row.manual_created_at || "",
      })) }, error: null };
    }

    case "listCheckins": {
      await requireGroupAccess(["C", "E"]);
      const result = await query(`select * from checkins order by coalesce(checkin_at, ''), id`);
      return { ok: true, data: { checkins: result.rows.map((row) => ({
        id: row.id,
        eventId: row.event_id || "",
        registrationId: row.registration_id || "",
        checkinAt: row.checkin_at || "",
        checkinMethod: row.checkin_method || "",
      })) }, error: null };
    }

    case "deleteCheckin": {
      await requireGroupAccess(["C", "E"]);
      const checkinId = firstText(body.checkinId || body.id);
      if (!checkinId) {
        return { ok: false, data: null, error: "Missing checkinId" };
      }
      await query(`delete from checkins where id = $1`, [checkinId]);
      return { ok: true, data: { id: checkinId }, error: null };
    }

    case "deleteEvent": {
      await requireGroupAccess(["C", "E"]);
      const eventId = firstText(body.eventId || body.id);
      if (!eventId) {
        return { ok: false, data: null, error: "Missing eventId" };
      }
      const result = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: "admin_ui",
        reason: "deleteEvent",
        entityType: "event",
        entityId: eventId,
        expectedRevision: body.expectedRevision,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from events where id = $1 limit 1 for update`, [eventId])),
        mutate: async ({ txQuery, current }) => {
          if (!current) {
            throw new Error("活動不存在");
          }
          await txQuery(`delete from checkins where event_id = $1`, [eventId]);
          await txQuery(`delete from registrations where event_id = $1`, [eventId]);
          await txQuery(`delete from events where id = $1`, [eventId]);
          return {
            action: "delete",
            after: null,
            returnValue: { id: eventId },
          };
        },
        buildSnapshot: (row) => normalizeEventRowForClient_(row),
        buildEvent: ({ action, beforeSnapshot }) => ({
          summary: action === "delete" ? `刪除活動 ${firstText(beforeSnapshot && beforeSnapshot.title, eventId)}` : `更新活動 ${eventId}`,
          severity: "warning",
        }),
      });
      return { ok: true, data: { id: eventId, revisionNo: result.revisionNo }, error: null };
    }

    case "createEvent":
    case "updateEvent": {
      await requireGroupAccess(["C", "E"]);
      const data = safeJsonObject(body.data || body.event || body);
      const id = firstText(data.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const normalized = {
        ...data,
        id,
      };
      const result = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: "admin_ui",
        reason: name,
        entityType: "event",
        entityId: id,
        expectedRevision: body.expectedRevision,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from events where id = $1 limit 1 for update`, [id])),
        mutate: async ({ txQuery, nextRevision, batchId, actor }) => {
          const nextRow = buildEventRowFromSnapshot_(normalized, null, nextRevision, batchId, actor);
          await txQuery(
            `insert into events (
              id, title, description, start_at, end_at, location, address,
              registration_open_at, registration_close_at, checkin_open_at, checkin_close_at,
              register_url, checkin_url, capacity, status, category, form_schema, raw,
              revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22,$23)
            on conflict (id) do update set
              title=excluded.title,
              description=excluded.description,
              start_at=excluded.start_at,
              end_at=excluded.end_at,
              location=excluded.location,
              address=excluded.address,
              registration_open_at=excluded.registration_open_at,
              registration_close_at=excluded.registration_close_at,
              checkin_open_at=excluded.checkin_open_at,
              checkin_close_at=excluded.checkin_close_at,
              register_url=excluded.register_url,
              checkin_url=excluded.checkin_url,
              capacity=excluded.capacity,
              status=excluded.status,
              category=excluded.category,
              form_schema=excluded.form_schema,
              raw=excluded.raw,
              revision_no=excluded.revision_no,
              last_change_batch_id=excluded.last_change_batch_id,
              last_changed_at=excluded.last_changed_at,
              last_changed_by=excluded.last_changed_by,
              last_changed_by_name=excluded.last_changed_by_name,
              synced_at=now()`,
            [
              nextRow.id,
              nextRow.title,
              nextRow.description,
              nextRow.startAt,
              nextRow.endAt,
              nextRow.location,
              nextRow.address,
              nextRow.registrationOpenAt,
              nextRow.registrationCloseAt,
              nextRow.checkinOpenAt,
              nextRow.checkinCloseAt,
              nextRow.registerUrl,
              nextRow.checkinUrl,
              nextRow.capacity,
              nextRow.status,
              nextRow.category,
              jsonbParam(nextRow.formSchema, {}),
              jsonbParam(nextRow.raw, {}),
              nextRow.revisionNo,
              batchId,
              nextRow.updatedAt,
              nextRow.lastChangedBy,
              nextRow.lastChangedByName,
            ]
          );
        },
        loadAfter: async (txQuery) => rowOrNull(await txQuery(`select * from events where id = $1 limit 1`, [id])),
        buildSnapshot: (row) => normalizeEventRowForClient_(row),
        buildEvent: ({ action, afterSnapshot, changedFields }) => ({
          summary:
            action === "create"
              ? `建立活動 ${firstText(afterSnapshot && afterSnapshot.title, id)}`
              : `更新活動 ${firstText(afterSnapshot && afterSnapshot.title, id)}${changedFields.length ? `（${changedFields.slice(0, 4).join(", ")}）` : ""}`,
          severity: changedFields.includes("startAt") || changedFields.includes("registrationCloseAt") ? "warning" : "info",
        }),
      });
      const event = result.after ? normalizeEventRowForClient_(result.after) : null;
      return { ok: true, data: { event }, error: null };
    }

    case "listEventAuditEvents": {
      await requireGroupAccess(["C", "E"]);
      const eventId = firstText(body.eventId || body.id);
      if (!eventId) {
        return { ok: true, data: { events: [] }, error: null };
      }
      const limit = Math.min(100, Math.max(1, Number(body.limit || 20) || 20));
      const result = await query(
        `select e.*, v.id as version_id, v.revision_no as version_revision_no
           from audit_events e
           left join audit_entity_versions v
             on v.batch_id = e.batch_id
            and v.entity_type = e.entity_type
            and v.entity_id = e.entity_id
            and v.action = e.action
          where e.entity_type = 'event' and e.entity_id = $1
          order by e.created_at desc
          limit $2`,
        [eventId, limit]
      );
      const events = result.rows.map((row) => ({
        id: firstText(row.id),
        batchId: firstText(row.batch_id),
        versionId: firstText(row.version_id),
        revisionNo: row.version_revision_no != null ? Number(row.version_revision_no) || 0 : 0,
        entityType: firstText(row.entity_type),
        entityId: firstText(row.entity_id),
        action: firstText(row.action),
        actorId: firstText(row.actor_id),
        actorName: firstText(row.actor_name),
        summary: firstText(row.summary),
        severity: firstText(row.severity, 'info'),
        createdAt: asIsoText_(row.created_at),
        diff: safeJsonObject(row.diff),
      }));
      return { ok: true, data: { events }, error: null };
    }

    case "restoreEventAuditVersion": {
      await requireGroupAccess(["C", "E"]);
      const versionId = firstText(body.versionId || body.id);
      if (!versionId) {
        return { ok: false, data: null, error: "Missing versionId" };
      }
      const result = await withTransaction(async (client) => {
        const txQuery = (text, params = []) => client.query(text, params);
        const actorId = firstText(auth && auth.studentId);
        const actorName = firstText(auth && auth.profile && auth.profile.name, actorId || "system");
        const actorEmail = firstText(auth && auth.profile && auth.profile.email);
        const versionRow = rowOrNull(await txQuery(`select * from audit_entity_versions where id = $1 limit 1 for update`, [versionId]));
        if (!versionRow) {
          return { ok: false, data: null, error: "Version not found" };
        }
        if (firstText(versionRow.entity_type) !== 'event') {
          return { ok: false, data: null, error: "Unsupported restore target" };
        }
        const targetSnapshot = safeJsonObject(versionRow.after_data);
        const fallbackSnapshot = safeJsonObject(versionRow.before_data);
        const snapshot = Object.keys(targetSnapshot).length ? targetSnapshot : fallbackSnapshot;
        if (!Object.keys(snapshot).length) {
          return { ok: false, data: null, error: "Version snapshot is empty" };
        }
        const batchId = `audit_batch:${crypto.randomUUID()}`;
        const createdAt = nowIso();
        await txQuery(
          `insert into audit_change_batches (id, source, actor_id, actor_name, actor_email, reason, status, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [batchId, 'admin_ui', actorId, actorName, actorEmail, 'restoreEventAuditVersion', 'pending', createdAt, jsonbParam({ versionId }, {})]
        );
        const eventId = firstText(versionRow.entity_id, snapshot.id);
        const currentRow = rowOrNull(await txQuery(`select * from events where id = $1 limit 1 for update`, [eventId]));
        const currentSnapshot = currentRow ? normalizeEventRowForClient_(currentRow) : {};
        const nextRevision = currentRow ? Number(currentRow.revision_no || 1) + 1 : 1;
        const nextRow = buildEventRowFromSnapshot_(snapshot, currentRow, nextRevision, batchId, { actorId, actorName });
        await txQuery(
          `insert into events (
            id, title, description, start_at, end_at, location, address,
            registration_open_at, registration_close_at, checkin_open_at, checkin_close_at,
            register_url, checkin_url, capacity, status, category, form_schema, raw,
            revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22,$23)
          on conflict (id) do update set
            title=excluded.title,
            description=excluded.description,
            start_at=excluded.start_at,
            end_at=excluded.end_at,
            location=excluded.location,
            address=excluded.address,
            registration_open_at=excluded.registration_open_at,
            registration_close_at=excluded.registration_close_at,
            checkin_open_at=excluded.checkin_open_at,
            checkin_close_at=excluded.checkin_close_at,
            register_url=excluded.register_url,
            checkin_url=excluded.checkin_url,
            capacity=excluded.capacity,
            status=excluded.status,
            category=excluded.category,
            form_schema=excluded.form_schema,
            raw=excluded.raw,
            revision_no=excluded.revision_no,
            last_change_batch_id=excluded.last_change_batch_id,
            last_changed_at=excluded.last_changed_at,
            last_changed_by=excluded.last_changed_by,
            last_changed_by_name=excluded.last_changed_by_name,
            synced_at=now()`,
          [
            nextRow.id,
            nextRow.title,
            nextRow.description,
            nextRow.startAt,
            nextRow.endAt,
            nextRow.location,
            nextRow.address,
            nextRow.registrationOpenAt,
            nextRow.registrationCloseAt,
            nextRow.checkinOpenAt,
            nextRow.checkinCloseAt,
            nextRow.registerUrl,
            nextRow.checkinUrl,
            nextRow.capacity,
            nextRow.status,
            nextRow.category,
            jsonbParam(nextRow.formSchema, {}),
            jsonbParam(nextRow.raw, {}),
            nextRow.revisionNo,
            batchId,
            nextRow.updatedAt,
            nextRow.lastChangedBy,
            nextRow.lastChangedByName,
          ]
        );
        const afterRow = rowOrNull(await txQuery(`select * from events where id = $1 limit 1`, [eventId]));
        const afterSnapshot = afterRow ? normalizeEventRowForClient_(afterRow) : snapshot;
        const { changedFields, diff } = diffSnapshotsForAudit_(currentSnapshot, afterSnapshot);
        const newVersionId = `audit_version:${crypto.randomUUID()}`;
        const eventAuditId = `audit_event:${crypto.randomUUID()}`;
        await txQuery(
          `insert into audit_entity_versions (id, batch_id, entity_type, entity_id, action, revision_no, before_data, after_data, changed_fields, source_updated_at, actor_id, actor_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb)`,
          [newVersionId, batchId, 'event', eventId, 'restore', nextRevision, jsonbParam(currentSnapshot, {}), jsonbParam(afterSnapshot, {}), changedFields, nextRow.updatedAt, actorId, actorName, nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId, diff }, {})]
        );
        await txQuery(
          `insert into audit_events (id, batch_id, entity_type, entity_id, action, actor_id, actor_name, summary, diff, severity, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)`,
          [eventAuditId, batchId, 'event', eventId, 'restore', actorId, actorName, `回復活動 ${firstText(afterSnapshot.title, eventId)}`, jsonbParam(diff, {}), 'warning', nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId }, {})]
        );
        await txQuery(
          `insert into audit_restores (id, restore_batch_id, target_entity_type, target_entity_id, restored_from_version_id, previous_revision_no, restored_revision_no, actor_id, actor_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [`audit_restore:${crypto.randomUUID()}`, batchId, 'event', eventId, versionId, currentRow ? Number(currentRow.revision_no || 1) : null, nextRevision, actorId, actorName, nextRow.updatedAt, jsonbParam({}, {})]
        );
        await txQuery(`update audit_change_batches set status = 'committed', committed_at = $2 where id = $1`, [batchId, nextRow.updatedAt]);
        return { ok: true, data: { event: afterSnapshot, batchId, revisionNo: nextRevision }, error: null };
      });
      return result;
    }

    case "updateRegistration": {
      await requireGroupAccess(["C", "E"]);
      const data = safeJsonObject(body.data || body.registration || body);
      const registrationId = firstText(data.id || body.id || body.registrationId);
      const status = firstText(data.status);
      if (!registrationId) {
        return { ok: false, data: null, error: "Missing registrationId" };
      }
      if (!status) {
        return { ok: false, data: null, error: "Missing status" };
      }

      const existing = await query(`select raw from registrations where id = $1 limit 1`, [registrationId]);
      const existingRow = rowOrNull(existing);
      if (!existingRow) {
        return { ok: false, data: null, error: "Registration not found" };
      }
      const existingRaw = existingRow.raw && typeof existingRow.raw === "object" ? existingRow.raw : {};
      const updatedAt = nowIso();
      const nextRaw = { ...existingRaw, status, updatedAt };

      await query(
        `update registrations set status=$2, updated_at=$3, raw=$4::jsonb, synced_at=now() where id=$1`,
        [registrationId, status, updatedAt, jsonbParam(nextRaw, {})]
      );
      return { ok: true, data: { id: registrationId }, error: null };
    }

    case "deleteRegistration": {
      await requireGroupAccess(["C", "E"]);
      const registrationId = firstText(body.registrationId || body.id);
      if (!registrationId) {
        return { ok: false, data: null, error: "Missing registrationId" };
      }
      await query(`delete from registrations where id = $1`, [registrationId]);
      await query(`delete from checkins where registration_id = $1`, [registrationId]);
      return { ok: true, data: { id: registrationId }, error: null };
    }

    case "adminCreateRegistration": {
      const memberships = await requireGroupAccess(["C", "E"]);
      const normalizedEmail = normalizeEmail(body.email || body.userEmail || (body.data && body.data.userEmail));
      const data = safeJsonObject(body.data);
      const eventId = firstText(data.eventId || body.eventId);
      if (!eventId) {
        return { ok: false, data: null, error: "Missing eventId" };
      }
      if (!normalizedEmail) {
        return { ok: false, data: null, error: "Missing email" };
      }
      const id = firstText(data.id, crypto.randomUUID());
      const createdAt = nowIso();
      const studentId = firstText(data.studentId);
      const userName = firstText(data.userName, data.name || "");
      const userPhone = firstText(data.userPhone, data.phone || "");
      const classYear = firstText(data.classYear);
      const customFields = safeJsonObject(data.customFields);

      await query(
        `insert into registrations (
          id, event_id, student_id, user_name, user_email, user_phone, class_year, custom_fields,
          status, created_at, updated_at, manual_created_by, manual_created_by_name, manual_created_at, raw
        ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'registered',$9,$9,$10,$11,$9,$12::jsonb)
        on conflict (id) do update set
          event_id = excluded.event_id,
          student_id = excluded.student_id,
          user_name = excluded.user_name,
          user_email = excluded.user_email,
          user_phone = excluded.user_phone,
          class_year = excluded.class_year,
          custom_fields = excluded.custom_fields,
          status = excluded.status,
          updated_at = excluded.updated_at,
          manual_created_by = excluded.manual_created_by,
          manual_created_by_name = excluded.manual_created_by_name,
          manual_created_at = excluded.manual_created_at,
          raw = excluded.raw,
          synced_at = now()`,
        [
          id,
          eventId,
          studentId,
          userName,
          normalizedEmail,
          userPhone,
          classYear,
          jsonbParam(customFields, {}),
          createdAt,
          auth.studentId,
          (() => {
            const me = memberships.find((m) => String(m.personId || "").trim() === String(auth.studentId || "").trim());
            return me ? String(me.personName || "").trim() : "";
          })(),
          jsonbParam(data, {}),
        ]
      );
      const row = await query(`select * from registrations where id = $1 limit 1`, [id]);
      const r = rowOrNull(row);
      return {
        ok: true,
        data: {
          registration: r
            ? {
                id: r.id,
                eventId: r.event_id || "",
                studentId: r.student_id || "",
                userName: r.user_name || "",
                userEmail: r.user_email || "",
                userPhone: r.user_phone || "",
                classYear: r.class_year || "",
                customFields: r.custom_fields || {},
                status: r.status || "",
                createdAt: r.created_at || "",
                updatedAt: r.updated_at || "",
                manualCreatedBy: r.manual_created_by || "",
                manualCreatedByName: r.manual_created_by_name || "",
                manualCreatedAt: r.manual_created_at || "",
              }
            : null,
        },
        error: null,
      };
    }

    case "batchUpdateGroupMemberships": {
      await requireGroupAccess(["E"]);
      const memberships = asArray(body.memberships || (body.data && body.data.memberships) || body.items);
      const toDeleteIds = asArray(body.toDeleteIds || (body.data && body.data.toDeleteIds));
      const toUpsert = asArray(body.toUpsert || (body.data && body.data.toUpsert));
      await withTransaction(async (client) => {
        if (memberships.length) {
          await client.query(`delete from group_memberships`);
          for (const item of memberships) {
            const raw = safeJsonObject(item);
            const id = firstText(raw.id, crypto.randomUUID());
            await client.query(
              `insert into group_memberships (
                id, person_id, person_name, group_id, role_in_group, notes, created_at, updated_at, raw
              ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
              [
                id,
                firstText(raw.personId),
                firstText(raw.personName),
                firstText(raw.groupId),
                firstText(raw.roleInGroup),
                firstText(raw.notes),
                firstText(raw.createdAt, nowIso()),
                firstText(raw.updatedAt, nowIso()),
                jsonbParam(raw, {}),
              ]
            );
          }
        } else {
          for (const rawId of toDeleteIds) {
            const id = firstText(rawId);
            if (!id) continue;
            await client.query(`delete from group_memberships where id = $1`, [id]);
          }
          for (const item of toUpsert) {
            const raw = safeJsonObject(item);
            const id = firstText(raw.id, crypto.randomUUID());
            await client.query(
              `insert into group_memberships (
                id, person_id, person_name, group_id, role_in_group, notes, created_at, updated_at, raw
              ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
              on conflict (id) do update set
                person_id = excluded.person_id,
                person_name = excluded.person_name,
                group_id = excluded.group_id,
                role_in_group = excluded.role_in_group,
                notes = excluded.notes,
                updated_at = excluded.updated_at,
                raw = excluded.raw`,
              [
                id,
                firstText(raw.personId),
                firstText(raw.personName),
                firstText(raw.groupId),
                firstText(raw.roleInGroup),
                firstText(raw.notes),
                firstText(raw.createdAt, nowIso()),
                firstText(raw.updatedAt, nowIso()),
                jsonbParam(raw, {}),
              ]
            );
          }
        }
      });
      return { ok: true, data: { updated: memberships.length || toUpsert.length, deleted: toDeleteIds.length }, error: null };
    }

    case "getDirectoryProfile": {
      requireAuth();
      const studentId = firstText(body.studentId, auth.studentId);
      if (!studentId) {
        return { ok: false, data: null, error: "Missing studentId" };
      }
      const result = await query(`select * from directories where id = $1 limit 1`, [studentId]);
      const profile = mapDirectoryProfile(rowOrNull(result));
      return { ok: true, data: { profile }, error: null };
    }

    case "updateDirectoryProfile": {
      requireAuth();
      const data = safeJsonObject(body.data);
      const studentId = firstText(data.id, auth.studentId);
      if (!studentId) {
        return { ok: false, data: null, error: "Missing id" };
      }

      const existingResult = await query(`select * from directories where id = $1 limit 1`, [studentId]);
      const existing = rowOrNull(existingResult) || {};

      const preferredName = firstText(data.preferredName, data.displayName, existing.preferred_name || "");
      const mobile = firstText(data.mobile, data.phone, existing.mobile || "");
      const email = normalizeEmail(firstText(data.email, existing.email || ""));
      const mergedRaw = {
        ...(existing.raw && typeof existing.raw === "object" ? existing.raw : {}),
        ...data,
        preferredName,
        displayName: preferredName,
        mobile,
        phone: mobile,
      };

      await query(
        `insert into directories (
          id, group_id, email, name_zh, name_en, preferred_name, company, title, mobile,
          backup_phone, emergency_contact, emergency_phone, dietary_restrictions, photo_url,
          birthday_month, birthday_day, raw
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
        on conflict (id) do update set
          group_id = excluded.group_id,
          email = excluded.email,
          name_zh = excluded.name_zh,
          name_en = excluded.name_en,
          preferred_name = excluded.preferred_name,
          company = excluded.company,
          title = excluded.title,
          mobile = excluded.mobile,
          backup_phone = excluded.backup_phone,
          emergency_contact = excluded.emergency_contact,
          emergency_phone = excluded.emergency_phone,
          dietary_restrictions = excluded.dietary_restrictions,
          photo_url = excluded.photo_url,
          birthday_month = excluded.birthday_month,
          birthday_day = excluded.birthday_day,
          raw = excluded.raw,
          synced_at = now()`,
        [
          studentId,
          firstText(data.group, existing.group_id || ""),
          email,
          firstText(data.nameZh, existing.name_zh || ""),
          firstText(data.nameEn, existing.name_en || ""),
          preferredName,
          firstText(data.company, existing.company || ""),
          firstText(data.title, existing.title || ""),
          mobile,
          firstText(data.backupPhone, existing.backup_phone || ""),
          firstText(data.emergencyContact, existing.emergency_contact || ""),
          firstText(data.emergencyPhone, existing.emergency_phone || ""),
          firstText(data.dietaryRestrictions, existing.dietary_restrictions || ""),
          firstText(data.photoUrl, existing.photo_url || ""),
          firstText(data.birthdayMonth, existing.birthday_month || ""),
          firstText(data.birthdayDay, existing.birthday_day || ""),
          jsonbParam(mergedRaw, {}),
        ]
      );
      const result = await query(`select * from directories where id = $1 limit 1`, [studentId]);
      return { ok: true, data: { profile: mapDirectoryProfile(rowOrNull(result)) }, error: null };
    }

    case "listBirthdays": {
      const result = await query(
        `select
           d.id,
           d.email,
           d.name_zh,
           d.name_en,
           d.preferred_name,
           d.company,
           d.title,
           d.mobile,
           d.birthday_month,
           d.birthday_day,
           d.group_id,
           s.name as student_name
         from directories d
         left join students s on s.id = d.id
         where coalesce(d.birthday_month, '') <> '' and coalesce(d.birthday_day, '') <> ''
         order by
           case when coalesce(d.birthday_month,'') ~ '^[0-9]{1,2}$' then d.birthday_month::int else 99 end,
           case when coalesce(d.birthday_day,'') ~ '^[0-9]{1,2}$' then d.birthday_day::int else 99 end,
           d.id`
      );
      const months = {};
      for (const row of result.rows) {
        const month = String(row.birthday_month || "").trim();
        if (!month) {
          continue;
        }
        if (!months[month]) {
          months[month] = [];
        }
        const birthdayMonth = String(row.birthday_month || "").trim();
        const birthdayDay = String(row.birthday_day || "").trim();
        const fallbackName = firstText(row.student_name, row.name_en || "");
        const nameZh = firstText(row.name_zh);
        const preferredName = firstText(row.preferred_name);
        const displayName = preferredName && preferredName !== nameZh ? preferredName : "";
        months[month].push({
          id: String(row.id || "").trim(),
          email: normalizeEmail(row.email || ""),
          name: firstText(preferredName, firstText(nameZh, fallbackName)),
          nameZh,
          displayName,
          company: firstText(row.company),
          group: firstText(row.group_id),
          // 新舊前端欄位相容
          month: birthdayMonth,
          day: birthdayDay,
          birthdayMonth,
          birthdayDay,
        });
      }
      const currentMonth = new Date().getMonth() + 1;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      return { ok: true, data: { months, currentMonth, nextMonth }, error: null };
    }

    case "listAcademicsBootstrap": {
      requireAuth();
      await ensureAcademicSessionsFresh_(query, withTransaction);
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const canManage = canAccessByGroups(memberships, ACADEMICS_ALLOWED_GROUPS);
      const fromDate = addDaysDateText_(todayDateText_(), -120);
      const toDate = addDaysDateText_(todayDateText_(), 210);

      const persistedSessions = await loadAcademicSessionsInRange_(query, { fromDate, toDate });
      const generatedTargets = buildGeneratedThursdaySessions({ fromDateText: todayDateText_(), weeks: 20 });
      const sessionsById = new Map();
      persistedSessions.forEach((item) => sessionsById.set(item.id, item));
      generatedTargets.forEach((item) => {
        if (!sessionsById.has(item.id)) {
          sessionsById.set(item.id, item);
        }
      });
      const courseLayer = await loadAcademicCourseLayer_(query, Array.from(sessionsById.values()), { includeDraftMakeupNotes: false });

      const myRequestResult = await query(
        `select r.*, d.name_zh as canonical_name_zh, d.preferred_name as canonical_preferred_name
           from makeup_requests r
           left join directories d on d.id = r.student_id
          where r.student_id = $1
          order by coalesce(r.created_at,'' ) desc, r.id desc`,
        [auth.studentId]
      );
      const publicRequestResult = await query(
        `select r.*, d.name_zh as canonical_name_zh, d.preferred_name as canonical_preferred_name
           from makeup_requests r
           left join directories d on d.id = r.student_id
          where coalesce(r.status,'submitted') <> 'cancelled'
          order by coalesce(r.target_session_id,''), coalesce(r.created_at,'' ) desc, r.id desc`
      );
      const requestSessionIds = new Set();
      [...myRequestResult.rows, ...publicRequestResult.rows].forEach((row) => {
        requestSessionIds.add(firstText(row.missed_session_id));
        requestSessionIds.add(firstText(row.target_session_id));
      });
      const missingSessions = await loadAcademicSessionsByIds_(query, Array.from(requestSessionIds));
      missingSessions.forEach((item) => sessionsById.set(item.id, item));

      const sessions = Array.from(sessionsById.values()).sort((left, right) => {
        const a = `${firstText(left.sessionDate)} ${firstText(left.startsAt)} ${firstText(left.id)}`;
        const b = `${firstText(right.sessionDate)} ${firstText(right.startsAt)} ${firstText(right.id)}`;
        return a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" });
      });
      const myRequests = myRequestResult.rows.map((row) => ({
        ...mapMakeupRequestRow(row, sessionsById),
        nameZh: firstText(row.canonical_name_zh),
        displayName: firstText(row.canonical_preferred_name),
      }));
      const publicRequests = publicRequestResult.rows.map((row) => ({
        ...mapMakeupRequestRow(row, sessionsById),
        nameZh: firstText(row.canonical_name_zh),
        displayName: firstText(row.canonical_preferred_name),
      }));
      const summaryByTarget = buildMakeupSummaryByTarget_(publicRequests);

      return {
        ok: true,
        data: {
          sessions,
          regularSessions: normalizeRegularSessionsByDayCourse_(sessions),
          makeupTargets: sessions.filter((item) => item.classKind === "makeup_target"),
          courses: courseLayer.courses,
          courseSessions: courseLayer.courseSessions,
          courseNotes: courseLayer.courseNotes,
          sessionTasks: courseLayer.sessionTasks,
          makeupNotes: courseLayer.makeupNotes,
          myRequests,
          publicRequests,
          summaryByTarget,
          canManage,
        },
        error: null,
      };
    }

    case "listAcademicsAdminBootstrap": {
      requireAuth();
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      await ensureAcademicSessionsFresh_(query, withTransaction);
      const fromDate = addDaysDateText_(todayDateText_(), -180);
      const toDate = addDaysDateText_(todayDateText_(), 365);

      const persistedSessions = await loadAcademicSessionsInRange_(query, { fromDate, toDate });
      const generatedTargets = buildGeneratedThursdaySessions({ fromDateText: todayDateText_(), weeks: 26 });
      const sessionsById = new Map();
      persistedSessions.forEach((item) => sessionsById.set(item.id, item));
      generatedTargets.forEach((item) => {
        if (!sessionsById.has(item.id)) {
          sessionsById.set(item.id, item);
        }
      });
      const courseLayer = await loadAcademicCourseLayer_(query, Array.from(sessionsById.values()), { includeDraftMakeupNotes: true });

      const requestsResult = await query(
        `select * from makeup_requests
         order by coalesce(status,''), coalesce(created_at,'' ) desc, id desc`
      );
      const requestSessionIds = new Set();
      requestsResult.rows.forEach((row) => {
        requestSessionIds.add(firstText(row.missed_session_id));
        requestSessionIds.add(firstText(row.target_session_id));
      });
      const missingSessions = await loadAcademicSessionsByIds_(query, Array.from(requestSessionIds));
      missingSessions.forEach((item) => sessionsById.set(item.id, item));

      const studentOptions = await listAcademicStudentOptions_(query);
      const requests = requestsResult.rows.map((row) => mapMakeupRequestRow(row, sessionsById));
      const summaryByTarget = buildMakeupSummaryByTarget_(requests);
      const sessions = Array.from(sessionsById.values()).sort((left, right) => {
        const a = `${firstText(left.sessionDate)} ${firstText(left.startsAt)} ${firstText(left.id)}`;
        const b = `${firstText(right.sessionDate)} ${firstText(right.startsAt)} ${firstText(right.id)}`;
        return a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" });
      });

      return {
        ok: true,
        data: {
          sessions,
          regularSessions: normalizeRegularSessionsByDayCourse_(sessions),
          makeupTargets: sessions.filter((item) => item.classKind === "makeup_target"),
          requests,
          courses: courseLayer.courses,
          courseSessions: courseLayer.courseSessions,
          courseNotes: courseLayer.courseNotes,
          sessionTasks: courseLayer.sessionTasks,
          makeupNotes: courseLayer.makeupNotes,
          summaryByTarget,
          students: studentOptions,
        },
        error: null,
      };
    }

    case "syncAcademicSessionsFromIcs": {
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      const icsUrl = firstText(body.icsUrl, process.env.ACADEMICS_ICS_URL || "");
      if (!icsUrl) {
        return { ok: false, data: null, error: "Missing icsUrl or ACADEMICS_ICS_URL" };
      }

      const syncResult = await syncAcademicSessionsFromIcs_(query, withTransaction, icsUrl);

      return {
        ok: true,
        data: {
          count: syncResult.count,
        },
        error: null,
      };
    }

    case "submitMakeupRequest": {
      requireAuth();
      const student = await findStudentProfileById(auth.studentId);
      if (!student || !student.id) {
        return { ok: false, data: null, error: "Student profile not found" };
      }

      const payload = safeJsonObject(body.data || body.request || body);
      const missedSessionId = firstText(payload.missedSessionId);
      const targetSessionId = firstText(payload.targetSessionId);
      if (!targetSessionId) {
        return { ok: false, data: null, error: "Missing targetSessionId" };
      }

      let missedSession = null;
      if (missedSessionId) {
        const missedSessionRow = rowOrNull(await query(`select * from academic_sessions where id = $1 limit 1`, [missedSessionId]));
        if (!missedSessionRow) {
          return { ok: false, data: null, error: "原課程不存在" };
        }
        missedSession = mapAcademicSessionRow(missedSessionRow);
        if (missedSession.classKind !== "regular") {
          return { ok: false, data: null, error: "原課程類型不正確" };
        }
      }

      let targetSessionRow = rowOrNull(await query(`select * from academic_sessions where id = $1 limit 1`, [targetSessionId]));
      if (!targetSessionRow) {
        targetSessionRow = await ensureGeneratedMakeupTargetSession_(query, targetSessionId);
      }
      if (!targetSessionRow) {
        return { ok: false, data: null, error: "補課場次不存在" };
      }
      const targetSession = mapAcademicSessionRow(targetSessionRow);
      if (targetSession.classKind !== "makeup_target") {
        return { ok: false, data: null, error: "補課場次類型不正確" };
      }

      const existingActive = await query(
        `select * from makeup_requests
         where student_id = $1
           and target_session_id = $2
           and coalesce(status,'submitted') <> 'cancelled'
         order by coalesce(updated_at,'' ) desc, id desc
         limit 1`,
        [auth.studentId, targetSessionId]
      );
      if (rowOrNull(existingActive)) {
        return { ok: false, data: null, error: "你已經申請過這個補課場次，若要重填請先撤銷。" };
      }

      const row = makeupRequestToDbRow_(payload, {
        ...student,
        email: firstText(student.email, auth && auth.profile ? auth.profile.email : ""),
      });
      await query(
        `insert into makeup_requests (
           id, student_id, student_name, student_email,
           missed_session_id, target_session_id,
           need_meal, need_handout,
           reason, note, admin_note, status,
           created_at, updated_at, cancelled_at, raw
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb
         )`,
        [
          row.id,
          row.studentId,
          row.studentName,
          row.studentEmail,
          row.missedSessionId,
          row.targetSessionId,
          row.needMeal,
          row.needHandout,
          row.reason,
          row.note,
          row.adminNote,
          row.status,
          row.createdAt,
          row.updatedAt,
          row.cancelledAt,
          jsonbParam(row.raw, {}),
        ]
      );
      const created = rowOrNull(await query(`select * from makeup_requests where id = $1 limit 1`, [row.id]));
      const sessionsById = new Map([[targetSession.id, targetSession]]);
      if (missedSession && missedSession.id) {
        sessionsById.set(missedSession.id, missedSession);
      }
      return { ok: true, data: { request: mapMakeupRequestRow(created, sessionsById) }, error: null };
    }

    case "adminCreateMakeupRequest": {
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      const payload = safeJsonObject(body.data || body.request || body);
      const studentId = firstText(payload.studentId, body.studentId);
      const targetSessionId = firstText(payload.targetSessionId, body.targetSessionId);
      const missedSessionId = firstText(payload.missedSessionId, body.missedSessionId);
      if (!studentId || !targetSessionId) {
        return { ok: false, data: null, error: "Missing studentId or targetSessionId" };
      }

      const student = await findStudentProfileById(studentId);
      if (!student || !student.id) {
        return { ok: false, data: null, error: "Student profile not found" };
      }

      let missedSession = null;
      if (missedSessionId) {
        const missedSessionRow = rowOrNull(await query(`select * from academic_sessions where id = $1 limit 1`, [missedSessionId]));
        if (!missedSessionRow) {
          return { ok: false, data: null, error: "原課程不存在" };
        }
        missedSession = mapAcademicSessionRow(missedSessionRow);
        if (missedSession.classKind !== "regular") {
          return { ok: false, data: null, error: "原課程類型不正確" };
        }
      }

      let targetSessionRow = rowOrNull(await query(`select * from academic_sessions where id = $1 limit 1`, [targetSessionId]));
      if (!targetSessionRow) {
        targetSessionRow = await ensureGeneratedMakeupTargetSession_(query, targetSessionId);
      }
      if (!targetSessionRow) {
        return { ok: false, data: null, error: "補課場次不存在" };
      }
      const targetSession = mapAcademicSessionRow(targetSessionRow);
      if (targetSession.classKind !== "makeup_target") {
        return { ok: false, data: null, error: "補課場次類型不正確" };
      }

      const existingActive = await query(
        `select * from makeup_requests
         where student_id = $1
           and target_session_id = $2
           and coalesce(status,'submitted') <> 'cancelled'
         order by coalesce(updated_at,'' ) desc, id desc
         limit 1`,
        [studentId, targetSessionId]
      );
      if (rowOrNull(existingActive)) {
        return { ok: false, data: null, error: "這位同學已經有同場次補課登記。" };
      }

      const row = makeupRequestToDbRow_({
        ...payload,
        missedSessionId,
        targetSessionId,
        status: firstText(payload.status, "submitted"),
      }, student);
      row.raw = {
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        manualCreatedBy: auth.studentId,
        manualCreatedByName: firstText(auth.profile && auth.profile.name ? auth.profile.name : "", auth.studentId),
        manualCreatedAt: nowIso(),
      };

      await query(
        `insert into makeup_requests (
           id, student_id, student_name, student_email,
           missed_session_id, target_session_id,
           need_meal, need_handout,
           reason, note, admin_note, status,
           created_at, updated_at, cancelled_at, raw
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb
         )`,
        [
          row.id,
          row.studentId,
          row.studentName,
          row.studentEmail,
          row.missedSessionId,
          row.targetSessionId,
          row.needMeal,
          row.needHandout,
          row.reason,
          row.note,
          row.adminNote,
          row.status,
          row.createdAt,
          row.updatedAt,
          row.cancelledAt,
          jsonbParam(row.raw, {}),
        ]
      );
      const created = rowOrNull(await query(`select * from makeup_requests where id = $1 limit 1`, [row.id]));
      const sessionsById = new Map([[targetSession.id, targetSession]]);
      if (missedSession && missedSession.id) {
        sessionsById.set(missedSession.id, missedSession);
      }
      return { ok: true, data: { request: mapMakeupRequestRow(created, sessionsById) }, error: null };
    }

    case "cancelMakeupRequest": {
      requireAuth();
      const id = firstText(body.id || (body.data && body.data.id));
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = rowOrNull(await query(`select * from makeup_requests where id = $1 limit 1`, [id]));
      if (!existing) {
        return { ok: false, data: null, error: "Request not found" };
      }
      if (firstText(existing.student_id) !== firstText(auth.studentId)) {
        throw new Error("Unauthorized");
      }
      if (firstText(existing.status).toLowerCase() === "completed") {
        return { ok: false, data: null, error: "已完成的補課不可撤銷" };
      }
      const updatedAt = nowIso();
      const cancelledAt = updatedAt;
      const mergedRaw = {
        ...safeJsonObject(existing.raw),
        status: "cancelled",
        updatedAt,
        cancelledAt,
      };
      await query(
        `update makeup_requests
         set status = 'cancelled',
             cancelled_at = $2,
             updated_at = $3,
             raw = $4::jsonb,
             synced_at = now()
         where id = $1`,
        [id, cancelledAt, updatedAt, jsonbParam(mergedRaw, {})]
      );
      const refreshed = rowOrNull(await query(`select * from makeup_requests where id = $1 limit 1`, [id]));
      const sessions = await loadAcademicSessionsByIds_(query, [
        firstText(refreshed && refreshed.missed_session_id),
        firstText(refreshed && refreshed.target_session_id),
      ]);
      const sessionsById = new Map(sessions.map((item) => [item.id, item]));
      return { ok: true, data: { request: mapMakeupRequestRow(refreshed, sessionsById) }, error: null };
    }

    case "updateMakeupRequest": {
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      const payload = safeJsonObject(body.data || body.request || body);
      const id = firstText(payload.id, body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = rowOrNull(await query(`select * from makeup_requests where id = $1 limit 1`, [id]));
      if (!existing) {
        return { ok: false, data: null, error: "Request not found" };
      }
      const nextStatus = firstText(payload.status, existing.status || "submitted").toLowerCase();
      const allowedStatuses = new Set(["submitted", "notified", "completed", "cancelled"]);
      if (!allowedStatuses.has(nextStatus)) {
        return { ok: false, data: null, error: "Invalid status" };
      }
      const updatedAt = nowIso();
      const cancelledAt = nextStatus === "cancelled" ? firstText(existing.cancelled_at, updatedAt) : firstText(existing.cancelled_at);
      const mergedRaw = {
        ...safeJsonObject(existing.raw),
        status: nextStatus,
        adminNote: firstText(payload.adminNote, existing.admin_note || ""),
        updatedAt,
        cancelledAt,
      };
      await query(
        `update makeup_requests
         set status = $2,
             admin_note = $3,
             updated_at = $4,
             cancelled_at = $5,
             raw = $6::jsonb,
             synced_at = now()
         where id = $1`,
        [id, nextStatus, firstText(payload.adminNote, existing.admin_note || ""), updatedAt, cancelledAt, jsonbParam(mergedRaw, {})]
      );
      const refreshed = rowOrNull(await query(`select * from makeup_requests where id = $1 limit 1`, [id]));
      const sessions = await loadAcademicSessionsByIds_(query, [
        firstText(refreshed && refreshed.missed_session_id),
        firstText(refreshed && refreshed.target_session_id),
      ]);
      const sessionsById = new Map(sessions.map((item) => [item.id, item]));
      return { ok: true, data: { request: mapMakeupRequestRow(refreshed, sessionsById) }, error: null };
    }

    case "upsertAcademicCourseNote": {
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      const payload = safeJsonObject(body.data || body.note || body);
      const courseId = firstText(payload.courseId);
      if (!courseId) {
        return { ok: false, data: null, error: "Missing courseId" };
      }
      const courseRow = rowOrNull(await query(`select * from academic_courses where id = $1 limit 1`, [courseId]));
      if (!courseRow) {
        return { ok: false, data: null, error: "Course not found" };
      }
      const actor = await findStudentProfileById(auth.studentId);
      const existing = rowOrNull(await query(`select * from academic_course_notes where course_id = $1 limit 1`, [courseId]));
      const row = academicCourseToDbRow_(
        {
          ...safeJsonObject(existing && existing.raw),
          ...payload,
          id: firstText(payload.id, existing && existing.id ? existing.id : ""),
          courseId,
        },
        actor || null
      );
      await query(
        `insert into academic_course_notes (
           id, course_id, title, summary, link_url, link_label,
           updated_by, updated_by_name, updated_at, raw
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb
         )
         on conflict (course_id) do update set
           id = excluded.id,
           title = excluded.title,
           summary = excluded.summary,
           link_url = excluded.link_url,
           link_label = excluded.link_label,
           updated_by = excluded.updated_by,
           updated_by_name = excluded.updated_by_name,
           updated_at = excluded.updated_at,
           raw = excluded.raw,
           synced_at = now()`,
        [row.id, row.courseId, row.title, row.summary, row.linkUrl, row.linkLabel, row.updatedBy, row.updatedByName, row.updatedAt, jsonbParam(row.raw, {})]
      );
      const refreshed = rowOrNull(await query(`select * from academic_course_notes where course_id = $1 limit 1`, [courseId]));
      return { ok: true, data: { note: mapAcademicCourseNoteRow_(refreshed) }, error: null };
    }

    case "upsertAcademicSessionTask": {
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      const payload = safeJsonObject(body.data || body.task || body);
      const sessionId = firstText(payload.sessionId);
      if (!sessionId) {
        return { ok: false, data: null, error: "Missing sessionId" };
      }
      const sessionRow = rowOrNull(await query(`select * from academic_sessions where id = $1 limit 1`, [sessionId]));
      if (!sessionRow) {
        return { ok: false, data: null, error: "Session not found" };
      }
      if (firstText(sessionRow.class_kind, sessionRow.raw && sessionRow.raw.classKind) !== "regular") {
        return { ok: false, data: null, error: "Session task only supports regular sessions" };
      }
      const actor = await findStudentProfileById(auth.studentId);
      const existing = rowOrNull(await query(`select * from academic_session_tasks where session_id = $1 limit 1`, [sessionId]));
      const row = academicSessionTaskToDbRow_(
        {
          ...safeJsonObject(existing && existing.raw),
          ...payload,
          id: firstText(payload.id, existing && existing.id ? existing.id : ""),
          sessionId,
        },
        actor || null
      );
      await query(
        `insert into academic_session_tasks (
           id, session_id, homework_notice, quiz_notice,
           updated_by, updated_by_name, updated_at, raw
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8::jsonb
         )
         on conflict (session_id) do update set
           id = excluded.id,
           homework_notice = excluded.homework_notice,
           quiz_notice = excluded.quiz_notice,
           updated_by = excluded.updated_by,
           updated_by_name = excluded.updated_by_name,
           updated_at = excluded.updated_at,
           raw = excluded.raw,
           synced_at = now()`,
        [row.id, row.sessionId, row.homeworkNotice, row.quizNotice, row.updatedBy, row.updatedByName, row.updatedAt, jsonbParam(row.raw, {})]
      );
      const refreshed = rowOrNull(await query(`select * from academic_session_tasks where session_id = $1 limit 1`, [sessionId]));
      return { ok: true, data: { task: mapAcademicSessionTaskRow_(refreshed) }, error: null };
    }

    case "upsertSessionNote": {
      await requireGroupAccess(ACADEMICS_ALLOWED_GROUPS);
      const payload = safeJsonObject(body.data || body.note || body);
      const sessionId = firstText(payload.sessionId);
      if (!sessionId) {
        return { ok: false, data: null, error: "Missing sessionId" };
      }
      const sessionRow = rowOrNull(await query(`select * from academic_sessions where id = $1 limit 1`, [sessionId]));
      if (!sessionRow) {
        return { ok: false, data: null, error: "Session not found" };
      }
      if (firstText(sessionRow.class_kind, sessionRow.raw && sessionRow.raw.classKind) === "regular") {
        return { ok: false, data: null, error: "Regular course note moved to course/session APIs" };
      }
      const actor = await findStudentProfileById(auth.studentId);
      const existing = rowOrNull(await query(`select * from session_notes where session_id = $1 limit 1`, [sessionId]));
      const row = sessionNoteToDbRow_({
        ...safeJsonObject(existing && existing.raw),
        ...payload,
        id: firstText(payload.id, existing && existing.id ? existing.id : ""),
        sessionId,
        publishedAt:
          firstText(payload.status, existing && existing.status ? existing.status : "draft").toLowerCase() === "published"
            ? firstText(payload.publishedAt, existing && existing.published_at ? existing.published_at : nowIso())
            : "",
      }, actor || null);
      await query(
        `insert into session_notes (
           id, session_id, title, summary, link_url, link_label,
           status, published_at, created_by, created_by_name, updated_at, raw
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb
         )
         on conflict (session_id) do update set
           id = excluded.id,
           title = excluded.title,
           summary = excluded.summary,
           link_url = excluded.link_url,
           link_label = excluded.link_label,
           status = excluded.status,
           published_at = excluded.published_at,
           created_by = excluded.created_by,
           created_by_name = excluded.created_by_name,
           updated_at = excluded.updated_at,
           raw = excluded.raw,
           synced_at = now()`,
        [
          row.id,
          row.sessionId,
          row.title,
          row.summary,
          row.linkUrl,
          row.linkLabel,
          row.status,
          row.publishedAt,
          row.createdBy,
          row.createdByName,
          row.updatedAt,
          jsonbParam(row.raw, {}),
        ]
      );
      const refreshed = rowOrNull(await query(`select * from session_notes where session_id = $1 limit 1`, [sessionId]));
      return { ok: true, data: { note: mapSessionNoteRow(refreshed) }, error: null };
    }

    case "listLandingBootstrap": {
      const studentId = auth && auth.studentId ? String(auth.studentId || "").trim() : "";
      if (!studentId) {
        return {
          ok: true,
          data: { memberships: [], notifications: [], unreadCount: 0, needsLogin: true },
          error: null,
        };
      }
      const memberships = await listMembershipsByStudentId(studentId);
      const groupIds = memberships.map((m) => String(m.groupId || "").trim()).filter(Boolean);

      // Todo notification: softball attendance for the next practice.
      try {
        const today = new Date().toISOString().slice(0, 10);
        const practiceResult = await query(
          `select * from softball_practices
           where coalesce(date,'') <> ''
             and coalesce(date,'') >= $1
           order by coalesce(date,''), id
           limit 1`,
          [today]
        );
        const practice = rowOrNull(practiceResult);
        if (practice && practice.id) {
          const practiceId = String(practice.id || "").trim();
          const attendanceResult = await query(
            `select status
             from softball_attendance
             where practice_id = $1
               and player_id = $2
             order by coalesce(updated_at,'') desc, id desc
             limit 1`,
            [practiceId, studentId]
          );
          const attendanceRow = rowOrNull(attendanceResult);
          const normalizedStatus = String((attendanceRow && attendanceRow.status) || "").trim().toLowerCase();
          // Treat "unknown" as not-yet-confirmed, so the todo stays until the user chooses attend/absent.
          const hasConfirmedResponse = Boolean(normalizedStatus && normalizedStatus !== "unknown");
          const todoId = `todo:softball:${practiceId}:${studentId}`;

          if (!hasConfirmedResponse) {
            const createdAtText = nowIso();
            const title = "壘球｜請回覆下一次練球";
            const body = [firstText(practice.date, ""), firstText(practice.title, ""), firstText(practice.location, "")]
              .filter(Boolean)
              .join(" · ");
            const url = `/softball/player?practiceId=${encodeURIComponent(practiceId)}`;
            const raw = {
              kind: "todo",
              todoKey: todoId,
              category: "softball",
              practiceId,
            };

            await query(
              `insert into notifications (
                 id, dedupe_key, kind, status,
                 target_student_id, target_group_id,
                 title, body, url,
                 created_at, updated_at, raw
               ) values ($1,$2,'todo','open',$3,'',$4,$5,$6,$7,now(),$8::jsonb)
               on conflict (id) do update set
                 status = 'open',
                 title = excluded.title,
                 body = excluded.body,
                 url = excluded.url,
                 raw = excluded.raw,
                 target_student_id = excluded.target_student_id,
                 -- Don't bump updated_at on every page load; only bump when transitioning from closed -> open.
                 updated_at = case when notifications.status <> 'open' then excluded.updated_at else notifications.updated_at end`,
              [todoId, todoId, studentId, title, body, url, createdAtText, jsonbParam(raw, {})]
            );
          } else {
            await query(
              `update notifications set status = 'closed', updated_at = now()
               where id = $1 and coalesce(status,'open') <> 'closed'`,
              [todoId]
            );
          }
        }
      } catch (error) {
        // Best-effort only; don't break landing page.
      }

      // Todo notification: event attendance confirmation (treat "尚未確定" as not-yet-confirmed).
      try {
        const parseEventDateValue_ = (value) => {
          if (!value) {
            return null;
          }
          if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
          }
          if (typeof value === "number") {
            const parsedNumber = new Date(value);
            return Number.isNaN(parsedNumber.getTime()) ? null : parsedNumber;
          }
          const raw = String(value || "").trim();
          if (!raw) {
            return null;
          }
          const normalized =
            /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
              ? raw.replace(/\//g, "-").replace(" ", "T")
              : raw;
          const parsed = new Date(normalized);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const isEventExpired_ = (eventRow) => {
          const status = String((eventRow && eventRow.status) || "").trim().toLowerCase();
          if (status && status !== "open") {
            return true;
          }
          const closeAt = parseEventDateValue_(eventRow && eventRow.registration_close_at);
          const endAt = parseEventDateValue_(eventRow && eventRow.end_at);
          const nowMs = Date.now();
          if (closeAt && nowMs > closeAt.getTime()) {
            return true;
          }
          if (endAt && nowMs > endAt.getTime()) {
            return true;
          }
          return false;
        };

        const eventsResult = await query(
          `select id, title, start_at, end_at, location, registration_close_at, status
           from events
           order by coalesce(start_at,''), id
           limit 80`
        );
        const registrationsResult = await query(
          `select event_id, custom_fields, status
           from registrations
           where student_id = $1
             and lower(coalesce(status,'')) <> 'cancelled'
           order by coalesce(updated_at,''), id`,
          [studentId]
        );

        const registrationsByEventId = new Map();
        registrationsResult.rows.forEach((row) => {
          const eventId = String(row.event_id || "").trim();
          if (!eventId || registrationsByEventId.has(eventId)) {
            return;
          }
          registrationsByEventId.set(eventId, row);
        });

        const shouldTreatAsConfirmedAttendance_ = (value) => {
          const attendance = String(value || "").trim();
          return attendance === "出席" || attendance === "不克出席";
        };

        for (const eventRow of eventsResult.rows) {
          const eventId = String(eventRow.id || "").trim();
          if (!eventId) {
            continue;
          }
          const registrationRow = registrationsByEventId.get(eventId);
          if (!registrationRow) {
            continue;
          }

          const fields = safeJsonObject(registrationRow.custom_fields);
          const attendance = String(fields.attendance || "").trim();
          const hasConfirmedAttendance = shouldTreatAsConfirmedAttendance_(attendance);
          const expired = isEventExpired_(eventRow);
          const todoId = `todo:event-attendance:${eventId}:${studentId}`;

          if (!expired && !hasConfirmedAttendance) {
            const createdAtText = nowIso();
            const title = `活動｜請確認出席狀態${eventRow.title ? `：${String(eventRow.title || "").trim()}` : ""}`;
            const body = [firstText(eventRow.start_at, ""), firstText(eventRow.location, "")]
              .filter(Boolean)
              .join(" · ");
            const url = `/register?eventId=${encodeURIComponent(eventId)}`;
            const raw = {
              kind: "todo",
              todoKey: todoId,
              category: "event",
              eventId,
              rule: "attendance_confirm",
              attendance,
            };

            await query(
              `insert into notifications (
                 id, dedupe_key, kind, status,
                 target_student_id, target_group_id,
                 title, body, url,
                 created_at, updated_at, raw
               ) values ($1,$2,'todo','open',$3,'',$4,$5,$6,$7,now(),$8::jsonb)
               on conflict (id) do update set
                 status = 'open',
                 title = excluded.title,
                 body = excluded.body,
                 url = excluded.url,
                 raw = excluded.raw,
                 target_student_id = excluded.target_student_id,
                 updated_at = case when notifications.status <> 'open' then excluded.updated_at else notifications.updated_at end`,
              [todoId, todoId, studentId, title, body, url, createdAtText, jsonbParam(raw, {})]
            );
          } else {
            await query(
              `update notifications set status = 'closed', updated_at = now()
               where id = $1 and coalesce(status,'open') <> 'closed'`,
              [todoId]
            );
          }
        }
      } catch (error) {
        // Best-effort only; don't break landing page.
      }

      // Todo notification: pending meal order before cutoff.
      try {
        const parseOrderDateValue_ = (value) => {
          if (!value) {
            return null;
          }
          if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
          }
          if (typeof value === "number") {
            const parsedNumber = new Date(value);
            return Number.isNaN(parsedNumber.getTime()) ? null : parsedNumber;
          }
          const raw = String(value || "").trim();
          if (!raw) {
            return null;
          }
          const normalized =
            /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
              ? raw.replace(/\//g, "-").replace(" ", "T")
              : raw;
          const parsed = new Date(normalized);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const getOrderCutoffAt_ = (planRow) => {
          const raw = safeJsonObject(planRow && planRow.raw);
          const explicitCutoff = parseOrderDateValue_(
            firstText(raw.cutoffAt, firstText(raw.closeAt, planRow && planRow.close_at ? planRow.close_at : ""))
          );
          if (explicitCutoff) {
            return explicitCutoff;
          }
          const mealDate = parseOrderDateValue_(firstText(planRow && planRow.date ? planRow.date : "", raw.date || ""));
          if (!mealDate) {
            return null;
          }
          const cutoff = new Date(mealDate);
          cutoff.setDate(cutoff.getDate() - 1);
          cutoff.setHours(23, 59, 0, 0);
          return cutoff;
        };

        const isOrderPlanOpen_ = (planRow) => {
          const raw = safeJsonObject(planRow && planRow.raw);
          const status = String(firstText(raw.status, planRow && planRow.status ? planRow.status : "")).trim().toLowerCase();
          if (status && status !== "open") {
            return false;
          }
          const cutoffAt = getOrderCutoffAt_(planRow);
          if (cutoffAt && Date.now() > cutoffAt.getTime()) {
            return false;
          }
          return true;
        };

        const weekdayShortFormatter = new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          weekday: "short",
        });
        const monthDayFormatter = new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          month: "numeric",
          day: "numeric",
        });
        const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
          timeZone: "Asia/Taipei",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Taipei",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const getDateKey_ = (date) => {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return "";
          }
          return dateKeyFormatter.format(date);
        };
        const getWeekStartKey_ = (date) => {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return "";
          }
          const copy = new Date(date.getTime());
          const localDay = copy.getDay();
          const diff = localDay === 0 ? -6 : 1 - localDay;
          copy.setDate(copy.getDate() + diff);
          return getDateKey_(copy);
        };
        const describeMealDay_ = (date) => {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            return "這份";
          }
          const now = new Date();
          const today = getDateKey_(now);
          const tomorrowDate = new Date(now.getTime());
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrow = getDateKey_(tomorrowDate);
          const targetKey = getDateKey_(date);
          if (targetKey === today) {
            return "今天";
          }
          if (targetKey === tomorrow) {
            return "明天";
          }
          const weekday = weekdayShortFormatter.format(date).replace("週", "");
          if (getWeekStartKey_(date) === getWeekStartKey_(now)) {
            return `本週${weekday}`;
          }
          return `${monthDayFormatter.format(date)}（${weekdayShortFormatter.format(date)}）`;
        };
        const describeCutoff_ = (cutoffAt) => {
          if (!(cutoffAt instanceof Date) || Number.isNaN(cutoffAt.getTime())) {
            return "請盡快回覆";
          }
          const now = new Date();
          const today = getDateKey_(now);
          const tomorrowDate = new Date(now.getTime());
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrow = getDateKey_(tomorrowDate);
          const targetKey = getDateKey_(cutoffAt);
          const timeText = timeFormatter.format(cutoffAt);
          if (targetKey === today) {
            return `請在今晚 ${timeText} 前回覆`;
          }
          if (targetKey === tomorrow) {
            return `請在明晚 ${timeText} 前回覆`;
          }
          return `請在 ${monthDayFormatter.format(cutoffAt)} ${weekdayShortFormatter.format(cutoffAt)} ${timeText} 前回覆`;
        };

        const plansResult = await query(`select * from order_plans order by coalesce(date,''), id`);
        const responsesResult = await query(
          `select order_id
             from order_responses
            where student_id = $1`,
          [studentId]
        );
        const respondedOrderIds = new Set(
          responsesResult.rows
            .map((row) => String(row.order_id || "").trim())
            .filter(Boolean)
        );

        for (const planRow of plansResult.rows) {
          const orderId = String(planRow && planRow.id ? planRow.id : "").trim();
          if (!orderId) {
            continue;
          }
          const todoId = `todo:ordering:${orderId}:${studentId}`;
          const rawPlan = safeJsonObject(planRow && planRow.raw);
          const isOpen = isOrderPlanOpen_(planRow);
          const hasResponse = respondedOrderIds.has(orderId);

          if (isOpen && !hasResponse) {
            const createdAtText = nowIso();
            const cutoffAt = getOrderCutoffAt_(planRow);
            const mealDate = parseOrderDateValue_(firstText(planRow && planRow.date ? planRow.date : "", rawPlan.date || ""));
            const title = `${describeMealDay_(mealDate)}便當還沒選`;
            const body = describeCutoff_(cutoffAt);
            const url = "/ordering";
            const raw = {
              kind: "todo",
              todoKey: todoId,
              category: "ordering",
              orderId,
              rule: "order_response_pending",
              title,
              message: body,
              url,
            };

            await query(
              `insert into notifications (
                 id, dedupe_key, kind, status,
                 target_student_id, target_group_id,
                 title, body, url,
                 created_at, updated_at, raw
               ) values ($1,$2,'todo','open',$3,'',$4,$5,$6,$7,now(),$8::jsonb)
               on conflict (id) do update set
                 status = 'open',
                 title = excluded.title,
                 body = excluded.body,
                 url = excluded.url,
                 raw = excluded.raw,
                 target_student_id = excluded.target_student_id,
                 updated_at = case when notifications.status <> 'open' then excluded.updated_at else notifications.updated_at end`,
              [todoId, todoId, studentId, title, body, url, createdAtText, jsonbParam(raw, {})]
            );
          } else {
            await query(
              `update notifications set status = 'closed', updated_at = now()
               where id = $1 and coalesce(status,'open') <> 'closed'`,
              [todoId]
            );
          }
        }
      } catch (error) {
        // Best-effort only; don't break landing page.
      }

      // Info notification: if the student has an active makeup registration and that target session
      // has published reminder info, surface it in notifications.
      try {
        const myMakeupRequestsResult = await query(
          `select * from makeup_requests
           where student_id = $1
             and coalesce(status,'submitted') <> 'cancelled'
           order by coalesce(created_at,'' ) desc, id desc`,
          [studentId]
        );
        const publishedMakeupNotesResult = await query(
          `select * from session_notes
           where coalesce(status,'draft') = 'published'
           order by coalesce(updated_at,'' ) desc, id desc`
        );

        const publishedMakeupNotesBySessionId = new Map(
          publishedMakeupNotesResult.rows
            .map((row) => mapSessionNoteRow(row))
            .map((note) => [firstText(note.sessionId), note])
        );

        const activeReminderTodoIds = new Set();

        for (const requestRow of myMakeupRequestsResult.rows) {
          const targetSessionId = firstText(requestRow && requestRow.target_session_id);
          if (!targetSessionId) {
            continue;
          }
          const note = publishedMakeupNotesBySessionId.get(targetSessionId);
          if (!note) {
            continue;
          }

          const reminderTitle = firstText(note.reminderTitle, note.title);
          const reminderText = firstText(note.reminderText, note.makeupReminder, note.note);
          const reminderLinkUrl = firstText(note.reminderLinkUrl, note.linkUrl);
          const reminderLinkLabel = firstText(note.reminderLinkLabel, note.linkLabel);
          if (!reminderTitle && !reminderText && !reminderLinkUrl) {
            continue;
          }

          const targetSession = buildGeneratedThursdaySessionFromId(targetSessionId) || null;
          const scheduleText = [
            firstText(targetSession && targetSession.sessionDate),
            firstText(targetSession && targetSession.title),
          ]
            .filter(Boolean)
            .join("｜");
          const notificationId = `academics:makeup-reminder:${targetSessionId}:${studentId}`;
          activeReminderTodoIds.add(notificationId);
          const createdAtText = nowIso();
          const title = `補課提醒${scheduleText ? `｜${scheduleText}` : ""}`;
          const bodyParts = [];
          if (reminderTitle) {
            bodyParts.push(reminderTitle);
          }
          if (reminderText) {
            bodyParts.push(reminderText);
          }
          const body = bodyParts.join(" · ");
          const url = `/academics`;
          const raw = {
            kind: "announcement",
            category: "academics_makeup",
            targetSessionId,
            reminderTitle,
            reminderText,
            reminderLinkUrl,
            reminderLinkLabel,
            title,
            message: body,
            url,
            createdAt: createdAtText,
          };

          await query(
            `insert into notifications (
               id, dedupe_key, kind, status,
               target_student_id, target_group_id,
               title, body, url,
               created_at, updated_at, raw
             ) values ($1,$2,'announcement','open',$3,'',$4,$5,$6,$7,now(),$8::jsonb)
             on conflict (id) do update set
               status = 'open',
               title = excluded.title,
               body = excluded.body,
               url = excluded.url,
               raw = excluded.raw,
               target_student_id = excluded.target_student_id,
               updated_at = case
                 when notifications.status <> 'open'
                   or notifications.title is distinct from excluded.title
                   or notifications.body is distinct from excluded.body
                   or notifications.url is distinct from excluded.url
                 then excluded.updated_at
                 else notifications.updated_at
               end`,
            [notificationId, notificationId, studentId, title, body, url, createdAtText, jsonbParam(raw, {})]
          );
        }

        await query(
          `update notifications
           set status = 'closed', updated_at = now()
           where coalesce(raw->>'category','') = 'academics_makeup'
             and coalesce(target_student_id,'') = $1
             and coalesce(status,'open') <> 'closed'
             and not (id = any($2::text[]))`,
          [studentId, Array.from(activeReminderTodoIds).length ? Array.from(activeReminderTodoIds) : ["__none__"]]
        );
      } catch (error) {
        // Best-effort only; don't break landing page.
      }

      const notificationsResult = await query(
        `select n.*, r.read_at, r.seen_updated_at
         from notifications n
         left join notification_reads r
           on r.notification_id = n.id
          and r.student_id = $1
         where coalesce(n.status,'open') = 'open'
           and (coalesce(n.target_student_id, '') = '' or n.target_student_id = $1)
           and (coalesce(n.target_group_id, '') = '' or n.target_group_id = any($2::text[]))
         order by coalesce(n.created_at, '') desc, n.id desc
         limit 50`,
        [studentId, groupIds.length ? groupIds : ["__none__"]]
      );
      const notifications = notificationsResult.rows.map((row) => {
        const raw = row.raw && typeof row.raw === "object" ? row.raw : {};
        const kind = String(row.kind || raw.kind || "announcement").trim() || "announcement";
        const updatedAt = row.updated_at || row.synced_at || null;
        const seenUpdatedAt = row.seen_updated_at || row.read_at || null;
        const isTodo = kind === "todo";
        const isRead = isTodo
          ? false
          : seenUpdatedAt && updatedAt
            ? new Date(seenUpdatedAt).getTime() >= new Date(updatedAt).getTime()
            : Boolean(row.read_at);

        return {
          id: String(row.id || "").trim(),
          kind,
          title: firstText(raw.title, row.title || ""),
          message: firstText(raw.message, row.body || ""),
          url: firstText(raw.url, row.url || ""),
          createdAt: firstText(raw.createdAt, row.created_at || ""),
          isRead,
        };
      });
      const unreadCount = notifications.filter((n) => !n.isRead).length;
      return { ok: true, data: { memberships, notifications, unreadCount }, error: null };
    }

    case "markNotificationRead": {
      requireAuth();
      const notificationId = firstText(body.notificationId || body.id);
      if (!notificationId) {
        return { ok: false, data: null, error: "Missing notificationId" };
      }
      await query(
        `insert into notification_reads (notification_id, student_id, read_at, seen_updated_at)
         values ($1,$2,now(),now())
         on conflict (notification_id, student_id)
         do update set seen_updated_at = excluded.seen_updated_at`,
        [notificationId, auth.studentId]
      );
      return { ok: true, data: { id: notificationId }, error: null };
    }

    case "markAllNotificationsRead": {
      requireAuth();
      const ids = asArray(body.notificationIds).map((id) => String(id || "").trim()).filter(Boolean);
      if (!ids.length) {
        return { ok: true, data: { updated: 0 }, error: null };
      }
      await withTransaction(async (client) => {
        for (const id of ids) {
          await client.query(
            `insert into notification_reads (notification_id, student_id, read_at, seen_updated_at)
             values ($1,$2,now(),now())
             on conflict (notification_id, student_id)
             do update set seen_updated_at = excluded.seen_updated_at`,
            [id, auth.studentId]
          );
        }
      });
      return { ok: true, data: { updated: ids.length }, error: null };
    }

    case "listAdminBootstrap": {
      await requireGroupAccess(["C", "E"]);
      const includeRegistrations = body.includeRegistrations === true;
      const includeCheckins = body.includeCheckins === true;
      const [events, students, memberships] = await Promise.all([
        query(`select * from events order by coalesce(start_at, ''), id`),
        query(`select id, name, google_sub, google_email from students order by coalesce(id,'')`),
        query(`select * from group_memberships order by coalesce(group_id,''), coalesce(person_id,''), id`),
      ]);
      const data = {
        events: events.rows.map((row) => ({
          id: row.id,
          title: row.title || "",
          description: row.description || "",
          startAt: row.start_at || "",
          endAt: row.end_at || "",
          location: row.location || "",
          address: row.address || "",
          registrationOpenAt: row.registration_open_at || "",
          registrationCloseAt: row.registration_close_at || "",
          checkinOpenAt: row.checkin_open_at || "",
          checkinCloseAt: row.checkin_close_at || "",
          registerUrl: row.register_url || "",
          checkinUrl: row.checkin_url || "",
          capacity: row.capacity == null ? "" : String(row.capacity),
          status: row.status || "",
          category: row.category || "",
          formSchema: row.form_schema || {},
        })),
        students: students.rows.map((row) => ({
          id: row.id || "",
          name: row.name || "",
          googleSub: row.google_sub || "",
          googleEmail: row.google_email || "",
        })),
        groupMemberships: memberships.rows.map((row) => ({
          id: row.id || "",
          personId: row.person_id || "",
          personName: row.person_name || "",
          groupId: row.group_id || "",
          roleInGroup: row.role_in_group || "",
          notes: row.notes || "",
          createdAt: row.created_at || "",
          updatedAt: row.updated_at || "",
        })),
      };
      if (includeRegistrations) {
        const registrations = await query(`select * from registrations order by coalesce(created_at,''), id`);
        data.registrations = registrations.rows.map((row) => ({
          id: row.id,
          eventId: row.event_id || "",
          studentId: row.student_id || "",
          userName: row.user_name || "",
          userEmail: row.user_email || "",
          userPhone: row.user_phone || "",
          classYear: row.class_year || "",
          customFields: row.custom_fields || {},
          status: row.status || "",
          createdAt: row.created_at || "",
          updatedAt: row.updated_at || "",
          manualCreatedBy: row.manual_created_by || "",
          manualCreatedByName: row.manual_created_by_name || "",
          manualCreatedAt: row.manual_created_at || "",
        }));
      }
      if (includeCheckins) {
        const checkins = await query(`select * from checkins order by coalesce(checkin_at,''), id`);
        data.checkins = checkins.rows.map((row) => ({
          id: row.id,
          eventId: row.event_id || "",
          registrationId: row.registration_id || "",
          checkinAt: row.checkin_at || "",
          checkinMethod: row.checkin_method || "",
        }));
      }
      return { ok: true, data, error: null };
    }

    case "listOrderPlans": {
      // User-facing page uses this without admin auth.
      const result = await query(`select * from order_plans order by coalesce(date, '') desc, id desc`);
      const plans = result.rows.map((row) => buildOrderPlanForClient_(row));
      return { ok: true, data: { plans }, error: null };
    }

    case "getOrderPublicLinkAdmin": {
      await requireGroupAccess(["I", "E"]);
      const orderPlanId = firstText(body.orderPlanId || body.order_id || body.id);
      if (!orderPlanId) {
        return { ok: true, data: { publicLink: null }, error: null };
      }
      const result = await query(`select * from ordering_public_links where order_plan_id = $1 limit 1`, [orderPlanId]);
      const row = rowOrNull(result);
      const publicLink = row ? normalizeOrderingPublicLinkRow(row) : null;
      return { ok: true, data: { publicLink }, error: null };
    }

    case "listOrderAuditEvents": {
      await requireGroupAccess(["I", "E"]);
      const orderPlanId = firstText(body.orderPlanId || body.order_id || body.id);
      if (!orderPlanId) {
        return { ok: true, data: { events: [] }, error: null };
      }
      const limit = Math.min(100, Math.max(1, Number(body.limit || 20) || 20));
      const result = await query(
        `select e.*, v.id as version_id, v.revision_no as version_revision_no
           from audit_events e
           left join audit_entity_versions v
             on v.batch_id = e.batch_id
            and v.entity_type = e.entity_type
            and v.entity_id = e.entity_id
            and v.action = e.action
          where (e.entity_type = 'order_plan' and e.entity_id = $1)
             or (e.parent_entity_type = 'order_plan' and e.parent_entity_id = $1)
          order by e.created_at desc
          limit $2`,
        [orderPlanId, limit]
      );
      const events = result.rows.map((row) => ({
        id: firstText(row.id),
        batchId: firstText(row.batch_id),
        versionId: firstText(row.version_id),
        revisionNo: row.version_revision_no != null ? Number(row.version_revision_no) || 0 : 0,
        entityType: firstText(row.entity_type),
        entityId: firstText(row.entity_id),
        parentEntityType: firstText(row.parent_entity_type),
        parentEntityId: firstText(row.parent_entity_id),
        action: firstText(row.action),
        actorId: firstText(row.actor_id),
        actorName: firstText(row.actor_name),
        summary: firstText(row.summary),
        severity: firstText(row.severity, 'info'),
        createdAt: asIsoText_(row.created_at),
        diff: safeJsonObject(row.diff),
      }));
      return { ok: true, data: { events }, error: null };
    }

    case "restoreOrderAuditVersion": {
      await requireGroupAccess(["I", "E"]);
      const versionId = firstText(body.versionId || body.id);
      if (!versionId) {
        return { ok: false, data: null, error: "Missing versionId" };
      }
      const result = await withTransaction(async (client) => {
        const txQuery = (text, params = []) => client.query(text, params);
        const actorId = firstText(auth && auth.studentId);
        const actorName = firstText(auth && auth.profile && auth.profile.name, actorId || "system");
        const actorEmail = firstText(auth && auth.profile && auth.profile.email);
        const versionRow = rowOrNull(await txQuery(`select * from audit_entity_versions where id = $1 limit 1 for update`, [versionId]));
        if (!versionRow) {
          return { ok: false, data: null, error: "Version not found" };
        }
        const entityType = firstText(versionRow.entity_type);
        if (!["order_plan", "ordering_public_link"].includes(entityType)) {
          return { ok: false, data: null, error: "Unsupported restore target" };
        }
        const targetSnapshot = safeJsonObject(versionRow.after_data);
        if (!Object.keys(targetSnapshot).length) {
          return { ok: false, data: null, error: "Version snapshot is empty" };
        }

        const batchId = `audit_batch:${crypto.randomUUID()}`;
        const createdAt = nowIso();
        await txQuery(
          `insert into audit_change_batches (id, source, actor_id, actor_name, actor_email, reason, status, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [batchId, 'admin_ui', actorId, actorName, actorEmail, 'restoreOrderAuditVersion', 'pending', createdAt, jsonbParam({ versionId }, {})]
        );

        if (entityType === 'order_plan') {
          const orderPlanId = firstText(versionRow.entity_id, targetSnapshot.id);
          const currentRow = rowOrNull(await txQuery(`select * from order_plans where id = $1 limit 1 for update`, [orderPlanId]));
          const currentSnapshot = currentRow ? buildOrderPlanForClient_(currentRow) : {};
          const nextRevision = currentRow ? Number(currentRow.revision_no || 1) + 1 : 1;
          const nextRow = buildOrderPlanRowFromSnapshot_(targetSnapshot, currentRow, nextRevision, batchId, { actorId, actorName });
          await txQuery(
            `insert into order_plans (
               id, date, title, description, close_at, vendor, items, status, raw, created_at, updated_at,
               revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
             ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16)
             on conflict (id) do update set
               date = excluded.date,
               title = excluded.title,
               description = excluded.description,
               close_at = excluded.close_at,
               vendor = excluded.vendor,
               items = excluded.items,
               status = excluded.status,
               raw = excluded.raw,
               updated_at = excluded.updated_at,
               revision_no = excluded.revision_no,
               last_change_batch_id = excluded.last_change_batch_id,
               last_changed_at = excluded.last_changed_at,
               last_changed_by = excluded.last_changed_by,
               last_changed_by_name = excluded.last_changed_by_name,
               synced_at = now()`,
            [nextRow.id, nextRow.date, nextRow.title, nextRow.description, nextRow.closeAt, nextRow.vendor, jsonbParam(nextRow.items, []), nextRow.status, jsonbParam(nextRow.raw, {}), nextRow.createdAt, nextRow.updatedAt, nextRow.revisionNo, batchId, nextRow.updatedAt, actorId, actorName]
          );
          const afterRow = rowOrNull(await txQuery(`select * from order_plans where id = $1 limit 1`, [orderPlanId]));
          const afterSnapshot = afterRow ? buildOrderPlanForClient_(afterRow) : targetSnapshot;
          const { changedFields, diff } = diffSnapshotsForAudit_(currentSnapshot, afterSnapshot);
          const newVersionId = `audit_version:${crypto.randomUUID()}`;
          const eventId = `audit_event:${crypto.randomUUID()}`;
          await txQuery(
            `insert into audit_entity_versions (id, batch_id, entity_type, entity_id, action, revision_no, before_data, after_data, changed_fields, source_updated_at, actor_id, actor_name, created_at, raw)
             values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb)`,
            [newVersionId, batchId, 'order_plan', orderPlanId, 'restore', nextRevision, jsonbParam(currentSnapshot, {}), jsonbParam(afterSnapshot, {}), changedFields, nextRow.updatedAt, actorId, actorName, nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId, diff }, {})]
          );
          await txQuery(
            `insert into audit_events (id, batch_id, entity_type, entity_id, action, actor_id, actor_name, summary, diff, severity, created_at, raw)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)`,
            [eventId, batchId, 'order_plan', orderPlanId, 'restore', actorId, actorName, `回復訂餐 ${firstText(afterSnapshot.date, orderPlanId)}`, jsonbParam(diff, {}), 'warning', nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId }, {})]
          );
          await txQuery(
            `insert into audit_restores (id, restore_batch_id, target_entity_type, target_entity_id, restored_from_version_id, previous_revision_no, restored_revision_no, actor_id, actor_name, created_at, raw)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
            [`audit_restore:${crypto.randomUUID()}`, batchId, 'order_plan', orderPlanId, versionId, currentRow ? Number(currentRow.revision_no || 1) : null, nextRevision, actorId, actorName, nextRow.updatedAt, jsonbParam({}, {})]
          );
          await txQuery(`update audit_change_batches set status = 'committed', committed_at = $2 where id = $1`, [batchId, nextRow.updatedAt]);
          return { ok: true, data: { plan: afterSnapshot, batchId, revisionNo: nextRevision }, error: null };
        }

        const linkId = firstText(versionRow.entity_id, targetSnapshot.id);
        const currentRow = rowOrNull(await txQuery(`select * from ordering_public_links where id = $1 limit 1 for update`, [linkId]));
        const currentSnapshot = currentRow ? normalizeOrderingPublicLinkRow(currentRow) : {};
        const nextRevision = currentRow ? Number(currentRow.revision_no || 1) + 1 : 1;
        const nextRow = buildOrderingPublicLinkRowFromSnapshot_(targetSnapshot, currentRow, nextRevision, batchId, { actorId, actorName });
        await txQuery(
          `insert into ordering_public_links (
             id, order_plan_id, token, title, description, close_at, status, raw, created_at, updated_at,
             revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
           ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)
           on conflict (id) do update set
             order_plan_id = excluded.order_plan_id,
             token = excluded.token,
             title = excluded.title,
             description = excluded.description,
             close_at = excluded.close_at,
             status = excluded.status,
             raw = excluded.raw,
             updated_at = excluded.updated_at,
             revision_no = excluded.revision_no,
             last_change_batch_id = excluded.last_change_batch_id,
             last_changed_at = excluded.last_changed_at,
             last_changed_by = excluded.last_changed_by,
             last_changed_by_name = excluded.last_changed_by_name,
             synced_at = now()`,
          [nextRow.id, nextRow.orderPlanId, nextRow.token, nextRow.title, nextRow.description, nextRow.closeAt, nextRow.status, jsonbParam(nextRow.raw, {}), nextRow.createdAt, nextRow.updatedAt, nextRow.revisionNo, batchId, nextRow.updatedAt, actorId, actorName]
        );
        const afterRow = rowOrNull(await txQuery(`select * from ordering_public_links where id = $1 limit 1`, [linkId]));
        const afterSnapshot = afterRow ? normalizeOrderingPublicLinkRow(afterRow) : targetSnapshot;
        const { changedFields, diff } = diffSnapshotsForAudit_(currentSnapshot, afterSnapshot);
        const newVersionId = `audit_version:${crypto.randomUUID()}`;
        const eventId = `audit_event:${crypto.randomUUID()}`;
        await txQuery(
          `insert into audit_entity_versions (id, batch_id, entity_type, entity_id, parent_entity_type, parent_entity_id, action, revision_no, before_data, after_data, changed_fields, source_updated_at, actor_id, actor_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15,$16::jsonb)`,
          [newVersionId, batchId, 'ordering_public_link', linkId, 'order_plan', nextRow.orderPlanId, 'restore', nextRevision, jsonbParam(currentSnapshot, {}), jsonbParam(afterSnapshot, {}), changedFields, nextRow.updatedAt, actorId, actorName, nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId, diff }, {})]
        );
        await txQuery(
          `insert into audit_events (id, batch_id, entity_type, entity_id, parent_entity_type, parent_entity_id, action, actor_id, actor_name, summary, diff, severity, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14::jsonb)`,
          [eventId, batchId, 'ordering_public_link', linkId, 'order_plan', nextRow.orderPlanId, 'restore', actorId, actorName, `回復外部訂餐入口 ${nextRow.orderPlanId}`, jsonbParam(diff, {}), 'warning', nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId }, {})]
        );
        await txQuery(
          `insert into audit_restores (id, restore_batch_id, target_entity_type, target_entity_id, restored_from_version_id, previous_revision_no, restored_revision_no, actor_id, actor_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [`audit_restore:${crypto.randomUUID()}`, batchId, 'ordering_public_link', linkId, versionId, currentRow ? Number(currentRow.revision_no || 1) : null, nextRevision, actorId, actorName, nextRow.updatedAt, jsonbParam({}, {})]
        );
        await txQuery(`update audit_change_batches set status = 'committed', committed_at = $2 where id = $1`, [batchId, nextRow.updatedAt]);
        return { ok: true, data: { publicLink: afterSnapshot, batchId, revisionNo: nextRevision }, error: null };
      });
      return result;
    }

    case "getOrderPublicPage": {
      const token = firstText(body.token || body.publicToken);
      if (!token) {
        return { ok: false, data: null, error: "Missing token" };
      }
      const linkRow = rowOrNull(await query(`select * from ordering_public_links where token = $1 limit 1`, [token]));
      if (!linkRow) {
        return { ok: false, data: null, error: "Link not found" };
      }
      const publicLink = normalizeOrderingPublicLinkRow(linkRow);
      if (String(publicLink.status || "").toLowerCase() !== "active") {
        return { ok: false, data: null, error: "Link closed" };
      }
      const planRow = rowOrNull(await query(`select * from order_plans where id = $1 limit 1`, [publicLink.orderPlanId]));
      if (!planRow) {
        return { ok: false, data: null, error: "Order plan not found" };
      }
      const plan = buildOrderPlanForClient_(planRow);
      const closed = isOrderPlanClosed_(plan, publicLink.closeAt);
      return {
        ok: true,
        data: {
          publicLink: {
            id: publicLink.id,
            title: firstText(publicLink.title, plan.title),
            description: firstText(publicLink.description),
            closeAt: firstText(publicLink.closeAt, plan.closeAt, plan.cutoffAt),
            status: publicLink.status,
          },
          plan: {
            ...plan,
            closeAt: firstText(publicLink.closeAt, plan.closeAt, plan.cutoffAt),
            publicTitle: firstText(publicLink.title, plan.title),
            publicDescription: firstText(publicLink.description),
            choices: getOrderChoicesForPlan_(plan),
            isClosed: closed,
          },
        },
        error: null,
      };
    }

    case "createOrderPlan":
    case "updateOrderPlan": {
      await requireGroupAccess(["I", "E"]);
      const row = toOrderPlanRow(body.data || body.plan || body);
      const expectedRevision = firstText(body.expectedRevision, row.raw.expectedRevision);
      const result = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: "admin_ui",
        reason: name,
        entityType: "order_plan",
        entityId: row.id,
        expectedRevision,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from order_plans where id = $1 limit 1 for update`, [row.id])),
        mutate: async ({ txQuery, current, nextRevision, batchId, actor }) => {
          if (current && firstText(current.date) !== row.date) {
            const responseCountResult = await txQuery(`select count(*)::int as count from order_responses where order_id = $1`, [row.id]);
            const responseCount = Number((responseCountResult.rows[0] && responseCountResult.rows[0].count) || 0);
            if (responseCount > 0) {
              const error = new Error(`這筆訂餐已有 ${responseCount} 份回覆，不能直接修改日期，請改用另存新訂餐。`);
              error.statusCode = 409;
              error.code = "ORDER_PLAN_DATE_LOCKED";
              throw error;
            }
          }
          await txQuery(
            `insert into order_plans (
               id, date, title, description, close_at, vendor, items, status, raw, created_at, updated_at,
               revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
             )
             values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16)
             on conflict (id) do update set
               date = excluded.date,
               title = excluded.title,
               description = excluded.description,
               close_at = excluded.close_at,
               vendor = excluded.vendor,
               items = excluded.items,
               status = excluded.status,
               raw = excluded.raw,
               updated_at = excluded.updated_at,
               revision_no = excluded.revision_no,
               last_change_batch_id = excluded.last_change_batch_id,
               last_changed_at = excluded.last_changed_at,
               last_changed_by = excluded.last_changed_by,
               last_changed_by_name = excluded.last_changed_by_name,
               synced_at = now()`,
            [
              row.id,
              row.date,
              row.title,
              row.description,
              row.closeAt,
              row.vendor,
              jsonbParam(row.items, []),
              row.status,
              jsonbParam(row.raw, {}),
              current ? firstText(current.created_at, row.createdAt) : row.createdAt,
              row.updatedAt,
              nextRevision,
              batchId,
              row.updatedAt,
              actor.actorId,
              actor.actorName,
            ]
          );
          const after = rowOrNull(await txQuery(`select * from order_plans where id = $1 limit 1`, [row.id]));
          return {
            action: current ? "update" : "create",
            after,
            returnValue: {
              id: row.id,
              plan: after ? buildOrderPlanForClient_(after) : buildOrderPlanForClient_({ ...row, revision_no: nextRevision }),
            },
          };
        },
        buildSnapshot: (currentRow) => buildOrderPlanForClient_(currentRow),
        buildEvent: ({ action, beforeSnapshot, afterSnapshot, changedFields, diff }) => ({
          summary:
            action === "create"
              ? `建立訂餐 ${firstText(afterSnapshot && afterSnapshot.date, row.date)}`
              : `更新訂餐 ${firstText(afterSnapshot && afterSnapshot.date, beforeSnapshot && beforeSnapshot.date, row.date)}（${changedFields.join(", ") || "無欄位差異"}）`,
          diff,
          severity: changedFields.includes("date") ? "warning" : "info",
        }),
      });
      return { ok: true, data: { id: row.id, plan: result.plan, batchId: result.batchId, revisionNo: result.revisionNo }, error: null };
    }

    case "upsertOrderPublicLink": {
      await requireGroupAccess(["I", "E"]);
      const data = safeJsonObject(body.data || body.publicLink || body);
      const orderPlanId = firstText(data.orderPlanId || body.orderPlanId || body.order_id);
      if (!orderPlanId) {
        return { ok: false, data: null, error: "Missing orderPlanId" };
      }
      const planExists = rowOrNull(await query(`select id from order_plans where id = $1 limit 1`, [orderPlanId]));
      if (!planExists) {
        return { ok: false, data: null, error: "Order plan not found" };
      }
      const existing = rowOrNull(await query(`select * from ordering_public_links where order_plan_id = $1 limit 1`, [orderPlanId]));
      const now = nowIso();
      const row = {
        id: firstNonEmptyText(data.id, existing && existing.id, `order_public:${crypto.randomUUID()}`),
        orderPlanId,
        token: firstNonEmptyText(data.token, existing && existing.token, generateOrderingPublicToken_()),
        title: firstText(data.title),
        description: firstText(data.description),
        closeAt: firstText(data.closeAt),
        status: firstText(data.status, data.enabled === false ? "disabled" : "active"),
        createdAt: firstNonEmptyText(data.createdAt, existing && existing.created_at, now),
        updatedAt: now,
      };
      const raw = {
        ...data,
        id: row.id,
        orderPlanId: row.orderPlanId,
        token: row.token,
        title: row.title,
        description: row.description,
        closeAt: row.closeAt,
        status: row.status,
        enabled: row.status === "active",
      };
      const expectedRevision = firstNonEmptyText(body.expectedRevision, data.expectedRevision, existing && existing.revision_no);
      const result = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: "admin_ui",
        reason: name,
        entityType: "ordering_public_link",
        entityId: row.id,
        expectedRevision,
        parentEntityType: "order_plan",
        parentEntityId: orderPlanId,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from ordering_public_links where id = $1 limit 1 for update`, [row.id])),
        mutate: async ({ txQuery, current, nextRevision, batchId, actor }) => {
          await txQuery(
            `insert into ordering_public_links (
               id, order_plan_id, token, title, description, close_at, status, raw, created_at, updated_at,
               revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
             )
             values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15)
             on conflict (id) do update set
               order_plan_id = excluded.order_plan_id,
               token = excluded.token,
               title = excluded.title,
               description = excluded.description,
               close_at = excluded.close_at,
               status = excluded.status,
               raw = excluded.raw,
               updated_at = excluded.updated_at,
               revision_no = excluded.revision_no,
               last_change_batch_id = excluded.last_change_batch_id,
               last_changed_at = excluded.last_changed_at,
               last_changed_by = excluded.last_changed_by,
               last_changed_by_name = excluded.last_changed_by_name,
               synced_at = now()`,
            [
              row.id,
              row.orderPlanId,
              row.token,
              row.title,
              row.description,
              row.closeAt,
              row.status,
              jsonbParam(raw, {}),
              current ? firstText(current.created_at, row.createdAt) : row.createdAt,
              row.updatedAt,
              nextRevision,
              batchId,
              row.updatedAt,
              actor.actorId,
              actor.actorName,
            ]
          );
          const after = rowOrNull(await txQuery(`select * from ordering_public_links where id = $1 limit 1`, [row.id]));
          return {
            action: current ? "update" : "create",
            after,
            returnValue: {
              publicLink: after ? normalizeOrderingPublicLinkRow(after) : normalizeOrderingPublicLinkRow({
                id: row.id,
                order_plan_id: row.orderPlanId,
                token: row.token,
                title: row.title,
                description: row.description,
                close_at: row.closeAt,
                status: row.status,
                created_at: row.createdAt,
                updated_at: row.updatedAt,
                revision_no: nextRevision,
                raw,
              }),
            },
          };
        },
        buildSnapshot: (currentRow) => normalizeOrderingPublicLinkRow(currentRow),
        buildEvent: ({ action, diff }) => ({
          summary: action === "create" ? `建立外部訂餐入口 ${orderPlanId}` : `更新外部訂餐入口 ${orderPlanId}`,
          diff,
          parentEntityType: "order_plan",
          parentEntityId: orderPlanId,
        }),
      });
      return { ok: true, data: { publicLink: result.publicLink, batchId: result.batchId, revisionNo: result.revisionNo }, error: null };
    }

    case "submitOrderPublicResponse": {
      const data = safeJsonObject(body.data || body.response || body);
      const token = firstText(data.token || body.token);
      if (!token) {
        return { ok: false, data: null, error: "Missing token" };
      }
      const linkRow = rowOrNull(await query(`select * from ordering_public_links where token = $1 limit 1`, [token]));
      if (!linkRow) {
        return { ok: false, data: null, error: "Link not found" };
      }
      const publicLink = normalizeOrderingPublicLinkRow(linkRow);
      if (String(publicLink.status || "").toLowerCase() !== "active") {
        return { ok: false, data: null, error: "Link closed" };
      }
      const planRow = rowOrNull(await query(`select * from order_plans where id = $1 limit 1`, [publicLink.orderPlanId]));
      if (!planRow) {
        return { ok: false, data: null, error: "Order plan not found" };
      }
      const plan = buildOrderPlanForClient_(planRow);
      if (isOrderPlanClosed_(plan, publicLink.closeAt)) {
        return { ok: false, data: null, error: "訂餐已截止" };
      }
      const guestName = firstText(data.guestName, data.displayName, data.studentName);
      const guestGroup = firstText(data.guestGroup, data.sourceLabel);
      const guestContact = firstText(data.guestContact);
      const choice = firstText(data.choice).toUpperCase();
      const comment = firstText(data.comment);
      if (!guestName) {
        return { ok: false, data: null, error: "Missing guestName" };
      }
      if (!["A", "B", "C", "NONE"].includes(choice)) {
        return { ok: false, data: null, error: "Invalid choice" };
      }

      const existingResponsesResult = await query(
        `select id, raw, student_name, created_at
         from order_responses
         where order_id = $1
         order by coalesce(created_at, '') desc, id desc`,
        [publicLink.orderPlanId]
      );
      const normalizedGuestName = normalizeDuplicateKey_(guestName);
      const normalizedGuestGroup = normalizeDuplicateKey_(guestGroup);
      const normalizedGuestContact = normalizeDuplicateKey_(guestContact);
      const possibleDuplicate = existingResponsesResult.rows.find((row) => {
        const raw = safeJsonObject(row && row.raw);
        if (firstText(raw.sourceType) !== "public_external") {
          return false;
        }
        const existingName = normalizeDuplicateKey_(firstText(raw.guestName, row && row.student_name));
        if (!existingName || existingName !== normalizedGuestName) {
          return false;
        }
        const existingGroup = normalizeDuplicateKey_(firstText(raw.guestGroup, raw.sourceLabel));
        const existingContact = normalizeDuplicateKey_(firstText(raw.guestContact));
        if (normalizedGuestContact && existingContact && normalizedGuestContact === existingContact) {
          return true;
        }
        if (!normalizedGuestContact && normalizedGuestGroup && existingGroup && normalizedGuestGroup === existingGroup) {
          return true;
        }
        return false;
      });
      if (possibleDuplicate) {
        return {
          ok: false,
          data: {
            duplicate: true,
            existingId: firstText(possibleDuplicate.id),
            createdAt: firstText(possibleDuplicate.created_at),
          },
          error: "可能重複下單：系統已找到相同姓名且聯絡方式／身分相符的外部訂單。若需修改，請聯絡美食組。",
        };
      }

      const id = `public:${crypto.randomUUID()}`;
      const createdAt = nowIso();
      const choiceLabel = firstText((getOrderChoicesForPlan_(plan).find((item) => item.value === choice) || {}).label);
      const raw = {
        ...data,
        id,
        orderId: publicLink.orderPlanId,
        studentId: "",
        studentName: guestName,
        studentEmail: "",
        displayName: guestName,
        sourceType: "public_external",
        sourceLabel: firstText(guestGroup, "外部自助訂餐"),
        guestName,
        guestGroup,
        guestContact,
        choice,
        choiceLabel,
        comment,
        publicLinkId: publicLink.id,
        publicToken: token,
      };
      await query(
        `insert into order_responses (id, order_id, student_id, student_name, student_email, response, total_amount, created_at, updated_at, raw)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)`,
        [id, publicLink.orderPlanId, "", guestName, "", jsonbParam(raw, {}), null, createdAt, createdAt, jsonbParam(raw, {})]
      );
      return { ok: true, data: { response: raw }, error: null };
    }

    case "submitOrderResponse": {
      requireAuth();
      const data = safeJsonObject(body.data || body.response || body);
      const orderId = firstText(data.orderId || body.orderId);
      if (!orderId) {
        return { ok: false, data: null, error: "Missing orderId" };
      }
      const student = await findStudentProfileById(auth.studentId);
      const id = firstText(data.id, `${orderId}:${auth.studentId}`);
      const createdAt = firstText(data.createdAt, nowIso());
      const updatedAt = nowIso();
      const studentName = firstText(data.studentName, student && student.name ? student.name : "");
      const studentEmail = normalizeEmail(firstText(data.studentEmail, student && student.email ? student.email : ""));
      const choice = firstText(data.choice).toUpperCase();
      const comment = firstText(data.comment);
      await query(
        `insert into order_responses (id, order_id, student_id, student_name, student_email, response, total_amount, created_at, updated_at, raw)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)
         on conflict (id) do update set
           response = excluded.response,
           total_amount = excluded.total_amount,
           updated_at = excluded.updated_at,
           raw = excluded.raw,
           synced_at = now()`,
        [
          id,
          orderId,
          auth.studentId,
          studentName,
          studentEmail,
          jsonbParam(data, {}),
          data.totalAmount == null || data.totalAmount === "" ? null : Number(String(data.totalAmount).replace(/,/g, "")),
          createdAt,
          updatedAt,
          jsonbParam(data, {}),
        ]
      );
      return {
        ok: true,
        data: {
          id,
          response: {
            id,
            orderId,
            studentId: auth.studentId,
            studentName,
            studentEmail,
            choice,
            comment,
            updatedAt,
          },
        },
        error: null,
      };
    }

    case "adminUpsertOrderProxyResponse": {
      await requireGroupAccess(["I", "E"]);
      const data = safeJsonObject(body.data || body.response || body);
      const orderId = firstText(data.orderId || body.orderId);
      const displayName = firstText(data.displayName, data.studentName);
      const choice = firstText(data.choice).toUpperCase();
      if (!orderId) {
        return { ok: false, data: null, error: "Missing orderId" };
      }
      if (!displayName) {
        return { ok: false, data: null, error: "Missing displayName" };
      }
      if (!["A", "B", "C", "NONE"].includes(choice)) {
        return { ok: false, data: null, error: "Invalid choice" };
      }
      const requestedId = firstText(data.id);
      let existing = null;
      if (requestedId) {
        existing = rowOrNull(await query(`select * from order_responses where id = $1 limit 1`, [requestedId]));
      }
      const id = requestedId || `proxy:${crypto.randomUUID()}`;
      const createdAt = existing ? firstText(existing.created_at, data.createdAt, nowIso()) : firstText(data.createdAt, nowIso());
      const updatedAt = nowIso();
      const raw = {
        ...data,
        id,
        orderId,
        studentId: "",
        studentName: displayName,
        studentEmail: "",
        displayName,
        choice,
        comment: firstText(data.comment),
        sourceType: "proxy_external",
        sourceLabel: firstText(data.sourceLabel, "外部代訂"),
        createdBy: auth && auth.studentId ? auth.studentId : "",
      };
      await query(
        `insert into order_responses (id, order_id, student_id, student_name, student_email, response, total_amount, created_at, updated_at, raw)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::jsonb)
         on conflict (id) do update set
           order_id = excluded.order_id,
           student_name = excluded.student_name,
           response = excluded.response,
           updated_at = excluded.updated_at,
           raw = excluded.raw,
           synced_at = now()`,
        [id, orderId, "", displayName, "", jsonbParam(raw, {}), null, createdAt, updatedAt, jsonbParam(raw, {})]
      );
      return { ok: true, data: { id, response: raw }, error: null };
    }

    case "deleteOrderProxyResponse": {
      await requireGroupAccess(["I", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = rowOrNull(await query(`select * from order_responses where id = $1 limit 1`, [id]));
      if (!existing) {
        return { ok: true, data: { id }, error: null };
      }
      const raw = safeJsonObject(existing.raw);
      if (!["proxy_external", "public_external"].includes(firstText(raw.sourceType))) {
        return { ok: false, data: null, error: "Only external responses can be deleted here" };
      }
      await query(`delete from order_responses where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "deleteOrderPlan": {
      await requireGroupAccess(["I", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = rowOrNull(await query(`select * from order_plans where id = $1 limit 1`, [id]));
      if (!existing) {
        return { ok: true, data: { id, deletedResponses: 0 }, error: null };
      }
      const responseCountResult = await query(`select count(*)::int as count from order_responses where order_id = $1`, [id]);
      const deletedResponses = Number((responseCountResult.rows[0] && responseCountResult.rows[0].count) || 0);
      await query(`delete from order_responses where order_id = $1`, [id]);
      await query(`delete from ordering_public_links where order_plan_id = $1`, [id]);
      await query(`delete from order_plans where id = $1`, [id]);
      return { ok: true, data: { id, deletedResponses }, error: null };
    }

    case "markOrderResponsePickedUp": {
      await requireGroupAccess(["I", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = rowOrNull(await query(`select * from order_responses where id = $1 limit 1`, [id]));
      if (!existing) {
        return { ok: false, data: null, error: "Response not found" };
      }
      const updatedAt = nowIso();
      const raw = safeJsonObject(existing.raw);
      raw.pickedUpAt = updatedAt;
      raw.pickedUpBy = auth && auth.studentId ? auth.studentId : "";
      raw.pickedUpByName = firstText(auth && auth.profile && auth.profile.name, auth && auth.studentId ? auth.studentId : "");
      await query(
        `update order_responses
            set response = $2::jsonb,
                raw = $3::jsonb,
                updated_at = $4,
                synced_at = now()
          where id = $1`,
        [id, jsonbParam(raw, {}), jsonbParam(raw, {}), updatedAt]
      );
      return {
        ok: true,
        data: {
          id,
          response: {
            ...raw,
            id,
            studentId: firstText(raw.studentId, existing.student_id || ""),
            studentName: firstText(raw.studentName, existing.student_name || ""),
            studentEmail: normalizeEmail(firstText(raw.studentEmail, existing.student_email || "")),
          },
        },
        error: null,
      };
    }

    case "unmarkOrderResponsePickedUp": {
      await requireGroupAccess(["I", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = rowOrNull(await query(`select * from order_responses where id = $1 limit 1`, [id]));
      if (!existing) {
        return { ok: false, data: null, error: "Response not found" };
      }
      const updatedAt = nowIso();
      const raw = safeJsonObject(existing.raw);
      delete raw.pickedUpAt;
      delete raw.pickedUpBy;
      delete raw.pickedUpByName;
      await query(
        `update order_responses
            set response = $2::jsonb,
                raw = $3::jsonb,
                updated_at = $4,
                synced_at = now()
          where id = $1`,
        [id, jsonbParam(raw, {}), jsonbParam(raw, {}), updatedAt]
      );
      return {
        ok: true,
        data: {
          id,
          response: {
            ...raw,
            id,
            studentId: firstText(raw.studentId, existing.student_id || ""),
            studentName: firstText(raw.studentName, existing.student_name || ""),
            studentEmail: normalizeEmail(firstText(raw.studentEmail, existing.student_email || "")),
          },
        },
        error: null,
      };
    }

    case "listOrderResponses": {
      await requireGroupAccess(["I", "E"]);
      const orderId = firstText(body.orderId);
      if (!orderId) {
        return { ok: true, data: { responses: [] }, error: null };
      }
      const result = await query(
        `select r.*, d.name_zh as canonical_name_zh, d.preferred_name as canonical_preferred_name
           from order_responses r
           left join directories d on d.id = r.student_id
          where r.order_id = $1
          order by coalesce(r.created_at,''), r.id`,
        [orderId]
      );
      const responses = result.rows.map((row) => {
        const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
        return {
          ...raw,
          id: row.id,
          studentId: firstText(raw.studentId, row && row.student_id ? row.student_id : ""),
          studentName: firstText(raw.studentName, row && row.student_name ? row.student_name : ""),
          studentEmail: normalizeEmail(firstText(raw.studentEmail, row && row.student_email ? row.student_email : "")),
          nameZh: String(row.canonical_name_zh || "").trim(),
          displayName: firstText(raw.displayName, String(row.canonical_preferred_name || "").trim()),
        };
      });
      return { ok: true, data: { responses }, error: null };
    }

    case "listOrderResponsesByStudent": {
      requireAuth();
      const result = await query(
        `select r.*, d.name_zh as canonical_name_zh, d.preferred_name as canonical_preferred_name
           from order_responses r
           left join directories d on d.id = r.student_id
          where r.student_id = $1
          order by coalesce(r.created_at,'') desc, r.id desc`,
        [auth.studentId]
      );
      const responses = result.rows.map((row) => {
        const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
        return {
          ...raw,
          id: row.id,
          studentId: firstText(raw.studentId, row && row.student_id ? row.student_id : ""),
          studentName: firstText(raw.studentName, row && row.student_name ? row.student_name : ""),
          studentEmail: normalizeEmail(firstText(raw.studentEmail, row && row.student_email ? row.student_email : "")),
          nameZh: String(row.canonical_name_zh || "").trim(),
          displayName: firstText(raw.displayName, String(row.canonical_preferred_name || "").trim()),
        };
      });
      return { ok: true, data: { responses }, error: null };
    }

    case "listFinanceCategoryTypes": {
      requireAuth();
      const result = await query(`select * from finance_category_types order by coalesce(label,''), id`);
      const items = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id, label: row.label || "" }));
      return { ok: true, data: { categories: items, categoryTypes: items }, error: null };
    }

    case "upsertFinanceCategoryType": {
      await requireGroupAccess(["D", "E"]);
      const data = safeJsonObject(body.data || body.categoryType || body);
      const id = firstText(data.id, crypto.randomUUID());
      await query(
        `insert into finance_category_types (id, label, notes, raw)
         values ($1,$2,$3,$4::jsonb)
         on conflict (id) do update set label=excluded.label, notes=excluded.notes, raw=excluded.raw, synced_at=now()`,
        [id, firstText(data.label), firstText(data.notes), jsonbParam(data, {})]
      );
      return { ok: true, data: { id }, error: null };
    }

    case "deleteFinanceCategoryType": {
      await requireGroupAccess(["D", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from finance_category_types where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listFinanceRoles": {
      await requireGroupAccess(["D", "E"]);
      const result = await query(`select * from finance_roles order by coalesce(role,''), coalesce(student_id,''), id`);
      const roles = result.rows.map((row) => mapFinanceRoleRow(row));
      return { ok: true, data: { roles }, error: null };
    }

    case "upsertFinanceRole": {
      await requireGroupAccess(["D", "E"]);
      const data = safeJsonObject(body.data || body.role || body);
      const id = firstText(data.id, crypto.randomUUID());
      await query(
        `insert into finance_roles (id, role, student_id, student_name, group_ids, raw)
         values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
         on conflict (id) do update set
          role=excluded.role,
          student_id=excluded.student_id,
          student_name=excluded.student_name,
          group_ids=excluded.group_ids,
          raw=excluded.raw,
          synced_at=now()`,
        [id, firstText(data.role), firstText(data.studentId), firstText(data.studentName), jsonbParam(safeJsonArray(data.groupIds), []), jsonbParam(data, {})]
      );
      return { ok: true, data: { id }, error: null };
    }

    case "deleteFinanceRole": {
      await requireGroupAccess(["D", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from finance_roles where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "createFinanceRequest": {
      requireAuth();
      const row = toFinanceRequestRow(body.data || body.request || body);
      if (!row.applicantId) {
        row.applicantId = auth.studentId;
      }
      const student = await findStudentProfileById(row.applicantId);
      if (!row.applicantName && student && student.name) {
        row.applicantName = student.name;
      }
      const applicantMemberships = await listMembershipsByStudentId(row.applicantId);
      const applicantDepartmentCheck = ensureFinanceApplicantDepartmentAllowed_(row, applicantMemberships);
      if (!applicantDepartmentCheck.ok) {
        return { ok: false, data: null, error: applicantDepartmentCheck.error };
      }
      const applicantRole = resolveApplicantGroupRoleByMemberships_(row, applicantMemberships);
      const workflowCreatedByRole = await resolveFinanceWorkflowRoleForActor_(query, auth.studentId);
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      if (!normalizedStatus || normalizedStatus === "pending_lead") {
        row.status = resolveFinanceInitialStatus_(row, applicantMemberships);
      }
      const applicantEmail = normalizeEmail(
        firstText(student && student.email ? student.email : "", firstText(row.raw && row.raw.applicantEmail, auth && auth.profile && auth.profile.email ? auth.profile.email : ""))
      );
      row.raw = {
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        categoryType: row.categoryType,
        amountEstimated: row.amountEstimated,
        amountActual: row.amountActual,
        currency: row.currency,
        paymentMethod: row.paymentMethod,
        vendorName: row.vendorName,
        payeeName: row.payeeName,
        payeeBank: row.payeeBank,
        payeeBankCode: firstText(row.raw && row.raw.payeeBankCode, row.payeeBank),
        payeeAccount: row.payeeAccount,
        relatedPurchaseId: row.relatedPurchaseId,
        noPurchaseReason: row.noPurchaseReason,
        expectedClearDate: row.expectedClearDate,
        attachments: row.attachments || [],
        status: row.status,
        applicantId: row.applicantId,
        applicantName: row.applicantName,
        applicantDepartment: row.applicantDepartment,
        applicantRole: firstText(row.raw && row.raw.applicantRole, applicantRole),
        applicantEmail,
        workflowCreatedByRole: firstText(row.raw && row.raw.workflowCreatedByRole, workflowCreatedByRole),
        submittedAt: row.status !== "draft" ? firstText(row.raw && row.raw.submittedAt, nowIso()) : firstText(row.raw && row.raw.submittedAt),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      const mutation = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: "finance_portal",
        reason: "createFinanceRequest",
        entityType: "finance_request",
        entityId: row.id,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1 for update`, [row.id])),
        mutate: async ({ txQuery, nextRevision, batchId, actor }) => {
          const nextRow = buildFinanceRequestRowFromSnapshot_(row.raw, null, nextRevision, batchId, actor);
          await txQuery(
            `insert into finance_requests (
              id, type, title, description, category_type,
              amount_estimated, amount_actual, currency, payment_method,
              vendor_name, payee_name, payee_bank, payee_account,
              related_purchase_id, no_purchase_reason, expected_clear_date,
              attachments, status,
              applicant_id, applicant_name, applicant_department,
              created_at, updated_at, raw,
              revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27,$28,$29)
            on conflict (id) do update set
              type=excluded.type,
              title=excluded.title,
              description=excluded.description,
              category_type=excluded.category_type,
              amount_estimated=excluded.amount_estimated,
              amount_actual=excluded.amount_actual,
              currency=excluded.currency,
              payment_method=excluded.payment_method,
              vendor_name=excluded.vendor_name,
              payee_name=excluded.payee_name,
              payee_bank=excluded.payee_bank,
              payee_account=excluded.payee_account,
              related_purchase_id=excluded.related_purchase_id,
              no_purchase_reason=excluded.no_purchase_reason,
              expected_clear_date=excluded.expected_clear_date,
              attachments=excluded.attachments,
              status=excluded.status,
              applicant_id=excluded.applicant_id,
              applicant_name=excluded.applicant_name,
              applicant_department=excluded.applicant_department,
              updated_at=excluded.updated_at,
              raw=excluded.raw,
              revision_no=excluded.revision_no,
              last_change_batch_id=excluded.last_change_batch_id,
              last_changed_at=excluded.last_changed_at,
              last_changed_by=excluded.last_changed_by,
              last_changed_by_name=excluded.last_changed_by_name,
              synced_at=now()`,
            [
              nextRow.id,
              nextRow.type,
              nextRow.title,
              nextRow.description,
              nextRow.categoryType,
              nextRow.amountEstimated,
              nextRow.amountActual,
              nextRow.currency,
              nextRow.paymentMethod,
              nextRow.vendorName,
              nextRow.payeeName,
              nextRow.payeeBank,
              nextRow.payeeAccount,
              nextRow.relatedPurchaseId,
              nextRow.noPurchaseReason,
              nextRow.expectedClearDate,
              jsonbParam(nextRow.attachments, []),
              nextRow.status,
              nextRow.applicantId,
              nextRow.applicantName,
              nextRow.applicantDepartment,
              nextRow.createdAt,
              nextRow.updatedAt,
              jsonbParam(nextRow.raw, {}),
              nextRow.revisionNo,
              batchId,
              nextRow.updatedAt,
              nextRow.lastChangedBy,
              nextRow.lastChangedByName,
            ]
          );
          await claimAttachments(txQuery, {
            attachmentIds: extractAttachmentIds(nextRow.attachments),
            entityType: "finance_request",
            entityId: nextRow.id,
            uploadedBy: auth.studentId,
          });
        },
        loadAfter: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1`, [row.id])),
        buildSnapshot: (current) => normalizeFinanceRequestRowForClient_(current),
        buildEvent: ({ action, afterSnapshot, changedFields }) => ({
          summary: action === "create" ? `建立財務申請 ${firstText(afterSnapshot && afterSnapshot.title, row.id)}` : `更新財務申請 ${row.id}`,
          severity: changedFields.includes("status") ? "warning" : "info",
        }),
      });
      return { ok: true, data: { id: row.id, revisionNo: mutation.revisionNo }, error: null };
    }

    case "adminCreateFinanceRequest": {
      await requireGroupAccess(["D", "E"]);
      const row = toFinanceRequestRow(body.data || body.request || body);
      const applicantId = firstText(row.applicantId, body.applicantId);
      if (!applicantId) {
        return { ok: false, data: null, error: "Missing applicantId" };
      }
      row.applicantId = applicantId;
      const student = await findStudentProfileById(applicantId);
      if (!row.applicantName && student && student.name) {
        row.applicantName = student.name;
      }
      const now = nowIso();
      const manualCreatedBy = auth.studentId;
      const manualCreatedByName = firstText(body.manualCreatedByName, firstText(auth.profile && auth.profile.name ? auth.profile.name : "", auth.studentId));
      const workflowCreatedByRole = await resolveFinanceWorkflowRoleForActor_(query, auth.studentId);
      const applicantMemberships = await listMembershipsByStudentId(row.applicantId);
      const applicantDepartmentCheck = ensureFinanceApplicantDepartmentAllowed_(row, applicantMemberships);
      if (!applicantDepartmentCheck.ok) {
        return { ok: false, data: null, error: applicantDepartmentCheck.error };
      }
      const applicantRole = resolveApplicantGroupRoleByMemberships_(row, applicantMemberships);
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      if (!normalizedStatus || normalizedStatus === "pending_lead") {
        row.status = resolveFinanceInitialStatus_(row, applicantMemberships);
      }
      const applicantEmail = normalizeEmail(firstText(student && student.email ? student.email : "", row.raw && row.raw.applicantEmail));
      row.raw = {
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        categoryType: row.categoryType,
        amountEstimated: row.amountEstimated,
        amountActual: row.amountActual,
        currency: row.currency,
        paymentMethod: row.paymentMethod,
        vendorName: row.vendorName,
        payeeName: row.payeeName,
        payeeBank: row.payeeBank,
        payeeBankCode: firstText(row.raw && row.raw.payeeBankCode, row.payeeBank),
        payeeAccount: row.payeeAccount,
        relatedPurchaseId: row.relatedPurchaseId,
        noPurchaseReason: row.noPurchaseReason,
        expectedClearDate: row.expectedClearDate,
        attachments: row.attachments || [],
        status: row.status,
        applicantId: row.applicantId,
        applicantName: row.applicantName,
        applicantDepartment: row.applicantDepartment,
        applicantRole: firstText(row.raw && row.raw.applicantRole, applicantRole),
        applicantEmail,
        workflowCreatedByRole: firstText(row.raw && row.raw.workflowCreatedByRole, workflowCreatedByRole),
        submittedAt: row.status !== "draft" ? firstText(row.raw && row.raw.submittedAt, nowIso()) : firstText(row.raw && row.raw.submittedAt),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        manualCreatedBy,
        manualCreatedByName,
        manualCreatedAt: now,
      };
      const mutation = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: "finance_admin",
        reason: "adminCreateFinanceRequest",
        entityType: "finance_request",
        entityId: row.id,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1 for update`, [row.id])),
        mutate: async ({ txQuery, nextRevision, batchId, actor }) => {
          const nextRow = buildFinanceRequestRowFromSnapshot_(row.raw, null, nextRevision, batchId, actor);
          await txQuery(
            `insert into finance_requests (
              id, type, title, description, category_type,
              amount_estimated, amount_actual, currency, payment_method,
              vendor_name, payee_name, payee_bank, payee_account,
              related_purchase_id, no_purchase_reason, expected_clear_date,
              attachments, status,
              applicant_id, applicant_name, applicant_department,
              created_at, updated_at, raw,
              revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
            ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27,$28,$29)
            on conflict (id) do update set
              type=excluded.type,
              title=excluded.title,
              description=excluded.description,
              category_type=excluded.category_type,
              amount_estimated=excluded.amount_estimated,
              amount_actual=excluded.amount_actual,
              currency=excluded.currency,
              payment_method=excluded.payment_method,
              vendor_name=excluded.vendor_name,
              payee_name=excluded.payee_name,
              payee_bank=excluded.payee_bank,
              payee_account=excluded.payee_account,
              related_purchase_id=excluded.related_purchase_id,
              no_purchase_reason=excluded.no_purchase_reason,
              expected_clear_date=excluded.expected_clear_date,
              attachments=excluded.attachments,
              status=excluded.status,
              applicant_id=excluded.applicant_id,
              applicant_name=excluded.applicant_name,
              applicant_department=excluded.applicant_department,
              updated_at=excluded.updated_at,
              raw=excluded.raw,
              revision_no=excluded.revision_no,
              last_change_batch_id=excluded.last_change_batch_id,
              last_changed_at=excluded.last_changed_at,
              last_changed_by=excluded.last_changed_by,
              last_changed_by_name=excluded.last_changed_by_name,
              synced_at=now()`,
            [
              nextRow.id, nextRow.type, nextRow.title, nextRow.description, nextRow.categoryType,
              nextRow.amountEstimated, nextRow.amountActual, nextRow.currency, nextRow.paymentMethod,
              nextRow.vendorName, nextRow.payeeName, nextRow.payeeBank, nextRow.payeeAccount,
              nextRow.relatedPurchaseId, nextRow.noPurchaseReason, nextRow.expectedClearDate,
              jsonbParam(nextRow.attachments, []), nextRow.status,
              nextRow.applicantId, nextRow.applicantName, nextRow.applicantDepartment,
              nextRow.createdAt, nextRow.updatedAt, jsonbParam(nextRow.raw, {}),
              nextRow.revisionNo, batchId, nextRow.updatedAt, nextRow.lastChangedBy, nextRow.lastChangedByName,
            ]
          );
          await claimAttachments(txQuery, {
            attachmentIds: extractAttachmentIds(nextRow.attachments),
            entityType: "finance_request",
            entityId: nextRow.id,
            uploadedBy: auth.studentId,
            allowUnowned: true,
          });
        },
        loadAfter: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1`, [row.id])),
        buildSnapshot: (current) => normalizeFinanceRequestRowForClient_(current),
        buildEvent: ({ action, afterSnapshot }) => ({
          summary: action === "create" ? `代建財務申請 ${firstText(afterSnapshot && afterSnapshot.title, row.id)}` : `更新財務申請 ${row.id}`,
          severity: "warning",
        }),
      });
      return { ok: true, data: { id: row.id, revisionNo: mutation.revisionNo }, error: null };
    }

    case "updateFinanceRequest": {
      requireAuth();

      const requestId = firstText(body.id, firstText(body.data && body.data.id, body.request && body.request.id));
      const requestAction = firstText(body.requestAction);
      const hasData = Boolean(body.data && typeof body.data === "object");

      if (!requestId && !hasData) {
        return { ok: false, data: null, error: "Missing id" };
      }

      // Workflow transition mode (withdraw/approve/return) - do NOT overwrite the full record.
      if (requestAction && !hasData) {
        const mutation = await applyVersionedMutation({
          withTransaction,
          actor: auth,
          source: "finance_workflow",
          reason: `updateFinanceRequest:${requestAction}`,
          entityType: "finance_request",
          entityId: requestId,
          expectedRevision: body.expectedRevision,
          loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1 for update`, [requestId])),
          mutate: async ({ txQuery, current, nextRevision, batchId, actor }) => {
            if (!current) {
              return { returnValue: { id: requestId, status: "" }, after: null };
            }
            const existingRaw = current.raw && typeof current.raw === "object" ? current.raw : {};
            const existingRecord = mapFinanceRequestRow(current);
            const fromStatus = String(existingRecord.status || "").trim() || "draft";
            const manualCreatedBy = firstText(existingRaw && typeof existingRaw === "object" ? existingRaw.manualCreatedBy : "");
            const isOwner =
              String(existingRecord.applicantId || "").trim() === String(auth.studentId || "").trim() ||
              (manualCreatedBy && String(manualCreatedBy).trim() === String(auth.studentId || "").trim());
            let toStatus = fromStatus;
            let approvalContext = null;
            if (requestAction === "withdraw") {
              if (!isOwner) {
                const error = new Error("Unauthorized");
                error.statusCode = 403;
                throw error;
              }
              toStatus = "withdrawn";
            } else if (requestAction === "return" || requestAction === "approve") {
              const actorRole = firstText(body.actorRole).toLowerCase();
              if (!actorRole) {
                const error = new Error("Unauthorized");
                error.statusCode = 403;
                throw error;
              }
              approvalContext = await loadFinanceApprovalContext_();
              const { memberships, financeRoles, studentIdByEmail } = approvalContext;
              const actorEmail = normalizeEmail(auth && auth.profile && auth.profile.email ? auth.profile.email : "");
              const canApprove = canFinanceActorApprove_(existingRecord, actorRole, auth.studentId, actorEmail, memberships, financeRoles, studentIdByEmail);
              if (!canApprove) {
                const error = new Error("Unauthorized");
                error.statusCode = 403;
                throw error;
              }
              toStatus = requestAction === "return" ? "returned" : resolveFinanceNextStatus_(existingRecord, actorRole, financeRoles, studentIdByEmail);
            } else {
              return { returnValue: { id: requestId, status: fromStatus }, after: current };
            }
            const now = nowIso();
            const resolvedApplicantRole =
              approvalContext && !firstText(existingRaw.applicantRole)
                ? resolveApplicantGroupRoleByMemberships_(existingRecord, approvalContext.memberships, approvalContext.studentIdByEmail)
                : "";
            const nextRaw = {
              ...existingRaw,
              status: toStatus,
              applicantRole: firstText(existingRaw.applicantRole, resolvedApplicantRole),
              updatedAt: now,
              revisionNo: nextRevision,
              lastChangeBatchId: batchId,
              lastChangedAt: now,
              lastChangedBy: actor.actorId,
              lastChangedByName: actor.actorName,
            };
            await txQuery(
              `update finance_requests
                  set status=$2, updated_at=$3, raw=$4::jsonb,
                      revision_no=$5, last_change_batch_id=$6, last_changed_at=$7, last_changed_by=$8, last_changed_by_name=$9,
                      synced_at=now()
                where id=$1`,
              [requestId, toStatus, now, jsonbParam(nextRaw, {}), nextRevision, batchId, now, actor.actorId, actor.actorName]
            );
            const actionId = crypto.randomUUID();
            const actorName = firstText(body.actorName, firstText(auth.profile && auth.profile.name ? auth.profile.name : "", auth.studentId));
            const actorRole = firstText(body.actorRole);
            const notes = firstText(body.actorNote, body.notes);
            const actionRaw = {
              id: actionId,
              requestId,
              actorId: auth.studentId,
              actorName,
              actorRole,
              action: requestAction,
              actionType: requestAction,
              fromStatus,
              toStatus,
              notes,
              createdAt: now,
            };
            await txQuery(
              `insert into finance_actions (id, request_id, actor_id, actor_name, action_type, from_status, to_status, notes, created_at, raw)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
               on conflict (id) do nothing`,
              [actionId, requestId, auth.studentId, actorName, requestAction, fromStatus, toStatus, notes, now, jsonbParam(actionRaw, {})]
            );
            const after = rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1`, [requestId]));
            return { action: "update", after, returnValue: { id: requestId, status: toStatus } };
          },
          loadAfter: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1`, [requestId])),
          buildSnapshot: (current) => normalizeFinanceRequestRowForClient_(current),
          buildEvent: ({ changedFields, afterSnapshot }) => ({
            summary: `${requestAction === "approve" ? "核准" : requestAction === "return" ? "退回" : "撤回"}財務申請 ${firstText(afterSnapshot && afterSnapshot.title, requestId)}`,
            severity: changedFields.includes("status") ? "warning" : "info",
          }),
        });
        return { ok: true, data: { id: requestId, status: mutation && mutation.status ? mutation.status : "" }, error: null };
      }

      // Full update mode (draft/update/submit): update the full record.
      const row = toFinanceRequestRow((body.data || body.request || body));
      row.id = firstText(row.id, requestId);
      if (!row.id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      const existing = await query(`select * from finance_requests where id = $1 limit 1`, [row.id]);
      const existingRow = rowOrNull(existing);
      const existingRecord = existingRow ? mapFinanceRequestRow(existingRow) : null;
      const existingRaw = existingRow && existingRow.raw && typeof existingRow.raw === "object" ? existingRow.raw : {};
      const manualCreatedBy = firstText(existingRaw.manualCreatedBy);
      const isOwner =
        Boolean(existingRecord) &&
        (String(existingRecord.applicantId || "").trim() === String(auth.studentId || "").trim() ||
          (manualCreatedBy && String(manualCreatedBy).trim() === String(auth.studentId || "").trim()));
      let isAdmin = false;
      if (!isOwner) {
        const memberships = await listMembershipsByStudentId(auth.studentId);
        isAdmin = canAccessByGroups(memberships, ["D", "E"]);
      }
      if (!isOwner && !isAdmin) {
        const error = new Error("Unauthorized");
        error.statusCode = 403;
        throw error;
      }
      row.applicantId = firstText(row.applicantId, existingRecord && existingRecord.applicantId ? existingRecord.applicantId : auth.studentId);
      row.applicantDepartment = firstText(row.applicantDepartment, existingRecord && existingRecord.applicantDepartment ? existingRecord.applicantDepartment : "");
      const applicantProfile = await findStudentProfileById(row.applicantId);
      if (!row.applicantName && applicantProfile && applicantProfile.name) {
        row.applicantName = applicantProfile.name;
      }
      const applicantMemberships = await listMembershipsByStudentId(row.applicantId);
      const applicantDepartmentCheck = ensureFinanceApplicantDepartmentAllowed_(row, applicantMemberships);
      if (!applicantDepartmentCheck.ok) {
        return { ok: false, data: null, error: applicantDepartmentCheck.error };
      }
      const applicantRole = resolveApplicantGroupRoleByMemberships_(row, applicantMemberships);
      const normalizedAction = requestAction.toLowerCase();
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      if (normalizedAction === "submit" || !normalizedStatus || normalizedStatus === "pending_lead") {
        row.status = resolveFinanceInitialStatus_(row, applicantMemberships);
      }
      const applicantEmail = normalizeEmail(
        firstText(applicantProfile && applicantProfile.email ? applicantProfile.email : "", firstText(row.raw && row.raw.applicantEmail, firstText(existingRecord && existingRecord.applicantEmail ? existingRecord.applicantEmail : "", auth && auth.profile && auth.profile.email ? auth.profile.email : "")))
      );
      const workflowCreatedByRole = firstText(existingRaw.workflowCreatedByRole, await resolveFinanceWorkflowRoleForActor_(query, manualCreatedBy));
      row.raw = {
        ...((existingRow && existingRow.raw && typeof existingRow.raw === "object" && existingRow.raw) || {}),
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        type: row.type,
        title: row.title,
        description: row.description,
        categoryType: row.categoryType,
        amountEstimated: row.amountEstimated,
        amountActual: row.amountActual,
        currency: row.currency,
        paymentMethod: row.paymentMethod,
        vendorName: row.vendorName,
        payeeName: row.payeeName,
        payeeBank: row.payeeBank,
        payeeBankCode: firstText(row.raw && row.raw.payeeBankCode, row.payeeBank),
        payeeAccount: row.payeeAccount,
        relatedPurchaseId: row.relatedPurchaseId,
        noPurchaseReason: row.noPurchaseReason,
        expectedClearDate: row.expectedClearDate,
        attachments: row.attachments || [],
        status: row.status,
        applicantId: row.applicantId,
        applicantName: row.applicantName,
        applicantDepartment: row.applicantDepartment,
        applicantRole: firstText(row.raw && row.raw.applicantRole, firstText(existingRecord && existingRecord.applicantRole ? existingRecord.applicantRole : "", applicantRole)),
        applicantEmail,
        workflowCreatedByRole: firstText(row.raw && row.raw.workflowCreatedByRole, workflowCreatedByRole),
        submittedAt:
          normalizedAction === "submit" || row.status !== "draft"
            ? firstText(row.raw && row.raw.submittedAt, firstText(existingRecord && existingRecord.submittedAt ? existingRecord.submittedAt : "", nowIso()))
            : firstText(row.raw && row.raw.submittedAt, existingRecord && existingRecord.submittedAt ? existingRecord.submittedAt : ""),
        createdAt: firstText(existingRecord && existingRecord.createdAt ? existingRecord.createdAt : "", row.createdAt),
        updatedAt: row.updatedAt,
      };
      const mutation = await applyVersionedMutation({
        withTransaction,
        actor: auth,
        source: isAdmin ? "finance_admin" : "finance_portal",
        reason: `updateFinanceRequest:${normalizedAction || 'save'}`,
        entityType: "finance_request",
        entityId: row.id,
        expectedRevision: body.expectedRevision,
        loadCurrent: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1 for update`, [row.id])),
        mutate: async ({ txQuery, current, nextRevision, batchId, actor }) => {
          const nextRow = buildFinanceRequestRowFromSnapshot_(row.raw, current, nextRevision, batchId, actor);
          await txQuery(
            `update finance_requests set
              type=$2,title=$3,description=$4,category_type=$5,
              amount_estimated=$6,amount_actual=$7,currency=$8,payment_method=$9,
              vendor_name=$10,payee_name=$11,payee_bank=$12,payee_account=$13,
              related_purchase_id=$14,no_purchase_reason=$15,expected_clear_date=$16,
              attachments=$17::jsonb,status=$18,
              applicant_id=$19,applicant_name=$20,applicant_department=$21,
              updated_at=$22,raw=$23::jsonb,
              revision_no=$24,last_change_batch_id=$25,last_changed_at=$26,last_changed_by=$27,last_changed_by_name=$28,
              synced_at=now()
            where id=$1`,
            [
              row.id,
              nextRow.type,
              nextRow.title,
              nextRow.description,
              nextRow.categoryType,
              nextRow.amountEstimated,
              nextRow.amountActual,
              nextRow.currency,
              nextRow.paymentMethod,
              nextRow.vendorName,
              nextRow.payeeName,
              nextRow.payeeBank,
              nextRow.payeeAccount,
              nextRow.relatedPurchaseId,
              nextRow.noPurchaseReason,
              nextRow.expectedClearDate,
              jsonbParam(nextRow.attachments, []),
              nextRow.status,
              nextRow.applicantId,
              nextRow.applicantName,
              nextRow.applicantDepartment,
              nextRow.updatedAt,
              jsonbParam(nextRow.raw, {}),
              nextRow.revisionNo,
              batchId,
              nextRow.updatedAt,
              nextRow.lastChangedBy,
              nextRow.lastChangedByName,
            ]
          );
          await claimAttachments(txQuery, {
            attachmentIds: extractAttachmentIds(nextRow.attachments),
            entityType: "finance_request",
            entityId: row.id,
            uploadedBy: auth.studentId,
            allowUnowned: true,
          });
        },
        loadAfter: async (txQuery) => rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1`, [row.id])),
        buildSnapshot: (current) => normalizeFinanceRequestRowForClient_(current),
        buildEvent: ({ changedFields, afterSnapshot }) => ({
          summary: normalizedAction === "submit" ? `送出財務申請 ${firstText(afterSnapshot && afterSnapshot.title, row.id)}` : `更新財務申請 ${firstText(afterSnapshot && afterSnapshot.title, row.id)}`,
          severity: changedFields.includes("status") || changedFields.includes("amountActual") || changedFields.includes("amountEstimated") ? "warning" : "info",
        }),
      });
      return { ok: true, data: { id: row.id, revisionNo: mutation.revisionNo }, error: null };
    }

    case "listFinanceAuditEvents": {
      requireAuth();
      const requestId = firstText(body.requestId || body.id);
      if (!requestId) {
        return { ok: true, data: { events: [] }, error: null };
      }
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);
      if (!isAdmin) {
        const requestResult = await query(`select * from finance_requests where id = $1 limit 1`, [requestId]);
        const requestRow = rowOrNull(requestResult);
        if (!requestRow) {
          return { ok: true, data: { events: [] }, error: null };
        }
        const canView = await canViewFinanceRequest_(mapFinanceRequestRow(requestRow));
        if (!canView) {
          const error = new Error("Unauthorized");
          error.statusCode = 403;
          throw error;
        }
      }
      const limit = Math.min(100, Math.max(1, Number(body.limit || 20) || 20));
      const result = await query(
        `select e.*, v.id as version_id, v.revision_no as version_revision_no
           from audit_events e
           left join audit_entity_versions v
             on v.batch_id = e.batch_id
            and v.entity_type = e.entity_type
            and v.entity_id = e.entity_id
            and v.action = e.action
          where e.entity_type = 'finance_request' and e.entity_id = $1
          order by e.created_at desc
          limit $2`,
        [requestId, limit]
      );
      const events = result.rows.map((row) => ({
        id: firstText(row.id),
        batchId: firstText(row.batch_id),
        versionId: firstText(row.version_id),
        revisionNo: row.version_revision_no != null ? Number(row.version_revision_no) || 0 : 0,
        entityType: firstText(row.entity_type),
        entityId: firstText(row.entity_id),
        action: firstText(row.action),
        actorId: firstText(row.actor_id),
        actorName: firstText(row.actor_name),
        summary: firstText(row.summary),
        severity: firstText(row.severity, 'info'),
        createdAt: asIsoText_(row.created_at),
        diff: safeJsonObject(row.diff),
      }));
      return { ok: true, data: { events }, error: null };
    }

    case "restoreFinanceAuditVersion": {
      await requireGroupAccess(["D", "E"]);
      const versionId = firstText(body.versionId || body.id);
      if (!versionId) {
        return { ok: false, data: null, error: "Missing versionId" };
      }
      const result = await withTransaction(async (client) => {
        const txQuery = (text, params = []) => client.query(text, params);
        const actorInfo = { actorId: firstText(auth && auth.studentId), actorName: firstText(auth && auth.profile && auth.profile.name, auth && auth.studentId), actorEmail: firstText(auth && auth.profile && auth.profile.email) };
        const versionRow = rowOrNull(await txQuery(`select * from audit_entity_versions where id = $1 limit 1 for update`, [versionId]));
        if (!versionRow || firstText(versionRow.entity_type) !== 'finance_request') {
          return { ok: false, data: null, error: "Version not found" };
        }
        const targetSnapshot = safeJsonObject(versionRow.after_data);
        if (!Object.keys(targetSnapshot).length) {
          return { ok: false, data: null, error: "Version snapshot is empty" };
        }
        const requestId = firstText(versionRow.entity_id, targetSnapshot.id);
        const batchId = `audit_batch:${crypto.randomUUID()}`;
        const createdAt = nowIso();
        await txQuery(
          `insert into audit_change_batches (id, source, actor_id, actor_name, actor_email, reason, status, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [batchId, 'finance_admin', actorInfo.actorId, actorInfo.actorName, actorInfo.actorEmail, 'restoreFinanceAuditVersion', 'pending', createdAt, jsonbParam({ versionId }, {})]
        );
        const currentRow = rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1 for update`, [requestId]));
        const currentSnapshot = currentRow ? normalizeFinanceRequestRowForClient_(currentRow) : {};
        const nextRevision = currentRow ? Number(currentRow.revision_no || 1) + 1 : 1;
        const nextRow = buildFinanceRequestRowFromSnapshot_(targetSnapshot, currentRow, nextRevision, batchId, actorInfo);
        await txQuery(
          `insert into finance_requests (
            id, type, title, description, category_type,
            amount_estimated, amount_actual, currency, payment_method,
            vendor_name, payee_name, payee_bank, payee_account,
            related_purchase_id, no_purchase_reason, expected_clear_date,
            attachments, status,
            applicant_id, applicant_name, applicant_department,
            created_at, updated_at, raw,
            revision_no, last_change_batch_id, last_changed_at, last_changed_by, last_changed_by_name
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24::jsonb,$25,$26,$27,$28,$29)
          on conflict (id) do update set
            type=excluded.type, title=excluded.title, description=excluded.description, category_type=excluded.category_type,
            amount_estimated=excluded.amount_estimated, amount_actual=excluded.amount_actual, currency=excluded.currency, payment_method=excluded.payment_method,
            vendor_name=excluded.vendor_name, payee_name=excluded.payee_name, payee_bank=excluded.payee_bank, payee_account=excluded.payee_account,
            related_purchase_id=excluded.related_purchase_id, no_purchase_reason=excluded.no_purchase_reason, expected_clear_date=excluded.expected_clear_date,
            attachments=excluded.attachments, status=excluded.status,
            applicant_id=excluded.applicant_id, applicant_name=excluded.applicant_name, applicant_department=excluded.applicant_department,
            updated_at=excluded.updated_at, raw=excluded.raw,
            revision_no=excluded.revision_no, last_change_batch_id=excluded.last_change_batch_id, last_changed_at=excluded.last_changed_at,
            last_changed_by=excluded.last_changed_by, last_changed_by_name=excluded.last_changed_by_name,
            synced_at=now()`,
          [
            nextRow.id, nextRow.type, nextRow.title, nextRow.description, nextRow.categoryType,
            nextRow.amountEstimated, nextRow.amountActual, nextRow.currency, nextRow.paymentMethod,
            nextRow.vendorName, nextRow.payeeName, nextRow.payeeBank, nextRow.payeeAccount,
            nextRow.relatedPurchaseId, nextRow.noPurchaseReason, nextRow.expectedClearDate,
            jsonbParam(nextRow.attachments, []), nextRow.status,
            nextRow.applicantId, nextRow.applicantName, nextRow.applicantDepartment,
            nextRow.createdAt, nextRow.updatedAt, jsonbParam(nextRow.raw, {}),
            nextRow.revisionNo, batchId, nextRow.updatedAt, nextRow.lastChangedBy, nextRow.lastChangedByName,
          ]
        );
        await claimAttachments(txQuery, {
          attachmentIds: extractAttachmentIds(nextRow.attachments),
          entityType: 'finance_request',
          entityId: nextRow.id,
          uploadedBy: actorInfo.actorId,
          allowUnowned: true,
        });
        const afterRow = rowOrNull(await txQuery(`select * from finance_requests where id = $1 limit 1`, [requestId]));
        const afterSnapshot = afterRow ? normalizeFinanceRequestRowForClient_(afterRow) : targetSnapshot;
        const { changedFields, diff } = diffSnapshotsForAudit_(currentSnapshot, afterSnapshot);
        const newVersionId = `audit_version:${crypto.randomUUID()}`;
        const eventAuditId = `audit_event:${crypto.randomUUID()}`;
        await txQuery(
          `insert into audit_entity_versions (id, batch_id, entity_type, entity_id, action, revision_no, before_data, after_data, changed_fields, source_updated_at, actor_id, actor_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb)`,
          [newVersionId, batchId, 'finance_request', requestId, 'restore', nextRevision, jsonbParam(currentSnapshot, {}), jsonbParam(afterSnapshot, {}), changedFields, nextRow.updatedAt, actorInfo.actorId, actorInfo.actorName, nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId, diff }, {})]
        );
        await txQuery(
          `insert into audit_events (id, batch_id, entity_type, entity_id, action, actor_id, actor_name, summary, diff, severity, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)`,
          [eventAuditId, batchId, 'finance_request', requestId, 'restore', actorInfo.actorId, actorInfo.actorName, `回復財務申請 ${firstText(afterSnapshot.title, requestId)}`, jsonbParam(diff, {}), 'warning', nextRow.updatedAt, jsonbParam({ restoredFromVersionId: versionId }, {})]
        );
        await txQuery(
          `insert into audit_restores (id, restore_batch_id, target_entity_type, target_entity_id, restored_from_version_id, previous_revision_no, restored_revision_no, actor_id, actor_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [`audit_restore:${crypto.randomUUID()}`, batchId, 'finance_request', requestId, versionId, currentRow ? Number(currentRow.revision_no || 1) : null, nextRevision, actorInfo.actorId, actorInfo.actorName, nextRow.updatedAt, jsonbParam({}, {})]
        );
        await txQuery(`update audit_change_batches set status = 'committed', committed_at = $2 where id = $1`, [batchId, nextRow.updatedAt]);
        return { ok: true, data: { request: afterSnapshot, batchId, revisionNo: nextRevision }, error: null };
      });
      return result;
    }

    case "listFinanceRequests": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);
      const [result, financeRolesResult] = await Promise.all([
        isAdmin
          ? query(`select * from finance_requests order by coalesce(updated_at,'' ) desc, id desc`)
          : query(
              `select *
               from finance_requests
               where applicant_id = $1
                  or coalesce(raw->>'manualCreatedBy','') = $1
               order by coalesce(updated_at,'') desc, id desc`,
              [auth.studentId]
            ),
        query(`select * from finance_roles order by coalesce(role,''), coalesce(student_id,''), id`),
      ]);
      const financeRoles = financeRolesResult.rows.map((row) => mapFinanceRoleRow(row));
      const rows = [];
      for (const row of result.rows) {
        rows.push(await autoFixFinanceWorkflowIfNeeded_(query, row, financeRoles));
      }
      const requests = [];
      for (const row of rows) {
        const mapped = mapFinanceRequestRow(row);
        mapped.attachments = await hydrateAttachmentItems(query, mapped.attachments);
        requests.push(mapped);
      }
      return { ok: true, data: { requests }, error: null };
    }

    case "listFinanceActions": {
      requireAuth();
      const requestId = firstText(body.requestId);
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);

      if (!requestId && !isAdmin) {
        const error = new Error("Unauthorized");
        error.statusCode = 403;
        throw error;
      }

      if (requestId && !isAdmin) {
        const requestResult = await query(`select * from finance_requests where id = $1 limit 1`, [requestId]);
        const requestRow = rowOrNull(requestResult);
        if (!requestRow) {
          return { ok: true, data: { actions: [] }, error: null };
        }
        const canView = await canViewFinanceRequest_(mapFinanceRequestRow(requestRow));
        if (!canView) {
          const error = new Error("Unauthorized");
          error.statusCode = 403;
          throw error;
        }
      }

      const result = requestId
        ? await query(`select * from finance_actions where request_id = $1 order by coalesce(created_at,''), id`, [requestId])
        : await query(`select * from finance_actions order by coalesce(created_at,'') desc, id desc limit 500`);
      const actions = result.rows.map((row) => mapFinanceActionRow(row));
      return { ok: true, data: { actions }, error: null };
    }

    case "listFinanceActionsByActor": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);

      const actorId = firstText(body.actorId);
      const actorName = firstText(body.actorName);
      const actorNames = safeJsonArray(body.actorNames)
        .map((item) => String(item || "").trim())
        .filter(Boolean);

      let result;
      if (isAdmin) {
        if (actorId) {
          result = await query(
            `select * from finance_actions where actor_id = $1 order by coalesce(created_at,'') desc, id desc limit 500`,
            [actorId]
          );
        } else if (actorName) {
          result = await query(
            `select * from finance_actions where actor_name = $1 order by coalesce(created_at,'') desc, id desc limit 500`,
            [actorName]
          );
        } else if (actorNames.length) {
          result = await query(
            `select * from finance_actions where actor_name = any($1::text[]) order by coalesce(created_at,'') desc, id desc limit 500`,
            [actorNames]
          );
        } else {
          return { ok: true, data: { actions: [] }, error: null };
        }
      } else {
        const studentProfile = await findStudentProfileById(auth.studentId);
        const ownNameCandidates = new Set([
          firstText(auth && auth.profile && auth.profile.name ? auth.profile.name : "").toLowerCase(),
          firstText(studentProfile && studentProfile.name ? studentProfile.name : "").toLowerCase(),
        ]);
        memberships.forEach((item) => {
          const value = firstText(item.personName).toLowerCase();
          if (value) {
            ownNameCandidates.add(value);
          }
        });
        const ownNames = Array.from(ownNameCandidates).filter(Boolean);

        if (ownNames.length) {
          result = await query(
            `select *
             from finance_actions
             where actor_id = $1
                or lower(coalesce(actor_name,'')) = any($2::text[])
             order by coalesce(created_at,'') desc, id desc
             limit 500`,
            [auth.studentId, ownNames]
          );
        } else {
          result = await query(
            `select *
             from finance_actions
             where actor_id = $1
             order by coalesce(created_at,'') desc, id desc
             limit 500`,
            [auth.studentId]
          );
        }
      }

      const actions = result.rows.map((row) => mapFinanceActionRow(row));
      return { ok: true, data: { actions }, error: null };
    }

    case "listFinanceActionsSummary": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);
      const requestIds = safeJsonArray(body.requestIds)
        .map((item) => String(item || "").trim())
        .filter(Boolean);

      if (requestIds.length) {
        let allowedIds = requestIds;
        if (!isAdmin) {
          const requestsResult = await query(`select * from finance_requests where id = any($1::text[])`, [requestIds]);
          const allowedSet = new Set();
          for (const row of requestsResult.rows) {
            const record = mapFinanceRequestRow(row);
            const canView = await canViewFinanceRequest_(record);
            if (canView) {
              allowedSet.add(String(record.id || "").trim());
            }
          }
          allowedIds = requestIds.filter((id) => allowedSet.has(id));
        }

        if (!allowedIds.length) {
          return { ok: true, data: { summary: {} }, error: null };
        }

        const result = await query(
          `with latest as (
             select distinct on (request_id) *
             from finance_actions
             where request_id = any($1::text[])
             order by request_id, coalesce(created_at,'') desc, id desc
           )
           select * from latest`,
          [allowedIds]
        );
        const summary = {};
        for (const row of result.rows) {
          const requestId = String(row.request_id || "").trim();
          if (!requestId) {
            continue;
          }
          summary[requestId] = mapFinanceActionRow(row);
        }
        return { ok: true, data: { summary }, error: null };
      }

      if (!isAdmin) {
        return { ok: true, data: { summary: [] }, error: null };
      }

      // Fallback: global action_type counts.
      const result = await query(
        `select coalesce(action_type,'') as action_type, count(*)::int as count
         from finance_actions
         group by coalesce(action_type,'')
         order by count desc, action_type asc`
      );
      return { ok: true, data: { summary: result.rows }, error: null };
    }

    case "listFinanceBootstrap": {
      requireAuth();
      const [students, memberships, categoryTypes, fundEvents] = await Promise.all([
        query(`select id, name, google_sub, google_email from students order by coalesce(id,'')`),
        query(`select * from group_memberships order by coalesce(group_id,''), coalesce(person_id,''), id`),
        query(`select * from finance_category_types order by coalesce(label,''), id`),
        query(`select * from fund_events order by coalesce(due_date,'') desc, id desc`),
      ]);

      const categories = categoryTypes.rows.map((row) => ({
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        label: row.label || "",
      }));

      return {
        ok: true,
        data: {
          students: students.rows.map((row) => ({
            id: row.id || "",
            name: row.name || "",
            googleSub: row.google_sub || "",
            googleEmail: row.google_email || "",
          })),
          groupMemberships: memberships.rows.map((row) => ({
            id: row.id || "",
            personId: row.person_id || "",
            personName: row.person_name || "",
            groupId: row.group_id || "",
            roleInGroup: row.role_in_group || "",
            notes: row.notes || "",
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || "",
          })),
          categories,
          categoryTypes: categories,
          fundEvents: fundEvents.rows.map((row) => mapFundEventRow(row)),
        },
        error: null,
      };
    }

    case "listFinanceApplicantBootstrap": {
      requireAuth();
      const [students, memberships, categoryTypes, fundEvents, requests, financeRolesResult] = await Promise.all([
        query(`select id, name, google_sub, google_email from students order by coalesce(id,'')`),
        query(`select * from group_memberships order by coalesce(group_id,''), coalesce(person_id,''), id`),
        query(`select * from finance_category_types order by coalesce(label,''), id`),
        query(`select * from fund_events order by coalesce(due_date,'') desc, id desc`),
        query(
          `select *
           from finance_requests
           where applicant_id = $1
              or coalesce(raw->>'manualCreatedBy','') = $1
           order by coalesce(updated_at,'') desc, id desc`,
          [auth.studentId]
        ),
        query(`select * from finance_roles order by coalesce(role,''), coalesce(student_id,''), id`),
      ]);

      const categories = categoryTypes.rows.map((row) => ({
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        label: row.label || "",
      }));
      const financeRoles = financeRolesResult.rows.map((row) => mapFinanceRoleRow(row));
      const requestRows = [];
      for (const row of requests.rows) {
        requestRows.push(await autoFixFinanceWorkflowIfNeeded_(query, row, financeRoles));
      }

      return {
        ok: true,
        data: {
          requests: requestRows.map((row) => mapFinanceRequestRow(row)),
          students: students.rows.map((row) => ({
            id: row.id || "",
            name: row.name || "",
            googleSub: row.google_sub || "",
            googleEmail: row.google_email || "",
          })),
          groupMemberships: memberships.rows.map((row) => ({
            id: row.id || "",
            personId: row.person_id || "",
            personName: row.person_name || "",
            groupId: row.group_id || "",
            roleInGroup: row.role_in_group || "",
            notes: row.notes || "",
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || "",
          })),
          categories,
          categoryTypes: categories,
          fundEvents: fundEvents.rows.map((row) => mapFundEventRow(row)),
        },
        error: null,
      };
    }

    case "listFinanceAdminBootstrap": {
      requireAuth();
      const includeRequests = body.includeRequests === true;

      const [students, memberships, categoryTypes, roles, fundEvents, fundSummary, requests] = await Promise.all([
        query(`select id, name, google_sub, google_email from students order by coalesce(id,'')`),
        query(`select * from group_memberships order by coalesce(group_id,''), coalesce(person_id,''), id`),
        query(`select * from finance_category_types order by coalesce(label,''), id`),
        query(`select * from finance_roles order by coalesce(role,''), coalesce(student_id,''), id`),
        query(`select * from fund_events order by coalesce(due_date,'') desc, id desc`),
        (async () => {
          const [totalsResult, expensesResult] = await Promise.all([
            query(
              `select
                 sum(case when coalesce(received_at,'') <> '' or coalesce(created_at,'') <> '' then coalesce(amount,0) else 0 end)::numeric as received,
                 sum(case when coalesce(accounted_at,'') <> '' then coalesce(amount,0) else 0 end)::numeric as accounted,
                 sum(case when coalesce(confirmed_at,'') <> '' then coalesce(amount,0) else 0 end)::numeric as confirmed
               from fund_payments`
            ),
            query(
              `select sum(coalesce(amount_actual,0))::numeric as total
               from finance_requests
               where lower(coalesce(status,'')) = 'closed'
                 and lower(coalesce(type,'')) in ('payment','pettycash')`
            ),
          ]);
          const totalsRow = rowOrNull(totalsResult) || {};
          const expensesRow = rowOrNull(expensesResult) || {};
          const received = Number(totalsRow.received || 0);
          const accounted = Number(totalsRow.accounted || 0);
          const confirmed = Number(totalsRow.confirmed || 0);
          const expensesTotal = Number(expensesRow.total || 0);
          return {
            income: { received, accounted, confirmed },
            expense: { total: expensesTotal },
            balance: {
              received: received - expensesTotal,
              accounted: accounted - expensesTotal,
              confirmed: confirmed - expensesTotal,
            },
          };
        })(),
        includeRequests
          ? query(`select * from finance_requests order by coalesce(updated_at,'') desc, id desc`)
          : Promise.resolve({ rows: [] }),
      ]);

      const categories = categoryTypes.rows.map((row) => ({
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        label: row.label || "",
      }));

      const requestRows = [];
      if (includeRequests) {
        const financeRolesForFix = roles.rows.map((row) => mapFinanceRoleRow(row));
        for (const row of requests.rows) {
          requestRows.push(await autoFixFinanceWorkflowIfNeeded_(query, row, financeRolesForFix));
        }
      }

      return {
        ok: true,
        data: {
          requests: includeRequests ? requestRows.map((row) => mapFinanceRequestRow(row)) : undefined,
          students: students.rows.map((row) => ({
            id: row.id || "",
            name: row.name || "",
            googleSub: row.google_sub || "",
            googleEmail: row.google_email || "",
          })),
          groupMemberships: memberships.rows.map((row) => ({
            id: row.id || "",
            personId: row.person_id || "",
            personName: row.person_name || "",
            groupId: row.group_id || "",
            roleInGroup: row.role_in_group || "",
            notes: row.notes || "",
            createdAt: row.created_at || "",
            updatedAt: row.updated_at || "",
          })),
          roles: roles.rows.map((row) => mapFinanceRoleRow(row)),
          categories,
          categoryTypes: categories,
          fundEvents: fundEvents.rows.map((row) => mapFundEventRow(row)),
          fundSummary,
        },
        error: null,
      };
    }

    case "listMyMemberships": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      return { ok: true, data: { memberships }, error: null };
    }

    case "listApprovalsOverview": {
      requireAuth();

      const context = await loadFinanceApprovalContext_();
      const requestsResult = await query(`select * from finance_requests order by coalesce(updated_at,'') desc, id desc`);
      const actorId = String(auth.studentId || "").trim();
      const actorEmail = normalizeEmail(auth && auth.profile && auth.profile.email ? auth.profile.email : "");

      let pending = 0;
      let inProgress = 0;
      let completed = 0;
      let returned = 0;

      for (const row of requestsResult.rows) {
        const record = mapFinanceRequestRow(row);
        const status = String(record.status || "").trim().toLowerCase();
        const isMine = isSameApplicant_(record, actorId, actorEmail);

        if (status === "closed") {
          if (isMine) {
            completed += 1;
          }
          continue;
        }

        if (status === "returned") {
          if (isMine) {
            returned += 1;
          }
          continue;
        }

        if (!status.startsWith("pending_")) {
          continue;
        }

        const canApprove = canApproveFinanceRequestForIdentity_(
          record,
          actorId,
          actorEmail,
          context.memberships,
          context.financeRoles,
          context.studentIdByEmail
        );
        if (canApprove) {
          pending += 1;
          continue;
        }

        if (isMine) {
          inProgress += 1;
        }
      }

      const total = pending + inProgress + completed + returned;
      return { ok: true, data: { pending, inProgress, completed, returned, total }, error: null };
    }

    case "listFundEvents": {
      requireAuth();
      const result = await query(`select * from fund_events order by coalesce(due_date,'') desc, id desc`);
      const events = result.rows.map((row) => mapFundEventRow(row));
      return { ok: true, data: { events }, error: null };
    }

    case "upsertFundEvent": {
      await requireGroupAccess(["D", "E"]);
      const row = toFundEventRow(body.data || body.event || body);
      await query(
        `insert into fund_events (id, title, description, due_date, amount_general, amount_sponsor, expected_general_count, expected_sponsor_count, status, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)
         on conflict (id) do update set
           title=excluded.title,
           description=excluded.description,
           due_date=excluded.due_date,
           amount_general=excluded.amount_general,
           amount_sponsor=excluded.amount_sponsor,
           expected_general_count=excluded.expected_general_count,
           expected_sponsor_count=excluded.expected_sponsor_count,
           status=excluded.status,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [
          row.id,
          row.title,
          row.description,
          row.dueDate,
          row.amountGeneral,
          row.amountSponsor,
          row.expectedGeneralCount,
          row.expectedSponsorCount,
          row.status,
          row.notes,
          jsonbParam(row.raw, {}),
          row.createdAt,
          row.updatedAt,
        ]
      );
      return { ok: true, data: { id: row.id }, error: null };
    }

    case "deleteFundEvent": {
      await requireGroupAccess(["D", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from fund_events where id = $1`, [id]);
      await query(`delete from fund_payments where event_id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listFundPayments": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);

      const eventId = firstText(body.eventId);
      if (!eventId && !isAdmin) {
        return { ok: true, data: { payments: [] }, error: null };
      }

      const result = eventId
        ? isAdmin
          ? await query(
              `select * from fund_payments where event_id = $1 order by coalesce(received_at,'') desc, id desc`,
              [eventId]
            )
          : await query(
              `select * from fund_payments where event_id = $1 and payer_id = $2 order by coalesce(received_at,'') desc, id desc`,
              [eventId, auth.studentId]
            )
        : await query(`select * from fund_payments order by coalesce(received_at,'') desc, id desc limit 1000`);

      const payments = result.rows.map((row) => mapFundPaymentRow(row));
      return { ok: true, data: { payments }, error: null };
    }

    case "upsertFundPayment": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["D", "E"]);

      const row = toFundPaymentRow(body.data || body.payment || body);

      if (!isAdmin) {
        // Student submission: lock payer to self and ignore admin-only bookkeeping fields.
        row.payerId = auth.studentId;
        row.accountedAt = "";
        row.confirmedAt = "";
        row.raw = { ...(row.raw && typeof row.raw === "object" ? row.raw : {}), payerId: auth.studentId, accountedAt: "", confirmedAt: "" };

        // Prevent editing other people's payment rows.
        const existing = await query(`select payer_id from fund_payments where id = $1 limit 1`, [row.id]);
        const existingRow = rowOrNull(existing);
        if (existingRow) {
          const existingPayer = String(existingRow.payer_id || "").trim();
          if (existingPayer && existingPayer !== String(auth.studentId || "").trim()) {
            const error = new Error("Unauthorized");
            error.statusCode = 403;
            throw error;
          }
        }
      }

      await query(
        `insert into fund_payments (id, event_id, payer_id, payer_name, payer_email, payer_type, amount, method, transfer_last5, received_at, accounted_at, confirmed_at, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
         on conflict (id) do update set
           event_id=excluded.event_id,
           payer_id=excluded.payer_id,
           payer_name=excluded.payer_name,
           payer_email=excluded.payer_email,
           payer_type=excluded.payer_type,
           amount=excluded.amount,
           method=excluded.method,
           transfer_last5=excluded.transfer_last5,
           received_at=excluded.received_at,
           accounted_at=excluded.accounted_at,
           confirmed_at=excluded.confirmed_at,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [
          row.id,
          row.eventId,
          row.payerId,
          row.payerName,
          row.payerEmail,
          row.payerType,
          row.amount,
          row.method,
          row.transferLast5,
          row.receivedAt,
          row.accountedAt,
          row.confirmedAt,
          row.notes,
          jsonbParam(row.raw, {}),
          row.createdAt,
          row.updatedAt,
        ]
      );
      return { ok: true, data: { id: row.id }, error: null };
    }

    case "deleteFundPayment": {
      await requireGroupAccess(["D", "E"]);
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from fund_payments where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "getFundSummary": {
      await requireGroupAccess(["D", "E"]);

      const [totalsResult, expensesResult] = await Promise.all([
        query(
          `select
             sum(case when coalesce(received_at,'') <> '' or coalesce(created_at,'') <> '' then coalesce(amount,0) else 0 end)::numeric as received,
             sum(case when coalesce(accounted_at,'') <> '' then coalesce(amount,0) else 0 end)::numeric as accounted,
             sum(case when coalesce(confirmed_at,'') <> '' then coalesce(amount,0) else 0 end)::numeric as confirmed
           from fund_payments`
        ),
        query(
          `select sum(coalesce(amount_actual,0))::numeric as total
           from finance_requests
           where lower(coalesce(status,'')) = 'closed'
             and lower(coalesce(type,'')) in ('payment','pettycash')`
        ),
      ]);

      const totalsRow = rowOrNull(totalsResult) || {};
      const expensesRow = rowOrNull(expensesResult) || {};

      const received = Number(totalsRow.received || 0);
      const accounted = Number(totalsRow.accounted || 0);
      const confirmed = Number(totalsRow.confirmed || 0);
      const expensesTotal = Number(expensesRow.total || 0);

      return {
        ok: true,
        data: {
          income: {
            received,
            accounted,
            confirmed,
          },
          expense: {
            total: expensesTotal,
          },
          balance: {
            received: received - expensesTotal,
            accounted: accounted - expensesTotal,
            confirmed: confirmed - expensesTotal,
          },
        },
        error: null,
      };
    }

    case "getSoftballAdminAccess": {
      const access = await getSoftballAdminAccess_();
      return {
        ok: true,
        data: {
          allowed: access.allowed,
          source: access.source,
        },
        error: null,
      };
    }

    case "listSoftballMemberships": {
      await requireSoftballAdminAccess();
      const result = await query(
        `select * from group_memberships where group_id = 'K' order by coalesce(role_in_group,''), coalesce(person_name,''), person_id`
      );
      const memberships = result.rows.map((row) => ({
        id: row.id || "",
        personId: row.person_id || "",
        personName: row.person_name || "",
        groupId: row.group_id || "",
        roleInGroup: row.role_in_group || "",
        notes: row.notes || "",
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || "",
      }));
      return { ok: true, data: { memberships }, error: null };
    }

    case "setSoftballMembershipRole": {
      await requireSoftballAdminAccess();
      const personId = firstText(body.personId);
      const role = firstText(body.role);
      if (!personId) {
        return { ok: false, data: null, error: "Missing personId" };
      }
      // 移除角色
      if (role === "" || role === "none") {
        await query(`delete from group_memberships where person_id = $1 and group_id = 'K'`, [personId]);
        return { ok: true, data: { personId, action: "removed" }, error: null };
      }
      // 檢查角色是否有效
      const validRoles = ["manager", "lead", "deputy", "member"];
      const normalizedRole = role.toLowerCase();
      if (!validRoles.includes(normalizedRole)) {
        return { ok: false, data: null, error: `Invalid role: ${role}. Must be one of: ${validRoles.join(", ")}, none` };
      }
      // 查詢球員姓名
      const personResult = await query(`select name_zh, name_en, preferred_name from directories where id = $1 limit 1`, [personId]);
      const personRow = rowOrNull(personResult);
      const personName = personRow ? firstText(personRow.preferred_name, firstText(personRow.name_zh, personRow.name_en)) : "";
      // 設定角色
      const id = `${personId}::K::${normalizedRole}`;
      const createdAt = nowIso();
      const updatedAt = nowIso();
      await query(
        `insert into group_memberships (id, person_id, person_name, group_id, role_in_group, notes, created_at, updated_at)
         values ($1,$2,$3,'K',$4,'',$5,$6)
         on conflict (id) do update set
           person_name=excluded.person_name,
           role_in_group=excluded.role_in_group,
           updated_at=excluded.updated_at`,
        [id, personId, personName, normalizedRole, createdAt, updatedAt]
      );
      return { ok: true, data: { personId, role: normalizedRole, action: "set" }, error: null };
    }

    case "listSoftballConfig": {
      requireAuth();
      const result = await query(`select * from softball_config where id = 'singleton' limit 1`);
      const row = rowOrNull(result);
      return { ok: true, data: { config: row ? row.raw || {} : {} }, error: null };
    }

    case "listSoftballBootstrap": {
      await requireSoftballAdminAccess();
      const [configResult, playersResult, practicesResult, fieldsResult, gearResult, angelsResult, vendorsResult, supplyCasesResult] = await Promise.all([
        query(`select * from softball_config where id = 'singleton' limit 1`),
        query(`select * from softball_players order by coalesce(name,''), id`),
        query(`select * from softball_practices order by coalesce(date,'') desc, id desc`),
        query(`select * from softball_fields order by coalesce(name,''), id`),
        query(`select * from softball_gear order by coalesce(name,''), id`),
        query(`select * from softball_angel_roster order by coalesce(joined_at,''), coalesce(student_id,''), id`),
        query(`select * from softball_supply_vendors order by coalesce(name,''), id`),
        query(`select * from softball_supply_cases order by coalesce(updated_at,'') desc, id desc`),
      ]);
      const configRow = rowOrNull(configResult);
      return {
        ok: true,
        data: {
          config: configRow ? configRow.raw || {} : {},
          players: playersResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          practices: practicesResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          fields: fieldsResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          gear: gearResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          angels: angelsResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          vendors: vendorsResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          supplyCases: supplyCasesResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
        },
        error: null,
      };
    }

    case "updateSoftballConfig": {
      await requireSoftballAdminAccess();
      const data = safeJsonObject(body.data || body.config || body);
      await query(
        `insert into softball_config (id, raw, updated_at) values ('singleton',$1::jsonb,$2)
         on conflict (id) do update set raw=excluded.raw, updated_at=excluded.updated_at, synced_at=now()`,
        [jsonbParam(data, {}), nowIso()]
      );
      return { ok: true, data: { config: data }, error: null };
    }

    case "listSoftballPlayers": {
      requireAuth();
      const result = await query(`select * from softball_players order by coalesce(name,''), id`);
      const players = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { players }, error: null };
    }

    case "createSoftballPlayer":
    case "updateSoftballPlayer": {
      await requireSoftballAdminAccess();
      const row = toSoftballPlayerRow(body.data || body.player || body);
      await query(
        `insert into softball_players (id, name, email, phone, jersey_no, jersey_size, positions, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
         on conflict (id) do update set
           name=excluded.name,
           email=excluded.email,
           phone=excluded.phone,
           jersey_no=excluded.jersey_no,
           jersey_size=excluded.jersey_size,
           positions=excluded.positions,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [row.id, row.name, row.email, row.phone, row.jerseyNo, row.jerseySize, jsonbParam(row.positions, []), jsonbParam(row.raw, {}), row.createdAt, row.updatedAt]
      );
      return { ok: true, data: { id: row.id }, error: null };
    }

    case "upsertMySoftballPlayerProfile": {
      requireAuth();
      const data = safeJsonObject(body.data || body.player || body);
      data.id = firstText(data.id, auth.studentId);
      data.email = firstText(data.email, auth.profile && auth.profile.email ? auth.profile.email : "");
      const row = toSoftballPlayerRow(data);
      await query(
        `insert into softball_players (id, name, email, phone, jersey_no, jersey_size, positions, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
         on conflict (id) do update set
           name=excluded.name,
           email=excluded.email,
           phone=excluded.phone,
           jersey_no=excluded.jersey_no,
           jersey_size=excluded.jersey_size,
           positions=excluded.positions,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [row.id, row.name, row.email, row.phone, row.jerseyNo, row.jerseySize, jsonbParam(row.positions, []), jsonbParam(row.raw, {}), row.createdAt, row.updatedAt]
      );
      return { ok: true, data: { id: row.id }, error: null };
    }

    case "deleteSoftballPlayer": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_players where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballPractices": {
      requireAuth();
      const result = await query(`select * from softball_practices order by coalesce(date,'') desc, id desc`);
      const practices = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { practices }, error: null };
    }

    case "createSoftballPractice":
    case "updateSoftballPractice": {
      await requireSoftballAdminAccess();
      const row = toSoftballPracticeRow(body.data || body.practice || body);
      await query(
        `insert into softball_practices (id, date, title, location, start_at, end_at, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
         on conflict (id) do update set
           date=excluded.date,
           title=excluded.title,
           location=excluded.location,
           start_at=excluded.start_at,
           end_at=excluded.end_at,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [row.id, row.date, row.title, row.location, row.startAt, row.endAt, row.notes, jsonbParam(row.raw, {}), row.createdAt, row.updatedAt]
      );
      return {
        ok: true,
        data: {
          id: row.id,
          practice: { ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id },
        },
        error: null,
      };
    }

    case "deleteSoftballPractice": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_practices where id = $1`, [id]);
      await query(`delete from softball_attendance where practice_id = $1`, [id]);
      await query(`delete from softball_supply_cases where practice_id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballAttendance": {
      requireAuth();
      const softballAccess = await getSoftballAdminAccess_();
      const isAdmin = softballAccess.allowed;
      const practiceId = firstText(body.practiceId);
      const requestedStudentId = firstText(body.studentId);
      const studentId = firstText(body.studentId, auth.studentId);
      let result;
      if (practiceId) {
        result = await query(
          `with att as (
             select *,
               coalesce(practice_id, raw->>'practiceId', raw->>'practice_id') as practice_key,
               coalesce(player_id, raw->>'playerId', raw->>'studentId', raw->>'player_id') as player_key
             from softball_attendance
             where coalesce(practice_id, raw->>'practiceId', raw->>'practice_id') = $1 ${
               isAdmin ? "" : "and coalesce(player_id, raw->>'playerId', raw->>'studentId', raw->>'player_id') = $2"
             }
           )
           select distinct on (practice_key, player_key) *
           from att
           order by practice_key, player_key, coalesce(updated_at,'') desc, id desc`,
          isAdmin ? [practiceId] : [practiceId, studentId]
        );
      } else if (isAdmin && !requestedStudentId) {
        // Admin without an explicit student filter: list recent rows for all players.
        result = await query(
          `with att as (
             select *,
               coalesce(practice_id, raw->>'practiceId', raw->>'practice_id') as practice_key,
               coalesce(player_id, raw->>'playerId', raw->>'studentId', raw->>'player_id') as player_key
             from softball_attendance
           )
           select distinct on (practice_key, player_key) *
           from att
           order by practice_key, player_key, coalesce(updated_at,'') desc, id desc
           limit 2000`
        );
      } else {
        // Even for admins, when studentId is provided, only return that student's attendance.
        result = await query(
          `with att as (
             select *,
               coalesce(practice_id, raw->>'practiceId', raw->>'practice_id') as practice_key,
               coalesce(player_id, raw->>'playerId', raw->>'studentId', raw->>'player_id') as player_key
             from softball_attendance
             where coalesce(player_id, raw->>'playerId', raw->>'studentId', raw->>'player_id') = $1
           )
           select distinct on (practice_key, player_key) *
           from att
           order by practice_key, player_key, coalesce(updated_at,'') desc, id desc
           limit 500`,
          [studentId]
        );
      }
      const attendance = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { attendance }, error: null };
    }

    case "submitSoftballAttendance": {
      requireAuth();
      const softballAccess = await getSoftballAdminAccess_();
      const isAdmin = softballAccess.allowed;
      const data = safeJsonObject(body.data || body.attendance || body);
      const practiceId = firstText(data.practiceId || body.practiceId);
      const playerId = firstText(data.playerId || data.studentId || body.playerId || body.studentId, auth.studentId);
      if (!practiceId || !playerId) {
        return { ok: false, data: null, error: "Missing practiceId/playerId" };
      }
      if (!isAdmin && String(playerId) !== String(auth.studentId)) {
        return { ok: false, data: null, error: "Unauthorized" };
      }
      const canonicalId = `${practiceId}:${playerId}`;
      const id = canonicalId;
      const existing = await query(
        `select * from softball_attendance where practice_id = $1 and player_id = $2 limit 1`,
        [practiceId, playerId]
      );
      const existingRow = existing.rows && existing.rows.length ? existing.rows[0] : null;
      const createdAt = firstText(existingRow && existingRow.created_at ? existingRow.created_at : "", data.createdAt, nowIso());
      const updatedAt = nowIso();
      const notes = firstText(data.notes || data.note || body.note || body.notes);
      const raw = {
        ...(data || {}),
        id,
        practiceId,
        playerId,
        studentId: playerId,
        notes,
      };
      await query(
        `insert into softball_attendance (id, practice_id, player_id, status, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         on conflict (practice_id, player_id) do update set
           id=excluded.id,
           status=excluded.status,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [id, practiceId, playerId, firstText(data.status), notes, jsonbParam(raw, {}), createdAt, updatedAt]
      );

      const stored = await query(
        `select * from softball_attendance where practice_id = $1 and player_id = $2 limit 1`,
        [practiceId, playerId]
      );
      const row = stored.rows && stored.rows.length ? stored.rows[0] : null;
      const attendance = row
        ? { ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }
        : null;

      return { ok: true, data: { id, attendance }, error: null };
    }

    case "listSoftballFields": {
      requireAuth();
      const result = await query(`select * from softball_fields order by coalesce(name,''), id`);
      const fields = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { fields }, error: null };
    }

    case "createSoftballField":
    case "updateSoftballField": {
      await requireSoftballAdminAccess();
      const data = safeJsonObject(body.data || body.field || body);
      const id = firstText(data.id, crypto.randomUUID());
      const createdAt = firstText(data.createdAt, nowIso());
      const updatedAt = nowIso();
      await query(
        `insert into softball_fields (id, name, address, map_url, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7)
         on conflict (id) do update set
           name=excluded.name,
           address=excluded.address,
           map_url=excluded.map_url,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [id, firstText(data.name), firstText(data.address), firstText(data.mapUrl || data.map_url), jsonbParam(data, {}), createdAt, updatedAt]
      );
      return { ok: true, data: { id }, error: null };
    }

    case "deleteSoftballField": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_fields where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballGear": {
      requireAuth();
      const result = await query(`select * from softball_gear order by coalesce(name,''), id`);
      const gear = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { gear }, error: null };
    }

    case "createSoftballGear":
    case "updateSoftballGear": {
      await requireSoftballAdminAccess();
      const data = safeJsonObject(body.data || body.gear || body);
      const id = firstText(data.id, crypto.randomUUID());
      const createdAt = firstText(data.createdAt, nowIso());
      const updatedAt = nowIso();
      await query(
        `insert into softball_gear (id, name, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4::jsonb,$5,$6)
         on conflict (id) do update set
           name=excluded.name,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [id, firstText(data.name), firstText(data.notes), jsonbParam(data, {}), createdAt, updatedAt]
      );
      return { ok: true, data: { id }, error: null };
    }

    case "deleteSoftballGear": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_gear where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballAngels": {
      await requireSoftballAdminAccess();
      const result = await query(`select * from softball_angel_roster order by coalesce(joined_at,''), coalesce(student_id,''), id`);
      const angels = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { angels }, error: null };
    }

    case "createSoftballAngel":
    case "updateSoftballAngel": {
      await requireSoftballAdminAccess();
      const row = toSoftballAngelRosterRow(body.data || body.angel || body);
      if (!row.studentId) {
        return { ok: false, data: null, error: "Missing studentId" };
      }
      const existingByStudent = await query(`select * from softball_angel_roster where student_id = $1 limit 1`, [row.studentId]);
      const existing = rowOrNull(existingByStudent);
      const id = existing ? firstText(existing.id, row.id) : row.id;
      const createdAt = existing ? firstText(existing.created_at, row.createdAt) : row.createdAt;
      await query(
        `insert into softball_angel_roster (id, student_id, status, notes, joined_at, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
         on conflict (id) do update set
           student_id=excluded.student_id,
           status=excluded.status,
           notes=excluded.notes,
           joined_at=excluded.joined_at,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [id, row.studentId, row.status, row.notes, row.joinedAt, jsonbParam({ ...row.raw, id, studentId: row.studentId }, {}), createdAt, row.updatedAt]
      );
      return { ok: true, data: { id }, error: null };
    }

    case "deleteSoftballAngel": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_angel_roster where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballSupplyVendors": {
      await requireSoftballAdminAccess();
      const result = await query(`select * from softball_supply_vendors order by coalesce(name,''), id`);
      const vendors = result.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id }));
      return { ok: true, data: { vendors }, error: null };
    }

    case "createSoftballSupplyVendor":
    case "updateSoftballSupplyVendor": {
      await requireSoftballAdminAccess();
      const row = toSoftballSupplyVendorRow(body.data || body.vendor || body);
      await query(
        `insert into softball_supply_vendors (id, name, category, phone, contact, delivery_note, min_order_amount, status, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
         on conflict (id) do update set
           name=excluded.name,
           category=excluded.category,
           phone=excluded.phone,
           contact=excluded.contact,
           delivery_note=excluded.delivery_note,
           min_order_amount=excluded.min_order_amount,
           status=excluded.status,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [row.id, row.name, row.category, row.phone, row.contact, row.deliveryNote, row.minOrderAmount, row.status, row.notes, jsonbParam(row.raw, {}), row.createdAt, row.updatedAt]
      );
      return { ok: true, data: { id: row.id }, error: null };
    }

    case "deleteSoftballSupplyVendor": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_supply_vendors where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballSupplyCases": {
      await requireSoftballAdminAccess();
      const result = await query(`select * from softball_supply_cases order by coalesce(updated_at,'') desc, id desc`);
      const supplyCases = result.rows.map((row) => ({
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        title: firstText(row.raw && row.raw.title, row.title || ""),
        vendorId: firstText(row.raw && row.raw.vendorId, row.vendor_id || ""),
        vendorIds: Array.isArray(row.raw && row.raw.vendorIds)
          ? row.raw.vendorIds
          : Array.isArray(row.vendor_ids)
          ? row.vendor_ids
          : safeJsonArray(row.vendor_ids),
      }));
      return { ok: true, data: { supplyCases }, error: null };
    }

    case "createSoftballSupplyCase":
    case "updateSoftballSupplyCase": {
      await requireSoftballAdminAccess();
      const row = toSoftballSupplyCaseRow(body.data || body.supplyCase || body);
      if (!row.practiceId) {
        return { ok: false, data: null, error: "Missing practiceId" };
      }
      const existingByPractice = await query(`select * from softball_supply_cases where practice_id = $1 limit 1`, [row.practiceId]);
      const existing = rowOrNull(existingByPractice);
      const id = existing ? firstText(existing.id, row.id) : row.id;
      const createdAt = existing ? firstText(existing.created_at, row.createdAt) : row.createdAt;
      await query(
        `insert into softball_supply_cases (id, title, practice_id, angel_roster_id, angel_student_id, vendor_id, vendor_ids, angel_status, order_status, planned_headcount, total_amount, ordered_at, notes, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16)
         on conflict (id) do update set
           title=excluded.title,
           practice_id=excluded.practice_id,
           angel_roster_id=excluded.angel_roster_id,
           angel_student_id=excluded.angel_student_id,
           vendor_id=excluded.vendor_id,
           vendor_ids=excluded.vendor_ids,
           angel_status=excluded.angel_status,
           order_status=excluded.order_status,
           planned_headcount=excluded.planned_headcount,
           total_amount=excluded.total_amount,
           ordered_at=excluded.ordered_at,
           notes=excluded.notes,
           raw=excluded.raw,
           updated_at=excluded.updated_at,
           synced_at=now()`,
        [
          id,
          row.title,
          row.practiceId,
          row.angelRosterId,
          row.angelStudentId,
          row.vendorId,
          jsonbParam(row.vendorIds, []),
          row.angelStatus,
          row.orderStatus,
          row.plannedHeadcount,
          row.totalAmount,
          row.orderedAt,
          row.notes,
          jsonbParam({ ...row.raw, id, title: row.title, practiceId: row.practiceId, vendorId: row.vendorId, vendorIds: row.vendorIds }, {}),
          createdAt,
          row.updatedAt,
        ]
      );
      return { ok: true, data: { id }, error: null };
    }

    case "deleteSoftballSupplyCase": {
      await requireSoftballAdminAccess();
      const id = firstText(body.id);
      if (!id) {
        return { ok: false, data: null, error: "Missing id" };
      }
      await query(`delete from softball_supply_cases where id = $1`, [id]);
      return { ok: true, data: { id }, error: null };
    }

    case "listSoftballPlayerBootstrap": {
      requireAuth();
      const [configResult, playerResult, playersResult, practicesResult, fieldsResult, attendanceResult] = await Promise.all([
        query(`select * from softball_config where id = 'singleton' limit 1`),
        query(`select * from softball_players where id = $1 limit 1`, [auth.studentId]),
        query(`select * from softball_players order by coalesce(name,''), id`),
        query(`select * from softball_practices order by coalesce(date,'') desc, id desc`),
        query(`select * from softball_fields order by coalesce(name,''), id`),
        query(`select * from softball_attendance where player_id = $1 order by coalesce(updated_at,'') desc, id desc limit 500`, [auth.studentId]),
      ]);
      const configRow = rowOrNull(configResult);
      const playerRow = rowOrNull(playerResult);
      return {
        ok: true,
        data: {
          config: configRow ? configRow.raw || {} : {},
          player: playerRow ? playerRow.raw || { id: playerRow.id } : null,
          players: playersResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          practices: practicesResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          fields: fieldsResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
          attendance: attendanceResult.rows.map((row) => ({ ...(row.raw && typeof row.raw === "object" ? row.raw : {}), id: row.id })),
        },
        error: null,
      };
    }


    case "listDocumentsBootstrap": {
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const canManageAll = canManageDocumentsGlobal_(memberships);
      const includeArchived = canManageAll && Boolean(body.includeArchived);
      const result = await query(
        `select d.*, v.summary_snapshot as latest_summary, v.change_summary as latest_change_summary,
                v.meeting_date as latest_meeting_date, v.effective_date as latest_effective_date,
                v.created_at as latest_version_created_at, v.attachments as latest_attachments
           from documents d
           left join document_versions v on v.id = d.latest_version_id
          where ($1::boolean or coalesce(d.status, 'published') <> 'archived')
          order by d.is_pinned desc, d.pin_order asc, coalesce(d.updated_at,'') desc, d.id desc`,
        [includeArchived]
      );
      const documents = [];
      for (const row of result.rows) {
        const item = mapDocumentRow(row);
        if (!item || (item.status === "archived" && !includeArchived)) {
          continue;
        }
        item.latestAttachments = await hydrateAttachmentItems(query, item.latestAttachments);
        documents.push(item);
      }
      return {
        ok: true,
        data: {
          documents,
          memberships,
          editableGroupIds: getEditableDocumentGroupIds_(memberships),
          canManageAll,
        },
        error: null,
      };
    }

    case "getDocumentDetail": {
      requireAuth();
      const id = firstText(body.id || body.documentId);
      const slug = firstText(body.slug);
      if (!id && !slug) {
        return { ok: false, data: null, error: "Missing document id" };
      }
      const result = id
        ? await query(
            `select d.*, v.summary_snapshot as latest_summary, v.change_summary as latest_change_summary,
                    v.meeting_date as latest_meeting_date, v.effective_date as latest_effective_date,
                    v.created_at as latest_version_created_at, v.attachments as latest_attachments,
                    v.content_snapshot as latest_content
               from documents d
               left join document_versions v on v.id = d.latest_version_id
              where d.id = $1 limit 1`,
            [id]
          )
        : await query(
            `select d.*, v.summary_snapshot as latest_summary, v.change_summary as latest_change_summary,
                    v.meeting_date as latest_meeting_date, v.effective_date as latest_effective_date,
                    v.created_at as latest_version_created_at, v.attachments as latest_attachments,
                    v.content_snapshot as latest_content
               from documents d
               left join document_versions v on v.id = d.latest_version_id
              where d.slug = $1 limit 1`,
            [slug]
          );
      const row = result.rows[0];
      if (!row) {
        return { ok: false, data: null, error: "Document not found" };
      }
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const document = mapDocumentRow(row);
      document.latestAttachments = await hydrateAttachmentItems(query, document.latestAttachments);
      const latestVersion = {
        id: firstText(row.latest_version_id),
        documentId: firstText(row.id),
        versionNumber: Number(row.latest_version_number || 0),
        title: firstText(row.title),
        summary: firstText(row.latest_summary),
        content: firstText(row.latest_content),
        changeSummary: firstText(row.latest_change_summary),
        meetingDate: firstText(row.latest_meeting_date),
        effectiveDate: firstText(row.latest_effective_date),
        attachments: await hydrateAttachmentItems(query, normalizeDocumentAttachments_(row.latest_attachments)),
        createdAt: firstText(row.latest_version_created_at),
      };
      return {
        ok: true,
        data: {
          document,
          latestVersion,
          permissions: {
            canEdit: canEditDocumentWithMemberships_(row, memberships),
            canManageAll: canManageDocumentsGlobal_(memberships),
          },
        },
        error: null,
      };
    }

    case "listDocumentVersions": {
      requireAuth();
      const documentId = firstText(body.documentId || body.id);
      if (!documentId) {
        return { ok: false, data: null, error: "Missing documentId" };
      }
      const documentResult = await query(`select * from documents where id = $1 limit 1`, [documentId]);
      const documentRow = documentResult.rows[0];
      if (!documentRow) {
        return { ok: false, data: null, error: "Document not found" };
      }
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const versionsResult = await query(
        `select * from document_versions where document_id = $1 order by version_number desc, coalesce(created_at,'') desc, id desc`,
        [documentId]
      );
      const versions = [];
      for (const row of versionsResult.rows) {
        const item = mapDocumentVersionRow(row);
        item.attachments = await hydrateAttachmentItems(query, item.attachments);
        versions.push(item);
      }
      return {
        ok: true,
        data: {
          versions,
          permissions: {
            canEdit: canEditDocumentWithMemberships_(documentRow, memberships),
            canManageAll: canManageDocumentsGlobal_(memberships),
          },
        },
        error: null,
      };
    }

    case "getAttachmentAccessUrl": {
      requireAuth();
      const attachmentId = firstText(body.attachmentId || body.id);
      if (!attachmentId) {
        return { ok: false, data: null, error: "Missing attachmentId" };
      }
      const result = await query(`select * from attachments where id = $1 limit 1`, [attachmentId]);
      const row = result.rows[0];
      if (!row || firstText(row.status) === "deleted") {
        return { ok: false, data: null, error: "Attachment not found" };
      }
      let url = "";
      try {
        url = await createSignedReadUrlForAttachment(row, null, { throwOnError: true });
      } catch (err) {
        return { ok: false, data: null, error: firstText((err && err.message) || "Attachment URL unavailable") };
      }
      if (!url) {
        return { ok: false, data: null, error: "Attachment URL unavailable" };
      }
      return {
        ok: true,
        data: {
          attachmentId,
          url,
          name: firstText(row.original_name),
          mimeType: firstText(row.mime_type),
        },
        error: null,
      };
    }

    case "createDocument": {
      requireAuth();
      const data = body.data && typeof body.data === "object" ? body.data : body;
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const ownerGroupId = firstText(data.ownerGroupId);
      if (!ownerGroupId) {
        return { ok: false, data: null, error: "Missing ownerGroupId" };
      }
      if (!getEditableDocumentGroupIds_(memberships).includes(ownerGroupId) && !canManageDocumentsGlobal_(memberships)) {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }
      const actorProfile = await findStudentProfileById(auth.studentId);
      const actorName = firstText(auth && auth.profile && auth.profile.name, firstText(actorProfile && actorProfile.name, actorProfile && actorProfile.nameZh));
      const title = firstText(data.title);
      const docType = firstText(data.docType, "reference");
      const summary = firstText(data.summary);
      const content = firstText(data.content);
      if (!title || !content) {
        return { ok: false, data: null, error: "Missing title or content" };
      }
      const createdAt = nowIso();
      const documentId = crypto.randomUUID();
      const versionId = crypto.randomUUID();
      const tags = normalizeDocumentTags_(data.tags);
      const attachments = normalizeDocumentAttachments_(data.attachments);
      const baseSlug = slugifyDocumentTitle_(title);
      let slug = baseSlug;
      for (let counter = 2; counter < 1000; counter += 1) {
        const existing = await query(`select id from documents where slug = $1 limit 1`, [slug]);
        if (!existing.rows.length) {
          break;
        }
        slug = `${baseSlug}-${counter}`;
      }
      await withTransaction(async (client) => {
        await client.query(
          `insert into documents (id, slug, title, doc_type, owner_group_id, visibility, tags, is_pinned, pin_order, latest_version_number, latest_version_id, status, created_by, created_by_name, created_at, updated_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)`,
          [
            documentId,
            slug,
            title,
            docType,
            ownerGroupId,
            firstText(data.visibility, "class"),
            tags,
            false,
            0,
            1,
            versionId,
            "published",
            auth.studentId,
            actorName,
            createdAt,
            createdAt,
            jsonbParam(data.raw || data, {}),
          ]
        );
        await client.query(
          `insert into document_versions (id, document_id, version_number, title_snapshot, summary_snapshot, content_snapshot, change_summary, meeting_date, effective_date, attachments, created_by, created_by_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb)`,
          [
            versionId,
            documentId,
            1,
            title,
            summary,
            content,
            firstText(data.changeSummary, "初版建立"),
            firstText(data.meetingDate),
            firstText(data.effectiveDate),
            jsonbParam(attachments, []),
            auth.studentId,
            actorName,
            createdAt,
            jsonbParam(data.raw || data, {}),
          ]
        );
      });
      await claimAttachments(query, {
        attachmentIds: extractAttachmentIds(attachments),
        entityType: "document_version",
        entityId: versionId,
        uploadedBy: auth.studentId,
      });
      return { ok: true, data: { id: documentId, slug, versionNumber: 1, versionId }, error: null };
    }

    case "createDocumentVersion": {
      requireAuth();
      const data = body.data && typeof body.data === "object" ? body.data : body;
      const documentId = firstText(data.documentId || data.id);
      if (!documentId) {
        return { ok: false, data: null, error: "Missing documentId" };
      }
      const documentResult = await query(`select * from documents where id = $1 limit 1`, [documentId]);
      const documentRow = documentResult.rows[0];
      if (!documentRow) {
        return { ok: false, data: null, error: "Document not found" };
      }
      const memberships = await listMembershipsByStudentId(auth.studentId);
      if (!canEditDocumentWithMemberships_(documentRow, memberships)) {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }
      const actorProfile = await findStudentProfileById(auth.studentId);
      const actorName = firstText(auth && auth.profile && auth.profile.name, firstText(actorProfile && actorProfile.name, actorProfile && actorProfile.nameZh));
      const versionNumber = Number(documentRow.latest_version_number || 0) + 1;
      const versionId = crypto.randomUUID();
      const title = firstText(data.title, documentRow.title);
      const summary = firstText(data.summary);
      const content = firstText(data.content);
      if (!content) {
        return { ok: false, data: null, error: "Missing content" };
      }
      const createdAt = nowIso();
      const attachments = normalizeDocumentAttachments_(data.attachments);
      await withTransaction(async (client) => {
        await client.query(
          `insert into document_versions (id, document_id, version_number, title_snapshot, summary_snapshot, content_snapshot, change_summary, meeting_date, effective_date, attachments, created_by, created_by_name, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb)`,
          [
            versionId,
            documentId,
            versionNumber,
            title,
            summary,
            content,
            firstText(data.changeSummary, `更新 v${versionNumber}`),
            firstText(data.meetingDate),
            firstText(data.effectiveDate),
            jsonbParam(attachments, []),
            auth.studentId,
            actorName,
            createdAt,
            jsonbParam(data.raw || data, {}),
          ]
        );
        await client.query(
          `update documents
              set title = $2,
                  latest_version_number = $3,
                  latest_version_id = $4,
                  updated_at = $5,
                  status = 'published',
                  archived_at = null,
                  synced_at = now()
            where id = $1`,
          [documentId, title, versionNumber, versionId, createdAt]
        );
      });
      await claimAttachments(query, {
        attachmentIds: extractAttachmentIds(attachments),
        entityType: "document_version",
        entityId: versionId,
        uploadedBy: auth.studentId,
      });
      return { ok: true, data: { id: documentId, versionNumber, versionId }, error: null };
    }

    case "updateDocumentMeta": {
      requireAuth();
      const data = body.data && typeof body.data === "object" ? body.data : body;
      const documentId = firstText(data.documentId || data.id);
      if (!documentId) {
        return { ok: false, data: null, error: "Missing documentId" };
      }
      const documentResult = await query(`select * from documents where id = $1 limit 1`, [documentId]);
      const documentRow = documentResult.rows[0];
      if (!documentRow) {
        return { ok: false, data: null, error: "Document not found" };
      }
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const canManageAll = canManageDocumentsGlobal_(memberships);
      if (!canEditDocumentWithMemberships_(documentRow, memberships)) {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }
      const nextTitle = firstText(data.title, documentRow.title);
      const nextDocType = firstText(data.docType, documentRow.doc_type);
      const nextTags = data.tags != null ? normalizeDocumentTags_(data.tags) : documentRow.tags || [];
      const nextVisibility = firstText(data.visibility, documentRow.visibility || "class");
      const nextOwnerGroupId = canManageAll ? firstText(data.ownerGroupId, documentRow.owner_group_id) : firstText(documentRow.owner_group_id);
      const nextIsPinned = canManageAll ? Boolean(data.isPinned) : Boolean(documentRow.is_pinned);
      const nextPinOrder = canManageAll ? Number(data.pinOrder || 0) : Number(documentRow.pin_order || 0);
      const nextStatus = canManageAll && firstText(data.status) ? firstText(data.status) : firstText(documentRow.status, "published");
      const updatedAt = nowIso();
      await query(
        `update documents
            set title = $2,
                doc_type = $3,
                owner_group_id = $4,
                visibility = $5,
                tags = $6,
                is_pinned = $7,
                pin_order = $8,
                status = $9,
                archived_at = case when $9 = 'archived' then coalesce(archived_at, $10) else null end,
                updated_at = $10,
                synced_at = now()
          where id = $1`,
        [documentId, nextTitle, nextDocType, nextOwnerGroupId, nextVisibility, nextTags, nextIsPinned, nextPinOrder, nextStatus, updatedAt]
      );
      return { ok: true, data: { id: documentId }, error: null };
    }

    case "archiveDocument": {
      requireAuth();
      const documentId = firstText(body.documentId || body.id);
      if (!documentId) {
        return { ok: false, data: null, error: "Missing documentId" };
      }
      const documentResult = await query(`select * from documents where id = $1 limit 1`, [documentId]);
      const documentRow = documentResult.rows[0];
      if (!documentRow) {
        return { ok: false, data: null, error: "Document not found" };
      }
      const memberships = await listMembershipsByStudentId(auth.studentId);
      if (!canEditDocumentWithMemberships_(documentRow, memberships)) {
        const error = new Error("Forbidden");
        error.statusCode = 403;
        throw error;
      }
      const archivedAt = nowIso();
      await query(`update documents set status = 'archived', archived_at = $2, updated_at = $2, synced_at = now() where id = $1`, [documentId, archivedAt]);
      return { ok: true, data: { id: documentId }, error: null };
    }


    case "listStudents": {
      const result = await query(`select id, name, google_sub, google_email from students order by coalesce(id,'')`);
      const students = result.rows.map((row) => ({
        id: row.id || "",
        name: row.name || "",
        googleSub: row.google_sub || "",
        googleEmail: row.google_email || "",
      }));
      return { ok: true, data: { students }, error: null };
    }

    case "searchStudents": {
      const q = String(body.query || "").trim().toLowerCase();
      if (!q || q.length < 2) {
        return { ok: true, data: { students: [] }, error: null };
      }
      const like = `%${q}%`;
      const result = await query(
        `select id, email, name_zh, name_en, preferred_name, company, title, group_id
         from directories
         where lower(coalesce(id,'')) like $1
            or lower(coalesce(email,'')) like $1
            or lower(coalesce(name_zh,'')) like $1
            or lower(coalesce(name_en,'')) like $1
            or lower(coalesce(preferred_name,'')) like $1
            or lower(coalesce(company,'')) like $1
         order by coalesce(group_id,''), coalesce(name_zh,''), id
         limit 30`,
        [like]
      );
      const students = result.rows.map((row) => ({
        id: String(row.id || "").trim(),
        email: normalizeEmail(row.email || ""),
        name: firstText(row.preferred_name, firstText(row.name_zh, row.name_en || "")),
        company: firstText(row.company),
        title: firstText(row.title),
        group: firstText(row.group_id),
      }));
      return { ok: true, data: { students }, error: null };
    }

    case "verifyGoogle": {
      const idToken = firstText(body.idToken);
      if (!idToken) {
        return { ok: false, data: null, error: "Missing idToken" };
      }
      const googleProfile = await verifyGoogleIdToken(idToken);
      const googleSub = String(googleProfile.sub || "").trim();
      if (!googleSub) {
        return { ok: false, data: null, error: "Invalid Google token" };
      }
      const linked = await query(
        `select s.id
         from students s
         where s.google_sub = $1
         limit 1`,
        [googleSub]
      );
      const studentId = linked.rows.length ? String(linked.rows[0].id || "").trim() : "";
      const student = studentId ? await findStudentProfileById(studentId) : null;
      const emailMatch = student && student.email ? normalizeEmail(student.email) === normalizeEmail(googleProfile.email) : false;
      const sessionToken = studentId
        ? createSessionToken({
            studentId,
            email: googleProfile.email,
            sub: googleProfile.sub,
            name: googleProfile.name,
          })
        : "";
      const refreshToken = studentId
        ? createRefreshToken({
            studentId,
            email: googleProfile.email,
            sub: googleProfile.sub,
            name: googleProfile.name,
          })
        : "";
      const memberships = studentId ? await listMembershipsByStudentId(studentId) : [];
      return {
        ok: true,
        data: {
          profile: googleProfile,
          student,
          emailMatch,
          sessionToken,
          refreshToken,
          memberships,
        },
        error: null,
      };
    }

    case "refreshSession": {
      const refreshToken = firstText(body.refreshToken);
      if (!refreshToken) {
        return { ok: false, data: null, error: "Missing refreshToken" };
      }
      const verified = verifyRefreshToken(refreshToken);
      if (!verified || !verified.studentId) {
        return { ok: false, data: null, error: "Unauthorized" };
      }
      const studentId = String(verified.studentId || "").trim();
      const memberships = await listMembershipsByStudentId(studentId);
      const sessionToken = createSessionToken({
        studentId,
        email: verified.email,
        sub: verified.sub,
        name: verified.name,
      });

      // For now we re-issue a fresh refresh token on each refresh. This keeps the client simple.
      // Hard caps / rotation / revocation can be added later.
      const nextRefreshToken = createRefreshToken({
        studentId,
        email: verified.email,
        sub: verified.sub,
        name: verified.name,
      });

      return {
        ok: true,
        data: {
          sessionToken,
          refreshToken: nextRefreshToken,
          memberships,
        },
        error: null,
      };
    }

    case "linkGoogleStudent": {
      const idToken = firstText(body.idToken);
      const studentId = firstText(body.studentId);
      if (!idToken) {
        return { ok: false, data: null, error: "Missing idToken" };
      }
      if (!studentId) {
        return { ok: false, data: null, error: "Missing studentId" };
      }
      const googleProfile = await verifyGoogleIdToken(idToken);
      if (!googleProfile || !googleProfile.sub) {
        return { ok: false, data: null, error: "Invalid Google token" };
      }
      await query(
        `update students set google_sub = $2, google_email = $3, synced_at = now(), raw = coalesce(raw, '{}'::jsonb)
         where id = $1`,
        [studentId, String(googleProfile.sub || ""), normalizeEmail(googleProfile.email || "")]
      );
      const student = await findStudentProfileById(studentId);
      const memberships = await listMembershipsByStudentId(studentId);
      const sessionToken = createSessionToken({
        studentId,
        email: googleProfile.email,
        sub: googleProfile.sub,
        name: googleProfile.name,
      });
      const refreshToken = createRefreshToken({
        studentId,
        email: googleProfile.email,
        sub: googleProfile.sub,
        name: googleProfile.name,
      });
      return { ok: true, data: { student, memberships, sessionToken, refreshToken }, error: null };
    }

    default: {
      return { ok: false, data: null, error: `Unsupported action: ${name}` };
    }
  }
}
