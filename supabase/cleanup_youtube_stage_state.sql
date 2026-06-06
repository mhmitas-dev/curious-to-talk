-- =============================================================
-- Niribi - Cleanup Stale Database-Backed YouTube Stage State
-- Run this once in the Supabase dashboard SQL editor.
--
-- Purpose:
-- - Remove the abandoned Supabase-backed YouTube playback experiment.
-- - Keep Screen Share stage ownership intact.
-- - Return the database stage owner contract to: idle | screen_share.
--
-- This is intentionally narrow. It does not touch users, rooms, profiles,
-- direct messages, room_stage_state rows used by Screen Share, or auth data.
-- =============================================================

-- Stop Realtime from watching the removed YouTube table before dropping it.
DO $$
BEGIN
  IF to_regclass('public.room_youtube_sessions') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'room_youtube_sessions'
    ) THEN
    ALTER PUBLICATION supabase_realtime
      DROP TABLE public.room_youtube_sessions;
  END IF;
END;
$$;

-- Remove room creation hook for the abandoned YouTube session table.
DROP TRIGGER IF EXISTS rooms_create_youtube_session ON public.rooms;
DROP FUNCTION IF EXISTS private.create_room_youtube_session();

-- Remove old shared-control and owner-based YouTube RPC surfaces.
DROP FUNCTION IF EXISTS public.get_room_youtube_session(uuid);
DROP FUNCTION IF EXISTS public.present_room_youtube_video(uuid, text, bigint, bigint);
DROP FUNCTION IF EXISTS public.update_room_youtube_playback(uuid, text, numeric, bigint);
DROP FUNCTION IF EXISTS public.start_room_youtube(uuid, text, bigint, bigint);
DROP FUNCTION IF EXISTS public.update_owned_room_youtube(uuid, text, numeric, bigint);
DROP FUNCTION IF EXISTS public.end_owned_room_youtube(uuid, numeric, bigint, bigint);
DROP FUNCTION IF EXISTS public.release_abandoned_room_youtube(uuid, uuid, bigint, bigint);

-- Drop policies only if the table exists. DROP POLICY errors if the table is gone.
DO $$
BEGIN
  IF to_regclass('public.room_youtube_sessions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "room_youtube_sessions_select"
      ON public.room_youtube_sessions;
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.room_youtube_sessions;

-- Reset any stale database-owned YouTube/Spotify stage rows back to idle.
-- LiveKit-first YouTube will not use room_stage_state, so these rows should
-- never remain visible after this cleanup.
DO $$
BEGIN
  IF to_regclass('public.room_stage_state') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'public.room_stage_state'::regclass
        AND tgname = 'room_stage_validate_transition'
        AND NOT tgisinternal
    ) THEN
    ALTER TABLE public.room_stage_state
      DISABLE TRIGGER room_stage_validate_transition;
  END IF;
END;
$$;

UPDATE public.room_stage_state
SET owner = 'idle',
    screen_share_participant_id = NULL,
    revision = revision + 1,
    updated_at = now()
WHERE owner NOT IN ('idle', 'screen_share');

ALTER TABLE public.room_stage_state
  DROP CONSTRAINT IF EXISTS room_stage_state_owner_check;

ALTER TABLE public.room_stage_state
  ADD CONSTRAINT room_stage_state_owner_check
  CHECK (owner IN ('idle', 'screen_share'));

-- Restore the validation trigger to the Screen Share-only database stage
-- contract. Future LiveKit-first YouTube should not alter this function.
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

DO $$
BEGIN
  IF to_regclass('public.room_stage_state') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'public.room_stage_state'::regclass
        AND tgname = 'room_stage_validate_transition'
        AND NOT tgisinternal
    ) THEN
    ALTER TABLE public.room_stage_state
      ENABLE TRIGGER room_stage_validate_transition;
  END IF;
END;
$$;

-- Verification queries:
--
-- select to_regclass('public.room_youtube_sessions') as youtube_table;
--
-- select proname
-- from pg_proc
-- join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
-- where nspname = 'public'
--   and proname like '%youtube%';
--
-- select owner, count(*)
-- from public.room_stage_state
-- group by owner
-- order by owner;
--
-- select pubname, schemaname, tablename
-- from pg_publication_tables
-- where tablename = 'room_youtube_sessions';
