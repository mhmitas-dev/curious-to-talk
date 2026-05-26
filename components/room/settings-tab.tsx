"use client";

import { useState } from "react";
import { Monitor, Sun } from "lucide-react";
import type { BufferTime, ScreenFPS, ScreenQuality, ScreenShareMode } from "./room-types";
import type { ScreenWakeLockStatus } from "./use-screen-wake-lock";

interface SettingsTabProps {
  screenShareMode: ScreenShareMode;
  setScreenShareMode: (mode: ScreenShareMode) => void;
  screenQuality: ScreenQuality;
  setScreenQuality: (q: ScreenQuality) => void;
  screenFps: ScreenFPS;
  setScreenFps: (fps: ScreenFPS) => void;
  bufferTime: BufferTime;
  setBufferTime: (b: BufferTime) => void;
  wakeLockStatus: ScreenWakeLockStatus;
  wakeLockError: string | null;
  wakeLockEnabled: boolean;
  onToggleWakeLock: () => void;
}

export function SettingsTab({
  screenShareMode,
  setScreenShareMode,
  screenQuality,
  setScreenQuality,
  screenFps,
  setScreenFps,
  bufferTime,
  setBufferTime,
  wakeLockStatus,
  wakeLockError,
  wakeLockEnabled,
  onToggleWakeLock,
}: SettingsTabProps) {
  const [view, setView] = useState<"main" | "screenShare">("main");

  if (view === "main") {
    return (
      <div className="flex h-full flex-col p-4 gap-6">
        <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">
          Settings
        </h3>
        <div className="flex flex-col gap-5 px-2">
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

          <div className="flex flex-col gap-2">
            <h4 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Display Options
            </h4>
            <DisplayOptionButton
              status={wakeLockStatus}
              error={wakeLockError}
              isEnabled={wakeLockEnabled}
              onToggle={onToggleWakeLock}
            />
          </div>
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
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-primary text-center">Mode</label>
          <select
            value={screenShareMode}
            onChange={(e) => setScreenShareMode(e.target.value as ScreenShareMode)}
            className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-primary cursor-pointer"
          >
            <option value="standard">Standard</option>
            <option value="document">Document</option>
          </select>
        </div>

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

function DisplayOptionButton({
  status,
  error,
  isEnabled,
  onToggle,
}: {
  status: ScreenWakeLockStatus;
  error: string | null;
  isEnabled: boolean;
  onToggle: () => void;
}) {
  const isActive = status === "active";
  const isUnsupported = status === "unsupported";
  const isAttentionState = status === "blocked" || status === "released";
  const label = getWakeLockLabel(status, isEnabled, error);
  const statusText = getWakeLockStatusText(status, isEnabled);

  return (
    <button
      onClick={onToggle}
      disabled={isUnsupported}
      className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
        isActive
          ? "border-secondary bg-secondary text-secondary-foreground shadow-sm"
          : isAttentionState
            ? "border-destructive/35 bg-card text-foreground hover:bg-destructive/10"
            : "border-border bg-card text-foreground hover:bg-accent/50"
      } ${isUnsupported ? "cursor-not-allowed opacity-55 hover:bg-card" : ""}`}
      aria-label={label}
      title={label}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
            isActive
              ? "bg-secondary-foreground text-secondary"
              : isAttentionState
                ? "bg-destructive/15 text-destructive"
                : "bg-primary text-primary-foreground"
          }`}
        >
          <Sun
            className={`h-5 w-5 ${status === "requesting" ? "animate-pulse" : ""}`}
          />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-medium">Keep screen awake</span>
          <span
            className={`mt-0.5 block text-xs ${
              isActive ? "text-secondary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {statusText}
          </span>
        </div>
      </div>
      <span
        className={`ml-3 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
          isActive
            ? "bg-secondary-foreground text-secondary"
            : isAttentionState
              ? "bg-destructive/15 text-destructive"
              : "bg-accent text-muted-foreground"
        }`}
      >
        {isActive ? "On" : "Off"}
      </span>
    </button>
  );
}

function getWakeLockLabel(
  status: ScreenWakeLockStatus,
  isEnabled: boolean,
  error: string | null
) {
  if (status === "unsupported") {
    return "Keeping the screen awake is not supported in this browser";
  }

  if (status === "blocked") {
    return error
      ? `Keeping the screen awake was blocked: ${error}`
      : "Keeping the screen awake was blocked. Tap to retry";
  }

  if (status === "released") {
    return "Screen wake lock was released. Tap to retry";
  }

  if (status === "requesting") {
    return "Requesting screen wake lock";
  }

  if (status === "active") {
    return "Keeping screen awake. Tap to turn off";
  }

  return isEnabled
    ? "Keep screen awake"
    : "Screen wake lock is off. Tap to keep screen awake";
}

function getWakeLockStatusText(
  status: ScreenWakeLockStatus,
  isEnabled: boolean
) {
  if (status === "active") return "On";
  if (status === "requesting") return "Turning on";
  if (status === "unsupported") return "Unavailable";
  if (status === "blocked" || status === "released") return "Tap to retry";
  return isEnabled ? "Ready" : "Off";
}
