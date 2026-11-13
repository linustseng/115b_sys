import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("all migration-created public tables have RLS by the end of the migration sequence", async () => {
  const dir = new URL("../migrations/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort((a, b) => a.localeCompare(b, "en"));
  const tables = new Map();
  for (const file of files) {
    const sql = (await readFile(new URL(file, dir), "utf8")).replace(/--[^\n]*/g, "");
    // Inventory for this repo's current CREATE TABLE syntax, not a SQL interpreter.
    // Fail explicitly if table lifecycle syntax changes instead of ignoring it.
    assert.doesNotMatch(sql, /\b(?:drop\s+table|rename\s+to|disable\s+row\s+level\s+security)\b/i, file);
    for (const match of sql.matchAll(/create\s+table\s+if\s+not\s+exists\s+([\w.]+)/gi)) {
      const name = match[1].replace(/^public\./i, "");
      if (!name.includes(".") && !tables.has(name)) tables.set(name, false);
    }
    if (["017_enable_rls_public_tables.sql", "024_enable_rls_new_public_tables.sql"].includes(file)) {
      assert.match(sql, /table_schema\s*=\s*'public'/i);
      assert.match(sql, /table_name\s*<>\s*'schema_migrations'/i);
      assert.match(sql, /ENABLE ROW LEVEL SECURITY/i);
      for (const name of tables.keys()) if (name !== "schema_migrations") tables.set(name, true);
    }
    for (const match of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?([\w.]+)\s+enable\s+row\s+level\s+security/gi)) {
      const name = match[1].replace(/^public\./i, "");
      if (tables.has(name)) tables.set(name, true);
    }
  }
  assert.equal(tables.size, 57, "Review inventory when tables are added or removed");
  assert.deepEqual([...tables].filter(([, enabled]) => !enabled).map(([name]) => name), []);
});
