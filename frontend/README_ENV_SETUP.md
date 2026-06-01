# Environment Variables Setup for Goal Planning Frontend

## Quick Fix for Supabase Error

You need to create a `.env.local` file in the `frontend` directory with your Supabase credentials.

## Steps:

1. **Copy Supabase credentials from ServiceHub:**
   - Open `servicehub-mvp/.env.local`
   - Copy the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values

2. **Create `.env.local` in the frontend directory:**
   ```bash
   cd frontend
   touch .env.local
   ```

3. **Add the following to `frontend/.env.local`:**
   ```env
   # Supabase Configuration (MUST be the SAME as ServiceHub for unified auth)
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url-here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

   # Goal Planning Backend API
   API_URL=http://localhost:8000

   # ServiceHub URL
   NEXT_PUBLIC_SERVICE_HUB_URL=http://localhost:3001
   ```

4. **Replace the placeholder values:**
   - `your-supabase-project-url-here` → Your actual Supabase project URL (from ServiceHub's .env.local)
   - `your-supabase-anon-key-here` → Your actual Supabase anon key (from ServiceHub's .env.local)

5. **Restart the frontend dev server:**
   ```bash
   # Stop the current server (Ctrl+C) and restart
   npm run dev
   ```

## Important Notes:

- **Both apps MUST use the same Supabase project** for unified authentication to work
- The `.env.local` file is already in `.gitignore` and won't be committed to git
- If you don't have Supabase credentials yet, follow the ServiceHub setup guide to create a Supabase project first

## Getting Supabase Credentials (if you don't have them):

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project (or use existing one)
4. Go to **Project Settings** → **API**
5. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
