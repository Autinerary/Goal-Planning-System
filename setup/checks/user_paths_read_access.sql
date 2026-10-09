-- =====================================================================
-- Read-only check: who can read stored plans straight from the Supabase
-- API, without going through the app's routes (paste into the Supabase SQL
-- editor and run). One SELECT over the system catalogs; it writes nothing.
--
-- Why: stored plans (user_paths.payload) list the other people each plan
-- was matched with. fix/plan-privacy-filter removes them from everything
-- the apps return, but not from direct reads. database/phase_b_shared_data.sql
-- gives the owner ("Owner can read own path") and connected friends
-- ("Friends can read connected path") SELECT on user_paths. With those in
-- place, anyone signed in can query the table with their own session and get
-- the whole stored plan, other people included. user_latest_context also
-- holds other people's ids (retrieved_user_ids). Whether production has
-- these policies is NOT YET VERIFIED; this answers it.
--
-- Rows: each policy on the two tables, then whether anon and authenticated
-- hold SELECT on them (and on user_paths.payload itself).
-- =====================================================================

SELECT 'policy'              AS kind,
       tablename             AS table_name,
       policyname            AS name,
       cmd                   AS command,
       array_to_string(roles, ', ') AS roles,
       qual                  AS using_expression,
       with_check            AS check_expression
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('user_paths', 'user_latest_context')
UNION ALL
SELECT 'privilege',
       t.table_name,
       r.role_name,
       'SELECT',
       r.role_name,
       CASE WHEN has_table_privilege(r.role_name, format('public.%I', t.table_name), 'SELECT')
            THEN 'can select the table' ELSE 'cannot select the table' END,
       CASE WHEN t.table_name = 'user_paths'
            THEN CASE WHEN has_column_privilege(r.role_name, 'public.user_paths', 'payload', 'SELECT')
                      THEN 'can select payload' ELSE 'cannot select payload' END
       END
  FROM (VALUES ('user_paths'), ('user_latest_context')) AS t(table_name)
 CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(role_name)
 WHERE to_regclass(format('public.%I', t.table_name)) IS NOT NULL
 ORDER BY kind, table_name, name;
