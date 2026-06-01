-- Migration: Add price field to resources and is_rater field to profiles
-- Run this script in Supabase SQL Editor

-- Add price field to resources table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='resources' AND column_name='price') THEN
        ALTER TABLE public.resources
        ADD COLUMN price DECIMAL(10, 2);
        COMMENT ON COLUMN public.resources.price IS 'Price in dollars (NULL for free resources or if price not applicable)';
        RAISE NOTICE 'Added price column to public.resources table.';
    ELSE
        RAISE NOTICE 'Price column already exists in public.resources table. Skipping.';
    END IF;
END
$$;

-- Add is_rater field to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_rater') THEN
        ALTER TABLE public.profiles
        ADD COLUMN is_rater BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN public.profiles.is_rater IS 'Whether this user is authorized to rate resources. Only raters can submit ratings.';
        RAISE NOTICE 'Added is_rater column to public.profiles table.';
    ELSE
        RAISE NOTICE 'is_rater column already exists in public.profiles table. Skipping.';
    END IF;
END
$$;

-- Create index for price queries (useful for sorting/filtering)
CREATE INDEX IF NOT EXISTS resources_price_idx ON public.resources(price) WHERE price IS NOT NULL;

-- Create index for rater queries
CREATE INDEX IF NOT EXISTS profiles_is_rater_idx ON public.profiles(is_rater) WHERE is_rater = TRUE;

SELECT 'Migration completed: price and is_rater fields added.' AS status;
