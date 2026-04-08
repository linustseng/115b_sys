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

function buildAttachmentPreviewUrl_(url, name = "附件預覽") {
  const href = String(url || "").trim();
  const filename = String(name || "附件預覽").trim() || "附件預覽";
  if (!href || typeof window === "undefined") {
    return "";
  }
  const previewUrl = new URL("/attachment-preview.html", window.location.origin);
  previewUrl.searchParams.set("url", href);
  previewUrl.searchParams.set("name", filename);
  return previewUrl.toString();
}

export function openAttachmentUrl_(url, name = "附件預覽") {
  const href = String(url || "").trim();
  if (!href || typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (isStandalonePwa_()) {
    window.location.assign(href);
    return true;
  }
  const targetHref = buildAttachmentPreviewUrl_(href, name) || href;
  const anchor = document.createElement("a");
  anchor.href = targetHref;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  return true;
}

export function isManagedAttachment_(item) {
  const attachment = item && typeof item === "object" ? item : {};
  const attachmentId = String(attachment.attachmentId || attachment.id || "").trim();
  const attachmentSource = String(attachment.source || "").trim().toLowerCase();
  return Boolean(attachmentId) && attachmentSource !== "legacy_url";
}

async function fetchFreshAttachmentUrl_(attachmentId, apiRequest) {
  const { result } = await apiRequest({ action: "getAttachmentAccessUrl", attachmentId });
  if (!result || !result.ok || !result.data || !result.data.url) {
    throw new Error((result && result.error) || "附件連結暫時無法取得");
  }
  return result.data;
}

export async function resolveAndOpenAttachment_(item, apiRequest) {
  const attachment = item && typeof item === "object" ? item : {};
  const attachmentName = String(attachment.name || attachment.originalName || "附件預覽").trim() || "附件預覽";
  const existingUrl = String(attachment.url || "").trim();
  const attachmentId = String(attachment.attachmentId || attachment.id || "").trim();

  // 規則：系統管理的附件不要直接信任 item.url。
  // signed URL 可能是舊的，開啟時一律向後端重取新的 access URL。
  if (isManagedAttachment_(attachment) && typeof apiRequest === "function") {
    const data = await fetchFreshAttachmentUrl_(attachmentId, apiRequest);
    return openAttachmentUrl_(data.url, data.name || attachmentName);
  }

  if (existingUrl) {
    return openAttachmentUrl_(existingUrl, attachmentName);
  }

  if (!attachmentId || typeof apiRequest !== "function") {
    return false;
  }
  const data = await fetchFreshAttachmentUrl_(attachmentId, apiRequest);
  return openAttachmentUrl_(data.url, data.name || attachmentName);
}
