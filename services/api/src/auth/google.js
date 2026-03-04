import { getConfig } from "../config.js";

const config = getConfig();

const ALLOWED_ISSUERS = {
  "accounts.google.com": true,
  "https://accounts.google.com": true,
};

function getAllowedClientIds() {
  return String(config.googleClientId || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter((item) => item);
}

export async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || "").trim();
  if (!token) {
    throw new Error("Missing idToken");
  }

  const url =
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token);

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error("Unauthorized");
  }

  const payload = await response.json();
  const allowedClientIds = getAllowedClientIds();
  const aud = String(payload && payload.aud ? payload.aud : "").trim();
  const iss = String(payload && payload.iss ? payload.iss : "").trim();
  const sub = String(payload && payload.sub ? payload.sub : "").trim();

  if (!aud || !allowedClientIds.includes(aud)) {
    throw new Error("Unauthorized");
  }
  if (!iss || !ALLOWED_ISSUERS[iss]) {
    throw new Error("Unauthorized");
  }
  if (!sub) {
    throw new Error("Unauthorized");
  }

  return {
    sub,
    email: String(payload && payload.email ? payload.email : "").trim().toLowerCase(),
    name: String(payload && payload.name ? payload.name : "").trim(),
    picture: String(payload && payload.picture ? payload.picture : "").trim(),
    emailVerified:
      payload && (payload.email_verified === true || String(payload.email_verified || "") === "true"),
  };
}
