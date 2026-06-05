"use client";

import { MdScreenShare, MdStopScreenShare } from "react-icons/md";
import type { BufferTime, ScreenFPS, ScreenQuality, ScreenShareMode } from "../room-types";
import type { ScreenShareAppState } from "./room-app-types";

export function ScreenShareApp({
  bufferTime,
  screenShare,
  screenFps,
  screenQuality,
  screenShareMode,
  onToggleScreenShare,
  setBufferTime,
  setScreenFps,
  setScreenQuality,
  setScreenShareMode,
}: ScreenShareAppState) {
  const { iAmSharing, someoneElseIsSharing, sharerName } = screenShare;
  const actionLabel = iAmSharing
    ? "Stop sharing"
    : someoneElseIsSharing
      ? "Sharing unavailable"
      : "Create screen share";
  const statusText = iAmSharing
    ? "You are presenting"
    : someoneElseIsSharing
      ? `${sharerName} is presenting`
      : "Ready to share";

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              iAmSharing
                ? "bg-primary text-primary-foreground"
                : someoneElseIsSharing
                  ? "bg-accent text-muted-foreground"
                  : "bg-sidebar text-foreground"
            }`}
          >
            {iAmSharing ? (
              <MdStopScreenShare className="h-5 w-5" />
            ) : (
              <MdScreenShare className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {iAmSharing
                ? "Screen share is live"
                : someoneElseIsSharing
                  ? "Someone is already sharing"
                  : "Share your screen"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {iAmSharing
                ? "Stop when you are finished presenting."
                : someoneElseIsSharing
                  ? "Only one screen share can run in the room at a time."
                  : "Choose a tab, window, or screen from your browser prompt."}
            </p>
            <p className="mt-3 text-xs font-medium text-primary">
              {statusText}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleScreenShare}
        disabled={someoneElseIsSharing}
        className={`flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          iAmSharing
            ? "bg-destructive/15 text-destructive hover:bg-destructive/20"
            : someoneElseIsSharing
              ? "cursor-not-allowed bg-card text-muted-foreground opacity-60"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {actionLabel}
      </button>

      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-sm">
        <div>
          <p className="text-sm font-medium text-foreground">Share settings</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            These settings apply when you start a new screen share.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <SelectSetting
            label="Mode"
            value={screenShareMode}
            onChange={(value) => setScreenShareMode(value as ScreenShareMode)}
            options={[
              { value: "standard", label: "Standard" },
              { value: "document", label: "Document" },
            ]}
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectSetting
              label="Quality"
              value={screenQuality}
              onChange={(value) => setScreenQuality(value as ScreenQuality)}
              options={[
                { value: "720p", label: "720p" },
                { value: "1080p", label: "1080p" },
              ]}
            />
            <SelectSetting
              label="Frame rate"
              value={String(screenFps)}
              onChange={(value) => setScreenFps(Number(value) as ScreenFPS)}
              options={[
                { value: "15", label: "15 fps" },
                { value: "30", label: "30 fps" },
              ]}
            />
          </div>

          <SelectSetting
            label="Buffer"
            value={String(bufferTime)}
            onChange={(value) => setBufferTime(Number(value) as BufferTime)}
            options={[
              { value: "0", label: "No buffer" },
              { value: "1", label: "1 second" },
              { value: "3", label: "3 seconds" },
              { value: "5", label: "5 seconds" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function SelectSetting({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-primary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-border bg-sidebar px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
