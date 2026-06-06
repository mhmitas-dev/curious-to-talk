-- =============================================================
-- Niribi - Authoritative Room Stage State
-- Run this in the Supabase dashboard SQL editor after schema.sql
-- =============================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_approved_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT profiles.status = 'approved'
      FROM public.profiles AS profiles
      WHERE profiles.id = user_id
    ),
    false
  )
$$;

-- One authoritative stage row exists for every room. The current database
-- stage owner is intentionally used for Screen Share only. Future lightweight
-- room activities such as YouTube should not add durable playback tables
-- unless the product explicitly needs persistence beyond the live room.
CREATE TABLE IF NOT EXISTS public.room_stage_state (
  room_id                     uuid        PRIMARY KEY
                                          REFERENCES public.rooms(id) ON DELETE CASCADE,
  owner                       text        NOT NULL DEFAULT 'idle'
                                          CHECK (owner IN ('idle', 'screen_share')),
  screen_share_participant_id uuid,
  revision                    bigint      NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_by                  uuid        NOT NULL,
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT room_stage_screen_share_owner_check CHECK (
    (owner = 'screen_share' AND screen_share_participant_id IS NOT NULL)
    OR (owner <> 'screen_share' AND screen_share_participant_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS room_stage_screen_share_participant_idx
  ON public.room_stage_state (screen_share_participant_id)
  WHERE screen_share_participant_id IS NOT NULL;

-- Backfill existing rooms before installing the room-creation trigger.
INSERT INTO public.room_stage_state (room_id, owner, updated_by)
SELECT rooms.id, 'idle', rooms.created_by
FROM public.rooms AS rooms
ON CONFLICT (room_id) DO NOTHING;

-- Create an idle stage row whenever an admin creates a new room.
CREATE OR REPLACE FUNCTION private.create_room_stage_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.room_stage_state (room_id, owner, updated_by)
  VALUES (NEW.id, 'idle', NEW.created_by)
  ON CONFLICT (room_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rooms_create_stage_state ON public.rooms;

CREATE TRIGGER rooms_create_stage_state
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION private.create_room_stage_state();

-- Defense in depth for all UPDATE paths, including direct Data API calls.
-- Phase 2 permits only idle <-> screen_share transitions.
CREATE OR REPLACE FUNCTION private.validate_room_stage_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (select auth.uid());
BEGIN
  IF caller_id IS NULL OR NOT private.is_approved_user(caller_id) THEN
    RAISE EXCEPTION 'Only approved users can change the room stage.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.room_id <> OLD.room_id THEN
    RAISE EXCEPTION 'The room stage identity cannot change.'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'The room stage revision must increase by one.'
      USING ERRCODE = '40001';
  END IF;

  IF NEW.updated_by <> caller_id THEN
    RAISE EXCEPTION 'The room stage actor does not match the authenticated user.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.owner = 'idle' AND NEW.owner = 'screen_share' THEN
    IF NEW.screen_share_participant_id <> caller_id THEN
      RAISE EXCEPTION 'A user can only claim the stage for their own screen share.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF OLD.owner = 'screen_share' AND NEW.owner = 'idle' THEN
    IF NEW.screen_share_participant_id IS NOT NULL THEN
      RAISE EXCEPTION 'An idle stage cannot retain a screen-share participant.'
        USING ERRCODE = '22023';
    END IF;

    -- The sharer may release immediately. Another approved participant may
    -- release a stale row only after a short grace period and an exact revision match.
    IF OLD.screen_share_participant_id <> caller_id
      AND OLD.updated_at > now() - interval '5 seconds' THEN
      RAISE EXCEPTION 'The screen-share stage is not stale yet.'
        USING ERRCODE = '40001';
    END IF;
  ELSE
    RAISE EXCEPTION 'This room stage transition is not available yet.'
      USING ERRCODE = '22023';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS room_stage_validate_transition
  ON public.room_stage_state;

CREATE TRIGGER room_stage_validate_transition
  BEFORE UPDATE ON public.room_stage_state
  FOR EACH ROW EXECUTE FUNCTION private.validate_room_stage_transition();

-- Trigger functions are invoked by PostgreSQL, not directly by clients.
REVOKE ALL ON FUNCTION private.validate_room_stage_transition()
  FROM PUBLIC, anon, authenticated;

-- Approved users can read stage state for rooms they can access.
ALTER TABLE public.room_stage_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_stage_state_select"
  ON public.room_stage_state;

DROP POLICY IF EXISTS "room_stage_state_update"
  ON public.room_stage_state;

CREATE POLICY "room_stage_state_select"
  ON public.room_stage_state FOR SELECT
  TO authenticated
  USING (
    private.is_approved_user((select auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.rooms
      WHERE rooms.id = room_stage_state.room_id
    )
  );

CREATE POLICY "room_stage_state_update"
  ON public.room_stage_state FOR UPDATE
  TO authenticated
  USING (
    private.is_approved_user((select auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.rooms
      WHERE rooms.id = room_stage_state.room_id
    )
  )
  WITH CHECK (
    private.is_approved_user((select auth.uid()))
    AND EXISTS (
      SELECT 1
      FROM public.rooms
      WHERE rooms.id = room_stage_state.room_id
    )
  );

-- Optimistic, revision-checked mutation functions. They run as the caller;
-- RLS and the validation trigger remain active.
CREATE OR REPLACE FUNCTION public.claim_room_screen_share(
  p_room_id uuid,
  p_expected_revision bigint
)
RETURNS public.room_stage_state
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  next_state public.room_stage_state%ROWTYPE;
BEGIN
  UPDATE public.room_stage_state
  SET owner = 'screen_share',
      screen_share_participant_id = (select auth.uid()),
      revision = revision + 1,
      updated_by = (select auth.uid())
  WHERE room_id = p_room_id
    AND revision = p_expected_revision
    AND owner = 'idle'
  RETURNING * INTO next_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The room stage changed before screen sharing started.'
      USING ERRCODE = '40001';
  END IF;

  RETURN next_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_room_screen_share(
  p_room_id uuid,
  p_expected_revision bigint
)
RETURNS public.room_stage_state
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  next_state public.room_stage_state%ROWTYPE;
BEGIN
  UPDATE public.room_stage_state
  SET owner = 'idle',
      screen_share_participant_id = NULL,
      revision = revision + 1,
      updated_by = (select auth.uid())
  WHERE room_id = p_room_id
    AND revision = p_expected_revision
    AND owner = 'screen_share'
    AND screen_share_participant_id = (select auth.uid())
  RETURNING * INTO next_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The screen-share stage is no longer owned by this user.'
      USING ERRCODE = '40001';
  END IF;

  RETURN next_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_stale_room_screen_share(
  p_room_id uuid,
  p_expected_revision bigint,
  p_expected_participant_id uuid
)
RETURNS public.room_stage_state
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  next_state public.room_stage_state%ROWTYPE;
BEGIN
  UPDATE public.room_stage_state
  SET owner = 'idle',
      screen_share_participant_id = NULL,
      revision = revision + 1,
      updated_by = (select auth.uid())
  WHERE room_id = p_room_id
    AND revision = p_expected_revision
    AND owner = 'screen_share'
    AND screen_share_participant_id = p_expected_participant_id
    AND updated_at <= now() - interval '5 seconds'
  RETURNING * INTO next_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The stale screen-share state changed or is still within its grace period.'
      USING ERRCODE = '40001';
  END IF;

  RETURN next_state;
END;
$$;

-- Least-privilege Data API access.
REVOKE ALL ON public.room_stage_state FROM anon, authenticated;
GRANT SELECT ON public.room_stage_state TO authenticated;
GRANT UPDATE (owner, screen_share_participant_id, revision, updated_by)
  ON public.room_stage_state TO authenticated;

REVOKE ALL ON FUNCTION public.claim_room_screen_share(uuid, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_room_screen_share(uuid, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_stale_room_screen_share(uuid, bigint, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_room_screen_share(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_room_screen_share(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_stale_room_screen_share(uuid, bigint, uuid) TO authenticated;

-- Realtime publication, idempotent for repeated setup runs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'room_stage_state'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_stage_state;
  END IF;
END;
$$;

-- =============================================================
-- Verification queries after running this file:
--
-- select room_id, owner, revision, updated_by, updated_at
-- from public.room_stage_state
-- order by updated_at desc;
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public' and tablename = 'room_stage_state';
--
-- select schemaname, tablename
-- from pg_publication_tables
-- where pubname = 'supabase_realtime' and tablename = 'room_stage_state';
-- =============================================================
