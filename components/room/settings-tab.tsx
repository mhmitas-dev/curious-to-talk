"use client";

import { Sun } from "lucide-react";
import type { ScreenWakeLockStatus } from "./use-screen-wake-lock";

interface SettingsTabProps {
  wakeLockStatus: ScreenWakeLockStatus;
  wakeLockError: string | null;
  wakeLockEnabled: boolean;
  onToggleWakeLock: () => void;
}

export function SettingsTab({
  wakeLockStatus,
  wakeLockError,
  wakeLockEnabled,
  onToggleWakeLock,
}: SettingsTabProps) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <h3 className="px-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Settings
      </h3>
      <div className="flex flex-col gap-2 px-2">
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
