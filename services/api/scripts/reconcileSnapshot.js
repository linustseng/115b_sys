import { getConfig } from "../src/config.js";
import { closePool, query } from "../src/db.js";

const config = getConfig();

const TABLE_MAPPINGS = [
  { snapshotKey: "events", table: "events" },
  { snapshotKey: "students", table: "students" },
  { snapshotKey: "registrations", table: "registrations" },
  { snapshotKey: "checkins", table: "checkins" },
  { snapshotKey: "directory", table: "directories" },
  { snapshotKey: "groupMemberships", table: "group_memberships" },
];

function quoteIdentifier(name) {
  if (!/^[a-z_]+$/i.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
}

async function pullSnapshotFromAppsScript() {
  const payload = {
    action: "syncPullSnapshot",
    syncToken: config.syncPullToken,
  };
  const url = new URL(config.appsScriptUrl);
  url.searchParams.set("payload", JSON.stringify(payload));

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error("Apps Script returned non-JSON response");
  }

  if (!json || json.ok !== true) {
    throw new Error((json && json.error) || "Apps Script snapshot failed");
  }

  return json.data || {};
}

async function countTableRows(table) {
  const sql = `SELECT count(*)::int AS count FROM ${quoteIdentifier(table)}`;
  const result = await query(sql);
  return Number(result.rows[0] && result.rows[0].count ? result.rows[0].count : 0);
}

async function run() {
  const snapshot = await pullSnapshotFromAppsScript();

  const comparisons = [];
  for (const mapping of TABLE_MAPPINGS) {
    const sourceRows = Array.isArray(snapshot[mapping.snapshotKey]) ? snapshot[mapping.snapshotKey] : [];
    const dbCount = await countTableRows(mapping.table);
    comparisons.push({
      key: mapping.snapshotKey,
      table: mapping.table,
      sourceCount: sourceRows.length,
      dbCount,
      match: sourceRows.length === dbCount,
    });
  }

  const mismatches = comparisons.filter((item) => !item.match);
  const output = {
    checkedAt: new Date().toISOString(),
    pulledAt: snapshot.pulledAt || "",
    comparisons,
    mismatchCount: mismatches.length,
  };

  console.log(JSON.stringify(output, null, 2));

  if (mismatches.length && String(process.env.RECONCILE_STRICT || "").trim() === "1") {
    process.exitCode = 1;
  }
}

run()
  .catch((error) => {
    console.error("reconcile:snapshot failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
