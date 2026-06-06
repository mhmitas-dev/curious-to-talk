"use client";

import type {
  BufferTime,
  RoomStageOwner,
} from "../room-types";
import { IdleStage } from "./idle-stage";
import { ScreenShareStage } from "./screen-share-stage";

interface RoomStageProps {
  bufferTime: BufferTime;
  owner: RoomStageOwner;
}

export function RoomStage({
  bufferTime,
  owner,
}: RoomStageProps) {
  if (owner === "screenShare") {
    return <ScreenShareStage bufferTime={bufferTime} />;
  }

  return <IdleStage />;
}
