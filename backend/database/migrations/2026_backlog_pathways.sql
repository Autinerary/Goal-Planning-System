-- ============================================================================
-- New pathway categories from Odosa's feature list, and the "Model Jet"
-- named path model.
--
-- Category shells only (title/blurb/icon), matching the existing pattern for
-- 'creative' and 'travel' in 2026_path_categories.sql — status 'coming'
-- rather than 'live'. This is deliberately NOT full curricula: writing a
-- confident-looking 4-step program for something like addiction recovery
-- without real clinical input would be actively harmful misinformation, not
-- a shortcut. The category exists so it's visible and requestable; the real
-- milestones need the team's actual expertise before they go live.
--
-- Idempotent — ON CONFLICT DO NOTHING, so this never overwrites edits already
-- made in the dashboard.
-- ============================================================================

INSERT INTO public.path_categories
  (key, title, blurb, icon, tint, icon_tint, focus_category, examples, foundations_description, foundations_seed_goals, foundations_status, sort_order)
VALUES
  ('adulting', 'Adulting for Neurodivergent Adults',
   'The everyday logistics school never taught — bills, appointments, and keeping a routine that actually holds.',
   'ListChecks', 'from-teal-50 to-white border-teal-200', 'bg-teal-100 text-teal-600', 'other',
   '["Managing bills & subscriptions","Booking your own appointments","Building a routine that sticks","Grocery & meal logistics"]',
   NULL, '[]', 'coming', 9),

  ('recovery', 'Addiction & Recovery',
   'Support for recovery, at your own pace, alongside whatever else you are working on.',
   'LifeBuoy', 'from-slate-50 to-white border-slate-200', 'bg-slate-100 text-slate-600', 'health',
   '["Finding the right support","Managing triggers","Rebuilding routines","Staying connected"]',
   NULL, '[]', 'coming', 10),

  ('nutrition', 'Healthy Eating',
   'Building a relationship with food that works for your body, your budget, and your executive function.',
   'Apple', 'from-lime-50 to-white border-lime-200', 'bg-lime-100 text-lime-600', 'health',
   '["Meal planning that survives a bad week","Sensory-friendly food swaps","Budget-friendly nutrition","Eating on a routine"]',
   NULL, '[]', 'coming', 11),

  ('veganism', 'Plant-Based Living',
   'Going vegan or plant-based without it becoming one more thing to burn out on.',
   'Leaf', 'from-green-50 to-white border-green-200', 'bg-green-100 text-green-600', 'health',
   '["Getting started without overhauling everything","Nutrition basics","Easy staple meals","Finding community"]',
   NULL, '[]', 'coming', 12),

  ('entrepreneurship', 'Entrepreneurship & ADHD/Neurodivergence',
   'Building something of your own in a way that works with your brain, not against it.',
   'Rocket', 'from-orange-50 to-white border-orange-200', 'bg-orange-100 text-orange-600', 'career',
   '["Turning a hyperfocus into a business","Systems for the parts you avoid","Finding accountability","Pricing & admin without dread"]',
   NULL, '[]', 'coming', 13),

  ('public-health', 'Public Health & Healthcare Careers',
   'Undergrad vs. medical school, nursing vs. becoming a doctor, or public health more broadly — the early decision points.',
   'Stethoscope', 'from-cyan-50 to-white border-cyan-200', 'bg-cyan-100 text-cyan-600', 'education',
   '["Undergrad prerequisites vs. med school track","Nursing vs. MD/DO paths","Public health degrees","Choosing a specialty direction"]',
   NULL, '[]', 'coming', 14)
ON CONFLICT (key) DO NOTHING;

-- ---- "Model Jet" ------------------------------------------------------------
-- Odosa's own named path model for ADHD, OCD & Depression. Inserted as
-- 'pending', NOT 'approved' — the existing path_models workflow already
-- gates visibility on approval (see 2026_path_models.sql RLS: only approved
-- rows are publicly readable). Nothing here goes live until Odosa reviews
-- and either edits or approves it herself; the content below is a neutral,
-- widely-used starting template, not a claim about her personal experience.
-- path_models has no unique constraint on (category_key, name) — it is
-- user-submitted content where two people could reasonably pick the same
-- name, so adding one was not the right fix. Idempotency here comes from an
-- explicit existence check instead of ON CONFLICT.
INSERT INTO public.path_models (category_key, name, contributor, description, seed_goals, status)
SELECT
  'recovery',
  'Model Jet',
  'Odosa (draft — pending her review)',
  'A starting template for managing ADHD, OCD and depression together, rather than as separate tracks. Draft only — needs Odosa''s own milestones and edits before this represents her actual approach.',
  '["Build one routine that covers ADHD, OCD and mood together", "Reduce the friction between the three rather than treating them separately"]',
  'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM public.path_models WHERE name = 'Model Jet' AND category_key = 'recovery'
);
