export function isStandalonePwa_() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof navigator !== "undefined" && navigator.standalone) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function openAttachmentUrl_(url) {
  const href = String(url || "").trim();
  if (!href || typeof window === "undefined") {
    return false;
  }
  if (isStandalonePwa_()) {
    window.location.assign(href);
    return true;
  }
  const opened = window.open(href, "_blank", "noopener,noreferrer");
  if (opened) {
    return true;
  }
  window.location.assign(href);
  return true;
}
