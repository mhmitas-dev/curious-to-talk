import type { RoomStageOwner } from "@/components/room/room-types";

export interface RoomStageSnapshot {
  roomId: string;
  owner: RoomStageOwner;
  revision: number;
  screenShareParticipantId: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface RoomStageRow {
  room_id: string;
  owner: "idle" | "screen_share";
  revision: number;
  screen_share_participant_id: string | null;
  updated_at: string;
  updated_by: string;
}

export function toRoomStageSnapshot(row: RoomStageRow): RoomStageSnapshot {
  return {
    roomId: row.room_id,
    owner: row.owner === "screen_share" ? "screenShare" : row.owner,
    revision: Number(row.revision),
    screenShareParticipantId: row.screen_share_participant_id,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
