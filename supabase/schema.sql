-- =============================================================
-- Niribi — Initial Schema
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

-- =============================================================
-- Direct Messages Foundation
-- =============================================================

-- ── Private authorization helpers ─────────────────────────────
CREATE OR REPLACE FUNCTION private.is_approved_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.profiles WHERE id = user_id),
    false
  )
$$;

-- Approved users need to see other approved users' public profile fields for DMs.
-- profiles contains no email column; auth email remains private in auth.users.
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    (select auth.uid()) = id
    OR private.is_admin()
    OR (
      status = 'approved'
      AND private.is_approved_user((select auth.uid()))
    )
  );

-- ── Direct message tables ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT direct_conversations_distinct_users CHECK (user_a <> user_b),
  CONSTRAINT direct_conversations_ordered_users CHECK (user_a < user_b),
  CONSTRAINT direct_conversations_unique_pair UNIQUE (user_a, user_b)
);

CREATE OR REPLACE FUNCTION private.is_direct_conversation_participant(
  conversation_id uuid,
  user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT user_id = user_a OR user_id = user_b
      FROM public.direct_conversations
      WHERE id = conversation_id
    ),
    false
  )
$$;

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text        NOT NULL CHECK (
    char_length(btrim(body)) > 0 AND char_length(body) <= 4000
  ),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.direct_conversation_reads (
  conversation_id uuid        NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT direct_conversation_reads_pkey PRIMARY KEY (conversation_id, user_id)
);

-- ── Indexes for message lists and unread counts ───────────────
CREATE INDEX IF NOT EXISTS direct_conversations_user_a_idx
  ON public.direct_conversations (user_a, updated_at DESC);

CREATE INDEX IF NOT EXISTS direct_conversations_user_b_idx
  ON public.direct_conversations (user_b, updated_at DESC);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_created_idx
  ON public.direct_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS direct_messages_unread_idx
  ON public.direct_messages (conversation_id, sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS direct_conversation_reads_user_idx
  ON public.direct_conversation_reads (user_id);

-- ── Updated-at maintenance ────────────────────────────────────
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.touch_direct_conversation_after_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.direct_conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS direct_conversations_set_updated_at
  ON public.direct_conversations;

CREATE TRIGGER direct_conversations_set_updated_at
  BEFORE UPDATE ON public.direct_conversations
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

DROP TRIGGER IF EXISTS direct_messages_touch_conversation
  ON public.direct_messages;

CREATE TRIGGER direct_messages_touch_conversation
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION private.touch_direct_conversation_after_message();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "direct_conversations_select"
  ON public.direct_conversations;

DROP POLICY IF EXISTS "direct_conversations_insert"
  ON public.direct_conversations;

DROP POLICY IF EXISTS "direct_messages_select"
  ON public.direct_messages;

DROP POLICY IF EXISTS "direct_messages_insert"
  ON public.direct_messages;

DROP POLICY IF EXISTS "direct_conversation_reads_select"
  ON public.direct_conversation_reads;

DROP POLICY IF EXISTS "direct_conversation_reads_insert"
  ON public.direct_conversation_reads;

DROP POLICY IF EXISTS "direct_conversation_reads_update"
  ON public.direct_conversation_reads;

CREATE POLICY "direct_conversations_select"
  ON public.direct_conversations FOR SELECT
  TO authenticated
  USING (
    private.is_approved_user((select auth.uid()))
    AND ((select auth.uid()) = user_a OR (select auth.uid()) = user_b)
  );

CREATE POLICY "direct_conversations_insert"
  ON public.direct_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_approved_user((select auth.uid()))
    AND ((select auth.uid()) = user_a OR (select auth.uid()) = user_b)
    AND private.is_approved_user(user_a)
    AND private.is_approved_user(user_b)
    AND user_a < user_b
  );

CREATE POLICY "direct_messages_select"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (
    private.is_approved_user((select auth.uid()))
    AND private.is_direct_conversation_participant(conversation_id, (select auth.uid()))
  );

CREATE POLICY "direct_messages_insert"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_approved_user((select auth.uid()))
    AND sender_id = (select auth.uid())
    AND private.is_direct_conversation_participant(conversation_id, (select auth.uid()))
  );

CREATE POLICY "direct_conversation_reads_select"
  ON public.direct_conversation_reads FOR SELECT
  TO authenticated
  USING (
    private.is_approved_user((select auth.uid()))
    AND user_id = (select auth.uid())
    AND private.is_direct_conversation_participant(conversation_id, (select auth.uid()))
  );

CREATE POLICY "direct_conversation_reads_insert"
  ON public.direct_conversation_reads FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_approved_user((select auth.uid()))
    AND user_id = (select auth.uid())
    AND private.is_direct_conversation_participant(conversation_id, (select auth.uid()))
  );

CREATE POLICY "direct_conversation_reads_update"
  ON public.direct_conversation_reads FOR UPDATE
  TO authenticated
  USING (
    private.is_approved_user((select auth.uid()))
    AND user_id = (select auth.uid())
    AND private.is_direct_conversation_participant(conversation_id, (select auth.uid()))
  )
  WITH CHECK (
    private.is_approved_user((select auth.uid()))
    AND user_id = (select auth.uid())
    AND private.is_direct_conversation_participant(conversation_id, (select auth.uid()))
  );

-- ── Grant Data API access to authenticated users ──────────────
GRANT SELECT, INSERT ON public.direct_conversations TO authenticated;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.direct_conversation_reads TO authenticated;

-- ── Realtime publication ──────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'direct_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_conversations;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'direct_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'direct_conversation_reads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_conversation_reads;
    END IF;
  END IF;
END;
$$;
