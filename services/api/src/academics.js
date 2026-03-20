import crypto from "node:crypto";
import ical from "node-ical";

const DEFAULT_CALENDAR_TIMEZONE = "Asia/Taipei";
const DEFAULT_SYNC_PAST_DAYS = 120;
const DEFAULT_SYNC_FUTURE_DAYS = 365;
const ACADEMIC_EXCLUDED_KEYWORDS = [
  "壘球",
  "練球",
  "比賽",
  "班聚",
  "聚餐",
  "ocamp",
  "o-camp",
  "迎新",
  "camp",
  "單車",
  "泳渡",
  "球隊",
  "活動",
  "新生盃",
  "隊聚",
  "welcome",
  "party",
  "大集合",
  "聚會",
  "春酒",
  "尾牙",
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toDateOnlyTextFromUtcParts(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function toDateTimeTextFromUtcParts(date) {
  return `${toDateOnlyTextFromUtcParts(date)} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function getZonedParts(date, timeZone = DEFAULT_CALENDAR_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const values = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });
  return values;
}

function toDateOnlyTextFromZonedDate(date, timeZone = DEFAULT_CALENDAR_TIMEZONE) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toDateTimeTextFromZonedDate(date, timeZone = DEFAULT_CALENDAR_TIMEZONE) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function addDaysUtc(dateText, days) {
  const base = new Date(`${String(dateText || "").trim()}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return "";
  }
  base.setUTCDate(base.getUTCDate() + Number(days || 0));
  return toDateOnlyTextFromUtcParts(base);
}

function getWeekdayFromDateText(dateText) {
  const value = new Date(`${String(dateText || "").trim()}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? -1 : value.getUTCDay();
}

function isWeekendDateText(dateText) {
  const weekday = getWeekdayFromDateText(dateText);
  return weekday === 6 || weekday === 0;
}

function durationMsBetween(start, end) {
  const startMs = start instanceof Date ? start.getTime() : Number.NaN;
  const endMs = end instanceof Date ? end.getTime() : Number.NaN;
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }
  return Math.max(0, endMs - startMs);
}

function firstText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback || "").trim();
}

function normalizeKeywordText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getCourseGroupTitle(title) {
  const raw = String(title || "").trim();
  if (!raw) {
    return "";
  }
  const stripped = raw
    .replace(/[\s\-_:：]*[0-9０-９]{1,3}$/u, "")
    .replace(/[（(][0-9０-９]{1,3}[)）]$/u, "")
    .trim();
  return stripped || raw;
}

function getTimeMinutesFromDateTimeText(dateTimeText) {
  const match = String(dateTimeText || "").trim().match(/(?:T| )(\d{2}):(\d{2})$/);
  if (!match) {
    return Number.NaN;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function hasAcademicLocation(value) {
  return Boolean(firstText(value));
}

function isAcademicDaytimeRange(startsAt, endsAt) {
  const startMinutes = getTimeMinutesFromDateTimeText(startsAt);
  const endMinutes = getTimeMinutesFromDateTimeText(endsAt);
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
    return false;
  }
  return startMinutes >= 8 * 60 && startMinutes <= 17 * 60 + 30 && endMinutes <= 18 * 60 + 30;
}

function isAcademicTitle(summary) {
  const normalized = normalizeKeywordText(summary);
  if (!normalized) {
    return false;
  }
  return !ACADEMIC_EXCLUDED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function buildCalendarSessionId(uid, recurrenceKey) {
  const hash = crypto
    .createHash("sha1")
    .update(`${String(uid || "").trim()}::${String(recurrenceKey || "").trim()}`)
    .digest("hex")
    .slice(0, 20);
  return `acad:cal:${hash}`;
}

export function buildGeneratedThursdaySessionId(dateText) {
  return `acad:thu:${String(dateText || "").trim()}`;
}

export function parseGeneratedThursdaySessionDate(id) {
  const text = String(id || "").trim();
  const match = text.match(/^acad:thu:(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : "";
}

export function buildGeneratedThursdaySessionFromDate(dateText) {
  const normalizedDate = String(dateText || "").trim();
  if (!normalizedDate || getWeekdayFromDateText(normalizedDate) !== 4) {
    return null;
  }
  return {
    id: buildGeneratedThursdaySessionId(normalizedDate),
    sourceType: "generated",
    sourceUid: `generated:${normalizedDate}`,
    sourceRecurrenceId: "",
    classKind: "makeup_target",
    classGroup: "THU",
    title: "週四補課",
    teacher: "",
    location: "",
    sessionDate: normalizedDate,
    startsAt: "",
    endsAt: "",
    registrationDeadline: `${normalizedDate} 12:00`,
    status: "published",
    isVisible: true,
    raw: {
      generated: true,
      weekday: "thu",
    },
  };
}

export function buildGeneratedThursdaySessionFromId(id) {
  const dateText = parseGeneratedThursdaySessionDate(id);
  return dateText ? buildGeneratedThursdaySessionFromDate(dateText) : null;
}

export function buildGeneratedThursdaySessions({ fromDateText, weeks = 16 } = {}) {
  const baseDateText = firstText(fromDateText, new Date().toISOString().slice(0, 10));
  const base = new Date(`${baseDateText}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) {
    return [];
  }
  const weekday = base.getUTCDay();
  const delta = (4 - weekday + 7) % 7;
  base.setUTCDate(base.getUTCDate() + delta);

  const results = [];
  for (let index = 0; index < Number(weeks || 0); index += 1) {
    const current = new Date(base.getTime());
    current.setUTCDate(base.getUTCDate() + index * 7);
    const dateText = toDateOnlyTextFromUtcParts(current);
    const session = buildGeneratedThursdaySessionFromDate(dateText);
    if (session) {
      results.push(session);
    }
  }
  return results;
}

export function mapAcademicSessionRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    sourceType: firstText(raw.sourceType, firstText(row && row.source_type ? row.source_type : "")),
    sourceUid: firstText(raw.sourceUid, firstText(row && row.source_uid ? row.source_uid : "")),
    sourceRecurrenceId: firstText(
      raw.sourceRecurrenceId,
      firstText(row && row.source_recurrence_id ? row.source_recurrence_id : "")
    ),
    classKind: firstText(raw.classKind, firstText(row && row.class_kind ? row.class_kind : "")),
    classGroup: firstText(raw.classGroup, firstText(row && row.class_group ? row.class_group : "")),
    title: firstText(raw.title, firstText(row && row.title ? row.title : "")),
    courseGroupTitle: firstText(raw.courseGroupTitle, getCourseGroupTitle(firstText(raw.title, firstText(row && row.title ? row.title : "")))),
    courseGroupKey: firstText(raw.courseGroupKey, normalizeKeywordText(firstText(raw.courseGroupTitle, getCourseGroupTitle(firstText(raw.title, firstText(row && row.title ? row.title : "")))))),
    teacher: firstText(raw.teacher, firstText(row && row.teacher ? row.teacher : "")),
    location: firstText(raw.location, firstText(row && row.location ? row.location : "")),
    sessionDate: firstText(raw.sessionDate, firstText(row && row.session_date ? row.session_date : "")),
    startsAt: firstText(raw.startsAt, firstText(row && row.starts_at ? row.starts_at : "")),
    endsAt: firstText(raw.endsAt, firstText(row && row.ends_at ? row.ends_at : "")),
    registrationDeadline: firstText(
      raw.registrationDeadline,
      firstText(row && row.registration_deadline ? row.registration_deadline : "")
    ),
    status: firstText(raw.status, firstText(row && row.status ? row.status : "")),
    isVisible:
      Object.prototype.hasOwnProperty.call(raw, "isVisible")
        ? Boolean(raw.isVisible)
        : row && typeof row.is_visible === "boolean"
        ? row.is_visible
        : true,
  };
}

