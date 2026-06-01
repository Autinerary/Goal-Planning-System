# ServiceHub MVP Setup Guide

Complete setup instructions for ServiceHub MVP with Supabase.

## Prerequisites

- Node.js 18+ installed
- npm/yarn/pnpm installed
- A Supabase account (free tier available)

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in (free tier is fine)
3. Click **"New Project"**
4. Fill in:
   - **Organization**: Create or select one
   - **Project Name**: `servicehub-mvp` (or any name you like)
   - **Database Password**: Create a strong password (save it securely!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier is fine
5. Click **"Create new project"**
6. Wait 1-2 minutes for the project to be created

## Step 2: Get Your Supabase Credentials

1. Once your project is created, go to **Project Settings** (gear icon)
2. Click **API** in the left sidebar
3. Copy these values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (starts with `eyJhbG...`)

## Step 3: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and paste your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 4: Enable pgvector Extension

1. In Supabase Dashboard, go to **Database** → **Extensions**
2. Search for **"vector"** or **"pgvector"**
3. Click **Enable** next to pgvector
4. Wait a few seconds for it to activate

## Step 5: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Open `lib/supabase/schema.sql` in your code editor
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **"Run"** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

## Step 6: Create Vector Search Functions

1. In the SQL Editor, create a new query
2. Open `lib/supabase/vector-functions.sql` in your code editor
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **"Run"**
6. You should see "Success. No rows returned"

## Step 7: Verify Setup

1. In Supabase Dashboard, go to **Database** → **Tables**
2. You should see these tables:
   - ✅ `profiles`
   - ✅ `user_barriers`
   - ✅ `resources`
   - ✅ `ratings`
   - ✅ `saved_resources`
   - ✅ `moderation_queue`
   - ✅ `user_embeddings`
   - ✅ `resource_embeddings`

3. Go to **Database** → **Functions**
4. You should see these functions:
   - ✅ `find_similar_users`
   - ✅ `find_similar_resources`
   - ✅ `search_resources_semantic`
   - ✅ `find_resources_for_user`

## Step 8: Install Dependencies & Run

```bash
# Install all packages
npm install

# Start development server
npm run dev
```

## Step 9: Test the Setup

1. Open [http://localhost:3000](http://localhost:3000)
2. You should see the home page (no errors!)
3. Try signing up:
   - Click "Sign up"
   - Create an account
   - Check your email for confirmation link
   - Complete onboarding

## Troubleshooting

### "Cannot find module 'autoprefixer'"
- Already fixed! Run `npm install` to ensure it's installed

### "Supabase URL and Key are required"
- Make sure `.env.local` exists and has correct values
- Restart the dev server after creating `.env.local`

### "Extension vector does not exist"
- Go to Database → Extensions and enable pgvector

### Tables not showing up
- Check the SQL Editor for any errors
- Make sure you ran `schema.sql` completely

### Functions not working
- Make sure you ran `vector-functions.sql`
- Check that pgvector extension is enabled

## Next Steps

After setup is complete:

1. ✅ Test authentication (sign up, login)
2. ✅ Complete onboarding flow
3. ✅ Try adding a test resource
4. ✅ Test search functionality
5. ✅ Test recommendations (after onboarding)

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- ServiceHub README: Check `README.md`
