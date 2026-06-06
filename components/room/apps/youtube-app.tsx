"use client";

import { type FormEvent, useState } from "react";
import { Play, Square } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { YouTubeAppState } from "./room-app-types";

export function YouTubeApp({
  disabled,
  disabledReason,
  error: activityError,
  isHost,
  isRecovering,
  isStarting,
  session,
  onEnd,
  onStart,
}: YouTubeAppState) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || isStarting || session) return;

    const result = await onStart(input);
    if (result === "invalid") {
      setError("Enter a valid YouTube link.");
      return;
    }

    if (result === "occupied") {
      setError("The stage is already being used.");
      return;
    }

    if (result === "failed") {
      setError("YouTube could not start. Try again.");
      return;
    }

    setInput("");
    setError(null);
  };

  const title = session ? "YouTube is on stage" : "Play YouTube";
  const description = session
    ? "The host controls playback for everyone in the room."
    : "Paste a YouTube link to watch together in this room.";
  const status = session
    ? isHost
      ? "You are the host"
      : "Someone is hosting"
    : isRecovering
      ? "Checking room"
      : "Ready";

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              session
                ? "bg-primary text-primary-foreground"
                : "bg-sidebar text-foreground"
            }`}
          >
            <FaYoutube className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
            <p className="mt-3 text-xs font-medium text-primary">{status}</p>
          </div>
        </div>
      </div>

      {!session && (
        <form onSubmit={submit} className="space-y-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium text-primary">Video link</span>
            <Input
              type="url"
              inputMode="url"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                if (error) setError(null);
              }}
              placeholder="https://youtube.com/watch?v=..."
              className="h-10 bg-background"
              disabled={disabled || isStarting}
              aria-invalid={!!error}
            />
          </label>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={disabled || isStarting || !input.trim()}
          >
            <Play data-icon="inline-start" />
            {isStarting ? "Starting" : "Play"}
          </Button>
        </form>
      )}

      {session && (
        <div className="rounded-xl bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
          <p className="font-medium text-foreground">Video ID</p>
          <p className="mt-1 break-all">{session.videoId}</p>
        </div>
      )}

      {session && isHost && (
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="w-full"
          onClick={() => void onEnd()}
        >
          <Square data-icon="inline-start" />
          End YouTube
        </Button>
      )}

      {disabledReason && (
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          {disabledReason}
        </p>
      )}
      {error && (
        <p className="px-1 text-xs leading-relaxed text-destructive">
          {error}
        </p>
      )}
      {!error && activityError && (
        <p className="px-1 text-xs leading-relaxed text-destructive">
          {activityError}
        </p>
      )}
    </div>
  );
}
