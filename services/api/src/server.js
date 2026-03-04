import express from "express";
import { getConfig } from "./config.js";
import { query } from "./db.js";
import { syncFromAppsScript } from "./sync/pullFromAppsScript.js";

const config = getConfig();
const app = express();

app.use(express.json({ limit: "2mb" }));

function isAuthorizedSyncRequest(req) {
  const header = String(req.headers.authorization || "").trim();
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token && token === config.syncPullToken) {
      return true;
    }
  }
  const bodyToken = String((req.body && (req.body.syncToken || req.body.token)) || "").trim();
  return Boolean(bodyToken && bodyToken === config.syncPullToken);
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

app.get("/health", async (_req, res) => {
  res.json({ ok: true, service: "115b-sys-api", now: new Date().toISOString() });
});

app.get("/v1/events", async (_req, res) => {
  try {
    const result = await query(
      `SELECT * FROM events ORDER BY coalesce(start_at, ''), id`
    );
    res.json({
      ok: true,
      data: { events: result.rows.map(toEventPayload) },
      error: null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, data: null, error: error.message || "Internal error" });
  }
});

app.get("/v1/bootstrap/home", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
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
