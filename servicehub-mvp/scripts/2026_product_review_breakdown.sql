-- ============================================================================
-- Give product reviews the same depth as service ratings (Odosa).
--
-- "Add rating breakdown & community reviews & pattern insights & 'Based on
-- those who matched your Diagnostics profile' from services here."
--
-- public.ratings already carries a snapshot of who the rater was at rating
-- time — their diagnostics, their relationship to each norm, their
-- organisations. That snapshot is what makes the nested breakdown possible at
-- all: RLS blocks reading another user's profile at render time, so the facts
-- have to be written down when the rating is made.
--
-- product_reviews had none of it — only (rating, comment). These columns mirror
-- ratings exactly so the same breakdown component can render for a product.
--
-- Idempotent. Requires 2026_shop_products.sql.
-- ============================================================================

ALTER TABLE public.product_reviews
  -- { barrier_type: severity 1-5 } for the reviewer, e.g. {"autism": 3}
  ADD COLUMN IF NOT EXISTS rater_diagnostics JSONB NOT NULL DEFAULT '{}',
  -- { barrier_type: 'lived' | 'direct_support' | 'indirect_support' | 'ally' }
  -- Only DECLARED relationships are recorded, so an undeclared reviewer is
  -- weighted as lived (safe) but never badged as such.
  ADD COLUMN IF NOT EXISTS rater_relationships JSONB NOT NULL DEFAULT '{}',
  -- Organisations the reviewer belonged to when they reviewed. Snapshot
  -- semantics on purpose: leaving an org later does not rewrite history.
  ADD COLUMN IF NOT EXISTS rater_org_ids UUID[] NOT NULL DEFAULT '{}',
  -- Per-norm scores, e.g. {"sensory": 5, "mobility": 4} — the product
  -- equivalent of ratings.barrier_scores.
  ADD COLUMN IF NOT EXISTS barrier_scores JSONB NOT NULL DEFAULT '{}',
  -- Marked helpful by other people, same as ratings.helpful_count.
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;

-- "Reviews from members of org X" stays fast as volume grows.
CREATE INDEX IF NOT EXISTS product_reviews_rater_org_ids_idx
  ON public.product_reviews USING GIN (rater_org_ids);

-- Product reviews were readable but not writable: there was no INSERT policy
-- and no write route at all, which is why rating a product was impossible.
-- 2026_shop_products.sql created a FOR ALL owner policy; re-assert it here so
-- this file is sufficient on its own.
DROP POLICY IF EXISTS product_reviews_write ON public.product_reviews;
CREATE POLICY product_reviews_write ON public.product_reviews
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

COMMENT ON COLUMN public.product_reviews.rater_diagnostics IS
  'Snapshot of { barrier_type: severity } for the reviewer at review time. Powers the diagnostics breakdown without cross-user reads.';
