import crypto from "node:crypto";
import { Readable } from "node:stream";
import express from "express";
import multer from "multer";
import cors from "cors";
import { google } from "googleapis";
import { getConfig } from "./config.js";
import { query, withTransaction } from "./db.js";
import { syncFromAppsScript } from "./sync/pullFromAppsScript.js";
import { createSessionToken, verifySessionToken } from "./auth/session.js";
import { verifyGoogleIdToken } from "./auth/google.js";
import { dispatchNativeAction } from "./nativeActions.js";

const config = getConfig();
const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-id-token", "x-goog-id-token"],
  })
);
app.options("*", cors());

app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

function decodeDriveServiceAccountJson_(base64) {
  const raw = String(base64 || "").trim();
  if (!raw) {
    return null;
  }
  const jsonText = Buffer.from(raw, "base64").toString("utf-8");
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid service account JSON");
  }
  return parsed;
}

async function getDriveClient_() {
  if (!config.driveServiceAccountJsonBase64) {
    throw new Error("Drive upload not configured");
  }
  const credentials = decodeDriveServiceAccountJson_(config.driveServiceAccountJsonBase64);
  if (!credentials) {
    throw new Error("Drive upload not configured");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient });
}

function isAllowedUploadMime_(mime) {
  const normalized = String(mime || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return new Set([
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  ]).has(normalized);
}

function safeFilename_(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "attachment";
  }
  // remove path separators and control chars
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .slice(0, 160) || "attachment";
}

