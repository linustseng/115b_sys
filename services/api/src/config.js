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
  const appsScriptUrl = requireEnv("APPS_SCRIPT_URL");
  const syncPullToken = requireEnv("SYNC_PULL_TOKEN");
  const sessionSecret = requireEnv("SESSION_SECRET");
  const googleClientId = requireEnv("GOOGLE_CLIENT_ID");

  cachedConfig = {
    nodeEnv: String(process.env.NODE_ENV || "development").trim(),
    port: parseNumber(process.env.PORT, 8080),
    databaseUrl,
    databaseSsl: parseBoolean(process.env.DATABASE_SSL, true),
    appsScriptUrl,
    appsScriptTimeoutMs: parseNumber(process.env.APPS_SCRIPT_TIMEOUT_MS, 20000),
    syncPullToken,
    sessionSecret,
    googleClientId,
  };

  return cachedConfig;
}
