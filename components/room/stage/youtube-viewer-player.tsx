"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import ReactPlayer from "react-player";
import type { YouTubeActivitySession } from "../room-types";
import { getExpectedYouTubePosition } from "../youtube-activity-utils";

interface YouTubeViewerPlayerProps {
  session: YouTubeActivitySession;
}

const DRIFT_CHECK_MS = 3_000;
const DRIFT_THRESHOLD_SECONDS = 1.5;

export function YouTubeViewerPlayer({ session }: YouTubeViewerPlayerProps) {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef(session);
  const [error, setError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const player = playerRef.current;
    if (!isReady || !player) return;

    const targetPosition = getExpectedYouTubePosition(session);
    if (Math.abs(player.currentTime - targetPosition) > DRIFT_THRESHOLD_SECONDS) {
      player.currentTime = targetPosition;
    }

    if (session.playbackStatus === "playing") {
      window.setTimeout(() => {
        if (
          sessionRef.current.sessionId === session.sessionId &&
          sessionRef.current.playbackStatus === "playing" &&
          playerRef.current?.paused
        ) {
          setNeedsGesture(true);
        }
      }, 700);
    } else {
      window.setTimeout(() => setNeedsGesture(false), 0);
    }
  }, [isReady, session]);

  useEffect(() => {
    if (!isReady) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      const currentSession = sessionRef.current;
      if (!player) return;

      const targetPosition = getExpectedYouTubePosition(currentSession);

      if (
        currentSession.playbackStatus === "playing" &&
        (player.paused ||
          Math.abs(player.currentTime - targetPosition) > DRIFT_THRESHOLD_SECONDS)
      ) {
        player.currentTime = targetPosition;
        void player.play().catch(() => setNeedsGesture(true));
        return;
      }

      if (
        currentSession.playbackStatus !== "playing" &&
        Math.abs(player.currentTime - targetPosition) > DRIFT_THRESHOLD_SECONDS
      ) {
        player.currentTime = targetPosition;
      }
    }, DRIFT_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [isReady]);

  const resumeLocalPlayback = () => {
    const player = playerRef.current;
    if (!player) return;

    void player
      .play()
      .then(() => setNeedsGesture(false))
      .catch(() => setNeedsGesture(true));
  };

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
          controls={false}
          width="100%"
          height="100%"
          playsInline
          config={{
            youtube: {
              disablekb: 1,
              iv_load_policy: 3,
              rel: 0,
            },
          }}
          onReady={() => {
            setError(false);
            setIsReady(true);
          }}
          onPlaying={() => setNeedsGesture(false)}
          onError={() => setError(true)}
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-card text-sm text-muted-foreground">
              Loading YouTube
            </div>
          }
        />

        {!needsGesture && (
          <div
            className="absolute inset-0 cursor-default"
            aria-hidden="true"
          />
        )}

        {!needsGesture && session.playbackStatus === "buffering" && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
            <div className="flex min-h-10 items-center gap-2 rounded-lg bg-card px-3 text-xs font-medium text-foreground shadow-sm">
              <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
              Waiting for host
            </div>
          </div>
        )}

        {needsGesture && (
          <button
            type="button"
            onClick={resumeLocalPlayback}
            className="absolute inset-0 flex items-center justify-center bg-background/80 text-foreground"
            aria-label="Join YouTube playback"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Play className="ml-0.5 h-5 w-5" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
