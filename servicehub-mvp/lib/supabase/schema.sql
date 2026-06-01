-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- users (extended from Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user', -- 'user', 'admin', 'self_advocate', 'parent', 'caregiver'
  location JSONB, -- {city, province, postal_code}
  is_rater BOOLEAN DEFAULT FALSE, -- Whether this user is authorized to rate resources
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- barriers (what challenges users face)
CREATE TABLE IF NOT EXISTS public.user_barriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  barrier_category TEXT NOT NULL, -- 'neurodivergence', 'disability', 'race', 'ethnicity', 'language', 'gender', 'sexual_orientation', 'socioeconomic', 'health'
  barrier_type TEXT NOT NULL, -- specific type: 'autism', 'ADHD', 'OCD', 'bipolar', 'deaf', 'blind', 'wheelchair_user', 'visible_minority', 'LGBTQ', etc.
  severity INTEGER CHECK (severity >= 1 AND severity <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- resources (services, places, products, etc.)
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'therapist', 'school', 'doctor', 'park', 'store', 'app', 'book', etc.
  location JSONB, -- {address, city, province, postal_code, lat, lng}
  contact_info JSONB, -- {phone, email, website}
  image_url TEXT,
  price DECIMAL(10, 2), -- Price in dollars (NULL for free resources or if price not applicable)
  submitted_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ratings (community reviews)
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  overall_score INTEGER CHECK (overall_score >= 1 AND overall_score <= 5),
  barrier_scores JSONB, -- {sensory: 5, mobility: 4, ...}
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, user_id)
);

-- saved resources (wishlist, current, past)
CREATE TABLE IF NOT EXISTS public.saved_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'current', 'past')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);

CREATE INDEX IF NOT EXISTS saved_resources_status_idx ON public.saved_resources(user_id, status);

-- moderation queue
CREATE TABLE IF NOT EXISTS public.moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL, -- 'resource', 'rating'
  item_id UUID NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- ✨ VECTOR DATABASE TABLES (FREE with pgvector!)
-- User embeddings for similarity matching
CREATE TABLE IF NOT EXISTS public.user_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  embedding VECTOR(384), -- 384-dimensional vector (using free sentence-transformers)
  barrier_embedding VECTOR(384), -- Embedding based on barrier profile
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resource embeddings for semantic search
CREATE TABLE IF NOT EXISTS public.resource_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE UNIQUE,
  embedding VECTOR(384), -- Full resource embedding (name + description + category)
  description_embedding VECTOR(384), -- Just description for detailed matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast vector similarity search
-- Note: For empty tables, we skip index creation. Vector indexes are most useful after data is populated.
-- You can create these indexes later using one of the following approaches:
--
-- Option 1: GIST indexes (work on empty tables, slower but more accurate):
--   CREATE INDEX user_embeddings_embedding_idx ON public.user_embeddings USING GIST (embedding vector_l2_ops);
--
-- Option 2: IVFFlat indexes (require data, faster, use cosine distance):
--   CREATE INDEX user_embeddings_embedding_idx ON public.user_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
--
-- For now, we skip index creation to allow schema.sql to run successfully on empty databases.
-- Indexes can be created manually or via a migration script after data is populated.

-- Create regular indexes for common queries
CREATE INDEX IF NOT EXISTS resources_status_idx ON public.resources(status);
CREATE INDEX IF NOT EXISTS resources_category_idx ON public.resources(category);
CREATE INDEX IF NOT EXISTS ratings_resource_id_idx ON public.ratings(resource_id);
CREATE INDEX IF NOT EXISTS ratings_user_id_idx ON public.ratings(user_id);
CREATE INDEX IF NOT EXISTS user_barriers_user_id_idx ON public.user_barriers(user_id);

-- Notifications (user notifications) - Create before enabling RLS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'resource_approved', 'resource_rejected', 'rating_helpful', 'new_rating', 'resource_saved_new_rating'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications(read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at DESC);

