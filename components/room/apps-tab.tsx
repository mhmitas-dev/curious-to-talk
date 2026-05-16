"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { MonitorPlay, Link } from "lucide-react";

interface Props {
  isAdmin: boolean;
  isWatchPartyActive: boolean;
}

export function AppsTab({ isAdmin, isWatchPartyActive }: Props) {
  const { localParticipant } = useLocalParticipant();
  const [url, setUrl] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState("");

  const handleShare = async () => {
    if (!url.trim()) return;
    setError("");

    const ytRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/;
    if (!ytRegex.test(url)) {
      setError("Please enter a valid YouTube URL.");
      return;
    }

    setIsSharing(true);
    try {
      await localParticipant.setAttributes({
        youtubeUrl: url.trim(),
        position: "0",
        isPlaying: "0",
      });
      setUrl("");
    } catch {
      setError("Failed to share. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  // ── Viewer: watch party is live ────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
          }}
        >
          <MonitorPlay className="h-8 w-8 text-white" />
        </div>

        {isWatchPartyActive ? (
          <>
            <div>
              <h3 className="text-sm font-semibold">Watch Party is Live!</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
                The host is controlling playback. Sit back and enjoy the video in
                the center stage.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Live
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold">Watch Party</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
                The host can share a YouTube video for everyone to watch together
                in sync.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Admin: share controls ──────────────────────────────────
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-5">
        <h3 className="text-sm font-semibold">Watch Party</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Share a YouTube video. You control playback; everyone watches in sync.
        </p>
      </div>

      {isWatchPartyActive ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-semibold">Watch Party is Live</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Control playback directly on the video player in the center stage.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleShare()}
              placeholder="Paste YouTube URL…"
              className="w-full rounded-lg border border-border bg-accent pl-9 pr-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <button
            onClick={handleShare}
            disabled={!url.trim() || isSharing}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
            }}
          >
            <MonitorPlay className="h-4 w-4" />
            {isSharing ? "Starting…" : "Start Watch Party"}
          </button>
        </div>
      )}
    </div>
  );
}
