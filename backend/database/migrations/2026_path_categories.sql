-- Path Market life categories — moved out of hardcoded page.tsx into editable
-- DB rows (Odosa: "can we not make anything here hardcoded"). The page now
-- fetches these instead of shipping them in code; community path_models still
-- merge on top by category_key. `icon` is a Lucide icon NAME mapped to a
-- component client-side (we can't store a component). Idempotent: safe to run
-- repeatedly; the seed uses ON CONFLICT DO NOTHING so edits in the DB stick.

CREATE TABLE IF NOT EXISTS public.path_categories (
  key                     TEXT PRIMARY KEY,
  title                   TEXT NOT NULL,
  blurb                   TEXT NOT NULL,
  icon                    TEXT NOT NULL DEFAULT 'Sparkles',
  tint                    TEXT NOT NULL DEFAULT 'from-slate-50 to-white border-slate-200',
  icon_tint               TEXT NOT NULL DEFAULT 'bg-slate-100 text-slate-600',
  focus_category          TEXT NOT NULL DEFAULT 'other',
  examples                JSONB NOT NULL DEFAULT '[]',
  foundations_description TEXT,
  foundations_seed_goals  JSONB NOT NULL DEFAULT '[]',
  foundations_status      TEXT NOT NULL DEFAULT 'live',   -- 'live' | 'coming'
  sort_order              INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS path_categories_sort_idx ON public.path_categories (sort_order);

ALTER TABLE public.path_categories ENABLE ROW LEVEL SECURITY;

-- Categories are a public browse taxonomy: readable by everyone. Editing is
-- done via the service-role admin path (bypasses RLS), so no write policy here.
DROP POLICY IF EXISTS path_categories_read ON public.path_categories;
CREATE POLICY path_categories_read ON public.path_categories
  FOR SELECT USING (true);

-- ---- Seed the current 8 categories as editable data (not code) --------------
INSERT INTO public.path_categories
  (key, title, blurb, icon, tint, icon_tint, focus_category, examples, foundations_description, foundations_seed_goals, foundations_status, sort_order)
VALUES
  ('med-sci', 'Medicine & Science',
   'Pursue a path in healthcare, research, or the sciences with accommodations built in.',
   'Stethoscope', 'from-sky-50 to-white border-sky-200', 'bg-sky-100 text-sky-600', 'education',
   '["Pre-med prerequisites","Research assistant roles","Lab / clinical skills","Grad-school applications"]',
   'The general route into science/medicine — prerequisites, research, and applications.',
   '["Get into a science/medicine program","Build research experience"]', 'live', 1),

  ('living', 'Independent Living',
   'Build the skills and supports to live on your own terms — home, money, and daily routines.',
   'Home', 'from-emerald-50 to-white border-emerald-200', 'bg-emerald-100 text-emerald-600', 'other',
   '["Budgeting & finances","Housing & tenancy","Meal planning & cooking","Daily-living routines"]',
   'A grounded start on money, housing, and daily routines for living independently.',
   '["Live independently","Manage my own budget"]', 'live', 2),

  ('career', 'Career & Workplace',
   'Land and thrive in a job that fits you — including disclosure and accommodations.',
   'Briefcase', 'from-amber-50 to-white border-amber-200', 'bg-amber-100 text-amber-600', 'career',
   '["Resume & interviews","Accommodation requests","Workplace social norms","Career growth"]',
   'Find work that fits, request accommodations, and grow — the general path.',
   '["Get a fulfilling job","Request workplace accommodations"]', 'live', 3),

  ('education', 'Education',
   'Navigate school, college, or trade programs with the right supports at each step.',
   'GraduationCap', 'from-indigo-50 to-white border-indigo-200', 'bg-indigo-100 text-indigo-600', 'education',
   '["Accommodations at school","Study strategies","Applications & funding","Graduation planning"]',
   'Get set up with accommodations and study supports through to graduation.',
   '["Graduate from my program","Set up school accommodations"]', 'live', 4),

  ('health', 'Health & Wellness',
   'Support your physical and mental health with routines, care, and self-advocacy.',
   'HeartPulse', 'from-rose-50 to-white border-rose-200', 'bg-rose-100 text-rose-600', 'health',
   '["Finding the right care","Managing appointments","Wellness routines","Self-advocacy in healthcare"]',
   'Build wellness routines and find care that works — the general path.',
   '["Build a wellness routine","Find supportive healthcare"]', 'live', 5),

  ('relationships', 'Relationships & Community',
   'Build and keep meaningful connections — friends, family, and community.',
   'Users', 'from-purple-50 to-white border-purple-200', 'bg-purple-100 text-purple-600', 'relationships',
   '["Making friends","Communication skills","Joining communities","Navigating family"]',
   'Grow a support network and communication skills at your own pace.',
   '["Build a support network","Improve my communication"]', 'live', 6),

  ('creative', 'Creative & Hobbies',
   'Turn interests into skills or income — art, music, making, and more.',
   'Palette', 'from-fuchsia-50 to-white border-fuchsia-200', 'bg-fuchsia-100 text-fuchsia-600', 'other',
   '["Develop a craft","Share your work","Find creative community","Monetize a hobby"]',
   'Grow a creative skill and share it — the general path.',
   '["Grow a creative skill"]', 'coming', 7),

  ('travel', 'Travel & Independence',
   'Plan sensory-aware travel and build confidence getting around.',
   'Plane', 'from-cyan-50 to-white border-cyan-200', 'bg-cyan-100 text-cyan-600', 'other',
   '["Sensory-friendly trip planning","Public transit confidence","Travel checklists","Accessible destinations"]',
   'Plan sensory-aware travel and build transit confidence.',
   '["Plan a trip","Get comfortable with transit"]', 'coming', 8)
ON CONFLICT (key) DO NOTHING;
