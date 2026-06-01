-- Grant Rater Status to Users
-- Run this in Supabase SQL Editor
--
-- IMPORTANT: All UPDATE statements below are commented out by default.
-- Uncomment ONLY the option you need, and replace placeholder values
-- with real ones BEFORE running. Otherwise you'll get errors like
-- "invalid input syntax for type uuid: 'user-uuid-here'".

-- Option 1: Grant rater status to a specific user by email
-- Replace 'user@example.com' with the actual email
-- UPDATE public.profiles
-- SET is_rater = TRUE
-- WHERE email = 'user@example.com';

-- Option 2: Grant rater status to a specific user by UUID
-- Replace '00000000-0000-0000-0000-000000000000' with the actual user ID (from auth.users table)
-- UPDATE public.profiles
-- SET is_rater = TRUE
-- WHERE id = '00000000-0000-0000-0000-000000000000';

-- Option 3: Grant rater status to all admins (safe to run as-is)
-- UPDATE public.profiles
-- SET is_rater = TRUE
-- WHERE role = 'admin';

-- Option 4: Grant rater status to multiple users by email
-- UPDATE public.profiles
-- SET is_rater = TRUE
-- WHERE email IN ('user1@example.com', 'user2@example.com', 'user3@example.com');

-- Option 5: List all users with their IDs and emails (to help you find the right user)
SELECT 
  id,
  email,
  full_name,
  role,
  is_rater,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- Option 6: List all current raters
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
WHERE is_rater = TRUE
ORDER BY created_at DESC;

-- Option 7: Revoke rater status (if needed)
-- UPDATE public.profiles SET is_rater = FALSE WHERE id = 'user-uuid-here';
