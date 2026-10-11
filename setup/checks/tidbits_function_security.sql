-- =====================================================================
-- Read-only check: how the Tidbits database functions are defined in THIS
-- database (paste into the Supabase SQL editor and run).
--
-- It only reads the system catalogs, in a single SELECT. It creates, changes
-- and writes nothing, and runs the same way any number of times.
--
-- Why: community_accept_answer and community_cast_vote, as written in the
-- repo, run with the owner's rights (SECURITY DEFINER), are executable by
-- every signed-in user, and act for a user id passed in as an argument
-- rather than the caller's own (auth.uid()). On a local copy of the repo's
-- SQL, one user could accept an answer and vote as another. Whether
-- production has the same definitions is NOT YET VERIFIED; this answers it.
--
-- One row per function. Columns:
--   security_definer        true: runs with the owner's rights, so RLS
--                           does not limit it
--   user_id_arguments       arguments that name a person (p_acting_user_id,
--                           p_voter_id, p_user_id, ...)
--   reads_auth_uid          the body calls auth.uid(), the caller's own id
--   acts_for_passed_in_id   SECURITY DEFINER, takes a person's id, and
--                           never reads auth.uid(): whoever can execute it
--                           can act for anyone
--   passed_id_only_for_server  the fixed versions (STEP 58 and 59): the id
--                           passed in counts only when auth.role() is
--                           'service_role'
--   anon_can_execute / authenticated_can_execute
--   execute_granted_to      every role with EXECUTE, including PUBLIC
--
-- Reading it: the two functions at the top are the ones in question. If
-- either shows acts_for_passed_in_id = true and
-- authenticated_can_execute = true, the hole is live in this database. If
-- anon_can_execute is also true, it is open to signed-out callers too.
-- Postgres gives PUBLIC EXECUTE on a new function unless it is revoked, and
-- the repo's Tidbits SQL never revokes it: on a local copy, anon could
-- execute both.
--
-- A flag says a function acts for an id passed in; whether that matters
-- depends on what it does. community_award_threshold_badges is flagged too,
-- but it only grants the named person badges they have already earned.
-- =====================================================================

WITH fn AS (
  SELECT p.oid,
         p.proname                                AS name,
         pg_get_function_identity_arguments(p.oid) AS arguments,
         p.prosecdef                              AS security_definer,
         pg_get_userbyid(p.proowner)              AS owner,
         p.proowner,
         p.proacl,
         p.proconfig,
         p.prosrc                                 AS body,
         coalesce(p.proargnames, '{}')            AS argnames
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND (p.proname LIKE 'community\_%' OR p.proname = 'is_admin')
),
id_args AS (
  SELECT f.oid,
         string_agg(a.name, ', ' ORDER BY a.ord) AS names
    FROM fn AS f
   CROSS JOIN LATERAL unnest(f.argnames) WITH ORDINALITY AS a(name, ord)
   WHERE a.name ~* '(acting|actor|voter|user_id|_uid$)'
   GROUP BY f.oid
),
grants AS (
  SELECT f.oid,
         string_agg(DISTINCT CASE WHEN g.grantee = 0 THEN 'PUBLIC'
                                  ELSE pg_get_userbyid(g.grantee) END, ', ') AS roles
    FROM fn AS f
   CROSS JOIN LATERAL aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) AS g
   WHERE g.privilege_type = 'EXECUTE'
   GROUP BY f.oid
)
SELECT f.name,
       f.arguments,
       f.security_definer,
       coalesce(i.names, '')                                   AS user_id_arguments,
       f.body ~* 'auth\.uid\(\)'                               AS reads_auth_uid,
       (f.security_definer AND i.names IS NOT NULL
        AND f.body !~* 'auth\.uid\(\)')                        AS acts_for_passed_in_id,
       (f.body ~* 'auth\.role\(\)' AND f.body ~* 'service_role') AS passed_id_only_for_server,
       has_function_privilege('anon', f.oid, 'EXECUTE')          AS anon_can_execute,
       has_function_privilege('authenticated', f.oid, 'EXECUTE') AS authenticated_can_execute,
       g.roles                                                  AS execute_granted_to,
       f.owner,
       coalesce(array_to_string(f.proconfig, ', '), '')         AS settings
  FROM fn AS f
  LEFT JOIN id_args AS i ON i.oid = f.oid
  LEFT JOIN grants  AS g ON g.oid = f.oid
 ORDER BY (f.name IN ('community_accept_answer', 'community_cast_vote')) DESC, f.name;