const STUDENT_PROFILE_SELECT = `
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.google_sub,
  s.google_email,
  d.id AS directory_id,
  d.email AS directory_email,
  d.name_zh,
  d.name_en,
  d.preferred_name,
  d.company,
  d.title,
  d.mobile,
  d.photo_url,
  d.dietary_restrictions,
  d.group_id
`;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseCustomFields(value) {
  if (!value) {
    return {};
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function toIsoString(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function isWithinWindow(openAt, closeAt) {
  if (!openAt && !closeAt) {
    return true;
  }
  const now = Date.now();
  const openMs = openAt ? Date.parse(String(openAt)) : NaN;
  const closeMs = closeAt ? Date.parse(String(closeAt)) : NaN;
  if (!Number.isNaN(openMs) && now < openMs) {
    return false;
  }
  if (!Number.isNaN(closeMs) && now > closeMs) {
    return false;
  }
  return true;
}

function firstText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback || "").trim();
}

function buildCheckinStatusForRegistration(registration, checkin) {
  if (!registration) {
    return { status: "not_registered" };
  }
  const fields = parseCustomFields(registration.custom_fields);
  const attendance = String(fields.attendance || "").trim();
  if (!attendance) {
    return { status: "attendance_unknown", attendance: "" };
  }
  if (attendance !== "出席") {
    return { status: "not_attending", attendance };
  }
  if (checkin) {
    return {
      status: "checked_in",
      attendance,
      checkinId: String(checkin.id || ""),
      checkinAt: String(checkin.checkin_at || ""),
    };
  }
  return { status: "not_checked_in", attendance };
}

function buildNodeRegistrationPayload(inputData, normalizedEmail, eventId) {
  const data = inputData || {};
  const customFields = parseCustomFields(data.customFields);
  const studentId = firstText(data.studentId, customFields.studentId || "");
  if (studentId && !customFields.studentId) {
    customFields.studentId = studentId;
  }
  const createdAt = nowIso();
  const id = firstText(data.id, crypto.randomUUID());
  return {
    id,
    eventId,
    studentId,
    userName: firstText(data.userName, data.name || ""),
    userEmail: normalizedEmail,
    userPhone: firstText(data.userPhone, data.phone || ""),
    classYear: firstText(data.classYear),
    customFields,
    status: "registered",
    createdAt,
    updatedAt: createdAt,
    manualCreatedBy: "",
    manualCreatedByName: "",
    manualCreatedAt: "",
  };
}

function buildNodeCheckinPayload(inputData, eventId, registrationId) {
  const data = inputData || {};
  return {
    id: firstText(data.checkinId, data.id || crypto.randomUUID()),
    eventId,
    registrationId,
    checkinAt: toIsoString(data.checkinAt) || nowIso(),
    checkinMethod: firstText(data.checkinMethod, "link"),
  };
}

function normalizeEventPayloadForMirror(data) {
  const input = data || {};
  const output = { ...input };
  if (Object.prototype.hasOwnProperty.call(output, "slug")) {
    delete output.slug;
  }
  return output;
}

async function findEventById(eventId, client) {
  const executor = client || { query };
  const result = await executor.query(`SELECT * FROM events WHERE id = $1 LIMIT 1`, [String(eventId || "").trim()]);
  return result.rows.length ? result.rows[0] : null;
}

async function findRegistrationByEmail(eventId, email, client) {
  const executor = client || { query };
  const result = await executor.query(
    `SELECT *
     FROM registrations
     WHERE event_id = $1
       AND lower(coalesce(user_email, '')) = $2
       AND lower(coalesce(status, '')) <> 'cancelled'
     ORDER BY coalesce(created_at, ''), id
     LIMIT 1`,
    [String(eventId || "").trim(), normalizeEmail(email)]
  );
  return result.rows.length ? result.rows[0] : null;
}

async function findRegistrationById(registrationId, client) {
  const executor = client || { query };
  const result = await executor.query(
    `SELECT * FROM registrations WHERE id = $1 LIMIT 1`,
    [String(registrationId || "").trim()]
  );
  return result.rows.length ? result.rows[0] : null;
}

async function countRegistrations(eventId, client) {
  const executor = client || { query };
  const result = await executor.query(
    `SELECT count(*)::int AS count
     FROM registrations
     WHERE event_id = $1
       AND lower(coalesce(status, '')) <> 'cancelled'`,
    [String(eventId || "").trim()]
  );
  return Number(result.rows[0] && result.rows[0].count ? result.rows[0].count : 0);
}

async function findCheckinByEventRegistration(eventId, registrationId, client) {
  const executor = client || { query };
  const result = await executor.query(
    `SELECT *
     FROM checkins
     WHERE event_id = $1
       AND registration_id = $2
     ORDER BY coalesce(checkin_at, ''), id
     LIMIT 1`,
    [String(eventId || "").trim(), String(registrationId || "").trim()]
  );
  return result.rows.length ? result.rows[0] : null;
}

async function listStatusesByEmail(email, eventIds, client) {
  const normalizedEmail = normalizeEmail(email);
  const ids = (Array.isArray(eventIds) ? eventIds : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item);
  ids.sort();
  const deduped = ids.filter((item, index) => index === 0 || ids[index - 1] !== item);
  if (!normalizedEmail || !deduped.length) {
    return {};
  }
  const executor = client || { query };
  const result = await executor.query(
    `SELECT r.*, c.id AS checkin_id, c.checkin_at
     FROM registrations r
     LEFT JOIN checkins c
       ON c.event_id = r.event_id
      AND c.registration_id = r.id
     WHERE r.event_id = ANY($1::text[])
       AND lower(coalesce(r.user_email, '')) = $2
       AND lower(coalesce(r.status, '')) <> 'cancelled'
     ORDER BY r.event_id, coalesce(c.checkin_at, '') DESC, coalesce(c.id, '') DESC`,
    [deduped, normalizedEmail]
  );

  const byEvent = {};
  result.rows.forEach((row) => {
    const eventId = String(row.event_id || "").trim();
    if (!eventId || byEvent[eventId]) {
      return;
    }
    byEvent[eventId] = row;
  });

  const statuses = {};
  deduped.forEach((eventId) => {
    const row = byEvent[eventId];
    if (!row) {
      statuses[eventId] = { status: "not_registered" };
      return;
    }
    const checkin = row.checkin_id
      ? { id: row.checkin_id, checkin_at: row.checkin_at }
      : null;
    statuses[eventId] = buildCheckinStatusForRegistration(row, checkin);
  });

  return statuses;
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return String(header.slice(7) || "").trim();
}

function getSessionTokenFromRequest(req) {
  const headerToken = getBearerToken(req);
  if (headerToken) {
    return headerToken;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const queryParams = req.query && typeof req.query === "object" ? req.query : {};
  return String(body.sessionToken || body.token || queryParams.sessionToken || "").trim();
}

function getIdTokenFromRequest(req) {
  const headerToken = String(req.headers["x-id-token"] || req.headers["x-goog-id-token"] || "").trim();
  if (headerToken) {
    return headerToken;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const queryParams = req.query && typeof req.query === "object" ? req.query : {};
  return String(body.idToken || queryParams.idToken || "").trim();
}

function isAuthorizedSyncRequest(req) {
  const bearerToken = getBearerToken(req);
  if (bearerToken && bearerToken === config.syncPullToken) {
    return true;
  }
  const bodyToken = String((req.body && (req.body.syncToken || req.body.token)) || "").trim();
  return Boolean(bodyToken && bodyToken === config.syncPullToken);
}

async function parseJsonResponse_(response, actionLabel) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON response for ${actionLabel}`);
  }
}

async function callAppsScriptAction_(action, payload = {}) {
  const requestPayload = {
    action,
    ...payload,
  };
  const requestJson = JSON.stringify(requestPayload);
  const baseUrl = String(config.appsScriptUrl || "").trim();
  if (!baseUrl) {
    throw new Error("Missing APPS_SCRIPT_URL");
  }

  const canUseGet = requestJson.length < 7000;

  if (canUseGet) {
    try {
      const getUrl = new URL(baseUrl);
      getUrl.searchParams.set("payload", requestJson);
      const response = await fetch(getUrl.toString(), {
        method: "GET",
        redirect: "follow",
      });
      const json = await parseJsonResponse_(response, action);
      if (json && typeof json.ok === "boolean") {
        return json;
      }
      throw new Error(`Unexpected response for ${action}`);
    } catch (error) {
      // Try POST fallback below.
    }
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestJson,
    redirect: "follow",
  });
  const json = await parseJsonResponse_(response, action);
  if (json && typeof json.ok === "boolean") {
    return json;
  }
  throw new Error(`Unexpected response for ${action}`);
}

function triggerBackgroundSync_() {
  syncFromAppsScript().catch((error) => {
    console.error("[syncFromAppsScript] background sync failed:", error && error.message ? error.message : error);
  });
}

function toEventPayload(row) {
  return {
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
  };
}

function toRegistrationPayload(row) {
  return {
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
  };
}

function toStudentPayload(row) {
  return {
    id: row.id || "",
    name: row.name || "",
    googleSub: row.google_sub || "",
    googleEmail: row.google_email || "",
  };
}

function toMembershipPayload(row) {
  return {
    id: row.id || "",
    personId: row.person_id || "",
    personName: row.person_name || "",
    groupId: row.group_id || "",
    roleInGroup: row.role_in_group || "",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function toStudentProfile(row, fallbackEmail = "") {
  if (!row) {
    return null;
  }
  const id = String(row.student_id || row.directory_id || "").trim();
  if (!id) {
    return null;
  }
  const preferredName = String(row.preferred_name || "").trim();
  const nameZh = String(row.name_zh || "").trim();
  const nameEn = String(row.name_en || "").trim();
  const name = String(row.student_name || preferredName || nameZh || nameEn || "").trim();
  return {
    id,
    name,
    email: normalizeEmail(row.directory_email || fallbackEmail || row.google_email || ""),
    nameZh,
    nameEn,
    preferredName,
    company: String(row.company || "").trim(),
    title: String(row.title || "").trim(),
    phone: String(row.mobile || "").trim(),
    photoUrl: String(row.photo_url || "").trim(),
    dietaryPreference: String(row.dietary_restrictions || "").trim(),
    group: String(row.group_id || "").trim(),
  };
}

async function listMembershipsByStudentId(studentId) {
  const targetId = String(studentId || "").trim();
  if (!targetId) {
    return [];
  }
  const result = await query(
    `SELECT *
     FROM group_memberships
     WHERE person_id = $1
     ORDER BY coalesce(group_id, ''), coalesce(role_in_group, ''), id`,
    [targetId]
  );
  return result.rows.map(toMembershipPayload);
}

async function findStudentProfileById(studentId) {
  const targetId = String(studentId || "").trim();
  if (!targetId) {
    return null;
  }
  const result = await query(
    `${STUDENT_PROFILE_SELECT}
     FROM students s
     LEFT JOIN directories d ON d.id = s.id
     WHERE s.id = $1
     LIMIT 1`,
    [targetId]
  );
  return result.rows.length ? toStudentProfile(result.rows[0]) : null;
}

async function findStudentProfileByGoogleSub(sub) {
  const targetSub = String(sub || "").trim();
  if (!targetSub) {
    return null;
  }
  const result = await query(
    `${STUDENT_PROFILE_SELECT}
     FROM students s
     LEFT JOIN directories d ON d.id = s.id
     WHERE s.google_sub = $1
     LIMIT 1`,
    [targetSub]
  );
  return result.rows.length ? toStudentProfile(result.rows[0]) : null;
}

async function findStudentProfileByEmail(email) {
  const targetEmail = normalizeEmail(email);
  if (!targetEmail) {
    return null;
  }
  const result = await query(
    `${STUDENT_PROFILE_SELECT}
     FROM directories d
     LEFT JOIN students s ON s.id = d.id
     WHERE lower(coalesce(d.email, '')) = $1
     LIMIT 1`,
    [targetEmail]
  );
  return result.rows.length ? toStudentProfile(result.rows[0], targetEmail) : null;
}

async function resolveAuthContext(req) {
  const providedSessionToken = getSessionTokenFromRequest(req);
  if (providedSessionToken) {
    const payload = verifySessionToken(providedSessionToken);
    if (payload && payload.studentId) {
      return {
        sessionToken: providedSessionToken,
        studentId: payload.studentId,
        profile: payload,
      };
    }
  }

  const idToken = getIdTokenFromRequest(req);
  if (!idToken) {
    return null;
  }

  const googleProfile = await verifyGoogleIdToken(idToken);
  const linkedStudent = await findStudentProfileByGoogleSub(googleProfile.sub);
  if (!linkedStudent || !linkedStudent.id) {
    return null;
  }

  const sessionToken = createSessionToken({
    studentId: linkedStudent.id,
    email: googleProfile.email,
    sub: googleProfile.sub,
    name: googleProfile.name,
  });

  return {
    sessionToken,
    studentId: linkedStudent.id,
    profile: googleProfile,
  };
}

app.get("/health", async (_req, res) => {
  res.json({ ok: true, service: "115b-sys-api", now: new Date().toISOString() });
});

async function handleNativeActionRequest_(req, res, actionName, payload) {
  try {
    const auth = await resolveAuthContext(req);
    const result = await dispatchNativeAction({
      action: actionName,
      payload,
      auth,
      query,
      withTransaction,
      verifyGoogleIdToken,
      createSessionToken,
      listMembershipsByStudentId,
      findStudentProfileById,
    });
    return res.status(result && result.ok ? 200 : 400).json(result);
  } catch (error) {
    const statusCode = Number(error && error.statusCode) || (String(error && error.message) === "Unauthorized" ? 401 : 500);
    return res.status(statusCode).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
}

// Legacy endpoint: in strict mode, only native actions are allowed.
// In non-strict mode, unsupported actions may fall back to Apps Script.
app.post("/v1/action", async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const action = String(payload.action || "").trim();
  if (!action) {
    return res.status(400).json({ ok: false, data: null, error: "Missing action" });
  }

  const forwarded = Object.assign({}, payload);
  delete forwarded.action;

  // Always try native first.
  const auth = await resolveAuthContext(req);
  try {
    const nativeResult = await dispatchNativeAction({
      action,
      payload: forwarded,
      auth,
      query,
      withTransaction,
      verifyGoogleIdToken,
      createSessionToken,
      listMembershipsByStudentId,
      findStudentProfileById,
    });

    if (nativeResult && nativeResult.ok) {
      return res.status(200).json(nativeResult);
    }

    const isUnsupported = nativeResult && nativeResult.ok === false && String(nativeResult.error || "").startsWith("Unsupported action");
    if (!isUnsupported) {
      return res.status(400).json(nativeResult || { ok: false, data: null, error: "Action failed" });
    }

    if (config.strictNodeOnly) {
      return res.status(400).json(nativeResult);
    }
  } catch (error) {
    if (config.strictNodeOnly) {
      const statusCode = Number(error && error.statusCode) || (String(error && error.message) === "Unauthorized" ? 401 : 500);
      return res.status(statusCode).json({ ok: false, data: null, error: error.message || "Internal error" });
    }
    // Non-strict: fallback below.
  }

  try {
    const result = await callAppsScriptAction_(action, forwarded);
    if (!result || typeof result.ok !== "boolean") {
      return res.status(502).json({ ok: false, data: null, error: "Invalid upstream response" });
    }

    const shouldTriggerSync = !/^list|^get|^lookup|^search|^verify/i.test(action);
    if (shouldTriggerSync) {
      triggerBackgroundSync_();
    }

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

// New native-only endpoint (preferred).
app.post("/v1/actions/:action", async (req, res) => {
  const actionName = String(req.params.action || "").trim();
  if (!actionName) {
    return res.status(400).json({ ok: false, data: null, error: "Missing action" });
  }
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  return handleNativeActionRequest_(req, res, actionName, payload);
});

app.get("/v1/events", async (_req, res) => {
  try {
    const result = await query(`SELECT * FROM events ORDER BY coalesce(start_at, ''), id`);
    res.json({
      ok: true,
      data: { events: result.rows.map(toEventPayload) },
      error: null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/students", async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name, google_sub, google_email
       FROM students
       ORDER BY coalesce(id, '')`
    );
    return res.json({
      ok: true,
      data: { students: result.rows.map(toStudentPayload) },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/group-memberships", async (_req, res) => {
  try {
    const result = await query(
      `SELECT *
       FROM group_memberships
       ORDER BY coalesce(group_id, ''), coalesce(person_id, ''), id`
    );
    return res.json({
      ok: true,
      data: { memberships: result.rows.map(toMembershipPayload) },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

function toDirectoryEntry(row) {
  if (!row) {
    return null;
  }
  const id = String(row.id || "").trim();
  if (!id) {
    return null;
  }
  return {
    id,
    email: normalizeEmail(row.email || ""),
    nameZh: String(row.name_zh || "").trim(),
    nameEn: String(row.name_en || "").trim(),
    preferredName: String(row.preferred_name || "").trim(),
    company: String(row.company || "").trim(),
    title: String(row.title || "").trim(),
    mobile: String(row.mobile || "").trim(),
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

function canViewDirectory_(memberships) {
  const list = Array.isArray(memberships) ? memberships : [];
  return list.some((item) => {
    const groupId = String(item.groupId || item.group_id || "").trim();
    const role = String(item.roleInGroup || item.role_in_group || "").trim();
    if (groupId === "E") {
      return true;
    }
    if (groupId === "A" && (role === "lead" || role === "deputy")) {
      return true;
    }
    return false;
  });
}

app.get("/v1/directory", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const memberships = await listMembershipsByStudentId(auth.studentId);
    if (!canViewDirectory_(memberships)) {
      return res.status(403).json({ ok: false, data: null, error: "Unauthorized" });
    }

    const result = await query(
      `SELECT *
       FROM directories
       ORDER BY coalesce(group_id, ''), coalesce(name_zh, ''), coalesce(preferred_name, ''), id`
    );
    const directory = result.rows.map(toDirectoryEntry).filter(Boolean);
    return res.json({ ok: true, data: { directory }, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/lookup-student", async (req, res) => {
  const email = normalizeEmail(req.query.email || "");
  if (!email) {
    return res.status(400).json({ ok: false, data: null, error: "Missing email" });
  }

  try {
    const result = await query(
      `${STUDENT_PROFILE_SELECT}
       FROM directories d
       JOIN students s ON s.id = d.id
       WHERE lower(coalesce(d.email, '')) = $1
       LIMIT 1`,
      [email]
    );
    if (!result.rows.length) {
      return res.status(404).json({ ok: false, data: null, error: "Student not found" });
    }
    return res.json({ ok: true, data: { student: toStudentProfile(result.rows[0], email) }, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/bootstrap/home", async (req, res) => {
  const email = normalizeEmail(req.query.email || "");
  if (!email) {
    return res.status(400).json({ ok: false, data: null, error: "Missing email" });
  }

  try {
    const [eventsResult, registrationsResult] = await Promise.all([
      query(`SELECT * FROM events ORDER BY coalesce(start_at, ''), id`),
      query(
        `SELECT *
         FROM registrations
         WHERE lower(coalesce(user_email, '')) = $1
           AND lower(coalesce(status, '')) <> 'cancelled'
         ORDER BY coalesce(created_at, ''), id`,
        [email]
      ),
    ]);

    const registrations = registrationsResult.rows.map(toRegistrationPayload);
    const eventIds = registrations
      .map((item) => String(item.eventId || "").trim())
      .filter((item) => item);
    const checkinStatuses = eventIds.length ? await listStatusesByEmail(email, eventIds) : {};

    return res.json({
      ok: true,
      data: {
        events: eventsResult.rows.map(toEventPayload),
        registrations,
        checkinStatuses,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/bootstrap/registration", async (req, res) => {
  const eventId = String(req.query.eventId || "").trim();
  const email = normalizeEmail(req.query.email || "");
  if (!eventId) {
    return res.json({ ok: false, data: null, error: "Missing eventId" });
  }

  try {
    const event = await findEventById(eventId);
    if (!event) {
      return res.json({ ok: false, data: null, error: "Event not found" });
    }
    const registration = email ? await findRegistrationByEmail(eventId, email) : null;
    const student = email ? await findStudentProfileByEmail(email) : null;
    return res.json({
      ok: true,
      data: {
        event: toEventPayload(event),
        registration: registration ? toRegistrationPayload(registration) : null,
        student: student || null,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/bootstrap/checkin", async (req, res) => {
  const eventId = String(req.query.eventId || "").trim();
  const email = normalizeEmail(req.query.email || "");
  if (!eventId) {
    return res.json({ ok: false, data: null, error: "Missing eventId" });
  }

  try {
    const event = await findEventById(eventId);
    if (!event) {
      return res.json({ ok: false, data: null, error: "Event not found" });
    }
    const statuses = email ? await listStatusesByEmail(email, [eventId]) : {};
    const statusEntry = statuses[eventId] || null;
    return res.json({
      ok: true,
      data: {
        event: toEventPayload(event),
        checkinStatus: statusEntry ? String(statusEntry.status || "") : null,
        attendance: statusEntry ? String(statusEntry.attendance || "") : "",
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

async function handleListCheckinStatus(req, res) {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const email = normalizeEmail(payload.email || req.query.email || "");
  const eventIds = Array.isArray(payload.eventIds)
    ? payload.eventIds
    : String(req.query.eventIds || "")
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item);

  if (!email) {
    return res.json({ ok: false, data: null, error: "Missing email" });
  }

  try {
    const statuses = await listStatusesByEmail(email, eventIds);
    return res.json({ ok: true, data: { statuses }, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
}

app.get("/v1/checkin-status", handleListCheckinStatus);
app.post("/v1/checkin-status", handleListCheckinStatus);

app.post("/v1/register", async (req, res) => {
  const data = (req.body && req.body.data) || req.body || {};
  const eventId = String(data.eventId || "").trim();
  const email = normalizeEmail(data.userEmail || data.email);
  if (!eventId || !email) {
    return res.json({ ok: false, data: null, error: "Missing eventId or email" });
  }

  try {
    const event = await findEventById(eventId);
    if (!event) {
      return res.json({ ok: false, data: null, error: "Event not found" });
    }

    const status = String(event.status || "").trim().toLowerCase();
    if (status && status !== "open") {
      return res.json({ ok: false, data: null, error: "Event is not open" });
    }

    if (!isWithinWindow(event.registration_open_at, event.registration_close_at)) {
      return res.json({ ok: false, data: null, error: "Registration window closed" });
    }

    const existing = await findRegistrationByEmail(eventId, email);
    if (existing) {
      return res.json({ ok: false, data: null, error: "Duplicate registration" });
    }

    const capacity = Number.isFinite(Number(event.capacity)) ? Math.trunc(Number(event.capacity)) : 0;
    const registrationPayload = buildNodeRegistrationPayload(data, email, eventId);

    await withTransaction(async (client) => {
      const duplicateInTx = await findRegistrationByEmail(eventId, email, client);
      if (duplicateInTx) {
        const error = new Error("Duplicate registration");
        error.code = "BUSINESS";
        throw error;
      }
      if (capacity > 0) {
        const currentCount = await countRegistrations(eventId, client);
        if (currentCount >= capacity) {
          const error = new Error("Event is full");
          error.code = "BUSINESS";
          throw error;
        }
      }

      const rawPayload = {
        id: registrationPayload.id,
        eventId: registrationPayload.eventId,
        studentId: registrationPayload.studentId,
        userName: registrationPayload.userName,
        userEmail: registrationPayload.userEmail,
        userPhone: registrationPayload.userPhone,
        classYear: registrationPayload.classYear,
        customFields: registrationPayload.customFields,
        status: registrationPayload.status,
        createdAt: registrationPayload.createdAt,
        updatedAt: registrationPayload.updatedAt,
        manualCreatedBy: registrationPayload.manualCreatedBy,
        manualCreatedByName: registrationPayload.manualCreatedByName,
        manualCreatedAt: registrationPayload.manualCreatedAt,
      };

      await client.query(
        `INSERT INTO registrations (
          id, event_id, student_id, user_name, user_email, user_phone, class_year,
          custom_fields, status, created_at, updated_at,
          manual_created_by, manual_created_by_name, manual_created_at,
          raw, synced_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8::jsonb, $9, $10, $11,
          $12, $13, $14,
          $15::jsonb, now()
        )`,
        [
          registrationPayload.id,
          registrationPayload.eventId,
          registrationPayload.studentId || null,
          registrationPayload.userName,
          registrationPayload.userEmail,
          registrationPayload.userPhone,
          registrationPayload.classYear,
          JSON.stringify(registrationPayload.customFields || {}),
          registrationPayload.status,
          registrationPayload.createdAt,
          registrationPayload.updatedAt,
          registrationPayload.manualCreatedBy,
          registrationPayload.manualCreatedByName,
          registrationPayload.manualCreatedAt,
          JSON.stringify(rawPayload),
        ]
      );

      const mirrorData = normalizeEventPayloadForMirror({
        ...data,
        id: registrationPayload.id,
        eventId: registrationPayload.eventId,
        studentId: registrationPayload.studentId,
        userEmail: registrationPayload.userEmail,
        userName: registrationPayload.userName,
        userPhone: registrationPayload.userPhone,
        classYear: registrationPayload.classYear,
        customFields: registrationPayload.customFields,
        createdAt: registrationPayload.createdAt,
        updatedAt: registrationPayload.updatedAt,
      });

      const mirrored = await callAppsScriptAction_("register", { data: mirrorData });
      if (!mirrored || mirrored.ok !== true) {
        console.warn("[mirror:register] failed", {
          registrationId: registrationPayload.id,
          eventId: registrationPayload.eventId,
          error: (mirrored && mirrored.error) || "Register failed",
        });
      }
    });

    triggerBackgroundSync_();
    return res.json({ ok: true, data: { registrationId: registrationPayload.id }, error: null });
  } catch (error) {
    const isBusiness = String(error && error.code || "") === "BUSINESS";
    if (isBusiness) {
      return res.json({ ok: false, data: null, error: error.message || "Register failed" });
    }
    return res.status(500).json({
      ok: false,
      data: null,
      error: error && error.message ? error.message : "Register failed",
    });
  }
});

app.post("/v1/update-registration", async (req, res) => {
  const data = (req.body && req.body.data) || req.body || {};
  const registrationId = String(data.id || "").trim();
  if (!registrationId) {
    return res.json({ ok: false, data: null, error: "Missing registration id" });
  }

  try {
    const existing = await findRegistrationById(registrationId);
    if (!existing) {
      return res.json({ ok: false, data: null, error: "Registration not found" });
    }

    const normalizedInputEmail = normalizeEmail(data.userEmail || req.body.email || "");
    if (!normalizedInputEmail || normalizeEmail(existing.user_email) !== normalizedInputEmail) {
      return res.json({ ok: false, data: null, error: "Unauthorized" });
    }

    const event = await findEventById(existing.event_id);
    if (!event) {
      return res.json({ ok: false, data: null, error: "Event not found" });
    }
    const eventStatus = String(event.status || "").trim().toLowerCase();
    if (eventStatus && eventStatus !== "open") {
      return res.json({ ok: false, data: null, error: "Event is not open" });
    }
    if (!isWithinWindow(event.registration_open_at, event.registration_close_at)) {
      return res.json({ ok: false, data: null, error: "Registration window closed" });
    }

    const nextCustomFields = parseCustomFields(
      Object.prototype.hasOwnProperty.call(data, "customFields") ? data.customFields : existing.custom_fields
    );
    const nextPayload = {
      id: existing.id,
      eventId: existing.event_id,
      studentId: firstText(data.studentId, existing.student_id || ""),
      userName: firstText(data.userName, existing.user_name || ""),
      userEmail: normalizeEmail(existing.user_email),
      userPhone: firstText(data.userPhone, existing.user_phone || ""),
      classYear: firstText(existing.class_year || ""),
      customFields: nextCustomFields,
      status: firstText(existing.status, "registered"),
      createdAt: String(existing.created_at || ""),
      updatedAt: nowIso(),
      manualCreatedBy: String(existing.manual_created_by || ""),
      manualCreatedByName: String(existing.manual_created_by_name || ""),
      manualCreatedAt: String(existing.manual_created_at || ""),
    };

    await withTransaction(async (client) => {
      const current = await findRegistrationById(registrationId, client);
      if (!current) {
        const error = new Error("Registration not found");
        error.code = "BUSINESS";
        throw error;
      }

      await client.query(
        `UPDATE registrations
         SET student_id = $2,
             user_name = $3,
             user_phone = $4,
             custom_fields = $5::jsonb,
             updated_at = $6,
             raw = $7::jsonb,
             synced_at = now()
         WHERE id = $1`,
        [
          registrationId,
          nextPayload.studentId || null,
          nextPayload.userName,
          nextPayload.userPhone,
          JSON.stringify(nextPayload.customFields || {}),
          nextPayload.updatedAt,
          JSON.stringify(nextPayload),
        ]
      );

      const mirrored = await callAppsScriptAction_("updateRegistration", {
        data: {
          id: nextPayload.id,
          eventId: nextPayload.eventId,
          studentId: nextPayload.studentId,
          userName: nextPayload.userName,
          userEmail: nextPayload.userEmail,
          userPhone: nextPayload.userPhone,
          classYear: nextPayload.classYear,
          customFields: JSON.stringify(nextPayload.customFields || {}),
          status: nextPayload.status,
        },
        email: nextPayload.userEmail,
      });
      if (!mirrored || mirrored.ok !== true) {
        console.warn("[mirror:updateRegistration] failed", {
          registrationId: nextPayload.id,
          eventId: nextPayload.eventId,
          error: (mirrored && mirrored.error) || "更新失敗",
        });
      }
    });

    const updated = await findRegistrationById(registrationId);
    triggerBackgroundSync_();
    return res.json({
      ok: true,
      data: { registration: updated ? toRegistrationPayload(updated) : null },
      error: null,
    });
  } catch (error) {
    const isBusiness = String(error && error.code || "") === "BUSINESS";
    if (isBusiness) {
      return res.json({ ok: false, data: null, error: error.message || "更新失敗" });
    }
    return res.status(500).json({ ok: false, data: null, error: error.message || "更新失敗" });
  }
});

app.post("/v1/checkin", async (req, res) => {
  const data = (req.body && req.body.data) || req.body || {};
  const eventId = String(data.eventId || "").trim();
  const email = normalizeEmail(data.userEmail || data.email);
  if (!eventId || !email) {
    return res.json({ ok: false, data: null, error: "Missing eventId or email" });
  }

  try {
    const event = await findEventById(eventId);
    if (!event) {
      return res.json({ ok: false, data: null, error: "Event not found" });
    }
    if (!String(event.checkin_url || "").trim()) {
      return res.json({ ok: false, data: null, error: "Check-in link not configured" });
    }
    if (!isWithinWindow(event.checkin_open_at, event.checkin_close_at)) {
      return res.json({ ok: false, data: null, error: "Check-in window closed" });
    }

    const registration = await findRegistrationByEmail(eventId, email);
    if (!registration) {
      return res.json({ ok: false, data: null, error: "Registration not found" });
    }

    const existingCheckin = await findCheckinByEventRegistration(eventId, registration.id);
    const statusInfo = buildCheckinStatusForRegistration(registration, existingCheckin);
    if (statusInfo.status === "attendance_unknown") {
      return res.json({ ok: false, data: null, error: "Attendance not confirmed" });
    }
    if (statusInfo.status === "not_attending") {
      return res.json({ ok: false, data: null, error: "Not attending" });
    }
    if (statusInfo.status === "checked_in") {
      return res.json({ ok: false, data: null, error: "Already checked in" });
    }

    const checkinPayload = buildNodeCheckinPayload(data, eventId, registration.id);

    await withTransaction(async (client) => {
      const registrationInTx = await findRegistrationByEmail(eventId, email, client);
      if (!registrationInTx) {
        const error = new Error("Registration not found");
        error.code = "BUSINESS";
        throw error;
      }
      const duplicate = await findCheckinByEventRegistration(eventId, registrationInTx.id, client);
      if (duplicate) {
        const error = new Error("Already checked in");
        error.code = "BUSINESS";
        throw error;
      }

      await client.query(
        `INSERT INTO checkins (id, event_id, registration_id, checkin_at, checkin_method, raw, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
        [
          checkinPayload.id,
          checkinPayload.eventId,
          checkinPayload.registrationId,
          checkinPayload.checkinAt,
          checkinPayload.checkinMethod,
          JSON.stringify({
            id: checkinPayload.id,
            eventId: checkinPayload.eventId,
            registrationId: checkinPayload.registrationId,
            checkinAt: checkinPayload.checkinAt,
            checkinMethod: checkinPayload.checkinMethod,
          }),
        ]
      );

      const mirrored = await callAppsScriptAction_("checkin", {
        data: normalizeEventPayloadForMirror({
          ...data,
          eventId: eventId,
          userEmail: email,
          checkinId: checkinPayload.id,
          checkinAt: checkinPayload.checkinAt,
          checkinMethod: checkinPayload.checkinMethod,
        }),
      });
      if (!mirrored || mirrored.ok !== true) {
        console.warn("[mirror:checkin] failed", {
          checkinId: checkinPayload.id,
          eventId,
          email,
          error: (mirrored && mirrored.error) || "Checkin failed",
        });
      }
    });

    triggerBackgroundSync_();
    return res.json({
      ok: true,
      data: {
        userName: String(registration.user_name || ""),
        checkinId: checkinPayload.id,
        checkinAt: checkinPayload.checkinAt,
      },
      error: null,
    });
  } catch (error) {
    const isBusiness = String(error && error.code || "") === "BUSINESS";
    if (isBusiness) {
      return res.json({ ok: false, data: null, error: error.message || "Checkin failed" });
    }
    return res.status(500).json({
      ok: false,
      data: null,
      error: error && error.message ? error.message : "Checkin failed",
    });
  }
});

app.post("/v1/auth/verify-google", async (req, res) => {
  const idToken = String((req.body && req.body.idToken) || "").trim();
  if (!idToken) {
    return res.status(400).json({ ok: false, data: null, error: "Missing idToken" });
  }

  try {
    const profile = await verifyGoogleIdToken(idToken);
    const linkedStudent = await findStudentProfileByGoogleSub(profile.sub);

    let emailMatch = null;
    let sessionToken = "";
    let memberships = [];

    if (linkedStudent && linkedStudent.id) {
      sessionToken = createSessionToken({
        studentId: linkedStudent.id,
        email: profile.email,
        sub: profile.sub,
        name: profile.name,
      });
      memberships = await listMembershipsByStudentId(linkedStudent.id);
    } else if (profile.email) {
      emailMatch = await findStudentProfileByEmail(profile.email);
    }

    return res.json({
      ok: true,
      data: {
        profile,
        student: linkedStudent,
        emailMatch,
        sessionToken,
        memberships,
      },
      error: null,
    });
  } catch (error) {
    const unauthorized = String(error && error.message ? error.message : "") === "Unauthorized";
    return res.status(unauthorized ? 401 : 500).json({
      ok: false,
      data: null,
      error: unauthorized ? "Unauthorized" : error.message || "Internal error",
    });
  }
});

app.post("/v1/auth/create-session", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const student = await findStudentProfileById(auth.studentId);
    const memberships = await listMembershipsByStudentId(auth.studentId);
    return res.json({
      ok: true,
      data: {
        sessionToken: auth.sessionToken,
        studentId: auth.studentId,
        student,
        memberships,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.post("/v1/finance/attachments/upload", upload.single("file"), async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }

    const folderId = String(config.driveFinanceFolderId || "").trim();
    if (!folderId) {
      return res.status(500).json({ ok: false, data: null, error: "Drive folder not configured" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, data: null, error: "Missing file" });
    }

    const mimetype = String(file.mimetype || "").trim();
    if (!isAllowedUploadMime_(mimetype)) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "不支援的檔案格式（僅支援 pdf/jpg/png/heic/xlsx/docx/pptx）",
      });
    }

    const drive = await getDriveClient_();
    const name = safeFilename_(file.originalname);

    const createResponse = await drive.files.create({
      requestBody: {
        name,
        parents: [folderId],
      },
      media: {
        mimeType: mimetype,
        body: Readable.from(file.buffer),
      },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });

    const fileId = String((createResponse && createResponse.data && createResponse.data.id) || "").trim();
    if (!fileId) {
      throw new Error("Drive upload failed");
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    const url = `https://drive.google.com/file/d/${fileId}/view`;
    return res.json({
      ok: true,
      data: {
        fileId,
        name,
        url,
        size: Number(file.size || 0),
        mimeType: mimetype,
      },
      error: null,
    });
  } catch (error) {
    const message = String((error && error.message) || "Upload failed");
    if (message === "Drive upload not configured") {
      return res.status(500).json({ ok: false, data: null, error: "Drive 上傳尚未設定" });
    }
    return res.status(500).json({ ok: false, data: null, error: message || "Upload failed" });
  }
});

async function handleListMyMemberships(req, res) {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const memberships = await listMembershipsByStudentId(auth.studentId);
    return res.json({
      ok: true,
      data: {
        sessionToken: auth.sessionToken,
        studentId: auth.studentId,
        memberships,
      },
      error: null,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
}

app.get("/v1/memberships/my", handleListMyMemberships);
app.post("/v1/memberships/my", handleListMyMemberships);

app.post("/internal/sync/pull", async (req, res) => {
  if (!isAuthorizedSyncRequest(req)) {
    return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
  }

  try {
    const result = await syncFromAppsScript();
    return res.json({ ok: true, data: result, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Sync failed" });
  }
});

app.get("/internal/sync/runs", async (req, res) => {
  if (!isAuthorizedSyncRequest(req)) {
    return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
  }
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.trunc(limitRaw))) : 20;
  try {
    const result = await query(
      `SELECT id, started_at, finished_at, status, summary, error
       FROM sync_runs
       ORDER BY id DESC
       LIMIT $1`,
      [limit]
    );
    return res.json({ ok: true, data: { runs: result.rows }, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, data: null, error: "Not found" });
});

app.listen(config.port, () => {
  console.log(`115b-sys-api listening on :${config.port}`);
});
