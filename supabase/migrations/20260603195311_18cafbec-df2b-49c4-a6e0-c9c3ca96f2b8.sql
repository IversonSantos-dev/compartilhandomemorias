
-- 1) Harden handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2) Security definer helpers for shared_links (so RLS-blocked anon can still validate tokens via policies)
CREATE OR REPLACE FUNCTION public.is_active_share_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_links
    WHERE token = _token AND is_active = true
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_share_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_has_active_link(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_links
    WHERE owner_id = _user_id AND is_active = true
  );
$$;
REVOKE EXECUTE ON FUNCTION public.owner_has_active_link(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_has_active_link(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_shared_link_by_token(_token text)
RETURNS TABLE(owner_id uuid, name text, token text, is_active boolean, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT sl.owner_id, sl.name, sl.token, sl.is_active, sl.created_at
  FROM public.shared_links sl
  WHERE sl.token = _token AND sl.is_active = true;
$$;
REVOKE EXECUTE ON FUNCTION public.get_shared_link_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_link_by_token(text) TO anon, authenticated;

-- 3) Lock down shared_links: drop public enumeration, owners keep full access
DROP POLICY IF EXISTS "Anyone can view shared links by token" ON public.shared_links;
-- "Owners can manage their shared links" remains (FOR ALL, auth.uid() = owner_id)

-- 4) Rewrite photos policies to use the security-definer helpers (since anon no longer reads shared_links directly)
DROP POLICY IF EXISTS "View photos policy" ON public.photos;
CREATE POLICY "View photos policy" ON public.photos
FOR SELECT
USING (
  (share_token IS NOT NULL AND public.is_active_share_token(share_token))
  OR (auth.uid() = user_id)
  OR public.owner_has_active_link(user_id)
);

DROP POLICY IF EXISTS "Anyone can insert photos with valid share token" ON public.photos;
CREATE POLICY "Anyone can insert photos with valid share token" ON public.photos
FOR INSERT
WITH CHECK (
  share_token IS NOT NULL AND public.is_active_share_token(share_token)
);

DROP POLICY IF EXISTS "Anyone can react to photos with valid share token" ON public.photos;
CREATE POLICY "Anyone can react to photos with valid share token" ON public.photos
FOR UPDATE
USING (
  (share_token IS NOT NULL AND public.is_active_share_token(share_token))
  OR public.owner_has_active_link(user_id)
)
WITH CHECK (
  (share_token IS NOT NULL AND public.is_active_share_token(share_token))
  OR public.owner_has_active_link(user_id)
);

-- 5) Column-protection trigger: non-owners can only modify `reactions` / `updated_at`
CREATE OR REPLACE FUNCTION public.photos_guard_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> OLD.user_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.share_token IS DISTINCT FROM OLD.share_token
       OR NEW.caption IS DISTINCT FROM OLD.caption
       OR NEW.guest_name IS DISTINCT FROM OLD.guest_name
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Only the photo owner may modify fields other than reactions';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS photos_guard_columns_trg ON public.photos;
CREATE TRIGGER photos_guard_columns_trg
BEFORE UPDATE ON public.photos
FOR EACH ROW EXECUTE FUNCTION public.photos_guard_columns();

-- 6) Storage: tighten anonymous uploads to require a valid active share token in path
DROP POLICY IF EXISTS "Public anonymous uploads with valid folder structure" ON storage.objects;
CREATE POLICY "Anon uploads only to active share token folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = 'public'
  AND public.is_active_share_token((storage.foldername(name))[2])
);

-- 7) Drop overly-broad SELECT policies that allow listing the public bucket.
--    Public bucket flag still serves direct object URLs without needing storage.objects RLS.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public access to all photos" ON storage.objects;