-- Pattern discoveries (agent-discovered patterns)
CREATE TABLE IF NOT EXISTS public.pattern_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'barrier_combination', 'resource_affinity', 'intersectionality', 'non_obvious'
  pattern JSONB NOT NULL, -- Pattern data
  frequency INTEGER NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  insight TEXT NOT NULL,
  scope TEXT DEFAULT 'global', -- 'global', 'category', 'location'
  category TEXT,
  location TEXT,
  metadata JSONB, -- {novelty_score, actionability_score, support_count, etc.}
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Patterns may become stale
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for pattern queries
CREATE INDEX IF NOT EXISTS pattern_discoveries_type_idx ON public.pattern_discoveries(type);
CREATE INDEX IF NOT EXISTS pattern_discoveries_scope_idx ON public.pattern_discoveries(scope);
CREATE INDEX IF NOT EXISTS pattern_discoveries_category_idx ON public.pattern_discoveries(category);
CREATE INDEX IF NOT EXISTS pattern_discoveries_confidence_idx ON public.pattern_discoveries(confidence DESC);
CREATE INDEX IF NOT EXISTS pattern_discoveries_discovered_at_idx ON public.pattern_discoveries(discovered_at DESC);

-- Unique constraint on insight so upserts (onConflict: 'insight') dedupe correctly
CREATE UNIQUE INDEX IF NOT EXISTS pattern_discoveries_insight_key
  ON public.pattern_discoveries(insight);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_barriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_discoveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can read their own data, admins can read all)
-- Drop existing policies first so this script is safe to re-run (CREATE POLICY has no IF NOT EXISTS)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own barriers" ON public.user_barriers;
DROP POLICY IF EXISTS "Users can manage own barriers" ON public.user_barriers;
DROP POLICY IF EXISTS "Anyone can view approved resources" ON public.resources;
DROP POLICY IF EXISTS "Authenticated users can create resources" ON public.resources;
DROP POLICY IF EXISTS "Users can update own submitted resources" ON public.resources;
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can manage own saved resources" ON public.saved_resources;
DROP POLICY IF EXISTS "Only admins can view moderation queue" ON public.moderation_queue;
DROP POLICY IF EXISTS "Users can view own embeddings" ON public.user_embeddings;
DROP POLICY IF EXISTS "Users can manage own embeddings" ON public.user_embeddings;
DROP POLICY IF EXISTS "Anyone can view resource embeddings" ON public.resource_embeddings;
DROP POLICY IF EXISTS "Anyone can view pattern discoveries" ON public.pattern_discoveries;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Profiles: Users can read their own profile, update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User barriers: Users can manage their own barriers
CREATE POLICY "Users can view own barriers" ON public.user_barriers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own barriers" ON public.user_barriers
  FOR ALL USING (auth.uid() = user_id);

-- Resources: Everyone can read approved resources, users can create resources
CREATE POLICY "Anyone can view approved resources" ON public.resources
  FOR SELECT USING (status = 'approved' OR submitted_by = auth.uid());

CREATE POLICY "Authenticated users can create resources" ON public.resources
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update own submitted resources" ON public.resources
  FOR UPDATE USING (submitted_by = auth.uid());

-- Ratings: Everyone can read ratings, authenticated users can create/update own ratings
CREATE POLICY "Anyone can view ratings" ON public.ratings
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ratings" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings" ON public.ratings
  FOR UPDATE USING (auth.uid() = user_id);

-- Saved resources: Users can manage their own saved resources
CREATE POLICY "Users can manage own saved resources" ON public.saved_resources
  FOR ALL USING (auth.uid() = user_id);

-- Moderation queue: Only admins can access (add admin check in application logic)
CREATE POLICY "Only admins can view moderation queue" ON public.moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- User embeddings: Users can view their own embeddings
CREATE POLICY "Users can view own embeddings" ON public.user_embeddings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own embeddings" ON public.user_embeddings
  FOR ALL USING (auth.uid() = user_id);

-- Resource embeddings: Everyone can read for similarity search
CREATE POLICY "Anyone can view resource embeddings" ON public.resource_embeddings
  FOR SELECT USING (true);

-- Everyone can view pattern discoveries
CREATE POLICY "Anyone can view pattern discoveries" ON public.pattern_discoveries
  FOR SELECT USING (true);

-- Notifications: Users can only view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);
