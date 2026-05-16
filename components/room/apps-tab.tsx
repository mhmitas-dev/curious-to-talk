"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { MonitorPlay } from "lucide-react";

export function AppsTab() {
  const { localParticipant } = useLocalParticipant();
  const [url, setUrl] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // Check if we are already sharing something
  const currentSharedUrl = localParticipant.attributes?.youtubeUrl;

  const handleShare = async () => {
    if (!url.trim()) return;
    
    // Basic youtube url validation
    const ytRegex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
    if (!ytRegex.test(url)) {
      alert("Please enter a valid YouTube URL");
      return;
    }

    setIsSharing(true);
    try {
      await localParticipant.setAttributes({ youtubeUrl: url });
      setUrl("");
    } catch (err) {
      console.error("Failed to share YouTube URL:", err);
      alert("Failed to share. Make sure your token has metadata update permissions.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleStopSharing = async () => {
    setIsSharing(true);
    try {
      // Set to empty string to stop sharing
      await localParticipant.setAttributes({ youtubeUrl: "" });
    } catch (err) {
      console.error("Failed to stop sharing:", err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-1">Watch Party</h3>
        <p className="text-xs text-muted-foreground">
          Share a YouTube video with the room. Others can click your profile to watch along.
        </p>
      </div>

      {currentSharedUrl ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-primary">
            <MonitorPlay className="h-5 w-5" />
            <span className="text-sm font-semibold">You are sharing a video</span>
          </div>
          <button
            onClick={handleStopSharing}
            disabled={isSharing}
            className="w-full rounded-lg bg-destructive/10 text-destructive py-2 text-sm font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
          >
            Stop Sharing
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL..."
            className="w-full rounded-lg bg-accent border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
          />
          <button
            onClick={handleShare}
            disabled={!url.trim() || isSharing}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
            }}
          >
            <MonitorPlay className="h-4 w-4" strokeWidth={2.5} />
            Start Watch Party
          </button>
        </div>
      )}
    </div>
  );
}
