import crypto from "node:crypto";
import { Readable } from "node:stream";
import express from "express";
import multer from "multer";
import cors from "cors";
import { google } from "googleapis";
import { getConfig } from "./config.js";
import { query, withTransaction } from "./db.js";
import { jsonbParam } from "./jsonb.js";
import { createSessionToken, createRefreshToken, verifyRefreshToken, verifySessionToken } from "./auth/session.js";
import { verifyGoogleIdToken } from "./auth/google.js";
import { dispatchNativeAction, refreshAcademicCourseBootstrapSnapshot, runAcademicAutoSync } from "./nativeActions.js";
import {
  isAllowedAttachmentMime,
  isAttachmentStorageConfigured,
  listAttachmentsByEntity,
  createSignedReadUrlForAttachment,
  createSignedUploadUrl,
  downloadStorageObject,
  listStoragePaths,
  removeStorageObject,
  softDeleteAttachment,
  uploadAttachmentFile,
} from "./attachments.js";
import {
  ACTIVITY_ALBUM_MAX_IMAGE_BYTES,
  isAcceptedActivityAlbumMime,
  validateActivityAlbumImage,
} from "./activityAlbumImageValidation.js";
import { activityPhotoPublicFields, canCreateActivityAlbum, canReadActivityPhoto, isCurrentActiveActivityMember } from "./activityAlbumSecurity.js";
import { cleanActivityAlbumOrphans, cleanExpiredActivityPending } from "./activityAlbumPendingCleanup.js";
import { activityUploadIpHash, recordAndCheckActivityUploadIntent } from "./activityAlbumUploadRateLimit.js";
import { loadStorageMonitoringSnapshot } from "./storageMonitoring.js";
import { canViewStorageMonitoring } from "./storageMonitoringAccess.js";
import {
  cleanExpiredCheerleadingVideoUploads,
  reserveCheerleadingVideoPending,
  validateCheerleadingVideoIntent,
  validateCompletedCheerleadingVideoObject,
} from "./cheerleadingVideoUpload.js";

const config = getConfig();
const app = express();
// Render terminates TLS at its proxy. One trusted hop gives the album abuse
// limiter a client IP while not accepting an arbitrary forwarded chain.
app.set("trust proxy", 1);

const ACADEMICS_AUTO_SYNC_INTERVAL_MS = Math.max(
  30 * 60 * 1000,
  Number(process.env.ACADEMICS_AUTO_SYNC_INTERVAL_MINUTES || 180) * 60 * 1000
);
let academicsAutoSyncRunning_ = false;

async function runAcademicAutoSyncTask_(reason = "interval") {
  if (academicsAutoSyncRunning_) {
    return;
  }
  academicsAutoSyncRunning_ = true;
  try {
    const result = await runAcademicAutoSync({ query, withTransaction, force: false });
    if (!result || !result.configured) {
      if (reason === "startup") {
        console.log("[academics] auto-sync skipped (ACADEMICS_ICS_URL not configured)");
      }
      return;
    }
    if (result.didSync) {
      console.log(`[academics] auto-sync completed (${reason}), imported ${Number(result.count || 0)} sessions`);
    } else if (reason === "startup") {
      console.log("[academics] auto-sync check completed (already fresh)");
    }
    await refreshAcademicCourseBootstrapSnapshot({ query, withTransaction });
    if (reason === "startup") {
      console.log("[academics] student course snapshot ready");
    }
  } catch (error) {
    console.error(`[academics] auto-sync failed (${reason}):`, (error && error.message) || error);
  } finally {
    academicsAutoSyncRunning_ = false;
  }
}

if (!config.sessionSecret) {
  throw new Error("Missing required env: SESSION_SECRET");
}
if (!config.googleClientId) {
  throw new Error("Missing required env: GOOGLE_CLIENT_ID");
}

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-id-token", "x-goog-id-token"],
  })
);
app.options("*", cors());

app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
    fields: 12,
    parts: 13,
    fieldSize: 64 * 1024,
  },
});

const LEGACY_MULTIPART_MAX_BYTES = 25 * 1024 * 1024;
const LEGACY_MULTIPART_MAX_CONCURRENCY = 2;
const CHEERLEADING_VIDEO_UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;
const CHEERLEADING_VIDEO_MAX_PENDING_UPLOADS = 3;
const CHEERLEADING_VIDEO_PENDING_TTL_HOURS = 3;
let activeLegacyMultipartUploads_ = 0;

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

function recoverUtf8Filename_(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const recovered = Buffer.from(raw, "latin1").toString("utf8").trim();
    const hasMojibake = /[ÃÂÅÆÇÐÑÕØåæçéö]/.test(raw);
    const hasReadableUnicode = /[\u4e00-\u9fff]/.test(recovered);
    if (recovered && recovered !== raw && (hasMojibake || hasReadableUnicode)) {
      return recovered;
    }
  } catch {
    // ignore recovery failures
  }
  return raw;
}

function safeFilename_(value) {
  const raw = recoverUtf8Filename_(value);
  if (!raw) {
    return "attachment";
  }
  // remove path separators and control chars
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .slice(0, 160) || "attachment";
}

function normalizeAttachmentEntityType_(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "_").slice(0, 80);
}

function normalizeAttachmentEntityId_(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]+/g, "_").slice(0, 120);
}

function isDocumentDraftEntity_(entityType, entityId) {
  return entityType === "document_version" && entityId.startsWith("draft:");
}

function isFinanceDraftEntity_(entityType, entityId) {
  return entityType === "finance_request" && entityId.startsWith("draft:");
}