export function mapSessionNoteRow(row) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    sessionId: firstText(raw.sessionId, firstText(row && row.session_id ? row.session_id : "")),
    title: firstText(raw.title, firstText(row && row.title ? row.title : "")),
    summary: firstText(raw.summary, firstText(row && row.summary ? row.summary : "")),
    linkUrl: firstText(raw.linkUrl, firstText(row && row.link_url ? row.link_url : "")),
    linkLabel: firstText(raw.linkLabel, firstText(row && row.link_label ? row.link_label : "")),
    homeworkNotice: firstText(raw.homeworkNotice),
    quizNotice: firstText(raw.quizNotice),
    status: firstText(raw.status, firstText(row && row.status ? row.status : "")),
    publishedAt: firstText(raw.publishedAt, firstText(row && row.published_at ? row.published_at : "")),
    createdBy: firstText(raw.createdBy, firstText(row && row.created_by ? row.created_by : "")),
    createdByName: firstText(raw.createdByName, firstText(row && row.created_by_name ? row.created_by_name : "")),
    updatedAt: firstText(raw.updatedAt, firstText(row && row.updated_at ? row.updated_at : "")),
  };
}

export function mapMakeupRequestRow(row, sessionsById = new Map()) {
  const raw = row && row.raw && typeof row.raw === "object" ? row.raw : {};
  const missedSessionId = firstText(raw.missedSessionId, firstText(row && row.missed_session_id ? row.missed_session_id : ""));
  const targetSessionId = firstText(raw.targetSessionId, firstText(row && row.target_session_id ? row.target_session_id : ""));
  const missedSession = sessionsById.get(missedSessionId) || null;
  const targetSession = sessionsById.get(targetSessionId) || buildGeneratedThursdaySessionFromId(targetSessionId) || null;
  return {
    ...raw,
    id: firstText(row && row.id ? row.id : raw.id),
    studentId: firstText(raw.studentId, firstText(row && row.student_id ? row.student_id : "")),
    studentName: firstText(raw.studentName, firstText(row && row.student_name ? row.student_name : "")),
    studentEmail: firstText(raw.studentEmail, firstText(row && row.student_email ? row.student_email : "")),
    missedSessionId,
    targetSessionId,
    missedSession,
    targetSession,
    needMeal:
      Object.prototype.hasOwnProperty.call(raw, "needMeal")
        ? Boolean(raw.needMeal)
        : Boolean(row && row.need_meal),
    needHandout:
      Object.prototype.hasOwnProperty.call(raw, "needHandout")
        ? Boolean(raw.needHandout)
        : Boolean(row && row.need_handout),
    reason: firstText(raw.reason, firstText(row && row.reason ? row.reason : "")),
    note: firstText(raw.note, firstText(row && row.note ? row.note : "")),
    adminNote: firstText(raw.adminNote, firstText(row && row.admin_note ? row.admin_note : "")),
    status: firstText(raw.status, firstText(row && row.status ? row.status : "submitted")),
    createdAt: firstText(raw.createdAt, firstText(row && row.created_at ? row.created_at : "")),
    updatedAt: firstText(raw.updatedAt, firstText(row && row.updated_at ? row.updated_at : "")),
    cancelledAt: firstText(raw.cancelledAt, firstText(row && row.cancelled_at ? row.cancelled_at : "")),
  };
}

