export function parseEventDateValue(value) {
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
  const normalized = /^\d{4}[-/]\d{2}[-/]\d{2} \d{2}:\d{2}/.test(raw)
    ? raw.replace(/\//g, "-").replace(" ", "T")
    : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getEventCompletionDate(event) {
  if (!event) {
    return null;
  }
  return (
    parseEventDateValue(event.endAt) ||
    parseEventDateValue(event.checkinCloseAt) ||
    parseEventDateValue(event.registrationCloseAt) ||
    parseEventDateValue(event.startAt)
  );
}

export function isEventCompleted(event, nowMs = Date.now()) {
  if (!event) {
    return false;
  }
  const status = String(event.status || "").trim().toLowerCase();
  if (["closed", "completed", "finished", "archived", "cancelled", "canceled"].includes(status)) {
    return true;
  }
  const completionDate = getEventCompletionDate(event);
  return completionDate ? completionDate.getTime() < nowMs : false;
}

export function filterActiveEvents(events, nowMs = Date.now()) {
  return (Array.isArray(events) ? events : []).filter((event) => !isEventCompleted(event, nowMs));
}
