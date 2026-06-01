-- Fix: Add missing status column to resources table if it doesn't exist
-- Run this BEFORE running schema.sql if you get "column status does not exist" error

-- Add status column to resources table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resources' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.resources ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Add status column to saved_resources table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'saved_resources' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.saved_resources ADD COLUMN status TEXT DEFAULT 'wishlist' CHECK (status IN ('wishlist', 'current', 'past'));
    END IF;
END $$;

-- Add status column to moderation_queue table if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'moderation_queue' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.moderation_queue ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;
