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

  const nodeEnv = String(process.env.NODE_ENV || "development").trim();
  const strictNodeOnly = parseBoolean(process.env.STRICT_NODE_ONLY, nodeEnv === "production");

  const appsScriptUrl = String(process.env.APPS_SCRIPT_URL || "").trim();
  const syncPullToken = String(process.env.SYNC_PULL_TOKEN || "").trim();
  if (!strictNodeOnly) {
    if (!appsScriptUrl) {
      throw new Error("Missing required env: APPS_SCRIPT_URL");
    }
    if (!syncPullToken) {
      throw new Error("Missing required env: SYNC_PULL_TOKEN");
    }
  }

  cachedConfig = {
    nodeEnv,
    port: parseNumber(process.env.PORT, 8080),
    strictNodeOnly,
    databaseUrl,
    databaseSsl: parseBoolean(process.env.DATABASE_SSL, true),
    appsScriptUrl,
    appsScriptTimeoutMs: parseNumber(process.env.APPS_SCRIPT_TIMEOUT_MS, 20000),
    syncPullToken,
    sessionSecret,
    googleClientId,
    driveFinanceFolderId,
    driveServiceAccountJsonBase64,
  };

  return cachedConfig;
}
