-- =============================================================
-- Curious to Talk — Initial Schema
-- Run this in the Supabase dashboard SQL editor
-- =============================================================

-- ── Profiles ─────────────────────────────────────────────────
-- Extends auth.users. Created automatically by trigger on signup.
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text        NOT NULL,
  is_admin      boolean     NOT NULL DEFAULT false,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved')),
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Rooms ─────────────────────────────────────────────────────
-- Permanent room definitions (admin creates, users just join).
CREATE TABLE IF NOT EXISTS public.rooms (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  description      text,
  max_participants integer,     -- NULL = unlimited
  created_by       uuid        NOT NULL REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms    ENABLE ROW LEVEL SECURITY;

-- ── Private schema for security-definer helpers ───────────────
-- (Not exposed to the Data API — safe for SECURITY DEFINER functions)
CREATE SCHEMA IF NOT EXISTS private;

-- Helper: returns true if the calling user is an admin
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;

-- ── Profiles RLS policies ─────────────────────────────────────
-- Users can read their own profile; admins can read all
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR private.is_admin());

-- Admins can update any profile field, including status/is_admin.
CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- Users can sync editable profile fields on their own row
-- (e.g., Google display name/avatar updates during OAuth callback).
CREATE POLICY "profiles_update_own_name"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── Rooms RLS policies ────────────────────────────────────────
-- Approved users can read rooms
CREATE POLICY "rooms_select"
  ON public.rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND status = 'approved'
    )
  );

-- Only admins can create rooms
CREATE POLICY "rooms_insert"
  ON public.rooms FOR INSERT
  WITH CHECK (private.is_admin());

-- Only admins can update rooms
CREATE POLICY "rooms_update"
  ON public.rooms FOR UPDATE
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- Only admins can delete rooms
CREATE POLICY "rooms_delete"
  ON public.rooms FOR DELETE
  USING (private.is_admin());

-- ── Grant Data API access to authenticated users ──────────────
-- Required because new Supabase projects don't expose tables automatically
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;

-- ── Trigger: auto-create profile on signup ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, status, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'User'
    ),
    'pending',
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- After running this SQL, go to:
-- Supabase Dashboard → Settings → Data API
-- Make sure the "public" schema is in the "Exposed schemas" list.
-- =============================================================
