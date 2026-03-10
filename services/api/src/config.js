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
  const sessionSecret = requireEnv("SESSION_SECRET");
  const googleClientId = requireEnv("GOOGLE_CLIENT_ID");

  const driveFinanceFolderId = String(process.env.DRIVE_FINANCE_FOLDER_ID || "").trim();
  const driveServiceAccountJsonBase64 = String(
    process.env.DRIVE_SERVICE_ACCOUNT_JSON_BASE64 || ""
  ).trim();
  const driveAttachmentPublicRead = parseBoolean(process.env.DRIVE_ATTACHMENT_PUBLIC_READ, false);

  const nodeEnv = String(process.env.NODE_ENV || "development").trim();
  const strictNodeOnly = parseBoolean(process.env.STRICT_NODE_ONLY, nodeEnv === "production");

  // Legacy Apps Script fallback is removed (native-only). Keep these optional for any remaining tooling.
  const appsScriptUrl = String(process.env.APPS_SCRIPT_URL || "").trim();
  const syncPullToken = String(process.env.SYNC_PULL_TOKEN || "").trim();

  const appsScriptSyncEnabled = parseBoolean(process.env.APPS_SCRIPT_SYNC_ENABLED, false);
  const appsScriptMirrorEnabled = parseBoolean(process.env.APPS_SCRIPT_MIRROR_ENABLED, false);

  cachedConfig = {
    nodeEnv,
    port: parseNumber(process.env.PORT, 8080),
    strictNodeOnly,
    databaseUrl,
    databaseSsl: parseBoolean(process.env.DATABASE_SSL, true),
    databaseSslRejectUnauthorized: parseBoolean(
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED,
      nodeEnv === "production"
    ),
    appsScriptUrl,
    appsScriptTimeoutMs: parseNumber(process.env.APPS_SCRIPT_TIMEOUT_MS, 20000),
    syncPullToken,
    appsScriptSyncEnabled,
    appsScriptMirrorEnabled,
    sessionSecret,
    googleClientId,
    driveFinanceFolderId,
    driveServiceAccountJsonBase64,
    driveAttachmentPublicRead,
  };

  return cachedConfig;
}
