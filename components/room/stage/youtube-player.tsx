"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type {
  YouTubePlaybackStatus,
  YouTubeSessionSnapshot,
} from "../room-types";

interface YouTubePlayerProps {
  isHost: boolean;
  session: YouTubeSessionSnapshot;
  onEnd: () => void | Promise<void>;
  onPlaybackChange: (
    status: YouTubePlaybackStatus,
    positionSeconds: number
  ) => Promise<boolean>;
}

interface YouTubeIframePlayer {
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      events: {
        onError: () => void;
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
      };
      playerVars: Record<string, number>;
      videoId: string;
    }
  ) => YouTubeIframePlayer;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const DRIFT_CHECK_MS = 3_000;
const DRIFT_THRESHOLD_SECONDS = 1.5;
const END_TOLERANCE_SECONDS = 0.5;

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector("script[data-niribi-youtube-api='true']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.niribiYoutubeApi = "true";
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

function expectedPosition(snapshot: YouTubeSessionSnapshot, now = Date.now()) {
  if (snapshot.playbackStatus !== "playing") {
    return Math.max(0, snapshot.positionSeconds);
  }

  return Math.max(
    0,
    snapshot.positionSeconds + Math.max(0, now - snapshot.updatedAt) / 1_000
  );
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const seconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function YouTubePlayer({
  isHost,
  session,
  onEnd,
  onPlaybackChange,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubeIframePlayer | null>(null);
  const sessionRef = useRef(session);
  const isHostRef = useRef(isHost);
  const onEndRef = useRef(onEnd);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [position, setPosition] = useState(0);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);

  useEffect(() => {
    sessionRef.current = session;
    isHostRef.current = isHost;
    onEndRef.current = onEnd;
  }, [isHost, onEnd, session]);

  useEffect(() => {
    let cancelled = false;

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;

      playerRef.current = new YT.Player(containerRef.current, {
        videoId: session.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            setError(false);
            setIsReady(true);
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              setNeedsGesture(false);
            }

            if (event.data === YT.PlayerState.ENDED && isHostRef.current) {
              void onEndRef.current();
            }
          },
          onError: () => setError(true),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [session.videoId]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const player = playerRef.current;
    const currentSession = sessionRef.current;
    const targetPosition = expectedPosition(currentSession);

    if (currentSession.playbackStatus === "playing") {
      player.loadVideoById({
        videoId: currentSession.videoId,
        startSeconds: targetPosition,
      });
    } else {
      player.cueVideoById({
        videoId: currentSession.videoId,
        startSeconds: targetPosition,
      });
    }

    setPosition(targetPosition);
  }, [isReady, session.sessionId, session.videoId]);

  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const player = playerRef.current;
    const targetPosition = expectedPosition(session);
    const currentPosition = player.getCurrentTime();
    const nextDuration = player.getDuration();
    if (nextDuration) setDuration(nextDuration);

    if (Math.abs(currentPosition - targetPosition) > DRIFT_THRESHOLD_SECONDS) {
      player.seekTo(targetPosition, true);
    }

    if (session.playbackStatus === "playing") {
      try {
        player.playVideo();
        window.setTimeout(() => {
          if (
            playerRef.current?.getPlayerState() !==
            window.YT?.PlayerState.PLAYING
          ) {
            setNeedsGesture(true);
          }
        }, 700);
      } catch {
        setNeedsGesture(true);
      }
    } else {
      player.pauseVideo();
      setNeedsGesture(false);
    }

    setPosition(targetPosition);
  }, [isReady, session]);

  useEffect(() => {
    if (!isReady) return;

    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const currentPosition = player.getCurrentTime();
      const nextDuration = player.getDuration();
      if (nextDuration) setDuration(nextDuration);

      if (
        isHostRef.current &&
        nextDuration > 0 &&
        currentPosition >= nextDuration - END_TOLERANCE_SECONDS
      ) {
        void onEndRef.current();
        return;
      }

      const targetPosition = expectedPosition(sessionRef.current);
      if (
        sessionRef.current.playbackStatus === "playing" &&
        Math.abs(currentPosition - targetPosition) > DRIFT_THRESHOLD_SECONDS
      ) {
        player.seekTo(targetPosition, true);
        setPosition(targetPosition);
        return;
      }

      setPosition(currentPosition);
    }, DRIFT_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [isReady]);

  const resumeLocalPlayback = () => {
    try {
      playerRef.current?.playVideo();
      setNeedsGesture(false);
    } catch {
      setNeedsGesture(true);
    }
  };

  const togglePlayback = async () => {
    if (!isHost || !playerRef.current) return;

    const currentPosition = playerRef.current.getCurrentTime();
    const nextStatus = session.playbackStatus === "playing" ? "paused" : "playing";
    await onPlaybackChange(nextStatus, currentPosition);
  };

  const commitSeek = async () => {
    if (seekDraft === null) return;
    const nextPosition = seekDraft;
    setSeekDraft(null);

    if (!isHost) return;
    await onPlaybackChange(session.playbackStatus, nextPosition);
  };

  if (error) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-card px-6 text-center text-sm text-muted-foreground">
        This video cannot be played here.
      </div>
    );
  }

  const displayedPosition = seekDraft ?? position;

  return (
    <div className="bg-black">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <div ref={containerRef} className="h-full w-full" />

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

      <div className="flex h-12 items-center gap-3 bg-card px-3 text-card-foreground">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!isHost || !isReady}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          aria-label={session.playbackStatus === "playing" ? "Pause" : "Play"}
        >
          {session.playbackStatus === "playing" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="ml-0.5 h-4 w-4" />
          )}
        </button>

        <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          {formatTime(displayedPosition)}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={Math.min(displayedPosition, Math.max(duration, 1))}
          onChange={(event) => setSeekDraft(Number(event.target.value))}
          onPointerUp={() => void commitSeek()}
          onKeyUp={() => void commitSeek()}
          disabled={!isHost || !isReady || duration <= 0}
          className="min-w-0 flex-1 accent-primary disabled:opacity-50"
          aria-label="Seek YouTube video"
        />
        <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {formatTime(duration)}
        </span>
        {!isHost && (
          <span className="hidden shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            Watching
          </span>
        )}
      </div>
    </div>
  );
}
