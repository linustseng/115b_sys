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
  const attachmentSignedUrlTtlSeconds = parseNumber(process.env.ATTACHMENT_SIGNED_URL_TTL_SECONDS, 1800);
  const attachmentMaxFileSizeBytes = parseNumber(process.env.ATTACHMENT_MAX_FILE_SIZE_BYTES, 20 * 1024 * 1024);

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
    attachmentSignedUrlTtlSeconds,
    attachmentMaxFileSizeBytes,
  };

  return cachedConfig;
}