function buildCalendarSessionRecord(base) {
  const recurrenceKey = firstText(base.recurrenceKey, base.sessionDate);
  const id = buildCalendarSessionId(base.uid, recurrenceKey);
  const raw = {
    id,
    sourceType: "calendar_ics",
    sourceUid: firstText(base.uid),
    sourceRecurrenceId: recurrenceKey,
    classKind: "regular",
    classGroup: "115B",
    title: firstText(base.title),
    courseGroupTitle: getCourseGroupTitle(firstText(base.title)),
    courseGroupKey: normalizeKeywordText(getCourseGroupTitle(firstText(base.title))),
    teacher: firstText(base.teacher),
    location: firstText(base.location),
    sessionDate: firstText(base.sessionDate),
    startsAt: firstText(base.startsAt),
    endsAt: firstText(base.endsAt),
    registrationDeadline: firstText(base.registrationDeadline),
    status: firstText(base.status, "published"),
    isVisible: true,
    calendarTimeZone: firstText(base.timeZone, DEFAULT_CALENDAR_TIMEZONE),
  };
  return {
    id,
    sourceType: "calendar_ics",
    sourceUid: raw.sourceUid,
    sourceRecurrenceId: raw.sourceRecurrenceId,
    classKind: "regular",
    classGroup: "115B",
    title: raw.title,
    courseGroupTitle: raw.courseGroupTitle,
    courseGroupKey: raw.courseGroupKey,
    teacher: raw.teacher,
    location: raw.location,
    sessionDate: raw.sessionDate,
    startsAt: raw.startsAt,
    endsAt: raw.endsAt,
    registrationDeadline: raw.registrationDeadline,
    status: raw.status,
    isVisible: true,
    raw,
  };
}

function shouldIncludeAcademicEvent(event, { dateText, title, isDateOnly, location, startsAt, endsAt }) {
  if (!event || isDateOnly) {
    return false;
  }
  if (!dateText || !isWeekendDateText(dateText)) {
    return false;
  }
  if (!hasAcademicLocation(location)) {
    return false;
  }
  if (!isAcademicDaytimeRange(startsAt, endsAt)) {
    return false;
  }
  return isAcademicTitle(title);
}

function buildStandaloneAcademicSession(event) {
  const timeZone = DEFAULT_CALENDAR_TIMEZONE;
  const sessionDate = toDateOnlyTextFromZonedDate(event.start, timeZone);
  const title = firstText(event.summary);
  const isDateOnly = Boolean(event && event.start && event.start.dateOnly);
  const startsAt = toDateTimeTextFromZonedDate(event.start, timeZone);
  const endsAt = toDateTimeTextFromZonedDate(event.end, timeZone);
  if (!shouldIncludeAcademicEvent(event, { dateText: sessionDate, title, isDateOnly, location: firstText(event.location), startsAt, endsAt })) {
    return null;
  }
  return buildCalendarSessionRecord({
    uid: event.uid,
    recurrenceKey: sessionDate,
    title,
    teacher: "",
    location: firstText(event.location),
    sessionDate,
    startsAt,
    endsAt,
    registrationDeadline: "",
    timeZone,
    status: "published",
  });
}

