import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "./config.js";
import { jsonbParam } from "./jsonb.js";

const config = getConfig();

const DEFAULT_BUCKET = "attachments";
const DEFAULT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 30;

let cachedClient = null;

function nowIso() {
  return new Date().toISOString();
}

function firstText(value, fallback = "") {
  const text = String(value == null ? "" : value).trim();
  return text || String(fallback || "").trim();
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEntityType(value, fallback = "generic") {
  return firstText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .slice(0, 80) || fallback;
}

function normalizeEntityId(value, fallback = "draft") {
  return firstText(value, fallback)
    .replace(/[^a-zA-Z0-9:_-]+/g, "_")
    .slice(0, 120) || fallback;
}

function toStorageSafeSegment(value, fallback = "file") {
  const normalized = String(value == null ? "" : value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 120);
  return normalized || fallback;
}

function toStorageSafeFilename(value) {
  const original = safeFilename(value);
  const dotIndex = original.lastIndexOf(".");
  const hasExt = dotIndex > 0 && dotIndex < original.length - 1;
  const ext = hasExt ? original.slice(dotIndex + 1) : "";
  const base = hasExt ? original.slice(0, dotIndex) : original;
  const safeBase = toStorageSafeSegment(base, "file");
  const safeExt = ext ? toStorageSafeSegment(ext, "bin").toLowerCase() : "";
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

function recoverUtf8Filename(value) {
  const raw = firstText(value);
  if (!raw) {
    return "";
  }
  // Common multipart mojibake: UTF-8 bytes interpreted as latin1.
  // Try a reversible latin1 -> utf8 recovery only when the decoded result looks better.
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

function safeFilename(value) {
  const raw = recoverUtf8Filename(firstText(value, "attachment"));
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 160) || "attachment";
}

export function isAllowedAttachmentMime(mime) {
  const normalized = firstText(mime).toLowerCase();
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
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]).has(normalized);
}

export function isAttachmentStorageConfigured() {
  return Boolean(firstText(config.supabaseUrl) && firstText(config.supabaseServiceRoleKey));
}

