"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomStageRow, RoomStageSnapshot } from "./types";
import { toRoomStageSnapshot } from "./types";

const STAGE_COLUMNS =
  "room_id, owner, screen_share_participant_id, revision, updated_by, updated_at";

function getRpcRow(data: unknown) {
  return (Array.isArray(data) ? data[0] : data) as RoomStageRow | null;
}

export async function fetchRoomStageSnapshot(
  supabase: SupabaseClient,
  roomId: string
): Promise<RoomStageSnapshot> {
  const { data, error } = await supabase
    .from("room_stage_state")
    .select(STAGE_COLUMNS)
    .eq("room_id", roomId)
    .single();

  if (error) throw error;
  return toRoomStageSnapshot(data as RoomStageRow);
}

async function runStageMutation(
  supabase: SupabaseClient,
  functionName:
    | "claim_room_screen_share"
    | "release_room_screen_share"
    | "release_stale_room_screen_share",
  args: Record<string, string | number>
) {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throw error;

  const row = getRpcRow(data);
  if (!row) throw new Error("The room stage mutation returned no state.");
  return toRoomStageSnapshot(row);
}

export function claimRoomScreenShare(
  supabase: SupabaseClient,
  roomId: string,
  expectedRevision: number
) {
  return runStageMutation(supabase, "claim_room_screen_share", {
    p_expected_revision: expectedRevision,
    p_room_id: roomId,
  });
}

export function releaseRoomScreenShare(
  supabase: SupabaseClient,
  roomId: string,
  expectedRevision: number
) {
  return runStageMutation(supabase, "release_room_screen_share", {
    p_expected_revision: expectedRevision,
    p_room_id: roomId,
  });
}

export function releaseStaleRoomScreenShare(
  supabase: SupabaseClient,
  roomId: string,
  expectedRevision: number,
  expectedParticipantId: string
) {
  return runStageMutation(supabase, "release_stale_room_screen_share", {
    p_expected_participant_id: expectedParticipantId,
    p_expected_revision: expectedRevision,
    p_room_id: roomId,
  });
}
