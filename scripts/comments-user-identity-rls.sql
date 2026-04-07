-- Bind comments to auth users while preserving anonymous compatibility.
-- Run this script in Supabase SQL Editor.

-- 1) Ensure comments.user_id exists and references auth.users
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Helpful index for "my comments" lookup
CREATE INDEX IF NOT EXISTS comments_user_id_idx ON public.comments(user_id);

-- 2) Enable and normalize RLS policies on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_select_all ON public.comments;
DROP POLICY IF EXISTS comments_insert_any ON public.comments;
DROP POLICY IF EXISTS comments_update_own ON public.comments;
DROP POLICY IF EXISTS comments_delete_own ON public.comments;

-- Anyone can read comments
CREATE POLICY comments_select_all
  ON public.comments
  FOR SELECT
  USING (true);

-- Insert rules:
-- - anonymous user: must insert with user_id = null
-- - authenticated user: must insert with user_id = auth.uid()
CREATE POLICY comments_insert_any
  ON public.comments
  FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Only author can modify own comment
CREATE POLICY comments_update_own
  ON public.comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only author can delete own comment
CREATE POLICY comments_delete_own
  ON public.comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Optional one-time backfill for historical rows created by logged-in users.
-- If your table has creator metadata from old schema, map it here manually.
-- Example:
-- UPDATE public.comments SET user_id = created_by_user_id WHERE user_id IS NULL;
