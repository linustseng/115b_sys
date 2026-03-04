import crypto from "node:crypto";
import { getConfig } from "../config.js";

const config = getConfig();
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function encodeBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ""), "utf8");
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? normalized + "=".repeat(4 - padding) : normalized;
  return Buffer.from(padded, "base64");
}

function sign(input) {
  return crypto.createHmac("sha256", config.sessionSecret).update(String(input || "")).digest();
}

function safeEqual(a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(payload) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };
  const body = {
    sid: crypto.randomBytes(8).toString("hex"),
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
    studentId: String(payload && payload.studentId ? payload.studentId : "").trim(),
    email: String(payload && payload.email ? payload.email : "").trim().toLowerCase(),
    sub: String(payload && payload.sub ? payload.sub : "").trim(),
    name: String(payload && payload.name ? payload.name : "").trim(),
  };

  if (!body.studentId) {
    throw new Error("Missing studentId for session token");
  }

  const headerEncoded = encodeBase64Url(JSON.stringify(header));
  const bodyEncoded = encodeBase64Url(JSON.stringify(body));
  const content = `${headerEncoded}.${bodyEncoded}`;
  const signature = encodeBase64Url(sign(content));
  return `${content}.${signature}`;
}

export function verifySessionToken(token) {
  const raw = String(token || "").trim();
  if (!raw) {
    return null;
  }
  const segments = raw.split(".");
  if (segments.length !== 3) {
    return null;
  }
  const [headerEncoded, bodyEncoded, signatureEncoded] = segments;
  if (!headerEncoded || !bodyEncoded || !signatureEncoded) {
    return null;
  }
  const content = `${headerEncoded}.${bodyEncoded}`;
  const expectedSignature = sign(content);
  const providedSignature = decodeBase64Url(signatureEncoded);
  if (!safeEqual(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const bodyRaw = decodeBase64Url(bodyEncoded).toString("utf8");
    const payload = JSON.parse(bodyRaw);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload !== "object") {
      return null;
    }
    if (!payload.studentId || !payload.exp || Number(payload.exp) < nowSeconds) {
      return null;
    }
    return {
      sid: String(payload.sid || "").trim(),
      studentId: String(payload.studentId || "").trim(),
      email: String(payload.email || "").trim().toLowerCase(),
      sub: String(payload.sub || "").trim(),
      name: String(payload.name || "").trim(),
      iat: Number(payload.iat || 0),
      exp: Number(payload.exp || 0),
    };
  } catch (error) {
    return null;
  }
}
