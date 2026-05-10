-- Policy to allow public viewing of photos linked to a valid share token
CREATE POLICY "Anyone can view photos with valid share token"
ON public.photos
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.shared_links 
        WHERE shared_links.token = photos.share_token AND shared_links.is_active = true
    )
);