function buildRecurringAcademicSessions(event, rangeStart, rangeEnd) {
  const results = [];
  const title = firstText(event.summary);
  const isDateOnly = Boolean(event && event.start && event.start.dateOnly);
  const durationMs = durationMsBetween(event.start, event.end);
  const recurrenceOverrides = event.recurrences || {};
  const exdates = event.exdate || {};
  const occurrenceDates = event.rrule.between(rangeStart, rangeEnd, true);

  for (const occurrence of occurrenceDates) {
    const recurrenceKey = toDateOnlyTextFromUtcParts(occurrence);
    const overrideEvent = recurrenceOverrides[recurrenceKey];
    if (exdates[recurrenceKey] && !overrideEvent) {
      continue;
    }

    if (overrideEvent) {
      const timeZone = DEFAULT_CALENDAR_TIMEZONE;
      const sessionDate = toDateOnlyTextFromZonedDate(overrideEvent.start, timeZone);
      const startsAt = toDateTimeTextFromZonedDate(overrideEvent.start, timeZone);
      const endsAt = toDateTimeTextFromZonedDate(overrideEvent.end, timeZone);
      if (!shouldIncludeAcademicEvent(overrideEvent, { dateText: sessionDate, title, isDateOnly, location: firstText(overrideEvent.location, event.location), startsAt, endsAt })) {
        continue;
      }
      results.push(
        buildCalendarSessionRecord({
          uid: event.uid,
          recurrenceKey,
          title,
          teacher: "",
          location: firstText(overrideEvent.location, event.location),
          sessionDate,
          startsAt,
          endsAt,
          registrationDeadline: "",
          timeZone,
          status: "published",
        })
      );
      continue;
    }

    const sessionDate = recurrenceKey;
    const syntheticEnd = new Date(occurrence.getTime() + durationMs);
    const startsAt = toDateTimeTextFromUtcParts(occurrence);
    const endsAt = toDateTimeTextFromUtcParts(syntheticEnd);
    if (!shouldIncludeAcademicEvent(event, { dateText: sessionDate, title, isDateOnly, location: firstText(event.location), startsAt, endsAt })) {
      continue;
    }
    results.push(
      buildCalendarSessionRecord({
        uid: event.uid,
        recurrenceKey,
        title,
        teacher: "",
        location: firstText(event.location),
        sessionDate,
        startsAt,
        endsAt,
        registrationDeadline: "",
        timeZone: DEFAULT_CALENDAR_TIMEZONE,
        status: "published",
      })
    );
  }

  return results;
}

export async function loadAcademicSessionsFromIcs(icsUrl, options = {}) {
  const url = firstText(icsUrl);
  if (!url) {
    throw new Error("Missing ICS URL");
  }

  const rangeStartText = firstText(options.rangeStart, addDaysUtc(new Date().toISOString().slice(0, 10), -DEFAULT_SYNC_PAST_DAYS));
  const rangeEndText = firstText(options.rangeEnd, addDaysUtc(new Date().toISOString().slice(0, 10), DEFAULT_SYNC_FUTURE_DAYS));
  const rangeStart = new Date(`${rangeStartText}T00:00:00Z`);
  const rangeEnd = new Date(`${rangeEndText}T23:59:59Z`);
  const parsed = await ical.async.fromURL(url);
  const events = Object.values(parsed).filter((item) => item && item.type === "VEVENT");
  const rows = [];
  const seenIds = new Set();

  for (const event of events) {
    if (!event || !event.start) {
      continue;
    }

    const nextRows = event.rrule
      ? buildRecurringAcademicSessions(event, rangeStart, rangeEnd)
      : [buildStandaloneAcademicSession(event)].filter(Boolean);

    nextRows.forEach((row) => {
      if (!row || !row.id || seenIds.has(row.id)) {
        return;
      }
      seenIds.add(row.id);
      rows.push(row);
    });
  }

  rows.sort((left, right) => {
    const a = `${firstText(left.sessionDate)} ${firstText(left.startsAt)} ${firstText(left.id)}`;
    const b = `${firstText(right.sessionDate)} ${firstText(right.startsAt)} ${firstText(right.id)}`;
    return a.localeCompare(b, "zh-Hant", { numeric: true, sensitivity: "base" });
  });

  return rows;
}
