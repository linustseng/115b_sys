-- 025_enable_rls_schema_migrations.sql
-- Supabase Security Advisor checks every base table in public, including the
-- app's migration ledger. It is only used by backend migration code.

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
