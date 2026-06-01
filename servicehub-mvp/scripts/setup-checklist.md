# ServiceHub Setup Checklist

Use this checklist to ensure everything is set up correctly.

## Supabase Project Setup

- [ ] Created Supabase account
- [ ] Created new project
- [ ] Saved database password securely
- [ ] Copied Project URL from API settings
- [ ] Copied anon public key from API settings

## Environment Variables

- [ ] Created `.env.local` from `.env.local.example`
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Verified `.env.local` is in `.gitignore`

## Database Setup

- [ ] Enabled pgvector extension in Database → Extensions
- [ ] Ran `lib/supabase/schema.sql` in SQL Editor
- [ ] Ran `lib/supabase/vector-functions.sql` in SQL Editor
- [ ] Verified all 8 tables exist in Database → Tables
- [ ] Verified all 5 functions exist in Database → Functions
- [ ] Ran `scripts/verify-setup.sql` to check everything

## Application Setup

- [ ] Ran `npm install` successfully
- [ ] Started dev server with `npm run dev`
- [ ] No errors in terminal
- [ ] Home page loads at http://localhost:3000

## Testing

- [ ] Can access home page
- [ ] Can see navigation bar
- [ ] Can click "Sign up"
- [ ] Can create account (check email for confirmation)
- [ ] Can log in after email confirmation
- [ ] Can access onboarding flow
- [ ] Can complete onboarding

## Optional (for production)

- [ ] Set up custom domain
- [ ] Configure email templates in Supabase
- [ ] Set up backup strategy
- [ ] Configure environment variables in hosting platform
