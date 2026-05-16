"use client";

import { useEffect, useRef, useCallback } from "react";
import YouTube, { type YouTubePlayer, type YouTubeEvent } from "react-youtube";
import type { Participant } from "livekit-client";
import { useLocalParticipant } from "@livekit/components-react";
import { useWatchParty, type WatchPartyEvent } from "./use-watch-party";
import { MonitorPlay, StopCircle } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────
function extractVideoId(url: string): string | null {
  const regExp =
    /^.*(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11}).*/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

function applyDriftCorrection(event: WatchPartyEvent): number {
  const driftSeconds = (Date.now() - event.sentAt) / 1000;
  return Math.max(0, event.position + driftSeconds);
}

// ── Props ──────────────────────────────────────────────────────
interface Props {
  adminParticipant: Participant;
  youtubeUrl: string;
  isAdmin: boolean;
}

// ── Component ──────────────────────────────────────────────────
export function WatchPartyStage({ adminParticipant, youtubeUrl, isAdmin }: Props) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const { localParticipant } = useLocalParticipant();
  const { latestEvent, sendPlay, sendPause, sendSeek } = useWatchParty();

  // Track if we've done the initial seek for late joiners
  const initialSeeked = useRef(false);
  // Prevent feedback loops (admin broadcasting events they received)
  const isSeeking = useRef(false);

  const videoId = extractVideoId(youtubeUrl);

  // ── Viewer: apply incoming sync events ─────────────────────
  useEffect(() => {
    if (isAdmin || !playerRef.current || !latestEvent) return;

    const player = playerRef.current;
    const correctedPosition = applyDriftCorrection(latestEvent);

    switch (latestEvent.type) {
      case "PLAY":
        player.seekTo(correctedPosition, true);
        player.playVideo();
        break;
      case "PAUSE":
        player.seekTo(correctedPosition, true);
        player.pauseVideo();
        break;
      case "SEEK":
        player.seekTo(correctedPosition, true);
        break;
    }
  }, [latestEvent, isAdmin]);

  // ── Late-joiner sync: seek to current position on mount ────
  const handleReady = useCallback(
    (event: YouTubeEvent) => {
      playerRef.current = event.target;

      if (!isAdmin && !initialSeeked.current) {
        initialSeeked.current = true;
        const savedPosition = parseFloat(
          adminParticipant.attributes?.position ?? "0"
        );
        const savedIsPlaying = adminParticipant.attributes?.isPlaying === "1";
        if (savedPosition > 0) {
          event.target.seekTo(savedPosition, true);
        }
        // Mirror the current playback state
        if (savedIsPlaying) {
          event.target.playVideo();
        } else {
          event.target.pauseVideo();
        }
      }

      // Admin: start paused, let them control
      if (isAdmin) {
        event.target.pauseVideo();
      }
    },
    [isAdmin, adminParticipant]
  );

  // ── Admin: 5-second attribute snapshot for late joiners ────
  useEffect(() => {
    if (!isAdmin || !playerRef.current) return;

    const interval = setInterval(async () => {
      if (!playerRef.current) return;
      const position = playerRef.current.getCurrentTime?.() ?? 0;
      const state = playerRef.current.getPlayerState?.();
      // YouTube player state 1 = playing
      const isPlaying = state === 1;
      await localParticipant.setAttributes({
        position: String(Math.floor(position)),
        isPlaying: isPlaying ? "1" : "0",
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isAdmin, localParticipant]);

  // ── Admin: player event handlers ───────────────────────────
  const handlePlay = useCallback(
    (event: YouTubeEvent) => {
      if (!isAdmin) return;
      sendPlay(event.target.getCurrentTime());
    },
    [isAdmin, sendPlay]
  );

  const handlePause = useCallback(
    (event: YouTubeEvent) => {
      if (!isAdmin) return;
      sendPause(event.target.getCurrentTime());
    },
    [isAdmin, sendPause]
  );

  const handleStateChange = useCallback(
    (event: YouTubeEvent) => {
      if (!isAdmin) return;
      // State 2 = paused, handled by onPause. State 5 = video cued (after seek).
      // We detect seeks via state change when NOT triggered by a play/pause event.
      if (event.data === 5 && !isSeeking.current) {
        isSeeking.current = true;
        sendSeek(event.target.getCurrentTime());
        setTimeout(() => { isSeeking.current = false; }, 300);
      }
    },
    [isAdmin, sendSeek]
  );

  // ── Admin: stop sharing ────────────────────────────────────
  const handleStop = useCallback(async () => {
    await localParticipant.setAttributes({
      youtubeUrl: "",
      position: "",
      isPlaying: "",
    });
  }, [localParticipant]);

  if (!videoId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 opacity-50 select-none">
        <p className="text-sm text-muted-foreground">Invalid YouTube URL</p>
      </div>
    );
  }

  const adminName = adminParticipant.name ?? adminParticipant.identity;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 overflow-hidden">
      {/* ── Player shell ── */}
      <div className="relative w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-border/40 bg-black"
        style={{ aspectRatio: "16/9" }}
      >
        <YouTube
          videoId={videoId}
          onReady={handleReady}
          onPlay={handlePlay}
          onPause={handlePause}
          onStateChange={handleStateChange}
          opts={{
            width: "100%",
            height: "100%",
            playerVars: {
              autoplay: 0,
              controls: isAdmin ? 1 : 0,
              // Disable related videos, branding noise
              rel: 0,
              modestbranding: 1,
            },
          }}
          className="absolute inset-0 w-full h-full"
          iframeClassName="absolute inset-0 w-full h-full"
        />
      </div>

      {/* ── Status bar ── */}
      <div className="flex w-full max-w-4xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
          {isAdmin ? (
            <span>You are hosting the Watch Party</span>
          ) : (
            <span>
              Watching with{" "}
              <span className="font-semibold text-foreground">{adminName}</span>{" "}
              — only the host controls playback
            </span>
          )}
        </div>

        {isAdmin && (
          <button
            onClick={handleStop}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive hover:text-white"
          >
            <StopCircle className="h-3.5 w-3.5" />
            Stop Sharing
          </button>
        )}

        {!isAdmin && (
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
            <MonitorPlay className="h-3.5 w-3.5" />
            Watch Party
          </div>
        )}
      </div>
    </div>
  );
}
