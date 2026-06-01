-- ServiceHub MVP - Verify Database Setup
-- Run this in Supabase SQL Editor to verify everything is set up correctly

-- Check if pgvector is enabled
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'vector';

-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'profiles',
    'user_barriers',
    'resources',
    'ratings',
    'saved_resources',
    'moderation_queue',
    'user_embeddings',
    'resource_embeddings'
  )
ORDER BY table_name;

-- Check if all functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'find_similar_users',
    'find_similar_resources',
    'search_resources_semantic',
    'search_resources_description_semantic',
    'find_resources_for_user'
  )
ORDER BY routine_name;

-- Check RLS policies are enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles',
    'user_barriers',
    'resources',
    'ratings',
    'saved_resources',
    'moderation_queue',
    'user_embeddings',
    'resource_embeddings'
  );

-- Expected output:
-- ✅ vector extension should show installed_version
-- ✅ All 8 tables should be listed
-- ✅ All 5 functions should be listed
-- ✅ All tables should have rowsecurity = true
