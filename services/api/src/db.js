import { Pool } from "pg";
import { getConfig } from "./config.js";

const config = getConfig();

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl
    ? { rejectUnauthorized: Boolean(config.databaseSslRejectUnauthorized) }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

export { pool };
