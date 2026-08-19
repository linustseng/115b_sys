export function isCurrentActiveActivityMember(profile) {
  return Boolean(profile && String(profile.id || "").trim() && String(profile.lifecycleStatus || profile.status || "active").trim() === "active");
}

export function canReadActivityPhoto({ status, canManage = false } = {}) {
  return status === "ready" || (Boolean(canManage) && status === "hidden");
}

export function activityPhotoPublicFields(row, signedUrl = "", safeFilename = (value) => String(value || "")) {
  return {
    id: String(row?.id || ""), originalName: safeFilename(row?.original_name), mimeType: String(row?.mime_type || ""),
    sizeBytes: Number(row?.size_bytes || 0), capturedAt: String(row?.captured_at || ""),
    uploadedByName: String(row?.uploaded_by_name || ""), status: String(row?.status || ""),
    createdAt: String(row?.created_at || ""), signedUrl: String(signedUrl || ""),
  };
}
