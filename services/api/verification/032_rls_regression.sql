-- STAGING / DISPOSABLE DATABASE ONLY. Run AFTER migrations through 032.
-- psql -X -v ON_ERROR_STOP=1 -f services/api/verification/032_rls_regression.sql
-- Connect as the target's owner/superuser with SET ROLE permissions.
-- All fixtures and temporary grants roll back, including on failure when psql disconnects.
-- Do not run concurrently with live traffic; table GRANT takes a lock.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='cheerleading_config'
      AND c.relrowsecurity AND NOT c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'Target missing or unexpected RLS state'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cheerleading_config')
    THEN RAISE EXCEPTION 'Unexpected policies: review drift before testing'; END IF;
END $$;
-- Exercise owner reads/upsert before testing clients. No FORCE RLS is added.
INSERT INTO public.cheerleading_config(id, raw, updated_at)
VALUES ('__032_rls_fixture__', '{"probe":1}', 'test')
ON CONFLICT(id) DO UPDATE SET raw=excluded.raw, updated_at=excluded.updated_at;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cheerleading_config
    WHERE id='__032_rls_fixture__' AND raw='{"probe":1}'::jsonb)
  THEN RAISE EXCEPTION 'Privileged upsert/read failed'; END IF;
END $$;
-- Deliberately grant CRUD so ACL denial cannot masquerade as RLS protection.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cheerleading_config TO anon, authenticated;

SET LOCAL ROLE anon;
DO $$
DECLARE affected integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cheerleading_config)
    THEN RAISE EXCEPTION 'anon: SELECT leaked rows'; END IF;
  UPDATE public.cheerleading_config SET raw='{"probe":2}' WHERE id='__032_rls_fixture__';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'anon: UPDATE modified rows'; END IF;
  DELETE FROM public.cheerleading_config WHERE id='__032_rls_fixture__';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'anon: DELETE modified rows'; END IF;
  BEGIN
    INSERT INTO public.cheerleading_config(id,raw) VALUES ('__032_anon_insert__','{}');
    RAISE EXCEPTION 'anon: INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    -- With explicit CRUD grants, SQLSTATE 42501 comes from the RLS WITH CHECK.
    NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE affected integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cheerleading_config)
    THEN RAISE EXCEPTION 'authenticated: SELECT leaked rows'; END IF;
  UPDATE public.cheerleading_config SET raw='{"probe":2}' WHERE id='__032_rls_fixture__';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'authenticated: UPDATE modified rows'; END IF;
  DELETE FROM public.cheerleading_config WHERE id='__032_rls_fixture__';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'authenticated: DELETE modified rows'; END IF;
  BEGIN
    INSERT INTO public.cheerleading_config(id,raw) VALUES ('__032_authenticated_insert__','{}');
    RAISE EXCEPTION 'authenticated: INSERT unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    -- With explicit CRUD grants, SQLSTATE 42501 comes from the RLS WITH CHECK.
    NULL;
  END;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cheerleading_config
    WHERE id='__032_rls_fixture__' AND raw='{"probe":1}'::jsonb)
  THEN RAISE EXCEPTION 'Fixture changed after client probes'; END IF;
END $$;
ROLLBACK;
