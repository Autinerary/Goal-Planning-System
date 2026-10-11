-- =====================================================================
-- Tidbits votes: the caller votes as themselves (STEP 59)
--
-- community_cast_vote(p_voter_id, ...) is SECURITY DEFINER, executable by
-- any signed-in person, and recorded the vote as whoever p_voter_id named.
-- So anyone could call it directly and vote as anyone else, once for every
-- account id they know (author ids show on every post). Shown on a local
-- Postgres with the repo's SQL on 8 Oct 2026; not yet verified against
-- production.
--
-- Now the vote is the signed-in caller's. p_voter_id counts only when the
-- server calls with the service-role key, which is how the vote routes call
-- it, so they keep working unchanged. Same signature, so grants stay.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.community_cast_vote(
    p_voter_id     UUID,
    p_target_type  TEXT,
    p_target_id    UUID,
    p_value        SMALLINT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_author UUID;
    -- Who is voting: the signed-in caller. p_voter_id counts only when the
    -- server calls with the service-role key, as the vote routes do.
    v_voter         UUID := CASE WHEN auth.role() = 'service_role'
                                 THEN p_voter_id ELSE auth.uid() END;
BEGIN
    IF v_voter IS NULL THEN
        RAISE EXCEPTION 'Sign-in required' USING ERRCODE = '28000';
    END IF;
    IF p_value NOT IN (-1, 0, 1) THEN
        RAISE EXCEPTION 'Vote value must be -1, 0, or 1';
    END IF;

    -- Identify the target author so we can block self-votes early.
    IF p_target_type = 'post' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_posts WHERE id = p_target_id;
    ELSIF p_target_type = 'answer' THEN
        SELECT author_id INTO v_target_author
          FROM public.community_answers WHERE id = p_target_id;
    ELSE
        RAISE EXCEPTION 'Invalid target_type %', p_target_type;
    END IF;
    IF v_target_author IS NULL THEN
        RAISE EXCEPTION 'Vote target not found';
    END IF;
    IF v_target_author = v_voter THEN
        -- Silent no-op: self-votes are a UX dead-end, not an error.
        RETURN;
    END IF;

    -- Upsert: 0 = retract the vote, +/-1 = set it.
    IF p_value = 0 THEN
        DELETE FROM public.community_votes
         WHERE voter_id = v_voter
           AND target_type = p_target_type
           AND target_id = p_target_id;
    ELSE
        INSERT INTO public.community_votes (voter_id, target_type, target_id, value)
        VALUES (v_voter, p_target_type, p_target_id, p_value)
        ON CONFLICT (voter_id, target_type, target_id)
        DO UPDATE SET value = EXCLUDED.value, created_at = now();
    END IF;
END;
$$;
