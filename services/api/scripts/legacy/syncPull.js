import { closePool } from "../../src/db.js";
import { syncFromAppsScript } from "../../src/sync/pullFromAppsScript.js";

async function run() {
  const result = await syncFromAppsScript();
  console.log(JSON.stringify(result, null, 2));
}

run()
  .catch((error) => {
    console.error("sync:pull failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