async function canAccessAttachmentEntity_(auth, entityType, entityId, reqBody = {}) {
  if (!auth || !auth.studentId) {
    return { canView: false, canUpload: false, canDelete: false };
  }
  const memberships = await listMembershipsByStudentId(auth.studentId);
  const isAdminLike = memberships.some((item) => {
    const groupId = String(item.groupId || item.group_id || "").trim();
    const role = String(item.roleInGroup || item.role_in_group || "").trim().toLowerCase();
    if (groupId === "E") {
      return true;
    }
    return groupId === "A" && (role === "lead" || role === "deputy");
  });

  if (entityType === "document_version") {
    if (isDocumentDraftEntity_(entityType, entityId)) {
      const ownerGroupId = String(reqBody.ownerGroupId || reqBody.groupId || "").trim();
      if (!ownerGroupId) {
        return { canView: false, canUpload: false, canDelete: false };
      }
      const canEdit = memberships.some((item) => {
        const groupId = String(item.groupId || item.group_id || "").trim();
        const role = String(item.roleInGroup || item.role_in_group || "").trim().toLowerCase();
        if (isAdminLike) {
          return true;
        }
        return groupId === ownerGroupId && (role === "lead" || role === "deputy");
      });
      return { canView: canEdit, canUpload: canEdit, canDelete: canEdit };
    }

    const result = await query(`select * from documents where latest_version_id = $1 or id = $1 limit 1`, [entityId]);
    const row = result.rows[0];
    if (!row) {
      return { canView: false, canUpload: false, canDelete: false };
    }
    const ownerGroupId = String(row.owner_group_id || "").trim();
    const canEdit = isAdminLike || memberships.some((item) => {
      const groupId = String(item.groupId || item.group_id || "").trim();
      const role = String(item.roleInGroup || item.role_in_group || "").trim().toLowerCase();
      return groupId === ownerGroupId && (role === "lead" || role === "deputy");
    });
    return { canView: true, canUpload: canEdit, canDelete: canEdit };
  }

  if (entityType === "finance_request") {
    if (isFinanceDraftEntity_(entityType, entityId)) {
      return { canView: true, canUpload: true, canDelete: true };
    }
    const result = await query(`select * from finance_requests where id = $1 limit 1`, [entityId]);
    const row = result.rows[0];
    if (!row) {
      return { canView: false, canUpload: false, canDelete: false };
    }
    const applicantId = String(row.applicant_id || "").trim();
    const isOwner = applicantId && applicantId === String(auth.studentId || "").trim();
    const financeRole = memberships.some((item) => {
      const groupId = String(item.groupId || item.group_id || "").trim();
      return groupId === "D" || groupId === "E" || groupId === "A";
    });
    const canManage = isAdminLike || financeRole;
    return { canView: isOwner || canManage, canUpload: isOwner || canManage, canDelete: canManage || isOwner };
  }

  if (entityType === "academic_session_note") {
    const canManage = isAdminLike || memberships.some((item) => {
      const groupId = String(item.groupId || item.group_id || "").trim();
      return groupId === "F" || groupId === "E" || groupId === "A";
    });
    return { canView: true, canUpload: canManage, canDelete: canManage };
  }

  if (entityType === "cheerleading_video") {
    const canManage = isAdminLike || memberships.some((item) => String(item.groupId || item.group_id || "").trim() === "L");
    return { canView: true, canUpload: canManage, canDelete: canManage };
  }

  return { canView: isAdminLike, canUpload: isAdminLike, canDelete: isAdminLike };
}

const STUDENT_PROFILE_SELECT = `
SELECT
  s.id AS student_id,
  s.name AS student_name,
  s.google_sub,
  s.google_email,
  s.lifecycle_status,
  s.lifecycle_updated_at,
  s.lifecycle_reason,
  s.lifecycle_notes,
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

const ACTIVE_STUDENT_WHERE_SQL = `coalesce(nullif(s.lifecycle_status, ''), 'active') = 'active'`;

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
  if (!attendance || attendance === "尚未確定") {
    return { status: "attendance_unknown", attendance: attendance || "" };
  }
  if (attendance === "不克出席") {
    return { status: "not_attending", attendance };
  }
  if (attendance !== "出席") {
    return { status: "attendance_unknown", attendance };
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
  // Security hardening: do not accept session token from query string.
  return String(body.sessionToken || body.token || "").trim();
}

function getIdTokenFromRequest(req) {
  const headerToken = String(req.headers["x-id-token"] || req.headers["x-goog-id-token"] || "").trim();
  if (headerToken) {
    return headerToken;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  // Security hardening: do not accept id token from query string.
  return String(body.idToken || "").trim();
}

function toEventPayload(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
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
    allowCompanions: raw.allowCompanions || "yes",
    allowBringDrinks: raw.allowBringDrinks || "yes",
    formSchema: row.form_schema || {},
    revisionNo: Number(row.revision_no || 0) || 0,
    lastChangeBatchId: row.last_change_batch_id || "",
    lastChangedAt: row.last_changed_at || "",
    lastChangedBy: row.last_changed_by || "",
    lastChangedByName: row.last_changed_by_name || "",
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
    status: row.lifecycle_status || "active",
    lifecycleStatus: row.lifecycle_status || "active",
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
    status: String(row.lifecycle_status || "active").trim() || "active",
    lifecycleStatus: String(row.lifecycle_status || "active").trim() || "active",
  };
}

async function listMembershipsByStudentId(studentId) {
  const targetId = String(studentId || "").trim();
  if (!targetId) {
    return [];
  }
  const result = await query(
    `SELECT gm.*
     FROM group_memberships gm
     JOIN students s ON s.id = gm.person_id
     WHERE gm.person_id = $1
       AND ${ACTIVE_STUDENT_WHERE_SQL}
     ORDER BY coalesce(gm.group_id, ''), coalesce(gm.role_in_group, ''), gm.id`,
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
       AND ${ACTIVE_STUDENT_WHERE_SQL}
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
       AND ${ACTIVE_STUDENT_WHERE_SQL}
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
       AND ${ACTIVE_STUDENT_WHERE_SQL}
     LIMIT 1`,
    [targetEmail]
  );
  return result.rows.length ? toStudentProfile(result.rows[0], targetEmail) : null;
}

