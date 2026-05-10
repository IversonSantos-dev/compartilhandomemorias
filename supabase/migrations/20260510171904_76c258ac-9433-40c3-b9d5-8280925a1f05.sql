-- Create shared_links table
CREATE TABLE IF NOT EXISTS public.shared_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.shared_links ENABLE ROW LEVEL SECURITY;

-- Policies for shared_links
CREATE POLICY "Owners can manage their shared links"
ON public.shared_links
FOR ALL
USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view shared links by token"
ON public.shared_links
FOR SELECT
USING (is_active = true);

-- Update photos table to include share_token
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS share_token TEXT;

-- Update RLS for photos table to allow public insertion if share_token is valid
CREATE POLICY "Anyone can insert photos with valid share token"
ON public.photos
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shared_links 
        WHERE token = share_token AND is_active = true
    )
);

-- Storage bucket is already created in previous steps, but we need to ensure public uploads are allowed
-- Create a policy for storage to allow public uploads if the path matches a specific pattern or if handled via edge function (but here we'll try direct client upload for simplicity if possible, or adjust policies)

-- For now, let's allow public uploads to a 'public-uploads' folder in the 'photos' bucket
CREATE POLICY "Public anonymous uploads with valid folder structure"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'photos' AND 
    (storage.foldername(name))[1] = 'public'
);

CREATE POLICY "Public access to all photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'photos');
