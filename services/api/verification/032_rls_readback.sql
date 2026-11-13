-- Read-only preflight AND post-deployment readback. Never applies a migration.
-- Run against project ltqnycnnblasnlpqgnda via a trusted database console.
-- Run section E separately via the actual API DATABASE_URL (no credentials in logs).
BEGIN READ ONLY;

-- A. Actual public base/partitioned tables: post-deploy expect ZERO rows.
-- Includes tables outside this repository; don't silently auto-alter them.
SELECT n.nspname AS schema_name, c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- B. Repo inventory vs live DB. Expected: all 57 present, RLS true post-deploy.
WITH expected(table_name) AS (VALUES
  ('sync_runs'),
  ('events'),
  ('students'),
  ('registrations'),
  ('checkins'),
  ('directories'),
  ('group_memberships'),
  ('schema_migrations'),
  ('order_plans'),
  ('order_responses'),
  ('finance_category_types'),
  ('finance_roles'),
  ('finance_requests'),
  ('finance_actions'),
  ('fund_events'),
  ('fund_payments'),
  ('softball_config'),
  ('softball_players'),
  ('softball_practices'),
  ('softball_attendance'),
  ('softball_fields'),
  ('softball_gear'),
  ('notifications'),
  ('notification_reads'),
  ('directory_logs'),
  ('admin_users'),
  ('announcements'),
  ('line_bindings'),
  ('agent_audit'),
  ('softball_angel_roster'),
  ('softball_supply_vendors'),
  ('softball_supply_cases'),
  ('academic_sessions'),
  ('makeup_requests'),
  ('session_notes'),
  ('documents'),
  ('document_versions'),
  ('attachments'),
  ('ordering_public_links'),
  ('academic_courses'),
  ('academic_course_sessions'),
  ('academic_course_notes'),
  ('academic_session_tasks'),
  ('audit_change_batches'),
  ('audit_entity_versions'),
  ('audit_events'),
  ('audit_restores'),
  ('cheerleading_practices'),
  ('cheerleading_attendance'),
  ('cheerleading_fields'),
  ('drink_queue_entries'),
  ('quick_links'),
  ('academic_snapshots'),
  ('cheerleading_config'),
  ('activity_albums'),
  ('activity_photos'),
  ('activity_album_upload_attempts')
)
SELECT e.table_name, c.oid IS NOT NULL AS present,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM expected e LEFT JOIN pg_namespace n ON n.nspname = 'public'
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = e.table_name
  AND c.relkind IN ('r', 'p')
ORDER BY e.table_name;

-- C. Target must be present. Repo expects ZERO policies. If any policy exists,
-- STOP before deployment and review it: ENABLE RLS alone does not override allow policies.
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'cheerleading_config' AND c.relkind IN ('r', 'p');
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Direct clients must not own the table or have superuser/BYPASSRLS.
SELECT r.rolname, r.rolsuper, r.rolbypassrls,
       pg_has_role(r.oid, c.relowner, 'USAGE') AS inherits_owner,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS select_grant,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS insert_grant,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS update_grant,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS delete_grant,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS truncate_grant
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname IN ('anon', 'authenticated')
  AND n.nspname = 'public' AND c.relname = 'cheerleading_config';

-- D. Expected applied filename after normal runner deployment.
SELECT id, applied_at FROM public.schema_migrations
WHERE id IN ('024_enable_rls_new_public_tables.sql',
             '025_enable_rls_schema_migrations.sql',
             '028_cheerleading_config.sql',
             '031_activity_albums_deployment_hardening.sql',
             '032_enable_rls_cheerleading_config.sql')
ORDER BY id;
COMMIT;

-- E. Run using the actual API DB connection, not a privileged dashboard role.
-- Expected exactly one row, can_bypass_target_rls=true, DML grants=true.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS effective_role,
       session_user AS login_role, current_schema() AS default_schema;
SELECT current_user AS api_role, r.rolsuper, r.rolbypassrls,
       pg_get_userbyid(c.relowner) AS owner, c.relforcerowsecurity,
       (r.rolsuper OR r.rolbypassrls OR
         (pg_has_role(current_user, c.relowner, 'USAGE') AND NOT c.relforcerowsecurity))
         AS can_bypass_target_rls,
       has_table_privilege(current_user, c.oid, 'SELECT') AS select_grant,
       has_table_privilege(current_user, c.oid, 'INSERT') AS insert_grant,
       has_table_privilege(current_user, c.oid, 'UPDATE') AS update_grant
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname = current_user AND n.nspname = 'public'
  AND c.relname = 'cheerleading_config';
-- The app's unqualified table must resolve to the audited public table.
SELECT to_regclass('cheerleading_config') = to_regclass('public.cheerleading_config')
       AS app_resolves_public_target;
COMMIT;
