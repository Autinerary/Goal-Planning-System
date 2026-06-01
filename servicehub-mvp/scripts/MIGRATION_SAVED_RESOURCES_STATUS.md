# Migration: Add Status Field to saved_resources Table

This migration adds a `status` field to the `saved_resources` table to enable users to track resources as:
- `wishlist` (default) - Resources they want to use in the future
- `current` - Resources they are actively using
- `past` - Resources they have used in the past

## SQL Migration Script

Run the SQL script in your Supabase SQL Editor:

```sql
-- Migration: Add status field to saved_resources table
-- This enables users to track resources as 'wishlist', 'current', or 'past'

-- Add status column with default 'wishlist' (backwards compatible)
ALTER TABLE public.saved_resources
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'current', 'past'));

-- Update existing rows to have 'wishlist' status (they're currently all wishlist items)
UPDATE public.saved_resources
SET status = 'wishlist'
WHERE status IS NULL;

-- Create index for faster queries by status
CREATE INDEX IF NOT EXISTS saved_resources_status_idx ON public.saved_resources(user_id, status);

-- Add comment for documentation
COMMENT ON COLUMN public.saved_resources.status IS 'Status: wishlist (default), current (actively using), past (previously used)';
```

## Steps to Apply

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the SQL script above
4. Run the script
5. Verify the migration by checking the table structure

## Notes

- All existing saved resources will default to 'wishlist' status
- The migration is backwards compatible
- An index is created for efficient queries by user_id and status
