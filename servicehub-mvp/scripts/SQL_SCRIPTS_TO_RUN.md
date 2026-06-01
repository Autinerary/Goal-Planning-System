# SQL Scripts to Run in Supabase SQL Editor

This document lists all SQL scripts that need to be executed in the Supabase SQL Editor, in order.

## Required Scripts (Run in Order)

### 1. **Main Database Schema** ⭐ REQUIRED
   **File:** `lib/supabase/schema.sql`
   
   **What it does:**
   - Creates all database tables (profiles, user_barriers, resources, ratings, saved_resources, moderation_queue, user_embeddings, resource_embeddings, pattern_discoveries, notifications)
   - Sets up Row Level Security (RLS) policies
   - Creates indexes for performance
   - Enables pgvector extension
   - Includes the `status` field on `saved_resources` table (for Current/Past Resources feature)
   
   **How to run:**
   1. Open Supabase Dashboard → SQL Editor
   2. Click "New query"
   3. Copy entire contents of `lib/supabase/schema.sql`
   4. Paste into SQL Editor
   5. Click "Run" (or Cmd/Ctrl + Enter)
   6. Should see: "Success. No rows returned"

### 2. **Vector Search Functions** ⭐ REQUIRED
   **File:** `lib/supabase/vector-functions.sql`
   
   **What it does:**
   - Creates PostgreSQL functions for vector similarity search:
     - `find_similar_users()` - Find users with similar barrier profiles
     - `find_similar_resources()` - Find resources similar to a given resource
     - `search_resources_semantic()` - Semantic search for resources
     - `search_resources_description_semantic()` - Semantic search using description embeddings
     - `find_resources_for_user()` - Find resources for a specific user
   
   **How to run:**
   1. In SQL Editor, create a **new query** (don't overwrite the previous one)
   2. Copy entire contents of `lib/supabase/vector-functions.sql`
   3. Paste into SQL Editor
   4. Click "Run"
   5. Should see: "Success. No rows returned"

## Optional Scripts

### 3. **Verify Setup** (Optional - for troubleshooting)
   **File:** `scripts/verify-setup.sql`
   
   **What it does:**
   - Checks if pgvector extension is enabled
   - Verifies all tables exist
   - Verifies all functions exist
   - Checks RLS policies are enabled
   
   **When to run:**
   - After running scripts 1 and 2
   - To verify everything is set up correctly
   - If you're experiencing issues

### 4. **Create Vector Indexes** (Optional - after data is populated)
   **File:** `scripts/create-vector-indexes.sql`
   
   **What it does:**
   - Creates IVFFlat indexes on vector columns for optimal search performance
   - Uses cosine similarity (vector_cosine_ops) which matches the functions in vector-functions.sql
   
   **When to run:**
   - After you have some data in `user_embeddings` and `resource_embeddings` tables
   - These indexes significantly improve vector similarity search performance
   - ⚠️ IVFFlat indexes require data to exist - they will fail on empty tables
   - The schema.sql file skips these indexes to allow setup on empty databases

### 5. **Migration: Add Status Field** (Only if database already exists)
   **File:** `scripts/add-saved-resources-status.sql`
   
   **What it does:**
   - Adds `status` field to `saved_resources` table (if not already present)
   - Updates existing rows to 'wishlist' status
   - Creates index for status queries
   
   **When to run:**
   - ⚠️ **ONLY if you already have a database with `saved_resources` table**
   - ⚠️ **NOT needed if you just ran `schema.sql`** (it's already included)
   - For existing databases that need the status field added

## Quick Summary

**For NEW database setup:**
1. ✅ Run `lib/supabase/schema.sql`
2. ✅ Run `lib/supabase/vector-functions.sql`
3. ✅ (Optional) Run `scripts/verify-setup.sql` to verify
4. ✅ (Optional) After you have data, run `scripts/create-vector-indexes.sql` for better performance

**If you get "column status does not exist" error:**
This means your tables already exist but are missing columns. You have two options:

**Option 1: Drop and recreate (RECOMMENDED for development)**
1. Run `scripts/reset-database.sql` to drop all tables
2. Then run `lib/supabase/schema.sql` to recreate everything

**Option 2: Fix missing columns (for production databases)**
1. Run `scripts/fix-missing-status-column.sql` to add missing columns
2. Then run `lib/supabase/schema.sql` (it will skip existing tables but create missing ones)

**For EXISTING database (migration):**
1. ✅ Run `scripts/add-saved-resources-status.sql` (if status field doesn't exist)

## After Running Scripts

Verify the setup:
1. Go to **Database** → **Tables**
   - Should see 10 tables (including `pattern_discoveries` and `notifications`)
2. Go to **Database** → **Functions**
   - Should see 5 vector search functions
3. Run `scripts/verify-setup.sql` for detailed verification

## Notes

- **pgvector extension** must be enabled first (via Database → Extensions in Supabase Dashboard)
- All scripts use `CREATE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so they're safe to run multiple times
- Scripts are idempotent - running them twice won't cause errors
