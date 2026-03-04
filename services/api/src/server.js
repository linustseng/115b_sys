import express from "express";
import { getConfig } from "./config.js";
import { query } from "./db.js";
import { syncFromAppsScript } from "./sync/pullFromAppsScript.js";
import { createSessionToken, verifySessionToken } from "./auth/session.js";
import { verifyGoogleIdToken } from "./auth/google.js";

const config = getConfig();
const app = express();

app.use(express.json({ limit: "2mb" }));

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
    const [eventsResult, registrationsResult, checkinsResult] = await Promise.all([
      query(`SELECT * FROM events ORDER BY coalesce(start_at, ''), id`),
      query(
        `SELECT *
         FROM registrations
         WHERE lower(coalesce(user_email, '')) = $1
           AND lower(coalesce(status, '')) <> 'cancelled'
         ORDER BY coalesce(created_at, ''), id`,
        [email]
      ),
      query(
        `SELECT c.*
         FROM checkins c
         JOIN registrations r ON r.id = c.registration_id
         WHERE lower(coalesce(r.user_email, '')) = $1`,
        [email]
      ),
    ]);

    const registrations = registrationsResult.rows.map(toRegistrationPayload);

    const checkinStatuses = {};
    registrations.forEach((item) => {
      if (!item.eventId) {
        return;
      }
      checkinStatuses[item.eventId] = {
        status: "registered",
        checkinAt: "",
        checkinMethod: "",
      };
    });
    checkinsResult.rows.forEach((item) => {
      const eventId = String(item.event_id || "").trim();
      if (!eventId) {
        return;
      }
      checkinStatuses[eventId] = {
        status: "checked_in",
        checkinAt: String(item.checkin_at || ""),
        checkinMethod: String(item.checkin_method || ""),
      };
    });

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

app.post("/v1/register", async (req, res) => {
  const data = (req.body && req.body.data) || req.body || {};
  try {
    const proxied = await callAppsScriptAction_("register", { data: data });
    if (proxied.ok) {
      triggerBackgroundSync_();
    }
    return res.json(proxied);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      data: null,
      error: error && error.message ? error.message : "Register failed",
    });
  }
});

app.post("/v1/checkin", async (req, res) => {
  const data = (req.body && req.body.data) || req.body || {};
  try {
    const proxied = await callAppsScriptAction_("checkin", { data: data });
    if (proxied.ok) {
      triggerBackgroundSync_();
    }
    return res.json(proxied);
  } catch (error) {
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
