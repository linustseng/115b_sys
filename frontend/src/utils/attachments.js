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
  if (!href || typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (isStandalonePwa_()) {
    window.location.assign(href);
    return true;
  }
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
}

export async function resolveAndOpenAttachment_(item, apiRequest) {
  const attachment = item && typeof item === "object" ? item : {};
  const existingUrl = String(attachment.url || "").trim();
  if (existingUrl) {
    return openAttachmentUrl_(existingUrl);
  }
  const attachmentId = String(attachment.attachmentId || attachment.id || "").trim();
  if (!attachmentId || typeof apiRequest !== "function") {
    return false;
  }
  const { result } = await apiRequest({ action: "getAttachmentAccessUrl", attachmentId });
  if (!result || !result.ok || !result.data || !result.data.url) {
    throw new Error((result && result.error) || "附件連結暫時無法取得");
  }
  return openAttachmentUrl_(result.data.url);
}
