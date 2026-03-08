import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, closePool } from "../src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureMigrationTable() {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function listMigrationFiles(migrationsDir) {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
}

async function hasMigration(id) {
  const result = await pool.query(`select id from schema_migrations where id = $1 limit 1`, [id]);
  return result.rows.length > 0;
}

async function recordMigration(id) {
  await pool.query(`insert into schema_migrations (id) values ($1) on conflict (id) do nothing`, [id]);
}

async function run() {
  const migrationsDir = path.resolve(__dirname, "../migrations");

  // Apply 001 first even if table doesn't exist yet.
  const initPath = path.join(migrationsDir, "001_init.sql");
  const initSql = await fs.readFile(initPath, "utf8");
  await pool.query(initSql);
  console.log("Migration applied: 001_init.sql");

  await ensureMigrationTable();
  await recordMigration("001_init.sql");

  const files = await listMigrationFiles(migrationsDir);
  for (const file of files) {
    if (file === "001_init.sql") {
      continue;
    }
    const already = await hasMigration(file);
    if (already) {
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await pool.query(sql);
    await recordMigration(file);
    console.log(`Migration applied: ${file}`);
  }
}

run()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
