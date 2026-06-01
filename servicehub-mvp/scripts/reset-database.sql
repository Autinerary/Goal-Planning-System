-- WARNING: This will DROP ALL TABLES and data!
-- Only run this in development/testing environments
-- Use with caution!

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS public.pattern_discoveries CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.resource_embeddings CASCADE;
DROP TABLE IF EXISTS public.user_embeddings CASCADE;
DROP TABLE IF EXISTS public.moderation_queue CASCADE;
DROP TABLE IF EXISTS public.saved_resources CASCADE;
DROP TABLE IF EXISTS public.ratings CASCADE;
DROP TABLE IF EXISTS public.resources CASCADE;
DROP TABLE IF EXISTS public.user_barriers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS find_similar_users(VECTOR(384), FLOAT, INT) CASCADE;
DROP FUNCTION IF EXISTS find_similar_resources(VECTOR(384), INT) CASCADE;
DROP FUNCTION IF EXISTS search_resources_semantic(VECTOR(384), INT, FLOAT) CASCADE;
DROP FUNCTION IF EXISTS search_resources_description_semantic(VECTOR(384), INT, FLOAT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS find_resources_for_user(UUID, INT) CASCADE;

-- Note: This does NOT drop the pgvector extension or auth.users table
-- Run schema.sql after this to recreate everything
