-- Add guest_name column to photos table
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS guest_name TEXT;