async function resolveAuthContext(req) {
  // 1) Prefer Bearer token, but if it's invalid, fall back to a body/query sessionToken.
  const bearerToken = getBearerToken(req);
  if (bearerToken) {
    const payload = verifySessionToken(bearerToken);
    if (payload && payload.studentId) {
      return {
        sessionToken: bearerToken,
        studentId: payload.studentId,
        profile: payload,
      };
    }
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const queryParams = req.query && typeof req.query === "object" ? req.query : {};
  const providedSessionToken = String(body.sessionToken || body.token || queryParams.sessionToken || "").trim();
  if (providedSessionToken && providedSessionToken !== bearerToken) {
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

function resolveActivityAlbumBearerAuth(req) {
  // Album endpoints intentionally do not inherit legacy body/query token
  // compatibility. In particular, an invalid Bearer token must never fall
  // back to a valid token smuggled in a query string or JSON payload.
  const bearerToken = getBearerToken(req);
  if (!bearerToken) return null;
  const payload = verifySessionToken(bearerToken);
  if (!payload || !payload.studentId) return null;
  return { sessionToken: bearerToken, studentId: payload.studentId, profile: payload };
}

app.get("/health", async (_req, res) => {
  res.json({ ok: true, service: "115b-sys-api", now: new Date().toISOString() });
});

const PUBLIC_NATIVE_ACTIONS = new Set(["verifyGoogle", "linkGoogleStudent", "refreshSession", "searchStudents"]);

async function handleNativeActionRequest_(req, res, actionName, payload) {
  try {
    const auth = PUBLIC_NATIVE_ACTIONS.has(actionName) ? null : await resolveAuthContext(req);
    const result = await dispatchNativeAction({
      action: actionName,
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
    });
    return res.status(result && result.ok ? 200 : 400).json(result);
  } catch (error) {
    const statusCode = Number(error && error.statusCode) || (String(error && error.message) === "Unauthorized" ? 401 : 500);
    return res.status(statusCode).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
}

// Legacy-style action endpoint retained for Node runtime compatibility.
app.post("/v1/action", async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const action = String(payload.action || "").trim();
  if (!action) {
    return res.status(400).json({ ok: false, data: null, error: "Missing action" });
  }

  const forwarded = Object.assign({}, payload);
  delete forwarded.action;

  // Always try native first.
  const auth = PUBLIC_NATIVE_ACTIONS.has(action) ? null : await resolveAuthContext(req);
  try {
    const nativeResult = await dispatchNativeAction({
      action,
      payload: forwarded,
      auth,
      query,
      withTransaction,
      verifyGoogleIdToken,
      createSessionToken,
      createRefreshToken,
      verifyRefreshToken,
      listMembershipsByStudentId,
      findStudentProfileById,
    });

    if (nativeResult && nativeResult.ok) {
      return res.status(200).json(nativeResult);
    }

    const isUnsupported =
      nativeResult &&
      nativeResult.ok === false &&
      String(nativeResult.error || "").startsWith("Unsupported action");
    if (!isUnsupported) {
      return res
        .status(400)
        .json(nativeResult || { ok: false, data: null, error: "Action failed" });
    }

    return res.status(400).json(nativeResult);
  } catch (error) {
    const statusCode =
      Number(error && error.statusCode) ||
      (String(error && error.message) === "Unauthorized" ? 401 : 500);
    return res
      .status(statusCode)
      .json({ ok: false, data: null, error: error.message || "Internal error" });
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

app.get("/v1/events", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
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

app.get("/v1/students", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const result = await query(
      `SELECT id, name, google_sub, google_email, lifecycle_status
       FROM students s
       WHERE ${ACTIVE_STUDENT_WHERE_SQL}
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

app.get("/v1/group-memberships", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }

    const myMemberships = await listMembershipsByStudentId(auth.studentId);
    const canViewAll = canViewAllMemberships_(myMemberships);

    if (!canViewAll) {
      return res.json({
        ok: true,
        data: { memberships: myMemberships },
        error: null,
      });
    }

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
    status: String(row.lifecycle_status || "active").trim() || "active",
    lifecycleStatus: String(row.lifecycle_status || "active").trim() || "active",
  };
}

function canViewDirectory_(memberships) {
  const list = Array.isArray(memberships) ? memberships : [];
  return list.some((item) => {
    const groupId = String(item.groupId || item.group_id || "").trim();
    const role = String(item.roleInGroup || item.role_in_group || "").trim();
    if (groupId === "E" && role === "lead") {
      return true;
    }
    if (groupId === "A" && (role === "lead" || role === "deputy")) {
      return true;
    }
    return false;
  });
}

function canViewAllMemberships_(memberships) {
  const list = Array.isArray(memberships) ? memberships : [];
  return list.some((item) => {
    const groupId = String(item.groupId || item.group_id || "").trim();
    const role = String(item.roleInGroup || item.role_in_group || "").trim();
    if (groupId === "E" && (role === "lead" || role === "deputy")) {
      return true;
    }
    if (groupId === "A" && (role === "lead" || role === "deputy")) {
      return true;
    }
    return false;
  });
}

async function isOwnEmailRequest_(auth, email) {
  const target = normalizeEmail(email);
  if (!target) {
    return false;
  }

  // Google email can differ from the directory/profile email (e.g. Gmail login + Outlook contact email).
  // Treat the bound student_id as the source of truth for "own profile" authorization.
  const studentId = String(auth && auth.studentId ? auth.studentId : "").trim();
  if (studentId) {
    const result = await query(
      `SELECT 1
       FROM directories d
       WHERE d.id = $1
         AND lower(coalesce(d.email, '')) = $2
       LIMIT 1`,
      [studentId, target]
    );
    if (result.rows.length) {
      return true;
    }
  }

  const authEmail = normalizeEmail(auth && auth.profile && auth.profile.email ? auth.profile.email : "");
  return Boolean(authEmail && authEmail === target);
}

app.get("/v1/directory", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const memberships = await listMembershipsByStudentId(auth.studentId);
    if (!canViewDirectory_(memberships)) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }

    const result = await query(
      `SELECT d.*, s.lifecycle_status
       FROM directories d
       JOIN students s ON s.id = d.id
       WHERE ${ACTIVE_STUDENT_WHERE_SQL}
       ORDER BY coalesce(d.group_id, ''), coalesce(d.name_zh, ''), coalesce(d.preferred_name, ''), d.id`
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
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }

    const myMemberships = await listMembershipsByStudentId(auth.studentId);
    const canLookupAny = canViewAllMemberships_(myMemberships);
    if (!canLookupAny && !(await isOwnEmailRequest_(auth, email))) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }

    const result = await query(
      `${STUDENT_PROFILE_SELECT}
       FROM directories d
       JOIN students s ON s.id = d.id
       WHERE lower(coalesce(d.email, '')) = $1
       AND ${ACTIVE_STUDENT_WHERE_SQL}
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
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const myMemberships = await listMembershipsByStudentId(auth.studentId);
    const canReadOthers = canViewAllMemberships_(myMemberships);
    if (!canReadOthers && !(await isOwnEmailRequest_(auth, email))) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }

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
    let auth = null;
    let canReadOthers = false;
    if (email) {
      auth = await resolveAuthContext(req);
      if (!auth || !auth.studentId) {
        return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
      }
      const myMemberships = await listMembershipsByStudentId(auth.studentId);
      canReadOthers = canViewAllMemberships_(myMemberships);
      if (!canReadOthers && !(await isOwnEmailRequest_(auth, email))) {
        return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
      }
    }

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

// Aggregate-only public data for the landing card; individual picks stay private.
app.get("/v1/world-cup/prediction-stats", async (_req, res) => {
  try {
    const result = await query(
      `SELECT
         count(*)::int AS participants,
         count(*) FILTER (WHERE custom_fields ->> 'predictedChampion' = '西班牙')::int AS spain_votes,
         count(*) FILTER (WHERE custom_fields ->> 'predictedChampion' = '阿根廷')::int AS argentina_votes
       FROM registrations
       WHERE event_id = 'world-cup-final-2026'
         AND lower(coalesce(status, '')) <> 'cancelled'
         AND coalesce(custom_fields ->> 'predictedChampion', '') <> ''`
    );
    const row = result.rows[0] || {};
    return res.json({ ok: true, data: {
      participants: Number(row.participants || 0),
      spainVotes: Number(row.spain_votes || 0),
      argentinaVotes: Number(row.argentina_votes || 0),
    }, error: null });
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
    if (email) {
      const auth = await resolveAuthContext(req);
      if (!auth || !auth.studentId) {
        return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
      }
      const myMemberships = await listMembershipsByStudentId(auth.studentId);
      const canReadOthers = canViewAllMemberships_(myMemberships);
      if (!canReadOthers && !(await isOwnEmailRequest_(auth, email))) {
        return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
      }
    }

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
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const myMemberships = await listMembershipsByStudentId(auth.studentId);
    const canReadOthers = canViewAllMemberships_(myMemberships);
    if (!canReadOthers && !(await isOwnEmailRequest_(auth, email))) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }

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
          jsonbParam(registrationPayload.customFields, {}),
          registrationPayload.status,
          registrationPayload.createdAt,
          registrationPayload.updatedAt,
          registrationPayload.manualCreatedBy,
          registrationPayload.manualCreatedByName,
          registrationPayload.manualCreatedAt,
          jsonbParam(rawPayload, {}),
        ]
      );

    });
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
          jsonbParam(nextPayload.customFields, {}),
          nextPayload.updatedAt,
          jsonbParam(nextPayload, {}),
        ]
      );

    });

    const updated = await findRegistrationById(registrationId);
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
          jsonbParam(
            {
              id: checkinPayload.id,
              eventId: checkinPayload.eventId,
              registrationId: checkinPayload.registrationId,
              checkinAt: checkinPayload.checkinAt,
              checkinMethod: checkinPayload.checkinMethod,
            },
            {}
          ),
        ]
      );

    });
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

