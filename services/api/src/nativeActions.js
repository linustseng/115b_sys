import crypto from "node:crypto";
import {
  buildGeneratedThursdaySessionFromId,
  buildGeneratedThursdaySessions,
  loadAcademicSessionsFromIcs,
  mapAcademicSessionRow,
  mapMakeupRequestRow,
  mapSessionNoteRow,
} from "./academics.js";
import { jsonbParam } from "./jsonb.js";

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

async function syncAcademicSessionsFromIcs_(icsUrl) {
  const url = firstText(icsUrl);
  if (!url) {
    return { configured: false, didSync: false, count: 0 };
  }
  const sessions = await loadAcademicSessionsFromIcs(url, {
    rangeStart: addDaysDateText_(todayDateText_(), -120),
    rangeEnd: addDaysDateText_(todayDateText_(), 365),
  });
  const hiddenPatch = JSON.stringify({ isVisible: false });
  await withTransaction(async (client) => {
    await client.query(
      `update academic_sessions
       set is_visible = false,
           updated_at = $1,
           raw = coalesce(raw, '{}'::jsonb) || $2::jsonb,
           synced_at = now()
       where coalesce(source_type,'') = 'calendar_ics'`,
      [nowIso(), hiddenPatch]
    );
    for (const item of sessions) {
      await upsertAcademicSession_(client.query.bind(client), item);
    }
  });
  return { configured: true, didSync: true, count: sessions.length };
}

