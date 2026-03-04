import { getConfig } from "../src/config.js";

const config = getConfig();

const iterations = Math.max(1, Number(process.env.BENCH_ITERATIONS || 10));
const benchEmail = String(process.env.BENCH_EMAIL || "").trim() || "linustseng@gmail.com";
const apiV2Base = String(process.env.BENCH_API_V2_URL || "").trim();

if (!apiV2Base) {
  console.error("Missing BENCH_API_V2_URL");
  process.exit(1);
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}`);
  }
  if (!json || json.ok !== true) {
    throw new Error((json && json.error) || `Request failed: ${url}`);
  }
  return json;
}

function buildAppsScriptUrl(payload) {
  const url = new URL(config.appsScriptUrl);
  url.searchParams.set("payload", JSON.stringify(payload));
  return url.toString();
}

async function benchCase(name, requester) {
  const samples = [];
  for (var i = 0; i < iterations; i++) {
    const started = Date.now();
    await requester();
    samples.push(Date.now() - started);
  }
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    name,
    iterations,
    avgMs: Number((total / samples.length).toFixed(1)),
    p95Ms: percentile(samples, 95),
    minMs: Math.min.apply(null, samples),
    maxMs: Math.max.apply(null, samples),
  };
}

async function run() {
  const base = apiV2Base.endsWith("/") ? apiV2Base.slice(0, -1) : apiV2Base;

  const cases = [
    {
      name: "apps:listEvents",
      requester: () => requestJson(buildAppsScriptUrl({ action: "listEvents" })),
    },
    {
      name: "node:listEvents",
      requester: () => requestJson(`${base}/v1/events`),
    },
    {
      name: "apps:listHomeBootstrap",
      requester: () => requestJson(buildAppsScriptUrl({ action: "listHomeBootstrap", email: benchEmail })),
    },
    {
      name: "node:listHomeBootstrap",
      requester: () => requestJson(`${base}/v1/bootstrap/home?email=${encodeURIComponent(benchEmail)}`),
    },
    {
      name: "apps:listStudents",
      requester: () => requestJson(buildAppsScriptUrl({ action: "listStudents" })),
    },
    {
      name: "node:listStudents",
      requester: () => requestJson(`${base}/v1/students`),
    },
  ];

  const results = [];
  for (const item of cases) {
    results.push(await benchCase(item.name, item.requester));
  }

  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        iterations,
        email: benchEmail,
        results,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error("bench:reads failed:", error.message || error);
  process.exit(1);
});
