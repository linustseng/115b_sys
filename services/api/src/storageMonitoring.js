const GIB = 1024 ** 3;

function text(value) {
  return String(value == null ? "" : value).trim();
}

function nonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function storageCategory(mimeType) {
  const mime = text(mimeType).toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || mime.includes("officedocument") || mime.includes("spreadsheet")) return "document";
  return "other";
}

function groupRows(rows, field) {
  return rows.map((row) => ({
    [field]: text(row[field]),
    sizeBytes: nonNegativeInteger(row.size_bytes),
    objectCount: nonNegativeInteger(row.object_count),
  })).filter((row) => row[field]);
}

export function buildStorageMonitoringSnapshot({ bucketRows = [], categoryRows = [], quotaBytes = 0, planLabel = "", observedAt = new Date().toISOString() } = {}) {
  const buckets = groupRows(bucketRows, "bucket");
  const categories = groupRows(categoryRows, "category");
  const actualUsedBytes = buckets.reduce((total, row) => total + row.sizeBytes, 0);
  const normalizedQuota = nonNegativeInteger(quotaBytes);
  const hasQuota = normalizedQuota > 0;
  const usagePercent = hasQuota ? Number(((actualUsedBytes / normalizedQuota) * 100).toFixed(2)) : null;
  const warningLevel = !hasQuota ? "unknown" : usagePercent >= 95 ? "critical" : usagePercent >= 85 ? "high" : usagePercent >= 70 ? "warning" : "normal";

  return {
    status: "ready",
    observedAt: text(observedAt),
    measurement: {
      kind: "measured_live_snapshot",
      source: "Supabase Storage storage.objects metadata",
      note: "This is a current object-size snapshot, not the billing GB-hours metric.",
    },
    actualUsedBytes,
    actualUsedGb: Number((actualUsedBytes / GIB).toFixed(4)),
    quota: hasQuota ? {
      status: "configured_project_quota",
      bytes: normalizedQuota,
      gb: Number((normalizedQuota / GIB).toFixed(4)),
      planLabel: text(planLabel),
      source: "Server-only project quota configuration",
    } : {
      status: "unavailable",
      bytes: null,
      gb: null,
      planLabel: "",
      source: "Not configured; this service will not infer an organization quota from a plan name.",
    },
    remainingBytes: hasQuota ? Math.max(0, normalizedQuota - actualUsedBytes) : null,
    remainingGb: hasQuota ? Number((Math.max(0, normalizedQuota - actualUsedBytes) / GIB).toFixed(4)) : null,
    usagePercent,
    warningLevel,
    warningThresholds: { warning: 70, high: 85, critical: 95 },
    buckets,
    categories,
    trend: { status: "snapshot_only", observedAt: text(observedAt) },
    needsConfiguration: hasQuota ? [] : ["SUPABASE_STORAGE_MONITORING_QUOTA_BYTES", "SUPABASE_STORAGE_MONITORING_PLAN_LABEL (optional)"],
  };
}

export async function loadStorageMonitoringSnapshot({ query, quotaBytes = 0, planLabel = "", now = () => new Date().toISOString() } = {}) {
  if (typeof query !== "function") throw new Error("query is required");
  // storage.objects is Supabase Storage's system catalog, not an application
  // attachment/activity table. It is the source Supabase documents for object-size
  // usage; malformed/missing size metadata is counted as zero rather than trusted.
  const result = await query(`select
      bucket_id as bucket,
      coalesce(metadata ->> 'mimetype', metadata ->> 'contentType', 'application/octet-stream') as mime_type,
      coalesce(sum(case when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$' then (metadata ->> 'size')::bigint else 0 end), 0)::text as size_bytes,
      count(*)::int as object_count
    from storage.objects
    group by bucket_id, coalesce(metadata ->> 'mimetype', metadata ->> 'contentType', 'application/octet-stream')
    order by bucket_id, mime_type`);
  const rows = Array.isArray(result && result.rows) ? result.rows : [];
  const bucketMap = new Map();
  const categoryMap = new Map();
  for (const row of rows) {
    const bucket = text(row.bucket);
    const sizeBytes = nonNegativeInteger(row.size_bytes);
    const objectCount = nonNegativeInteger(row.object_count);
    if (!bucket) continue;
    const bucketCurrent = bucketMap.get(bucket) || { bucket, size_bytes: 0, object_count: 0 };
    bucketCurrent.size_bytes += sizeBytes;
    bucketCurrent.object_count += objectCount;
    bucketMap.set(bucket, bucketCurrent);
    const category = storageCategory(row.mime_type);
    const categoryCurrent = categoryMap.get(category) || { category, size_bytes: 0, object_count: 0 };
    categoryCurrent.size_bytes += sizeBytes;
    categoryCurrent.object_count += objectCount;
    categoryMap.set(category, categoryCurrent);
  }
  return buildStorageMonitoringSnapshot({
    bucketRows: [...bucketMap.values()].sort((a, b) => b.size_bytes - a.size_bytes || a.bucket.localeCompare(b.bucket)),
    categoryRows: [...categoryMap.values()].sort((a, b) => b.size_bytes - a.size_bytes || a.category.localeCompare(b.category)),
    quotaBytes,
    planLabel,
    observedAt: now(),
  });
}
