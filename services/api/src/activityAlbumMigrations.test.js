import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("031 reasserts private bucket/RLS after already-applied 029/030 without changing other buckets", async () => {
  const [schema, rls, hardening] = await Promise.all([
    readFile(new URL("../migrations/029_activity_albums.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/030_activity_albums_rls.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/031_activity_albums_deployment_hardening.sql", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /values \('activity-albums', 'activity-albums', false, 15728640, array\['image\/jpeg', 'image\/png'\]\)/i);
  assert.match(schema, /alter table activity_albums enable row level security/i);
  assert.match(schema, /alter table activity_photos enable row level security/i);
  assert.match(schema, /alter table storage\.objects enable row level security/i);
  assert.match(rls, /update storage\.buckets set public = false/i);
  assert.match(hardening, /on conflict \(id\) do update set[\s\S]*public = false/i);
  assert.match(hardening, /file_size_limit = 15728640/i);
  assert.match(hardening, /array\['image\/jpeg', 'image\/png'\]/i);
  assert.match(hardening, /alter table activity_album_upload_attempts enable row level security/i);
  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(hardening, new RegExp(`activity_albums_block_client_${operation}[\\s\\S]*?to anon, authenticated[\\s\\S]*?bucket_id <> 'activity-albums'`, "i"));
  }
  assert.match(hardening, /as restrictive/i);
  assert.match(hardening, /bucket_id <> 'activity-albums'/i, "storage protection is bucket-scoped rather than a global policy removal");
});