async function handleAttachmentUpload_(req, res, defaults = {}) {
  try {
    const auth = req.prevalidatedUploadAuth || await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    if (!isAttachmentStorageConfigured()) {
      return res.status(500).json({ ok: false, data: null, error: "Supabase Storage 尚未設定" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ ok: false, data: null, error: "Missing file" });
    }

    const mergedBody = {
      ...(defaults && typeof defaults === "object" ? defaults : {}),
      ...(req.body && typeof req.body === "object" ? req.body : {}),
    };
    const entityType = normalizeAttachmentEntityType_(mergedBody.entityType);
    const entityId = normalizeAttachmentEntityId_(mergedBody.entityId);
    const attachmentKind = String(mergedBody.attachmentKind || "general").trim() || "general";
    if (!entityType || !entityId) {
      return res.status(400).json({ ok: false, data: null, error: "Missing entityType or entityId" });
    }

    const mimetype = String(file.mimetype || "").trim();
    if (!isAllowedAttachmentMime(mimetype)) {
      return res.status(400).json({
        ok: false,
        data: null,
        error: "不支援的檔案格式（僅支援 pdf/jpg/png/heic/xlsx/docx/pptx）",
      });
    }

    const access = await canAccessAttachmentEntity_(auth, entityType, entityId, mergedBody);
    if (!access.canUpload) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }

    const actorProfile = await findStudentProfileById(auth.studentId);
    const actorName = firstText(auth && auth.profile && auth.profile.name, firstText(actorProfile && actorProfile.name, actorProfile && actorProfile.nameZh));

    const uploaded = await uploadAttachmentFile({
      fileBuffer: file.buffer,
      fileName: safeFilename_(file.originalname),
      mimeType: mimetype,
      entityType,
      entityId,
      attachmentKind,
      uploadedBy: auth.studentId,
      uploadedByName: actorName,
      raw: {
        originalFieldName: firstText(file.fieldname),
        uploadSource: "http_upload",
        title: firstText(mergedBody.title),
        category: firstText(mergedBody.category),
        description: firstText(mergedBody.description),
      },
      query,
    });

    return res.json({
      ok: true,
      data: {
        attachmentId: uploaded.attachmentId,
        name: uploaded.item && uploaded.item.name,
        url: uploaded.item && uploaded.item.url,
        size: uploaded.item && uploaded.item.sizeBytes,
        sizeBytes: uploaded.item && uploaded.item.sizeBytes,
        mimeType: uploaded.item && uploaded.item.mimeType,
        attachmentKind: uploaded.item && uploaded.item.attachmentKind,
        item: uploaded.item,
      },
      error: null,
    });
  } catch (error) {
    const message = String((error && error.message) || "Upload failed");
    return res.status(500).json({ ok: false, data: null, error: message || "Upload failed" });
  }
}

function rejectOversizedLegacyMultipart_(req, res, next) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > LEGACY_MULTIPART_MAX_BYTES) {
    return res.status(413).json({
      ok: false,
      data: null,
      error: "大型影片請重新整理頁面後使用新版直傳功能",
    });
  }
  return next();
}

async function requireAttachmentUploadAuthBeforeBody_(req, res, next) {
  try {
    const bearerToken = getBearerToken(req);
    let auth = null;
    if (bearerToken) {
      const payload = verifySessionToken(bearerToken);
      if (payload && payload.studentId) {
        auth = { sessionToken: bearerToken, studentId: payload.studentId, profile: payload };
      }
    } else {
      const idToken = String(req.headers["x-id-token"] || req.headers["x-goog-id-token"] || "").trim();
      if (idToken) {
        const googleProfile = await verifyGoogleIdToken(idToken);
        const linkedStudent = await findStudentProfileByGoogleSub(googleProfile.sub);
        if (linkedStudent && linkedStudent.id) {
          auth = {
            sessionToken: createSessionToken({
              studentId: linkedStudent.id,
              email: googleProfile.email,
              sub: googleProfile.sub,
              name: googleProfile.name,
            }),
            studentId: linkedStudent.id,
            profile: googleProfile,
          };
        }
      }
    }
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    req.prevalidatedUploadAuth = auth;
    return next();
  } catch {
    return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
  }
}

function limitLegacyMultipartConcurrency_(req, res, next) {
  if (activeLegacyMultipartUploads_ >= LEGACY_MULTIPART_MAX_CONCURRENCY) {
    return res.status(429).json({ ok: false, data: null, error: "附件上傳忙碌中，請稍後再試" });
  }
  activeLegacyMultipartUploads_ += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeLegacyMultipartUploads_ = Math.max(0, activeLegacyMultipartUploads_ - 1);
  };
  res.once("finish", release);
  res.once("close", release);
  return next();
}

function parseSingleAttachmentUpload_(req, res, next) {
  upload.single("file")(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error && error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      ok: false,
      data: null,
      error: tooLarge ? "檔案大小超過 25 MB；大型影片請使用新版直傳功能" : "無法讀取上傳檔案",
    });
  });
}

