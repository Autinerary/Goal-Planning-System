# Database Seeding Guide

This guide explains how to seed the ServiceHub database with test data for development and testing.

## Prerequisites

1. **Supabase Service Role Key** (Recommended):
   - Go to Supabase Dashboard → Settings → API
   - Copy the `service_role` key (keep this secret!)
   - Add to `.env.local`:
     ```
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
     ```
   - This key allows the script to create users via the admin API

2. **Alternative** (Without Service Role Key):
   - The script will still work but will skip user creation
   - You'll need to manually create test users in Supabase Auth dashboard
   - Then run the seed script again to create resources and ratings

## Seeding Methods

### Method 1: Via Admin Dashboard (Recommended)

1. Make sure you're logged in as an admin user
2. Navigate to `/admin/data-management`
3. Click "Seed Database" button
4. Wait for the process to complete (may take 1-2 minutes)
5. You'll see a success message with counts

### Method 2: Via API Route

```bash
curl -X POST http://localhost:3000/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

### Method 3: Direct Script Execution

```bash
# Install tsx if not already installed
npm install -g tsx

# Run the seed script
npx tsx lib/supabase/seed.ts
```

## What Gets Created

### Test Users (8 users)
- `autism_parent@test.com` - Parent with autism, sensory, communication barriers
- `adhd_advocate@test.com` - Self-advocate with ADHD, anxiety, cognitive barriers
- `mobility_user@test.com` - Self-advocate with mobility, sensory barriers
- `therapist@test.com` - Professional (no barriers)
- `caregiver@test.com` - Caregiver with autism, ADHD, sensory, social barriers
- `multi_barrier@test.com` - Self-advocate with multiple barriers
- `hearing_impairment@test.com` - Self-advocate with hearing impairment
- `visual_impairment@test.com` - Self-advocate with visual impairment

**Default Password:** `TestPassword123!`

### Test Resources (~100 resources)
- Distributed across all categories:
  - Therapists (21 resources)
  - Schools (24 resources)
  - Doctors (9 resources)
  - Parks (22 resources)
  - Stores (14 resources)
  - Community Centers (13 resources)
  - Support Groups (9 resources)
  - Recreation (10 resources)
  - Employment (5 resources)
  - Housing (4 resources)

- **Locations:** Toronto, Vancouver, Montreal
- **Status:** 75% approved, 25% pending

### Test Ratings (~250 ratings)
- Varied scores (1-5 stars)
- 60% bias towards 4-5 star ratings (realistic distribution)
- Barrier-specific ratings for users with barriers
- Some resources with no ratings (for testing empty states)
- Helpful counts (0-15 per rating)

## Clearing Test Data

### Via Admin Dashboard

1. Navigate to `/admin/data-management`
2. Click "Clear Test Data"
3. Confirm the deletion
4. All test data (users with @test.com emails) will be removed

### Via API Route

```bash
curl -X POST http://localhost:3000/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"action": "clear"}'
```

### Via Script

```bash
npx tsx lib/supabase/seed.ts clear
```

## Important Notes

1. **Development Only**: Seeding is disabled in production mode
2. **Test Data Identification**: All test users use `@test.com` email domain
3. **Cascade Deletes**: Deleting a test user will cascade delete their barriers, ratings, and saved resources
4. **Service Role Key**: Required for creating users via admin API. Without it, you'll need to create users manually.

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- For user creation, also add `SUPABASE_SERVICE_ROLE_KEY`

### "Could not create auth user via admin API"
- This means the service role key is missing or invalid
- You can still seed resources and ratings, but users need to be created manually
- Or add the service role key to `.env.local`

### "Error creating profile"
- User might already exist
- Check Supabase Auth dashboard for existing users
- The script will skip existing users and continue

### Slow Performance
- Seeding ~100 resources and ~250 ratings can take 1-2 minutes
- This is normal - the script logs progress every 50 ratings

## Next Steps After Seeding

1. **Generate Embeddings**: Run the batch embedding generation:
   ```bash
   curl -X POST http://localhost:3000/api/embeddings/batch-generate
   ```

2. **Test Features**:
   - Search functionality
   - Recommendations
   - Ratings and reviews
   - Saved resources
   - Pattern discovery

3. **Login as Test User**:
   - Use any test user email (e.g., `autism_parent@test.com`)
   - Password: `TestPassword123!`
   - Complete onboarding if needed