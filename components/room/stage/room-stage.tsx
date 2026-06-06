"use client";

import type {
  BufferTime,
  RoomStageOwner,
  YouTubePlaybackStatus,
  YouTubeSessionSnapshot,
} from "../room-types";
import { IdleStage } from "./idle-stage";
import { ScreenShareStage } from "./screen-share-stage";
import { YouTubeStage } from "./youtube-stage";

interface RoomStageProps {
  bufferTime: BufferTime;
  owner: RoomStageOwner;
  youtube: {
    isHost: boolean;
    session: YouTubeSessionSnapshot | null;
    onEnd: () => void | Promise<void>;
    onPlaybackChange: (
      status: YouTubePlaybackStatus,
      positionSeconds: number
    ) => Promise<boolean>;
  };
}

export function RoomStage({
  bufferTime,
  owner,
  youtube,
}: RoomStageProps) {
  if (owner === "screenShare") {
    return <ScreenShareStage bufferTime={bufferTime} />;
  }

  if (youtube.session) {
    return (
      <YouTubeStage
        isHost={youtube.isHost}
        session={youtube.session}
        onEnd={youtube.onEnd}
        onPlaybackChange={youtube.onPlaybackChange}
      />
    );
  }

  return <IdleStage />;
}
