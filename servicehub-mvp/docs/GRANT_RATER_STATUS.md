# How to Grant Rater Status to Users

## Overview

Only users with `is_rater = TRUE` in their profile can submit ratings. All users can still recommend/submit resources, but rating is restricted to authorized raters.

## Methods to Grant Rater Status

### Method 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Run one of the SQL commands below:

#### Grant by Email (Easiest)
```sql
UPDATE public.profiles 
SET is_rater = TRUE 
WHERE email = 'user@example.com';
```

#### Grant by User UUID
```sql
-- First, find the user ID using:
SELECT id, email, full_name FROM public.profiles WHERE email = 'user@example.com';

-- Then grant rater status:
UPDATE public.profiles 
SET is_rater = TRUE 
WHERE id = 'user-uuid-here';
```

#### Grant to All Admins
```sql
UPDATE public.profiles 
SET is_rater = TRUE 
WHERE role = 'admin';
```

### Method 2: Using Supabase Dashboard (Table Editor)

1. Go to **Table Editor** → **profiles** table
2. Find the user you want to make a rater
3. Click on the row to edit
4. Set `is_rater` to `true`
5. Save

### Method 3: Programmatically (Via API/Code)

You can also create an admin API endpoint or use Supabase client:

```typescript
// In an admin API route or server-side code
import { createClient } from '@/lib/supabase/server'

const supabase = createClient()

// Grant rater status by email
await supabase
  .from('profiles')
  .update({ is_rater: true })
  .eq('email', 'user@example.com')

// Grant rater status by user ID
await supabase
  .from('profiles')
  .update({ is_rater: true })
  .eq('id', 'user-uuid-here')
```

## Finding User Information

### List All Users
```sql
SELECT 
  id,
  email,
  full_name,
  role,
  is_rater,
  created_at
FROM public.profiles
ORDER BY created_at DESC;
```

### List Current Raters
```sql
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
WHERE is_rater = TRUE
ORDER BY created_at DESC;
```

### Find User by Email
```sql
SELECT * FROM public.profiles WHERE email = 'user@example.com';
```

## Revoking Rater Status

To remove rater status:

```sql
UPDATE public.profiles 
SET is_rater = FALSE 
WHERE id = 'user-uuid-here';
```

Or by email:

```sql
UPDATE public.profiles 
SET is_rater = FALSE 
WHERE email = 'user@example.com';
```

## Quick Start

1. Open Supabase SQL Editor
2. Run: `SELECT id, email, full_name, is_rater FROM public.profiles;`
3. Copy the user's email or ID
4. Run: `UPDATE public.profiles SET is_rater = TRUE WHERE email = 'their-email@example.com';`
5. Verify: `SELECT email, is_rater FROM public.profiles WHERE email = 'their-email@example.com';`

## Security Note

Only users with admin access to your Supabase project should be able to grant rater status. Consider creating an admin UI page in the future to manage raters without direct database access.
