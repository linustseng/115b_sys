import dotenv from "dotenv";

dotenv.config();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function parseBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

let cachedConfig = null;

export function getConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const databaseUrl = requireEnv("DATABASE_URL");
  // Keep optional at config-load time so migration/predeploy can run with DB-only env.
  // Server runtime validates required auth secrets before accepting traffic.
  const sessionSecret = String(process.env.SESSION_SECRET || "").trim();
  const googleClientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();

  const driveFinanceFolderId = String(process.env.DRIVE_FINANCE_FOLDER_ID || "").trim();
  const driveServiceAccountJsonBase64 = String(
    process.env.DRIVE_SERVICE_ACCOUNT_JSON_BASE64 || ""
  ).trim();
  const driveAttachmentPublicRead = parseBoolean(process.env.DRIVE_ATTACHMENT_PUBLIC_READ, false);

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const supabaseServiceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const supabaseAttachmentBucket = String(process.env.SUPABASE_ATTACHMENT_BUCKET || "attachments").trim() || "attachments";
  const supabaseActivityAlbumBucket = String(process.env.SUPABASE_ACTIVITY_ALBUM_BUCKET || "activity-albums").trim() || "activity-albums";
  // This is deliberately an explicit, project-scoped value supplied by an owner
  // from the Supabase billing/usage console.  Do not infer an organization quota
  // from the plan name: Storage quotas and billing are organization scoped.
  const supabaseStorageMonitoringQuotaBytes = parseNumber(process.env.SUPABASE_STORAGE_MONITORING_QUOTA_BYTES, 0);
  const supabaseStorageMonitoringPlanLabel = String(process.env.SUPABASE_STORAGE_MONITORING_PLAN_LABEL || "").trim().slice(0, 80);
  const attachmentSignedUrlTtlSeconds = parseNumber(process.env.ATTACHMENT_SIGNED_URL_TTL_SECONDS, 1800);
  const attachmentMaxFileSizeBytes = parseNumber(process.env.ATTACHMENT_MAX_FILE_SIZE_BYTES, 20 * 1024 * 1024);
  const cheerleadingVideoMaxFileSizeBytes = parseNumber(process.env.CHEERLEADING_VIDEO_MAX_FILE_SIZE_BYTES, 500 * 1024 * 1024);

  const nodeEnv = String(process.env.NODE_ENV || "development").trim();
  const strictNodeOnly = parseBoolean(process.env.STRICT_NODE_ONLY, nodeEnv === "production");

  cachedConfig = {
    nodeEnv,
    port: parseNumber(process.env.PORT, 8080),
    strictNodeOnly,
    databaseUrl,
    databaseSsl: parseBoolean(process.env.DATABASE_SSL, true),
    // Keep compatibility with managed DBs that use self-signed/intermediate chains.
    // Opt-in strict validation via DATABASE_SSL_REJECT_UNAUTHORIZED=true when CA chain is trusted.
    databaseSslRejectUnauthorized: parseBoolean(
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
      false
    ),
    sessionSecret,
    googleClientId,
    driveFinanceFolderId,
    driveServiceAccountJsonBase64,
    driveAttachmentPublicRead,
    supabaseUrl,
    supabaseServiceRoleKey,
    supabaseAttachmentBucket,
    supabaseActivityAlbumBucket,
    supabaseStorageMonitoringQuotaBytes: Math.max(0, supabaseStorageMonitoringQuotaBytes),
    supabaseStorageMonitoringPlanLabel,
    attachmentSignedUrlTtlSeconds,
    attachmentMaxFileSizeBytes,
    cheerleadingVideoMaxFileSizeBytes,
  };

  return cachedConfig;
}
