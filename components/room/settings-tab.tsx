"use client";

import { useState } from "react";
import { Monitor } from "lucide-react";
import type { BufferTime, ScreenFPS, ScreenQuality } from "./room-types";

interface SettingsTabProps {
  screenQuality: ScreenQuality;
  setScreenQuality: (q: ScreenQuality) => void;
  screenFps: ScreenFPS;
  setScreenFps: (fps: ScreenFPS) => void;
  bufferTime: BufferTime;
  setBufferTime: (b: BufferTime) => void;
}

export function SettingsTab({
  screenQuality,
  setScreenQuality,
  screenFps,
  setScreenFps,
  bufferTime,
  setBufferTime,
}: SettingsTabProps) {
  const [view, setView] = useState<"main" | "screenShare">("main");

  if (view === "main") {
    return (
      <div className="flex h-full flex-col p-4 gap-6">
        <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">
          Settings
        </h3>
        <div className="flex flex-col gap-2 px-2">
          <button
            onClick={() => setView("screenShare")}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground group-hover:scale-105 transition-transform">
                <Monitor className="h-5 w-5" />
              </div>
              <span className="font-medium text-foreground">Screen Share</span>
            </div>
            <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">
              →
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 gap-6 animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-2 px-2">
        <button
          onClick={() => setView("main")}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors -ml-2"
          aria-label="Back to settings menu"
        >
          <span className="text-xl leading-none mb-1">←</span>
        </button>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Screen Share
        </h3>
      </div>

      <div className="flex flex-col gap-5 px-2">
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-primary text-center">Quality</label>
            <select
              value={screenQuality}
              onChange={(e) => setScreenQuality(e.target.value as ScreenQuality)}
              className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-primary cursor-pointer"
            >
              <option value="720p">720p (HD)</option>
              <option value="1080p">1080p (FHD)</option>
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-primary text-center">Frame Rate</label>
            <select
              value={screenFps}
              onChange={(e) => setScreenFps(Number(e.target.value) as ScreenFPS)}
              className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-primary cursor-pointer"
            >
              <option value={15}>15 fps</option>
              <option value={30}>30 fps</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-primary text-center">Buffer Time</label>
          <select
            value={bufferTime}
            onChange={(e) => setBufferTime(Number(e.target.value) as BufferTime)}
            className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-primary cursor-pointer"
          >
            <option value={0}>No buffer - Better for Realtime</option>
            <option value={1}>1 second - Better for Quality</option>
            <option value={3}>3 seconds - Better for Quality</option>
            <option value={5}>5 seconds - Better for Quality</option>
          </select>
        </div>
      </div>
    </div>
  );
}
