-- 017_enable_rls_public_tables.sql
-- Lock down Supabase-exposed tables. Backend uses direct Postgres access, so
-- enabling RLS here blocks anonymous/public access without changing app flows.

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
