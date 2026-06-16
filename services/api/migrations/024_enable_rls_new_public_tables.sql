-- 024_enable_rls_new_public_tables.sql
-- Keep tables created after 017 locked down from Supabase anon/public access.
-- The app backend uses direct Postgres access, so these RLS gates protect the
-- public API surface without changing server-side flows.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'schema_migrations'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.table_schema, r.table_name);
  END LOOP;
END $$;
