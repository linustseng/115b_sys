// Admin datetime-local values are Taiwan wall time, not the host timezone.
export function eventTimeMs(value) {
  if (!value) return NaN;
  if (value instanceof Date) return value.getTime();
  let text = String(value).trim().replace(/\//g, "-").replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += "T00:00:00";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)) text += "+08:00";
  return Date.parse(text);
}

export function isWithinWindow(openAt, closeAt, now = Date.now()) {
  const open = eventTimeMs(openAt);
  const close = eventTimeMs(closeAt);
  return !(Number.isFinite(open) && now < open) && !(Number.isFinite(close) && now > close);
}

export function registrationWindowLabel(event, now = Date.now()) {
  if (String(event.status || "").trim().toLowerCase() !== "open") return "報名未開放";
  if (now < eventTimeMs(event.registrationOpenAt)) return "報名尚未開始";
  if (now > eventTimeMs(event.registrationCloseAt)) return "報名已截止";
  return "報名進行中";
}
