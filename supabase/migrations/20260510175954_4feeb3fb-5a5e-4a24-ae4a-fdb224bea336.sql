-- Drop redundant or restrictive SELECT policies
DROP POLICY IF EXISTS "Anyone can view photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can view photos with valid share token" ON public.photos;
DROP POLICY IF EXISTS "Users can view their own photos" ON public.photos;

-- Create a clear policy for viewing photos:
-- 1. If it has a share_token, it must be an active one.
-- 2. If it doesn't have a share_token, it must belong to the authenticated user.
CREATE POLICY "View photos policy" ON public.photos
FOR SELECT
TO public
USING (
  (share_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shared_links 
    WHERE shared_links.token = photos.share_token 
    AND shared_links.is_active = true
  ))
  OR 
  (auth.uid() = user_id)
);
