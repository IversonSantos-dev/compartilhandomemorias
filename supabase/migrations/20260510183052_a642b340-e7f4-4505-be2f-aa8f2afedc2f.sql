-- Add avatar_url and banner_url to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Add name to shared_links table
ALTER TABLE public.shared_links 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Update profiles trigger to include new fields if needed
-- (Assuming standard profiles table structure from common templates)

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles are viewable by everyone (publicly accessible information)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Shared links are viewable by everyone (or those with the token)
-- Existing policies should already cover SELECT for shared_links
