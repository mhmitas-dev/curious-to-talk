"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactPlayer from "react-player";
import type {
  YouTubeActivitySession,
  YouTubePlaybackCommand,
  YouTubePlaybackStatus,
} from "../room-types";
import { getExpectedYouTubePosition } from "../youtube-activity-utils";

interface YouTubeHostPlayerProps {
  session: YouTubeActivitySession;
  onEnd: () => void | Promise<void>;
  onPlaybackChange: (
    command: YouTubePlaybackCommand,
    playbackStatus: YouTubePlaybackStatus,
    positionSeconds: number
  ) => Promise<boolean>;
}

const HOST_BUFFERING_DEBOUNCE_MS = 1_200;
const HOST_SEEK_BROADCAST_THRESHOLD_SECONDS = 1;

export function YouTubeHostPlayer({
  session,
  onEnd,
  onPlaybackChange,
}: YouTubeHostPlayerProps) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const bufferingTimerRef = useRef<number | null>(null);
  const sessionRef = useRef(session);
  const [error, setError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearBufferingTimer = useCallback(() => {
    if (bufferingTimerRef.current !== null) {
      window.clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
  }, []);

  const getPlayerPosition = () => {
    const position = playerRef.current?.currentTime;
    if (typeof position === "number" && Number.isFinite(position)) {
      return Math.max(0, position);
    }

    return getExpectedYouTubePosition(sessionRef.current);
  };

  const getPlayerStatus = (): YouTubePlaybackStatus => {
    const player = playerRef.current;
    if (!player) return sessionRef.current.playbackStatus;
    if (player.ended) return "paused";
    return player.paused ? "paused" : "playing";
  };

  const publishPlayerChange = (
    command: YouTubePlaybackCommand,
    playbackStatus: YouTubePlaybackStatus = getPlayerStatus()
  ) => {
    void onPlaybackChange(command, playbackStatus, getPlayerPosition());
  };

  const scheduleBuffering = () => {
    const player = playerRef.current;
    if (!isReady || !player || player.paused || player.ended) return;
    if (sessionRef.current.playbackStatus !== "playing") return;

    clearBufferingTimer();
    bufferingTimerRef.current = window.setTimeout(() => {
      const latestPlayer = playerRef.current;
      if (
        latestPlayer &&
        !latestPlayer.paused &&
        !latestPlayer.ended &&
        sessionRef.current.playbackStatus === "playing"
      ) {
        publishPlayerChange("buffering", "buffering");
      }
      bufferingTimerRef.current = null;
    }, HOST_BUFFERING_DEBOUNCE_MS);
  };

  useEffect(() => {
    const player = playerRef.current;
    if (!isReady || !player) return;

    const targetPosition = getExpectedYouTubePosition(session);
    if (Math.abs(player.currentTime - targetPosition) > 1) {
      player.currentTime = targetPosition;
    }
  }, [isReady, session]);

  useEffect(() => {
    return () => clearBufferingTimer();
  }, [clearBufferingTimer]);

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
          playing={session.playbackStatus !== "paused"}
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
          onPlay={() => {
            clearBufferingTimer();
            publishPlayerChange("play", "playing");
          }}
          onPlaying={() => {
            clearBufferingTimer();
            if (sessionRef.current.playbackStatus !== "playing") {
              publishPlayerChange("play", "playing");
            }
          }}
          onPause={() => {
            clearBufferingTimer();
            if (!playerRef.current?.ended) {
              publishPlayerChange("pause", "paused");
            }
          }}
          onLoadStart={scheduleBuffering}
          onStalled={scheduleBuffering}
          onWaiting={scheduleBuffering}
          onSeeking={() => {
            clearBufferingTimer();
            const targetPosition = getPlayerPosition();
            const expectedHostPosition = getExpectedYouTubePosition(
              sessionRef.current
            );
            if (
              Math.abs(targetPosition - expectedHostPosition) >
              HOST_SEEK_BROADCAST_THRESHOLD_SECONDS
            ) {
              publishPlayerChange("seek");
            }
          }}
          onSeeked={() => publishPlayerChange("seek")}
          onEnded={() => {
            clearBufferingTimer();
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