function getSupabaseClient() {
  if (!isAttachmentStorageConfigured()) {
    throw new Error("Supabase Storage not configured");
  }
  if (!cachedClient) {
    cachedClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

export function normalizeAttachmentItems(value) {
  const list = Array.isArray(value)
    ? value
    : (() => {
        try {
          const parsed = JSON.parse(String(value || "[]"));
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

  return list
    .map((item) => {
      const row = item && typeof item === "object" ? item : {};
      const attachmentId = firstText(row.attachmentId, row.id);
      const name = safeFilename(row.name || row.originalName || "");
      const url = firstText(row.url);
      if (!attachmentId && !url) {
        return null;
      }
      return {
        attachmentId,
        id: attachmentId,
        name: name || firstText(url),
        url,
        mimeType: firstText(row.mimeType),
        sizeBytes: parseNumber(row.sizeBytes, 0),
        attachmentKind: firstText(row.attachmentKind, "general"),
        source: firstText(row.source, attachmentId ? "attachment" : "legacy_url"),
      };
    })
    .filter(Boolean)
    .slice(0, 20);
}

export function buildAttachmentPublicShape(row, signedUrl = "") {
  if (!row) {
    return null;
  }
  return {
    attachmentId: firstText(row.id),
    id: firstText(row.id),
    name: safeFilename(row.original_name || row.originalName || row.name),
    url: firstText(signedUrl),
    mimeType: firstText(row.mime_type || row.mimeType),
    sizeBytes: parseNumber(row.size_bytes ?? row.sizeBytes, 0),
    attachmentKind: firstText(row.attachment_kind || row.attachmentKind, "general"),
    source: "attachment",
    status: firstText(row.status, "ready"),
  };
}

function buildStoragePath({ entityType, entityId, attachmentId, fileName }) {
  const safeEntityType = toStorageSafeSegment(normalizeEntityType(entityType), "generic");
  const safeEntityId = toStorageSafeSegment(normalizeEntityId(entityId), "draft");
  const safeFileName = toStorageSafeFilename(fileName);
  return `${safeEntityType}/${safeEntityId}/${attachmentId}-${safeFileName}`;
}

export async function uploadAttachmentFile({
  fileBuffer,
  fileName,
  mimeType,
  entityType,
  entityId,
  attachmentKind = "general",
  uploadedBy = "",
  uploadedByName = "",
  raw = {},
  query,
}) {
  if (!query || typeof query !== "function") {
    throw new Error("query is required");
  }
  if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
    throw new Error("Missing file buffer");
  }
  const normalizedMime = firstText(mimeType).toLowerCase();
  if (!isAllowedAttachmentMime(normalizedMime)) {
    throw new Error("不支援的檔案格式（僅支援 pdf/jpg/png/heic/xlsx/docx/pptx）");
  }
  if (fileBuffer.length > parseNumber(config.attachmentMaxFileSizeBytes, DEFAULT_MAX_FILE_SIZE_BYTES)) {
    throw new Error("檔案大小超過限制");
  }

  const attachmentId = crypto.randomUUID();
  const bucket = firstText(config.supabaseAttachmentBucket, DEFAULT_BUCKET);
  const storagePath = buildStoragePath({ entityType, entityId, attachmentId, fileName });
  const createdAt = nowIso();

  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
    contentType: normalizedMime,
    upsert: false,
  });
  if (error) {
    throw new Error(firstText(error.message, "Storage upload failed"));
  }

  await query(
    `insert into attachments (
       id, entity_type, entity_id, bucket, storage_path, original_name,
       mime_type, size_bytes, attachment_kind, visibility,
       uploaded_by, uploaded_by_name, status,
       created_at, updated_at, completed_at, raw
     ) values (
       $1,$2,$3,$4,$5,$6,
       $7,$8,$9,$10,
       $11,$12,$13,
       $14,$15,$16,$17::jsonb
     )`,
    [
      attachmentId,
      normalizeEntityType(entityType),
      normalizeEntityId(entityId),
      bucket,
      storagePath,
      safeFilename(fileName),
      normalizedMime,
      Number(fileBuffer.length || 0),
      firstText(attachmentKind, "general"),
      "private",
      firstText(uploadedBy),
      firstText(uploadedByName),
      "ready",
      createdAt,
      createdAt,
      createdAt,
      jsonbParam(raw, {}),
    ]
  );

  const { data: signedData, error: signedError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, parseNumber(config.attachmentSignedUrlTtlSeconds, DEFAULT_SIGNED_URL_TTL_SECONDS));

  if (signedError) {
    throw new Error(firstText(signedError.message, "Failed to create signed URL"));
  }

  return {
    attachmentId,
    bucket,
    storagePath,
    signedUrl: firstText(signedData && signedData.signedUrl),
    item: buildAttachmentPublicShape(
      {
        id: attachmentId,
        original_name: fileName,
        mime_type: normalizedMime,
        size_bytes: Number(fileBuffer.length || 0),
        attachment_kind: attachmentKind,
        status: "ready",
      },
      firstText(signedData && signedData.signedUrl)
    ),
  };
}

export async function createSignedReadUrlForAttachment(row, ttlSeconds = null) {
  if (!row) {
    return "";
  }
  const bucket = firstText(row.bucket);
  const storagePath = firstText(row.storage_path || row.storagePath);
  if (!bucket || !storagePath) {
    return "";
  }
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, parseNumber(ttlSeconds, parseNumber(config.attachmentSignedUrlTtlSeconds, DEFAULT_SIGNED_URL_TTL_SECONDS)));
  if (error) {
    return "";
  }
  return firstText(data && data.signedUrl);
}

export async function listAttachmentsByEntity(query, { entityType, entityId, includeDeleted = false } = {}) {
  if (!query || typeof query !== "function") {
    throw new Error("query is required");
  }
  const params = [normalizeEntityType(entityType), normalizeEntityId(entityId)];
  const deletedClause = includeDeleted ? "" : "and coalesce(status,'') <> 'deleted' and coalesce(deleted_at,'') = ''";
  const result = await query(
    `select * from attachments
      where entity_type = $1
        and entity_id = $2
        ${deletedClause}
      order by coalesce(created_at,'') asc, id asc`,
    params
  );
  const items = [];
  for (const row of result.rows) {
    const signedUrl = await createSignedReadUrlForAttachment(row);
    items.push(buildAttachmentPublicShape(row, signedUrl));
  }
  return items.filter(Boolean);
}

export function extractAttachmentIds(value) {
  return normalizeAttachmentItems(value)
    .map((item) => firstText(item.attachmentId || item.id))
    .filter(Boolean);
}

export async function claimAttachments(query, {
  attachmentIds = [],
  entityType,
  entityId,
  uploadedBy = "",
  allowUnowned = false,
} = {}) {
  if (!query || typeof query !== "function") {
    throw new Error("query is required");
  }
  const ids = Array.from(new Set((Array.isArray(attachmentIds) ? attachmentIds : []).map((item) => firstText(item)).filter(Boolean))).slice(0, 20);
  if (!ids.length) {
    return { count: 0 };
  }
  const normalizedEntityType = normalizeEntityType(entityType);
  const normalizedEntityId = normalizeEntityId(entityId);
  const updatedAt = nowIso();
  const owner = firstText(uploadedBy);
  const allowOwnerFilter = Boolean(owner);
  await query(
    `update attachments
        set entity_type = $2,
            entity_id = $3,
            updated_at = $4,
            synced_at = now()
      where id = any($1::text[])
        and coalesce(status,'') <> 'deleted'
        and (
          coalesce(entity_id,'') = ''
          or coalesce(entity_id,'') = $3
          or coalesce(entity_id,'') like 'draft:%'
          or ($5::boolean and coalesce(entity_id,'') like 'temp:%')
        )
        and (
          not $6::boolean
          or coalesce(uploaded_by,'') = $7
          or ($8::boolean and coalesce(uploaded_by,'') = '')
        )`,
    [
      ids,
      normalizedEntityType,
      normalizedEntityId,
      updatedAt,
      Boolean(allowUnowned),
      allowOwnerFilter,
      owner,
      Boolean(allowUnowned),
    ]
  );
  return { count: ids.length };
}

export async function softDeleteAttachment(query, { attachmentId, deletedBy = "" } = {}) {
  if (!query || typeof query !== "function") {
    throw new Error("query is required");
  }
  const id = firstText(attachmentId);
  if (!id) {
    throw new Error("Missing attachmentId");
  }
  const result = await query(`select * from attachments where id = $1 limit 1`, [id]);
  const row = result.rows[0];
  if (!row) {
    return { ok: false, row: null };
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from(firstText(row.bucket)).remove([firstText(row.storage_path)]);
  if (error) {
    throw new Error(firstText(error.message, "Failed to delete attachment object"));
  }
  const deletedAt = nowIso();
  const mergedRaw = {
    ...(row.raw && typeof row.raw === "object" ? row.raw : {}),
    deletedBy: firstText(deletedBy),
    deletedAt,
  };
  await query(
    `update attachments
        set status = 'deleted',
            deleted_at = $2,
            updated_at = $2,
            raw = $3::jsonb,
            synced_at = now()
      where id = $1`,
    [id, deletedAt, jsonbParam(mergedRaw, {})]
  );
  return { ok: true, row };
}

export async function hydrateAttachmentItems(query, value) {
  const normalized = normalizeAttachmentItems(value);
  if (!normalized.length) {
    return [];
  }
  const ids = normalized.map((item) => item.attachmentId).filter(Boolean);
  if (!ids.length) {
    return normalized;
  }
  const result = await query(`select * from attachments where id = any($1::text[])`, [ids]);
  const byId = new Map(result.rows.map((row) => [firstText(row.id), row]));
  const output = [];
  for (const item of normalized) {
    const row = item.attachmentId ? byId.get(item.attachmentId) : null;
    if (!row || firstText(row.status) === "deleted") {
      if (item.url) {
        output.push(item);
      }
      continue;
    }
    const signedUrl = await createSignedReadUrlForAttachment(row);
    output.push(buildAttachmentPublicShape(row, signedUrl) || item);
  }
  return output;
}
