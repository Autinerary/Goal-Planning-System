-- =====================================================================
-- Tidbits badges say what earns them (STEP 63)
--
-- Riipen Labs, Group 34 found karma and up-votes unexplained. Tidbits now
-- calls karma "helpful points" and explains the rule (up-votes minus
-- down-votes, plus 15 for each accepted answer). Two badge descriptions
-- disagreed with how they are earned: "Helpful" said "Received 5 upvotes on
-- an answer" but is granted at 25 points, and "Community Pillar" said
-- "karma". Only these two rows change, and only while they still have the
-- old wording. The app works before this is applied: the old text shows.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

UPDATE public.community_badges
   SET description = 'Reached 25 helpful points'
 WHERE slug = 'helpful' AND description = 'Received 5 upvotes on an answer';

UPDATE public.community_badges
   SET description = 'Reached 1,000 helpful points'
 WHERE slug = 'community_pillar' AND description = 'Reached 1000 karma';
