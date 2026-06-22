-- Pattern Recognition Agent: vector store for "learn from people who came before you"
--
-- Replaces the previous Pinecone integration. The Python backend's
-- PatternRecognitionAgent generates 1536-dim OpenAI embeddings
-- (text-embedding-ada-002) from each user's profile + barriers + goals and
-- stores them here so future onboarding runs can do top-K similarity search
-- against past users' journeys.
--
-- This table is intentionally separate from `user_embeddings`:
--   - `user_embeddings` (servicehub-mvp) is 384-dim and powers resource matching
--   - `pattern_user_embeddings` (this file) is 1536-dim and powers similar-user
--     pattern discovery in the multi-agent path-planning flow
--
-- Run this once in the Supabase SQL editor.

-- 1. Make sure pgvector is enabled (no-op if already enabled by servicehub schema)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Table
CREATE TABLE IF NOT EXISTS public.pattern_user_embeddings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE,
  embedding        VECTOR(1536) NOT NULL,
  barriers         TEXT[]      NOT NULL DEFAULT '{}',
  goals            TEXT[]      NOT NULL DEFAULT '{}',
  success_rate     REAL        NOT NULL DEFAULT 0.5,
  journey          TEXT        NOT NULL DEFAULT '',
  motivation_type  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS: backend writes use the service-role key, so RLS stays enabled with
-- no policies. This matches `recommendation_memory` and blocks anon access.
ALTER TABLE public.pattern_user_embeddings ENABLE ROW LEVEL SECURITY;

-- 4. Cosine-similarity index. ivfflat needs data to build well; if the table
-- is empty when you run this it will still create but won't be useful until
-- you have a few hundred rows. Re-run REINDEX later if needed.
CREATE INDEX IF NOT EXISTS pattern_user_embeddings_embedding_idx
  ON public.pattern_user_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 5. RPC: top-K similar users with optional barrier filtering.
-- `barriers_filter` semantic: array overlap (`&&`) — return users that share
-- AT LEAST ONE barrier with the query. Pass NULL to disable the filter.
CREATE OR REPLACE FUNCTION public.find_similar_pattern_users(
  query_embedding   VECTOR(1536),
  match_threshold   FLOAT  DEFAULT 0.7,
  match_count       INT    DEFAULT 10,
  barriers_filter   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  user_id         UUID,
  similarity      FLOAT,
  barriers        TEXT[],
  goals           TEXT[],
  success_rate    REAL,
  journey         TEXT,
  motivation_type TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    p.user_id,
    1 - (p.embedding <=> query_embedding) AS similarity,
    p.barriers,
    p.goals,
    p.success_rate,
    p.journey,
    p.motivation_type
  FROM public.pattern_user_embeddings p
  WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    AND (barriers_filter IS NULL OR p.barriers && barriers_filter)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;
