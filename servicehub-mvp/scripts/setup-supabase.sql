-- ServiceHub MVP - Complete Database Setup
-- Run this in Supabase SQL Editor after enabling pgvector extension

-- Step 1: Enable pgvector (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Run schema.sql contents
-- (Copy contents from lib/supabase/schema.sql here)

-- Step 3: Run vector-functions.sql contents  
-- (Copy contents from lib/supabase/vector-functions.sql here)

-- This file is just a reminder - actually use the separate SQL files
-- for better organization and easier troubleshooting.