async function requireCheerleadingVideoManager_(req, res) {
  const auth = resolveActivityAlbumBearerAuth(req);
  if (!auth || !auth.studentId) {
    res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    return null;
  }
  const profile = await findStudentProfileById(auth.studentId);
  if (!profile) {
    res.status(403).json({ ok: false, data: null, error: "已不具 115B 班級成員資格" });
    return null;
  }
  const access = await canAccessAttachmentEntity_(auth, "cheerleading_video", "upload", {});
  if (!access.canUpload) {
    res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    return null;
  }
  return { ...auth, profile };
}

async function cleanExpiredCheerleadingVideoUploads_(studentId = "") {
  return cleanExpiredCheerleadingVideoUploads({
    query,
    removeStorageObject,
    studentId,
    ttlHours: CHEERLEADING_VIDEO_PENDING_TTL_HOURS,
    now: nowIso,
  });
}

app.post(
  "/v1/attachments/upload",
  requireAttachmentUploadAuthBeforeBody_,
  rejectOversizedLegacyMultipart_,
  limitLegacyMultipartConcurrency_,
  parseSingleAttachmentUpload_,
  async (req, res) => handleAttachmentUpload_(req, res)
);

app.post("/v1/cheerleading/videos/upload-intent", async (req, res) => {
  try {
    const auth = await requireCheerleadingVideoManager_(req, res); if (!auth) return;
    if (!isAttachmentStorageConfigured()) return res.status(503).json({ ok: false, data: null, error: "影片儲存空間尚未設定" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const validation = validateCheerleadingVideoIntent({
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      maxSizeBytes: config.cheerleadingVideoMaxFileSizeBytes,
    });
    if (!validation.ok) return res.status(400).json({ ok: false, data: null, error: validation.error });

    await cleanExpiredCheerleadingVideoUploads_(auth.studentId);
    const videoId = crypto.randomUUID();
    const fileName = safeFilename_(body.fileName);
    const bucket = config.supabaseAttachmentBucket;
    const storagePath = `cheerleading_video/${videoId}/${videoId}-${fileName}`;
    const timestamp = nowIso();
    const raw = {
      title: firstText(body.title, fileName),
      category: firstText(body.category).slice(0, 120),
      description: firstText(body.description).slice(0, 2000),
      uploadSource: "signed_direct_upload",
    };
    const reserved = await reserveCheerleadingVideoPending({
      withTransaction,
      studentId: auth.studentId,
      maxPending: CHEERLEADING_VIDEO_MAX_PENDING_UPLOADS,
      insertPending: async (client) => {
        await client.query(`insert into attachments (
          id,entity_type,entity_id,bucket,storage_path,original_name,mime_type,size_bytes,
          attachment_kind,visibility,uploaded_by,uploaded_by_name,status,created_at,updated_at,raw
        ) values ($1,'cheerleading_video',$1,$2,$3,$4,$5,$6,'general','private',$7,$8,'pending',$9,$9,$10::jsonb)`, [
          videoId,
          bucket,
          storagePath,
          fileName,
          validation.mimeType,
          validation.sizeBytes,
          auth.studentId,
          firstText(auth.profile.name, auth.profile.nameZh),
          timestamp,
          jsonbParam(raw, {}),
        ]);
        return { videoId, bucket, storagePath };
      },
    });
    if (!reserved) {
      return res.status(429).json({ ok: false, data: null, error: "已有多個影片等待完成，請稍後再試" });
    }
    try {
      const upload = await createSignedUploadUrl({ bucket, storagePath, mimeType: validation.mimeType });
      return res.json({
        ok: true,
        data: { videoId, signedUrl: upload.signedUrl, expiresInSeconds: CHEERLEADING_VIDEO_UPLOAD_URL_TTL_SECONDS },
        error: null,
      });
    } catch (error) {
      console.error("[cheerleading-videos] signed upload preparation failed:", (error && error.message) || error);
      await query("delete from attachments where id=$1 and status='pending'", [videoId]);
      return res.status(503).json({ ok: false, data: null, error: "目前無法準備影片上傳，請稍後再試" });
    }
  } catch (error) {
    console.error("[cheerleading-videos] upload intent failed:", (error && error.message) || error);
    return res.status(500).json({ ok: false, data: null, error: "目前無法準備影片上傳，請稍後再試" });
  }
});

app.post("/v1/cheerleading/videos/:id/complete", async (req, res) => {
  try {
    const auth = await requireCheerleadingVideoManager_(req, res); if (!auth) return;
    const found = await query(`select * from attachments
      where id=$1 and entity_type='cheerleading_video' and uploaded_by=$2 and status in ('pending','ready') limit 1`, [req.params.id, auth.studentId]);
    const pending = found.rows[0];
    if (!pending) return res.status(404).json({ ok: false, data: null, error: "找不到待完成的影片上傳" });
    if (pending.status === "ready") {
      return res.json({
        ok: true,
        data: {
          video: {
            id: pending.id,
            title: firstText(pending.raw?.title, pending.original_name),
            category: firstText(pending.raw?.category),
            description: firstText(pending.raw?.description),
            sizeBytes: Number(pending.size_bytes || 0),
            createdAt: firstText(pending.created_at),
          },
        },
        error: null,
      });
    }

    const objectResult = await query(`select metadata from storage.objects where bucket_id=$1 and name=$2 limit 1`, [pending.bucket, pending.storage_path]);
    const validation = validateCompletedCheerleadingVideoObject({
      objectRow: objectResult.rows[0],
      expectedMimeType: pending.mime_type,
      expectedSizeBytes: pending.size_bytes,
    });
    if (!validation.ok) {
      if (!objectResult.rows[0]) return res.status(409).json({ ok: false, data: null, error: "影片尚未完整送達，請稍後再試" });
      const claim = await query(`update attachments set status='deleting',updated_at=$3
        where id=$1 and uploaded_by=$2 and status='pending' returning id,bucket,storage_path`, [pending.id, auth.studentId, nowIso()]);
      const claimed = claim.rows[0];
      if (!claimed) return res.status(409).json({ ok: false, data: null, error: "影片狀態已變更，請重新整理" });
      try {
        await removeStorageObject({ bucket: claimed.bucket, storagePath: claimed.storage_path });
        const timestamp = nowIso();
        await query("update attachments set status='deleted',deleted_at=$2,updated_at=$2 where id=$1 and status='deleting'", [claimed.id, timestamp]);
      } catch {
        await query("update attachments set status='pending',updated_at=$2 where id=$1 and status='deleting'", [claimed.id, nowIso()]);
      }
      return res.status(400).json({ ok: false, data: null, error: validation.error });
    }

    const timestamp = nowIso();
    const updated = await query(`update attachments set status='ready',mime_type=$3,size_bytes=$4,updated_at=$5,completed_at=$5
      where id=$1 and uploaded_by=$2 and status='pending' returning id,original_name,mime_type,size_bytes,raw,created_at`, [
      pending.id,
      auth.studentId,
      validation.mimeType,
      validation.sizeBytes,
      timestamp,
    ]);
    const row = updated.rows[0];
    if (!row) return res.status(409).json({ ok: false, data: null, error: "影片狀態已變更，請重新整理" });
    return res.json({
      ok: true,
      data: {
        video: {
          id: row.id,
          title: firstText(row.raw?.title, row.original_name),
          category: firstText(row.raw?.category),
          description: firstText(row.raw?.description),
          sizeBytes: Number(row.size_bytes || 0),
          createdAt: firstText(row.created_at),
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("[cheerleading-videos] upload completion failed:", (error && error.message) || error);
    return res.status(500).json({ ok: false, data: null, error: "無法完成影片上架，請稍後再試" });
  }
});

app.get("/v1/cheerleading/videos/:id/play", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    const id = String(req.params.id || "").trim();
    const result = await query("select * from attachments where id = $1 and entity_type = 'cheerleading_video' and status = 'ready' limit 1", [id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ ok: false, data: null, error: "影片不存在或已下架" });
    const url = await createSignedReadUrlForAttachment(row, 300, { throwOnError: true });
    return res.json({ ok: true, data: { url, expiresInSeconds: 300 }, error: null });
  } catch (error) { return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" }); }
});

const ACTIVITY_PENDING_TTL_MINUTES = 30;
const ACTIVITY_SIGNED_UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

function activityAlbumPayload_(row, { photoCount = 0, coverUrl = "" } = {}) {
  if (!row) return null;
  return {
    id: firstText(row.id), title: firstText(row.title), description: firstText(row.description),
    eventDate: firstText(row.event_date), location: firstText(row.location), status: firstText(row.status),
    coverPhotoId: firstText(row.cover_photo_id), photoCount: Number(photoCount || 0), coverUrl: firstText(coverUrl),
  };
}

function activityPhotoPayload_(row, signedUrl = "") {
  return activityPhotoPublicFields(row, signedUrl, safeFilename_);
}

async function requireActiveActivityAlbumMember_(req, res) {
  const auth = resolveActivityAlbumBearerAuth(req);
  if (!auth || !auth.studentId) {
    res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    return null;
  }
  // Do not trust a session's historical claims. This DB lookup applies the
  // lifecycle_status=active predicate on every album/photo request.
  const profile = await findStudentProfileById(auth.studentId);
  if (!isCurrentActiveActivityMember(profile)) {
    res.status(403).json({ ok: false, data: null, error: "已不具 115B 班級成員資格" });
    return null;
  }
  return { ...auth, profile, canManage: await canManageActivityAlbums_(auth.studentId) };
}

async function getActivityAlbum_(albumId) {
  const result = await query("select * from activity_albums where id = $1 limit 1", [firstText(albumId)]);
  return result.rows[0] || null;
}

async function hydrateActivityAlbum_(album, photoCount = 0) {
  let coverUrl = "";
  if (album && album.cover_photo_id) {
    const result = await query("select * from activity_photos where id = $1 and album_id = $2 and status = 'ready' limit 1", [album.cover_photo_id, album.id]);
    if (result.rows[0]) coverUrl = await createSignedReadUrlForAttachment(result.rows[0], 60);
  }
  return activityAlbumPayload_(album, { photoCount, coverUrl });
}

async function cleanExpiredActivityPending_(studentId, albumId) {
  return cleanExpiredActivityPending({ query, removeStorageObject, studentId, albumId, ttlMinutes: ACTIVITY_PENDING_TTL_MINUTES });
}

async function runGlobalActivityAlbumCleanup_() {
  if (!isAttachmentStorageConfigured() || config.supabaseActivityAlbumBucket !== "activity-albums") return;
  await cleanActivityAlbumOrphans({
    query,
    removeStorageObject,
    listStoragePaths,
    bucket: config.supabaseActivityAlbumBucket,
    ttlMinutes: ACTIVITY_PENDING_TTL_MINUTES,
  });
  // Retain only a small investigation window for rate-limit events. This is
  // independent of photo status, so deleted/invalid intents remain countable.
  await query("delete from activity_album_upload_attempts where created_at < now() - interval '48 hours'");
}

async function canManageActivityAlbums_(studentId) {
  const memberships = await listMembershipsByStudentId(studentId);
  return memberships.some((item) => {
    const groupId = firstText(item.groupId || item.group_id);
    const role = firstText(item.roleInGroup || item.role_in_group).toLowerCase();
    return groupId === "E" || (groupId === "A" && (role === "lead" || role === "deputy"));
  });
}

app.get("/v1/admin/storage-monitoring", async (req, res) => {
  try {
    // Re-check the active member on every request, then enforce the dedicated
    // single-user allowlist. Group/admin roles do not grant this permission.
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    if (!canViewStorageMonitoring(auth.studentId)) return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    const snapshot = await loadStorageMonitoringSnapshot({
      query,
      quotaBytes: config.supabaseStorageMonitoringQuotaBytes,
      planLabel: config.supabaseStorageMonitoringPlanLabel,
    });
    return res.json({ ok: true, data: snapshot, error: null });
  } catch (error) {
    // Do not return database/storage details or credentials to the browser.
    return res.status(503).json({ ok: false, data: null, error: "Storage monitoring is temporarily unavailable" });
  }
});

app.get("/v1/activity-albums", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    const includeArchived = auth.canManage && String(req.query.includeArchived || "") === "1";
    const result = await query(`select a.*, count(p.id)::int as photo_count from activity_albums a
      left join activity_photos p on p.album_id = a.id and p.status = 'ready'
      where ($1::boolean or a.status <> 'archived') group by a.id
      order by a.event_date desc nulls last, a.created_at desc`, [includeArchived]);
    const albums = await Promise.all(result.rows.map((row) => hydrateActivityAlbum_(row, row.photo_count)));
    return res.json({ ok: true, data: { albums, canCreate: canCreateActivityAlbum(auth.profile), canManage: auth.canManage }, error: null });
  } catch (error) { return res.status(500).json({ ok: false, data: null, error: "Unable to load activity albums" }); }
});

app.post("/v1/activity-albums", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    if (!canCreateActivityAlbum(auth.profile)) return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    const title = firstText(req.body && req.body.title).slice(0, 120);
    const eventDate = firstText(req.body && req.body.eventDate);
    if (!title || (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate))) return res.status(400).json({ ok: false, data: null, error: "Invalid album settings" });
    const result = await query(`insert into activity_albums (id,title,description,event_date,location,created_by)
      values ($1,$2,$3,$4,$5,$6) returning *`, [crypto.randomUUID(), title, firstText(req.body.description).slice(0, 1000), eventDate || null, firstText(req.body.location).slice(0, 160), auth.studentId]);
    return res.json({ ok: true, data: { album: activityAlbumPayload_(result.rows[0]) }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to create activity album" }); }
});

app.patch("/v1/activity-albums/:id", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    if (!auth.canManage) return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    const existing = await getActivityAlbum_(req.params.id); if (!existing) return res.status(404).json({ ok: false, data: null, error: "Album not found" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const title = Object.hasOwn(body, "title") ? firstText(body.title).slice(0, 120) : existing.title;
    const eventDate = Object.hasOwn(body, "eventDate") ? firstText(body.eventDate) : firstText(existing.event_date);
    const status = Object.hasOwn(body, "status") ? firstText(body.status) : existing.status;
    const coverPhotoId = Object.hasOwn(body, "coverPhotoId") ? firstText(body.coverPhotoId) : firstText(existing.cover_photo_id);
    if (!title || (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) || !["active", "archived"].includes(status)) return res.status(400).json({ ok: false, data: null, error: "Invalid album settings" });
    if (coverPhotoId) {
      const cover = await query("select id from activity_photos where id = $1 and album_id = $2 and status = 'ready' limit 1", [coverPhotoId, existing.id]);
      if (!cover.rows[0]) return res.status(400).json({ ok: false, data: null, error: "Cover photo must be ready in this album" });
    }
    const result = await query(`update activity_albums set title=$2,description=$3,event_date=$4,location=$5,status=$6,cover_photo_id=$7,updated_at=now()
      where id=$1 returning *`, [existing.id, title, Object.hasOwn(body, "description") ? firstText(body.description).slice(0, 1000) : existing.description, eventDate || null, Object.hasOwn(body, "location") ? firstText(body.location).slice(0, 160) : existing.location, status, coverPhotoId || null]);
    return res.json({ ok: true, data: { album: await hydrateActivityAlbum_(result.rows[0]) }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to update activity album" }); }
});

app.get("/v1/activity-albums/:id/photos", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    const album = await getActivityAlbum_(req.params.id); if (!album || (album.status === "archived" && !auth.canManage)) return res.status(404).json({ ok: false, data: null, error: "Album not found" });
    const includeHidden = auth.canManage && String(req.query.includeHidden || "") === "1";
    const result = await query(`select * from activity_photos where album_id=$1 and (status='ready' or ($2::boolean and status='hidden'))
      order by captured_at desc nulls last, created_at desc`, [album.id, includeHidden]);
    const photos = await Promise.all(result.rows.map(async (row) => activityPhotoPayload_(row, await createSignedReadUrlForAttachment(row, 60))));
    return res.json({ ok: true, data: { album: await hydrateActivityAlbum_(album, result.rows.filter((row) => row.status === "ready").length), photos, canManage: auth.canManage }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to load activity photos" }); }
});

app.post("/v1/activity-albums/:id/upload-intent", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    const rate = await recordAndCheckActivityUploadIntent({
      query,
      studentId: auth.studentId,
      ipHash: activityUploadIpHash(req.ip || req.socket?.remoteAddress || "unknown", config.sessionSecret),
    });
    if (!rate.allowed) return res.status(429).json({ ok: false, data: null, error: "上傳意圖過於頻繁，請稍後再試" });
    if (!isAttachmentStorageConfigured() || config.supabaseActivityAlbumBucket !== "activity-albums") return res.status(503).json({ ok: false, data: null, error: "Private activity photo storage is not configured" });
    const album = await getActivityAlbum_(req.params.id);
    const mimeType = firstText(req.body && req.body.mimeType).toLowerCase();
    const sizeBytes = Number(req.body && req.body.sizeBytes);
    const fileName = safeFilename_(req.body && req.body.fileName);
    if (!album || album.status !== "active") return res.status(404).json({ ok: false, data: null, error: "Album not found" });
    if (!fileName || !isAcceptedActivityAlbumMime(mimeType) || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > ACTIVITY_ALBUM_MAX_IMAGE_BYTES) return res.status(400).json({ ok: false, data: null, error: "僅支援已驗證的 JPG、PNG，且每張不可超過 15 MB；HEIC／HEIF 暫不支援" });
    await cleanExpiredActivityPending_(auth.studentId, album.id);
    const photoId = crypto.randomUUID();
    const storagePath = `activity-albums/${album.id}/${photoId}`;
    // Persist pending first. If signing fails, delete that row as a real
    // rollback so no orphaned capability or metadata remains.
    await query(`insert into activity_photos (id,album_id,bucket,storage_path,original_name,mime_type,size_bytes,uploaded_by,uploaded_by_name,status)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`, [photoId, album.id, config.supabaseActivityAlbumBucket, storagePath, fileName, mimeType, sizeBytes, auth.studentId, auth.profile.name]);
    try {
      const upload = await createSignedUploadUrl({ bucket: config.supabaseActivityAlbumBucket, storagePath, mimeType });
      return res.json({ ok: true, data: { photoId, signedUrl: upload.signedUrl, expiresInSeconds: ACTIVITY_SIGNED_UPLOAD_URL_TTL_SECONDS }, error: null });
    } catch (error) {
      await query("delete from activity_photos where id=$1 and status='pending'", [photoId]);
      return res.status(503).json({ ok: false, data: null, error: "Unable to prepare photo upload" });
    }
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to prepare photo upload" }); }
});

app.post("/v1/activity-photos/:id/complete", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    const result = await query(`select p.*, a.status as album_status from activity_photos p join activity_albums a on a.id=p.album_id
      where p.id=$1 and p.uploaded_by=$2 and p.status='pending' limit 1`, [req.params.id, auth.studentId]);
    const pending = result.rows[0];
    if (!pending || pending.album_status !== "active") return res.status(404).json({ ok: false, data: null, error: "Upload not found" });
    let content;
    try { content = await downloadStorageObject({ bucket: pending.bucket, storagePath: pending.storage_path }); } catch { content = null; }
    const image = await validateActivityAlbumImage(content);
    if (!image) {
      try { if (content) await removeStorageObject({ bucket: pending.bucket, storagePath: pending.storage_path }); } catch { /* cleanup retry is handled by later maintenance */ }
      await query("update activity_photos set status='deleted', deleted_at=now(), updated_at=now() where id=$1 and status='pending'", [pending.id]);
      return res.status(400).json({ ok: false, data: null, error: "上傳內容不是完整且安全可驗證的 JPG 或 PNG 圖片" });
    }
    const updated = await query(`update activity_photos set status='ready',mime_type=$3,size_bytes=$4,updated_at=now()
      where id=$1 and uploaded_by=$2 and status='pending' returning *`, [pending.id, auth.studentId, image.mimeType, content.length]);
    return res.json({ ok: true, data: { photo: activityPhotoPayload_(updated.rows[0]) }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to complete photo upload" }); }
});

app.get("/v1/activity-photos/:id/download", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    const result = await query(`select p.*,a.status as album_status from activity_photos p join activity_albums a on a.id=p.album_id where p.id=$1 limit 1`, [req.params.id]);
    const photo = result.rows[0];
    const readable = photo && canReadActivityPhoto({ status: photo.status, canManage: auth.canManage });
    if (!readable || (photo.album_status === "archived" && !auth.canManage)) return res.status(404).json({ ok: false, data: null, error: "Photo not found" });
    const url = await createSignedReadUrlForAttachment(photo, 60, { throwOnError: true, download: photo.original_name });
    return res.json({ ok: true, data: { url, expiresInSeconds: 60 }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to download photo" }); }
});

app.patch("/v1/activity-photos/:id", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    if (!auth.canManage) return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    const status = firstText(req.body && req.body.status);
    if (!["ready", "hidden"].includes(status)) return res.status(400).json({ ok: false, data: null, error: "Invalid status" });
    const result = await query("update activity_photos set status=$2,updated_at=now() where id=$1 and status in ('ready','hidden') returning *", [req.params.id, status]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, data: null, error: "Photo not found" });
    if (status === "hidden") await query("update activity_albums set cover_photo_id=null,updated_at=now() where cover_photo_id=$1", [result.rows[0].id]);
    return res.json({ ok: true, data: { photo: activityPhotoPayload_(result.rows[0]) }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to update photo" }); }
});

app.delete("/v1/activity-photos/:id", async (req, res) => {
  try {
    const auth = await requireActiveActivityAlbumMember_(req, res); if (!auth) return;
    if (!auth.canManage) return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    const found = await query("select * from activity_photos where id=$1 and status in ('ready','hidden') limit 1", [req.params.id]);
    const photo = found.rows[0]; if (!photo) return res.status(404).json({ ok: false, data: null, error: "Photo not found" });
    await removeStorageObject({ bucket: photo.bucket, storagePath: photo.storage_path });
    await withTransaction(async ({ query: tx }) => {
      await tx("update activity_photos set status='deleted',deleted_at=now(),updated_at=now() where id=$1", [photo.id]);
      await tx("update activity_albums set cover_photo_id=null,updated_at=now() where cover_photo_id=$1", [photo.id]);
    });
    return res.json({ ok: true, data: { id: firstText(photo.id) }, error: null });
  } catch { return res.status(500).json({ ok: false, data: null, error: "Unable to delete photo" }); }
});

app.get("/v1/attachments", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const entityType = normalizeAttachmentEntityType_(req.query && req.query.entityType);
    const entityId = normalizeAttachmentEntityId_(req.query && req.query.entityId);
    if (!entityType || !entityId) {
      return res.status(400).json({ ok: false, data: null, error: "Missing entityType or entityId" });
    }
    const access = await canAccessAttachmentEntity_(auth, entityType, entityId, req.query || {});
    if (!access.canView) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }
    const attachments = await listAttachmentsByEntity(query, { entityType, entityId });
    return res.json({ ok: true, data: { attachments }, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.delete("/v1/attachments/:id", async (req, res) => {
  try {
    const auth = await resolveAuthContext(req);
    if (!auth || !auth.studentId) {
      return res.status(401).json({ ok: false, data: null, error: "Unauthorized" });
    }
    const attachmentId = String(req.params && req.params.id || "").trim();
    if (!attachmentId) {
      return res.status(400).json({ ok: false, data: null, error: "Missing attachment id" });
    }
    const existing = await query(`select * from attachments where id = $1 limit 1`, [attachmentId]);
    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, data: null, error: "Attachment not found" });
    }
    const access = await canAccessAttachmentEntity_(auth, normalizeAttachmentEntityType_(row.entity_type), normalizeAttachmentEntityId_(row.entity_id), {});
    if (!access.canDelete) {
      return res.status(403).json({ ok: false, data: null, error: "Forbidden" });
    }
    await softDeleteAttachment(query, { attachmentId, deletedBy: auth.studentId });
    return res.json({ ok: true, data: { id: attachmentId }, error: null });
  } catch (error) {
    return res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.post("/v1/finance/attachments/upload", requireAttachmentUploadAuthBeforeBody_, rejectOversizedLegacyMultipart_, limitLegacyMultipartConcurrency_, parseSingleAttachmentUpload_, async (req, res) => {
  const draftId = String((req.body && req.body.entityId) || crypto.randomUUID()).trim();
  return handleAttachmentUpload_(req, res, {
    entityType: "finance_request",
    entityId: `draft:${draftId}`,
    attachmentKind: "supporting_document",
  });
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

app.use((_req, res) => {
  res.status(404).json({ ok: false, data: null, error: "Not found" });
});

export { app };

if (process.env.NODE_ENV !== "test") app.listen(config.port, () => {
  console.log(`115b-sys-api listening on :${config.port}`);

  // 定期背景同步正式課程，避免完全依賴人工按鈕。
  setTimeout(() => {
    runAcademicAutoSyncTask_("startup");
  }, 20 * 1000);

  const timer = setInterval(() => {
    runAcademicAutoSyncTask_("interval");
  }, ACADEMICS_AUTO_SYNC_INTERVAL_MS);
  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }

  // A member does not need to visit the same album for stale pending rows or
  // raced signed-URL uploads to be swept. Failures are logged and retried; they
  // never make the HTTP server unavailable.
  const cleanActivityAlbums = () => runGlobalActivityAlbumCleanup_().catch((error) => {
    console.error("[activity-albums] orphan cleanup failed:", (error && error.message) || error);
  });
  setTimeout(cleanActivityAlbums, 30 * 1000);
  const cleanupTimer = setInterval(cleanActivityAlbums, 15 * 60 * 1000);
  if (cleanupTimer && typeof cleanupTimer.unref === "function") cleanupTimer.unref();

  const cleanCheerleadingVideoUploads = () => cleanExpiredCheerleadingVideoUploads_().catch((error) => {
    console.error("[cheerleading-videos] pending upload cleanup failed:", (error && error.message) || error);
  });
  setTimeout(cleanCheerleadingVideoUploads, 45 * 1000);
  const videoCleanupTimer = setInterval(cleanCheerleadingVideoUploads, 15 * 60 * 1000);
  if (videoCleanupTimer && typeof videoCleanupTimer.unref === "function") videoCleanupTimer.unref();
});
