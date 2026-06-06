"use client";

import type {
  YouTubePlaybackStatus,
  YouTubeSessionSnapshot,
} from "../room-types";
import { YouTubePlayer } from "./youtube-player";

interface YouTubeStageProps {
  isHost: boolean;
  session: YouTubeSessionSnapshot;
  onEnd: () => void | Promise<void>;
  onPlaybackChange: (
    status: YouTubePlaybackStatus,
    positionSeconds: number
  ) => Promise<boolean>;
}

export function YouTubeStage({
  isHost,
  session,
  onEnd,
  onPlaybackChange,
}: YouTubeStageProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-sidebar md:p-4">
      <div className="w-full max-w-6xl overflow-hidden bg-black md:rounded-xl">
        <YouTubePlayer
          key={session.sessionId}
          isHost={isHost}
          session={session}
          onEnd={onEnd}
          onPlaybackChange={onPlaybackChange}
        />
      </div>
    </div>
  );
}
