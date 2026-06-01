# Quick Setup Instructions for Supabase

## Your Project Info
- **Project ID**: `rjakdztbroclkzgpyqrl`
- **Project URL**: `https://rjakdztbroclkzgpyqrl.supabase.co`

## Step-by-Step Setup

### 1. Get API Key (2 minutes)
1. In Supabase Dashboard, click **"API Keys"** in left sidebar (under PROJECT SETTINGS)
2. Find **"anon public"** key (starts with `eyJhbG...`)
3. Copy it
4. Update `.env.local`:
   ```bash
   # Replace "your-anon-key-here" with the actual key
   ```

### 2. Enable pgvector (1 minute)
1. Go to **Database** → **Extensions** (in left sidebar)
2. Search for **"vector"**
3. Click **"Enable"** button
4. Wait a few seconds

### 3. Run Database Schema (3 minutes)

**First SQL Script:**
1. Go to **SQL Editor** → **New query**
2. Copy entire contents of: `lib/supabase/schema.sql`
3. Paste into SQL Editor
4. Click **"Run"** (or Cmd/Ctrl + Enter)
5. Should see: "Success. No rows returned"

**Second SQL Script:**
1. Create **New query** in SQL Editor
2. Copy entire contents of: `lib/supabase/vector-functions.sql`
3. Paste into SQL Editor
4. Click **"Run"**
5. Should see: "Success. No rows returned"

### 4. Verify Setup (1 minute)
1. Go to **Database** → **Tables**
2. Should see 8 tables:
   - profiles
   - user_barriers
   - resources
   - ratings
   - saved_resources
   - moderation_queue
   - user_embeddings
   - resource_embeddings

3. Go to **Database** → **Functions**
4. Should see 5 functions:
   - find_similar_users
   - find_similar_resources
   - search_resources_semantic
   - search_resources_description_semantic
   - find_resources_for_user

### 5. Test the App
```bash
# Restart dev server
npm run dev
```

Visit http://localhost:3000 - should work now! 🎉
