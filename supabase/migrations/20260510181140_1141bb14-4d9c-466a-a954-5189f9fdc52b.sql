-- Drop and recreate the policy (PostgreSQL doesn't support CREATE OR REPLACE POLICY)
DROP POLICY IF EXISTS "View photos policy" ON public.photos;

CREATE POLICY "View photos policy" ON public.photos
FOR SELECT
TO public
USING (
  -- 1. Photos with an active share_token
  (share_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.shared_links 
    WHERE shared_links.token = photos.share_token 
    AND shared_links.is_active = true
  ))
  OR 
  -- 2. Photos belonging to an owner who has an active shared link
  (EXISTS (
    SELECT 1 FROM public.shared_links 
    WHERE shared_links.owner_id = photos.user_id 
    AND shared_links.is_active = true
  ))
  OR
  -- 3. The owner of the photo
  (auth.uid() = user_id)
);
