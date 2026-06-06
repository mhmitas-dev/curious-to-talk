"use client";

import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import ReactPlayer from "react-player";
import type {
  YouTubeActivitySession,
  YouTubePlaybackStatus,
} from "../room-types";

interface YouTubeHostPlayerProps {
  session: YouTubeActivitySession;
  onEnd: () => void | Promise<void>;
  onPlaybackChange: (
    command: "pause" | "play" | "seek",
    playbackStatus: YouTubePlaybackStatus,
    positionSeconds: number
  ) => Promise<boolean>;
}

function expectedPosition(session: YouTubeActivitySession, now = Date.now()) {
  if (session.playbackStatus !== "playing") {
    return Math.max(0, session.positionSeconds);
  }

  return Math.max(
    0,
    session.positionSeconds + Math.max(0, now - session.updatedAt) / 1_000
  );
}

function getEventTarget(event: SyntheticEvent<HTMLVideoElement>) {
  return event.currentTarget;
}

export function YouTubeHostPlayer({
  session,
  onEnd,
  onPlaybackChange,
}: YouTubeHostPlayerProps) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const player = playerRef.current;
    if (!isReady || !player) return;

    const targetPosition = expectedPosition(session);
    if (Math.abs(player.currentTime - targetPosition) > 1) {
      player.currentTime = targetPosition;
    }
  }, [isReady, session]);

  if (error) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-card px-6 text-center text-sm text-muted-foreground">
        This video cannot be played here.
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden bg-black md:rounded-xl">
      <div className="relative aspect-video w-full bg-black">
        <ReactPlayer
          ref={playerRef}
          src={`https://www.youtube.com/watch?v=${session.videoId}`}
          playing={session.playbackStatus === "playing"}
          controls
          width="100%"
          height="100%"
          playsInline
          config={{
            youtube: {
              iv_load_policy: 3,
              rel: 0,
            },
          }}
          onReady={() => {
            setError(false);
            setIsReady(true);
          }}
          onPlay={(event) => {
            const player = getEventTarget(event);
            void onPlaybackChange("play", "playing", player.currentTime);
          }}
          onPause={(event) => {
            const player = getEventTarget(event);
            if (!player.ended) {
              void onPlaybackChange("pause", "paused", player.currentTime);
            }
          }}
          onSeeked={(event) => {
            const player = getEventTarget(event);
            void onPlaybackChange(
              "seek",
              player.paused ? "paused" : "playing",
              player.currentTime
            );
          }}
          onEnded={() => {
            void onEnd();
          }}
          onError={() => setError(true)}
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-card text-sm text-muted-foreground">
              Loading YouTube
            </div>
          }
        />
      </div>
    </div>
  );
}
