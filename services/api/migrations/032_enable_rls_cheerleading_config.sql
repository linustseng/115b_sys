-- 032_enable_rls_cheerleading_config.sql
-- 028 created this API-owned table after the blanket RLS sweep in 024.
-- Intentionally no client policies: the Node API uses direct Postgres access.
-- Preflight: confirm no existing policies and that the API role owns this
-- table (without FORCE RLS), is superuser, or has BYPASSRLS.
-- Do not use IF EXISTS: a missing 028 table must fail, not record false success.
ALTER TABLE public.cheerleading_config ENABLE ROW LEVEL SECURITY;
