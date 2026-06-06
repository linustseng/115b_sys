const CACHE_VERSION = "v12-auth-reset";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const API_CACHE_TTL_MS = 60 * 1000;
const API_READ_ACTION_PREFIXES = ["list", "get", "lookup", "search", "verify"];
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("message", (event) => {
  const data = event && event.data ? event.data : {};
  if (data && data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              (key.startsWith("static-") && key !== STATIC_CACHE) ||
              (key.startsWith("api-") && key !== API_CACHE)
          )
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function stableStringify_(value) {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify_(item)).join(",")}]`;
  }
  if (typeof value !== "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify_(value[key])}`).join(",")}}`;
}

function hashKey_(text) {
  const input = String(text || "");
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function isReadAction_(action) {
  const normalized = String(action || "").trim();
  return API_READ_ACTION_PREFIXES.some((prefix) => normalized.indexOf(prefix) === 0);
}

function buildApiCacheKeys_(payload) {
  const bodyKey = hashKey_(stableStringify_(payload || {}));
  const bucket = Math.floor(Date.now() / API_CACHE_TTL_MS);
  const current = new Request(`/__api_cache__/${bodyKey}/${bucket}`);
  const previous = new Request(`/__api_cache__/${bodyKey}/${bucket - 1}`);
  return { current, previous };
}

function hasAuthContext_(request, payload) {
  const hasAuthHeader = Boolean(
    request.headers.get("Authorization") ||
      request.headers.get("x-id-token") ||
      request.headers.get("x-goog-id-token")
  );
  const body = payload && typeof payload === "object" ? payload : {};
  const hasAuthPayload = Boolean(body.sessionToken || body.idToken || body.refreshToken);
  return hasAuthHeader || hasAuthPayload;
}

function isUserScopedReadAction_(action) {
  return new Set([
    "listLandingBootstrap",
    "listHomeBootstrap",
    "listMyMemberships",
    "listApprovalsOverview",
    "listFinanceBootstrap",
    "listFinanceApplicantBootstrap",
    "listFinanceAdminBootstrap",
    "listFinanceRequests",
    "listFinanceActions",
    "listFinanceActionsByActor",
    "listFinanceActionsSummary",
    "listFundEvents",
    "listFundPayments",
    "getFundSummary",
    "listOrderPlans",
    "listOrderResponses",
    "listOrderResponsesByStudent",
    "listSoftballBootstrap",
    "listSoftballPlayerBootstrap",
    "listSoftballPlayers",
    "listSoftballPractices",
    "listSoftballFields",
    "listSoftballGear",
    "listSoftballConfig",
    "listSoftballAttendance",
    "listSoftballMemberships",
    "listSoftballAngels",
    "listSoftballSupplyVendors",
    "listSoftballSupplyCases",
    "listGroupMemberships",
    "listStudents",
    "lookupStudent",
    "searchStudents",
    "verifyGoogle",
    "refreshSession",
  ]).has(String(action || "").trim());
}

async function handleApiPostRequest_(event, request) {
  const cloned = request.clone();
  let payload;
  try {
    payload = await cloned.json();
  } catch (error) {
    return fetch(request);
  }
  const action = String((payload && payload.action) || "").trim();
  if (!action) {
    return fetch(request);
  }

  const apiCache = await caches.open(API_CACHE);

  if (isReadAction_(action)) {
    if (hasAuthContext_(request, payload) || isUserScopedReadAction_(action)) {
      return fetch(request);
    }

    const keys = buildApiCacheKeys_(payload);
    const cached = (await apiCache.match(keys.current)) || (await apiCache.match(keys.previous));
    const revalidatePromise = fetch(request.clone())
      .then((response) => {
        if (response && response.ok) {
          apiCache.put(keys.current, response.clone());
        }
        return response;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(revalidatePromise);
      return cached;
    }
    const fresh = await revalidatePromise;
    if (fresh) {
      return fresh;
    }
    return fetch(request);
  }

  const response = await fetch(request);
  if (response && response.ok) {
    event.waitUntil(caches.delete(API_CACHE));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method === "POST") {
    event.respondWith(handleApiPostRequest_(event, request));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put("/", responseClone));
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  const destination = request.destination;
  if (["script", "style", "image", "font"].includes(destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, responseClone));
            return response;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }
        return networkFetch;
      })
    );
  }
});