async function ensureAcademicSessionsFresh_({ force = false } = {}) {
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
           )`
      )
    );
    if (Number(legacyCheck && legacyCheck.count ? legacyCheck.count : 0) > 0) {
      return syncAcademicSessionsFromIcs_(configuredUrl);
    }

    const latest = rowOrNull(
      await query(
        `select max(synced_at) as latest_synced_at
         from academic_sessions
         where coalesce(source_type,'') = 'calendar_ics'`
      )
    );
    const latestSyncedAt = firstText(latest && latest.latest_synced_at ? latest.latest_synced_at : "");
    if (latestSyncedAt) {
      const latestMs = Date.parse(latestSyncedAt);
      if (!Number.isNaN(latestMs) && Date.now() - latestMs < 6 * 60 * 60 * 1000) {
        return { configured: true, didSync: false, count: 0 };
      }
    }
  }
  return syncAcademicSessionsFromIcs_(configuredUrl);
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
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    type: firstText(raw.type, row && row.type ? row.type : ""),
    title: firstText(raw.title, row && row.title ? row.title : ""),
    description: firstText(raw.description, row && row.description ? row.description : ""),
    categoryType: firstText(raw.categoryType, row && row.category_type ? row.category_type : ""),
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
    currency: firstText(raw.currency, row && row.currency ? row.currency : "TWD"),
    paymentMethod: firstText(raw.paymentMethod, row && row.payment_method ? row.payment_method : ""),
    vendorName: firstText(raw.vendorName, row && row.vendor_name ? row.vendor_name : ""),
    payeeName: firstText(raw.payeeName, row && row.payee_name ? row.payee_name : ""),
    payeeBank: firstText(raw.payeeBank, row && row.payee_bank ? row.payee_bank : ""),
    payeeBankCode: firstText(raw.payeeBankCode, firstText(raw.payeeBank, row && row.payee_bank ? row.payee_bank : "")),
    payeeAccount: firstText(raw.payeeAccount, row && row.payee_account ? row.payee_account : ""),
    relatedPurchaseId: firstText(raw.relatedPurchaseId, row && row.related_purchase_id ? row.related_purchase_id : ""),
    noPurchaseReason: firstText(raw.noPurchaseReason, row && row.no_purchase_reason ? row.no_purchase_reason : ""),
    expectedClearDate: firstText(raw.expectedClearDate, row && row.expected_clear_date ? row.expected_clear_date : ""),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : safeJsonArray(row && row.attachments),
    status: firstText(raw.status, row && row.status ? row.status : ""),
    applicantId: firstText(raw.applicantId, row && row.applicant_id ? row.applicant_id : ""),
    applicantName: firstText(raw.applicantName, row && row.applicant_name ? row.applicant_name : ""),
    applicantRole: firstText(raw.applicantRole),
    applicantDepartment: firstText(raw.applicantDepartment, row && row.applicant_department ? row.applicant_department : ""),
    applicantEmail: normalizeEmail(firstText(raw.applicantEmail)),
    submittedAt: firstText(raw.submittedAt),
    createdAt: firstText(raw.createdAt, row && row.created_at ? row.created_at : ""),
    updatedAt: firstText(raw.updatedAt, row && row.updated_at ? row.updated_at : ""),
  };
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
    // Landing can render without login; it will return empty private sections when unauthenticated.
    "listLandingBootstrap",
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

  const requireSoftballAdminAccess = async () => {
    requireAuth();
    const memberships = await listMembershipsByStudentId(auth.studentId);
    // 1. E/H 組（資管組、體育主將組）
    if (canAccessByGroups(memberships, ["E", "H"])) {
      return memberships;
    }
    // 2. K 組的 manager/lead/deputy
    if (hasSoftballTeamRole_(memberships)) {
      return memberships;
    }
    // 3. 球員表裡有「球隊經理」位置（向下相容）
    if (await isSoftballManager_()) {
      return memberships;
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
      await query(`delete from events where id = $1`, [eventId]);
      await query(`delete from registrations where event_id = $1`, [eventId]);
      await query(`delete from checkins where event_id = $1`, [eventId]);
      return { ok: true, data: { id: eventId }, error: null };
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
      await query(
        `insert into events (
          id, title, description, start_at, end_at, location, address,
          registration_open_at, registration_close_at, checkin_open_at, checkin_close_at,
          register_url, checkin_url, capacity, status, category, form_schema, raw
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb)
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
          synced_at=now()`,
        [
          id,
          firstText(normalized.title),
          firstText(normalized.description),
          firstText(normalized.startAt || normalized.start_at),
          firstText(normalized.endAt || normalized.end_at),
          firstText(normalized.location),
          firstText(normalized.address),
          firstText(normalized.registrationOpenAt || normalized.registration_open_at),
          firstText(normalized.registrationCloseAt || normalized.registration_close_at),
          firstText(normalized.checkinOpenAt || normalized.checkin_open_at),
          firstText(normalized.checkinCloseAt || normalized.checkin_close_at),
          firstText(normalized.registerUrl || normalized.register_url),
          firstText(normalized.checkinUrl || normalized.checkin_url),
          normalized.capacity == null || normalized.capacity === "" ? null : Number(normalized.capacity),
          firstText(normalized.status),
          firstText(normalized.category),
          jsonbParam(safeJsonObject(normalized.formSchema || normalized.form_schema), {}),
          jsonbParam(normalized, {}),
        ]
      );
      const result = await query(`select * from events where id = $1 limit 1`, [id]);
      const row = rowOrNull(result);
      const event = row
        ? {
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
          }
        : null;
      return { ok: true, data: { event }, error: null };
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
      await withTransaction(async (client) => {
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
      });
      return { ok: true, data: { updated: memberships.length }, error: null };
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
      await ensureAcademicSessionsFresh_();
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

      const notesResult = await query(
        `select * from session_notes
         where coalesce(status,'draft') = 'published'
         order by coalesce(published_at,'' ) desc, coalesce(updated_at,'' ) desc, id desc`
      );
      const notes = notesResult.rows.map((row) => mapSessionNoteRow(row));

      const myRequestResult = await query(
        `select * from makeup_requests
         where student_id = $1
         order by coalesce(created_at,'' ) desc, id desc`,
        [auth.studentId]
      );
      const publicRequestResult = await query(
        `select * from makeup_requests
         where coalesce(status,'submitted') <> 'cancelled'
         order by coalesce(target_session_id,''), coalesce(created_at,'' ) desc, id desc`
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
      const myRequests = myRequestResult.rows.map((row) => mapMakeupRequestRow(row, sessionsById));
      const publicRequests = publicRequestResult.rows.map((row) => mapMakeupRequestRow(row, sessionsById));
      const summaryByTarget = buildMakeupSummaryByTarget_(publicRequests);

      return {
        ok: true,
        data: {
          sessions,
          regularSessions: sessions.filter((item) => item.classKind === "regular"),
          makeupTargets: sessions.filter((item) => item.classKind === "makeup_target"),
          notes,
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
      await ensureAcademicSessionsFresh_();
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

      const notesResult = await query(
        `select * from session_notes
         order by coalesce(status,'' ) desc, coalesce(published_at,'' ) desc, coalesce(updated_at,'' ) desc, id desc`
      );
      const studentOptions = await listAcademicStudentOptions_(query);
      const notes = notesResult.rows.map((row) => mapSessionNoteRow(row));
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
          regularSessions: sessions.filter((item) => item.classKind === "regular"),
          makeupTargets: sessions.filter((item) => item.classKind === "makeup_target"),
          requests,
          notes,
          summaryByTarget,
          students: studentOptions,
          hasConfiguredIcsUrl: Boolean(firstText(process.env.ACADEMICS_ICS_URL || "")),
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

      const syncResult = await syncAcademicSessionsFromIcs_(icsUrl);

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
      const plans = result.rows.map((row) => ({
        ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
        id: row.id,
        date: row.date || "",
        title: row.title || "",
        description: row.description || "",
        closeAt: row.close_at || "",
        vendor: row.vendor || "",
        items: row.items || [],
        status: row.status || "",
        createdAt: row.created_at || "",
        updatedAt: row.updated_at || "",
      }));
      return { ok: true, data: { plans }, error: null };
    }

    case "createOrderPlan": {
      await requireGroupAccess(["I", "E"]);
      const row = toOrderPlanRow(body.data || body.plan || body);
      await query(
        `insert into order_plans (id, date, title, description, close_at, vendor, items, status, raw, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11)
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
          row.createdAt,
          row.updatedAt,
        ]
      );
      return { ok: true, data: { id: row.id, plan: row }, error: null };
    }

    case "updateOrderPlan": {
      await requireGroupAccess(["I", "E"]);
      const row = toOrderPlanRow(body.data || body.plan || body);
      await query(
        `update order_plans set
           date=$2,title=$3,description=$4,close_at=$5,vendor=$6,items=$7::jsonb,status=$8,raw=$9::jsonb,updated_at=$10,synced_at=now()
         where id=$1`,
        [row.id, row.date, row.title, row.description, row.closeAt, row.vendor, jsonbParam(row.items, []), row.status, jsonbParam(row.raw, {}), row.updatedAt]
      );
      return { ok: true, data: { id: row.id, plan: row }, error: null };
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
      if (firstText(raw.sourceType) !== "proxy_external") {
        return { ok: false, data: null, error: "Only proxy responses can be deleted here" };
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
      // lock applicant to current user when not provided
      if (!row.applicantId) {
        row.applicantId = auth.studentId;
      }
      const student = await findStudentProfileById(row.applicantId);
      if (!row.applicantName && student && student.name) {
        row.applicantName = student.name;
      }

      const applicantMemberships = await listMembershipsByStudentId(row.applicantId);
      const applicantRole = resolveApplicantGroupRoleByMemberships_(row, applicantMemberships);
      const workflowCreatedByRole = await resolveFinanceWorkflowRoleForActor_(query, auth.studentId);
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      if (!normalizedStatus || normalizedStatus === "pending_lead") {
        row.status = resolveFinanceInitialStatus_(row, applicantMemberships);
      }

      const applicantEmail = normalizeEmail(
        firstText(
          student && student.email ? student.email : "",
          firstText(
            row.raw && row.raw.applicantEmail,
            auth && auth.profile && auth.profile.email ? auth.profile.email : ""
          )
        )
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
        applicantEmail: applicantEmail,
        workflowCreatedByRole: firstText(row.raw && row.raw.workflowCreatedByRole, workflowCreatedByRole),
        submittedAt:
          row.status !== "draft"
            ? firstText(row.raw && row.raw.submittedAt, nowIso())
            : firstText(row.raw && row.raw.submittedAt),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      await query(
        `insert into finance_requests (
          id, type, title, description, category_type,
          amount_estimated, amount_actual, currency, payment_method,
          vendor_name, payee_name, payee_bank, payee_account,
          related_purchase_id, no_purchase_reason, expected_clear_date,
          attachments, status,
          applicant_id, applicant_name, applicant_department,
          created_at, updated_at, raw
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24::jsonb)
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
          synced_at=now()`,
        [
          row.id,
          row.type,
          row.title,
          row.description,
          row.categoryType,
          row.amountEstimated,
          row.amountActual,
          row.currency,
          row.paymentMethod,
          row.vendorName,
          row.payeeName,
          row.payeeBank,
          row.payeeAccount,
          row.relatedPurchaseId,
          row.noPurchaseReason,
          row.expectedClearDate,
          jsonbParam(row.attachments, []),
          row.status,
          row.applicantId,
          row.applicantName,
          row.applicantDepartment,
          row.createdAt,
          row.updatedAt,
          jsonbParam(row.raw, {}),
        ]
      );
      return { ok: true, data: { id: row.id }, error: null };
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
      const manualCreatedByName = firstText(
        body.manualCreatedByName,
        firstText(auth.profile && auth.profile.name ? auth.profile.name : "", auth.studentId)
      );
      const workflowCreatedByRole = await resolveFinanceWorkflowRoleForActor_(query, auth.studentId);

      const applicantMemberships = await listMembershipsByStudentId(row.applicantId);
      const applicantRole = resolveApplicantGroupRoleByMemberships_(row, applicantMemberships);
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      if (!normalizedStatus || normalizedStatus === "pending_lead") {
        row.status = resolveFinanceInitialStatus_(row, applicantMemberships);
      }

      const applicantEmail = normalizeEmail(
        firstText(student && student.email ? student.email : "", row.raw && row.raw.applicantEmail)
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
        applicantEmail: applicantEmail,
        workflowCreatedByRole: firstText(row.raw && row.raw.workflowCreatedByRole, workflowCreatedByRole),
        submittedAt:
          row.status !== "draft"
            ? firstText(row.raw && row.raw.submittedAt, nowIso())
            : firstText(row.raw && row.raw.submittedAt),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        manualCreatedBy,
        manualCreatedByName,
        manualCreatedAt: now,
      };
      await query(
        `insert into finance_requests (
          id, type, title, description, category_type,
          amount_estimated, amount_actual, currency, payment_method,
          vendor_name, payee_name, payee_bank, payee_account,
          related_purchase_id, no_purchase_reason, expected_clear_date,
          attachments, status,
          applicant_id, applicant_name, applicant_department,
          created_at, updated_at, raw
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19,$20,$21,$22,$23,$24::jsonb)
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
          synced_at=now()`,
        [
          row.id,
          row.type,
          row.title,
          row.description,
          row.categoryType,
          row.amountEstimated,
          row.amountActual,
          row.currency,
          row.paymentMethod,
          row.vendorName,
          row.payeeName,
          row.payeeBank,
          row.payeeAccount,
          row.relatedPurchaseId,
          row.noPurchaseReason,
          row.expectedClearDate,
          jsonbParam(row.attachments, []),
          row.status,
          row.applicantId,
          row.applicantName,
          row.applicantDepartment,
          row.createdAt,
          row.updatedAt,
          jsonbParam(row.raw, {}),
        ]
      );
      return { ok: true, data: { id: row.id }, error: null };
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
        const existingResult = await query(`select * from finance_requests where id = $1 limit 1`, [requestId]);
        const existingRow = rowOrNull(existingResult);
        if (!existingRow) {
          return { ok: false, data: null, error: "Request not found" };
        }

        const existingRaw = existingRow.raw && typeof existingRow.raw === "object" ? existingRow.raw : {};
        const existingRecord = mapFinanceRequestRow(existingRow);
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
          const canApprove = canFinanceActorApprove_(
            existingRecord,
            actorRole,
            auth.studentId,
            actorEmail,
            memberships,
            financeRoles,
            studentIdByEmail
          );
          if (!canApprove) {
            const error = new Error("Unauthorized");
            error.statusCode = 403;
            throw error;
          }

          if (requestAction === "return") {
            toStatus = "returned";
          } else {
            toStatus = resolveFinanceNextStatus_(existingRecord, actorRole, financeRoles, studentIdByEmail);
          }
        } else {
          return { ok: false, data: null, error: `Unsupported requestAction: ${requestAction}` };
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
        };

        await query(
          `update finance_requests set status=$2, updated_at=$3, raw=$4::jsonb, synced_at=now() where id=$1`,
          [requestId, toStatus, now, jsonbParam(nextRaw, {})]
        );

        // Record workflow action for approvals UI.
        const actionId = crypto.randomUUID();
        const actorName = firstText(
          body.actorName,
          firstText(auth.profile && auth.profile.name ? auth.profile.name : "", auth.studentId)
        );
        const actorRole = firstText(body.actorRole);
        const notes = firstText(body.actorNote, body.notes);
        const actionRaw = {
          id: actionId,
          requestId: requestId,
          actorId: auth.studentId,
          actorName: actorName,
          actorRole: actorRole,
          action: requestAction,
          actionType: requestAction,
          fromStatus: fromStatus,
          toStatus: toStatus,
          notes: notes,
          createdAt: now,
        };
        await query(
          `insert into finance_actions (id, request_id, actor_id, actor_name, action_type, from_status, to_status, notes, created_at, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           on conflict (id) do nothing`,
          [
            actionId,
            requestId,
            auth.studentId,
            actorName,
            requestAction,
            fromStatus,
            toStatus,
            notes,
            now,
            jsonbParam(actionRaw, {}),
          ]
        );

        return { ok: true, data: { id: requestId, status: toStatus }, error: null };
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
      row.applicantDepartment = firstText(
        row.applicantDepartment,
        existingRecord && existingRecord.applicantDepartment ? existingRecord.applicantDepartment : ""
      );
      const applicantProfile = await findStudentProfileById(row.applicantId);
      if (!row.applicantName && applicantProfile && applicantProfile.name) {
        row.applicantName = applicantProfile.name;
      }

      const applicantMemberships = await listMembershipsByStudentId(row.applicantId);
      const applicantRole = resolveApplicantGroupRoleByMemberships_(row, applicantMemberships);
      const normalizedAction = requestAction.toLowerCase();
      const normalizedStatus = String(row.status || "").trim().toLowerCase();
      if (normalizedAction === "submit" || !normalizedStatus || normalizedStatus === "pending_lead") {
        row.status = resolveFinanceInitialStatus_(row, applicantMemberships);
      }

      const applicantEmail = normalizeEmail(
        firstText(
          applicantProfile && applicantProfile.email ? applicantProfile.email : "",
          firstText(
            row.raw && row.raw.applicantEmail,
            firstText(
              existingRecord && existingRecord.applicantEmail ? existingRecord.applicantEmail : "",
              auth && auth.profile && auth.profile.email ? auth.profile.email : ""
            )
          )
        )
      );
      const workflowCreatedByRole = firstText(
        existingRaw.workflowCreatedByRole,
        await resolveFinanceWorkflowRoleForActor_(query, manualCreatedBy)
      );

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
        applicantRole: firstText(
          row.raw && row.raw.applicantRole,
          firstText(existingRecord && existingRecord.applicantRole ? existingRecord.applicantRole : "", applicantRole)
        ),
        applicantEmail: applicantEmail,
        workflowCreatedByRole: firstText(row.raw && row.raw.workflowCreatedByRole, workflowCreatedByRole),
        submittedAt:
          normalizedAction === "submit" || row.status !== "draft"
            ? firstText(
                row.raw && row.raw.submittedAt,
                firstText(existingRecord && existingRecord.submittedAt ? existingRecord.submittedAt : "", nowIso())
              )
            : firstText(row.raw && row.raw.submittedAt, existingRecord && existingRecord.submittedAt ? existingRecord.submittedAt : ""),
        createdAt: firstText(existingRecord && existingRecord.createdAt ? existingRecord.createdAt : "", row.createdAt),
        updatedAt: row.updatedAt,
      };
      await query(
        `update finance_requests set
          type=$2,title=$3,description=$4,category_type=$5,
          amount_estimated=$6,amount_actual=$7,currency=$8,payment_method=$9,
          vendor_name=$10,payee_name=$11,payee_bank=$12,payee_account=$13,
          related_purchase_id=$14,no_purchase_reason=$15,expected_clear_date=$16,
          attachments=$17::jsonb,status=$18,
          applicant_id=$19,applicant_name=$20,applicant_department=$21,
          updated_at=$22,raw=$23::jsonb,synced_at=now()
        where id=$1`,
        [
          row.id,
          row.type,
          row.title,
          row.description,
          row.categoryType,
          row.amountEstimated,
          row.amountActual,
          row.currency,
          row.paymentMethod,
          row.vendorName,
          row.payeeName,
          row.payeeBank,
          row.payeeAccount,
          row.relatedPurchaseId,
          row.noPurchaseReason,
          row.expectedClearDate,
          jsonbParam(row.attachments, []),
          row.status,
          row.applicantId,
          row.applicantName,
          row.applicantDepartment,
          row.updatedAt,
          jsonbParam(row.raw, {}),
        ]
      );
      return { ok: true, data: { id: row.id }, error: null };
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
      const requests = rows.map((row) => mapFinanceRequestRow(row));
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
      requireAuth();
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const byGroup = canAccessByGroups(memberships, ["E", "H"]);
      const byTeamRole = byGroup ? false : hasSoftballTeamRole_(memberships);
      const byManager = byGroup || byTeamRole ? false : await isSoftballManager_();
      return {
        ok: true,
        data: {
          allowed: Boolean(byGroup || byTeamRole || byManager),
          source: byGroup ? "group" : byTeamRole ? "team-role" : byManager ? "manager" : "",
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
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["E", "H"]) || (await isSoftballManager_());
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
      const memberships = await listMembershipsByStudentId(auth.studentId);
      const isAdmin = canAccessByGroups(memberships, ["E", "H"]) || (await isSoftballManager_());
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
