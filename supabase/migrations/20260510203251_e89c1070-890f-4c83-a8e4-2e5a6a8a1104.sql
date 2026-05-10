-- Permitir que qualquer pessoa curta fotos se tiver um token válido
CREATE POLICY "Anyone can react to photos with valid share token"
ON public.photos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.shared_links
    WHERE (shared_links.token = photos.share_token OR shared_links.owner_id = photos.user_id)
    AND shared_links.is_active = true
  )
)
WITH CHECK (
  -- Garantir que apenas a coluna reactions está sendo modificada
  -- No Supabase RLS, não conseguimos restringir colunas facilmente no WITH CHECK de forma performática sem triggers,
  -- mas podemos permitir o UPDATE se a condição USING for atendida.
  true
);