-- Fix search_path for handle_updated_at
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Refine storage policy to avoid listing warning if possible, 
-- but keep it accessible for public view of specific files.
-- Actually, for a gallery app, public read of all objects in 'photos' bucket is usually intended.
-- To satisfy the linter's concern about broad SELECT, we could restrict it, 
-- but for now I'll just fix the search_path which is a higher priority security risk.
