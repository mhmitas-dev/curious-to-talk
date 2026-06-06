"use client";

import type {
  BufferTime,
  RoomStageOwner,
  YouTubeActivitySession,
  YouTubePlaybackStatus,
} from "../room-types";
import { IdleStage } from "./idle-stage";
import { ScreenShareStage } from "./screen-share-stage";
import { YouTubeActivityStage } from "./youtube-activity-stage";

interface RoomStageProps {
  bufferTime: BufferTime;
  owner: RoomStageOwner;
  youtube: {
    isHost: boolean;
    onEnd: () => void | Promise<void>;
    onHostPlaybackChange: (
      command: "pause" | "play" | "seek",
      playbackStatus: YouTubePlaybackStatus,
      positionSeconds: number
    ) => Promise<boolean>;
    session: YouTubeActivitySession | null;
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
      <YouTubeActivityStage
        isHost={youtube.isHost}
        onEnd={youtube.onEnd}
        onHostPlaybackChange={youtube.onHostPlaybackChange}
        session={youtube.session}
      />
    );
  }

  return <IdleStage />;
}
