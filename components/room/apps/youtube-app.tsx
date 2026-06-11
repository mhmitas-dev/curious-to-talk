"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Clock, LoaderCircle, Play, Search, Square } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchYouTube,
  type YouTubeSearchResult,
} from "@/lib/youtube/search-client";
import type { YouTubeAppState } from "./room-app-types";

type SearchStatus = "error" | "idle" | "loading" | "ready";

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
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [startingResultId, setStartingResultId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startVideo = async (value: string, invalidMessage: string) => {
    if (disabled || isStarting || session) return;

    setError(null);

    const result = await onStart(value);
    if (result === "invalid") {
      setError(invalidMessage);
      return false;
    }

    if (result === "occupied") {
      setError("The stage is already being used.");
      return false;
    }

    if (result === "failed") {
      setError("YouTube could not start. Try again.");
      return false;
    }

    setError(null);
    return true;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const started = await startVideo(input, "Enter a valid YouTube link.");
    if (started) setInput("");
  };

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchInput.trim();
    if (!query) {
      setSearchError("Search for a video or artist.");
      setSearchResults([]);
      setSearchStatus("idle");
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setSearchError(null);
    setSearchStatus("loading");

    try {
      const response = await searchYouTube(query, {
        limit: 10,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) return;

      setSearchResults(response.results);
      setSearchStatus("ready");
      if (response.results.length === 0) {
        setSearchError("No videos found.");
      }
    } catch (searchError) {
      if (abortController.signal.aborted) return;

      console.error("Failed to search YouTube", searchError);
      setSearchResults([]);
      setSearchStatus("error");
      setSearchError("YouTube search is unavailable right now.");
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const playSearchResult = async (result: YouTubeSearchResult) => {
    if (disabled || isStarting || session || startingResultId) return;

    setStartingResultId(result.id);
    try {
      const started = await startVideo(
        result.url || result.id,
        "This search result cannot be played."
      );
      if (started) setSearchError(null);
    } finally {
      setStartingResultId(null);
    }
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
        <div className="flex flex-col gap-4">
          <form onSubmit={submitSearch} className="space-y-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-primary">Search YouTube</span>
              <div className="flex gap-2">
                <Input
                  type="search"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    if (searchError) setSearchError(null);
                  }}
                  placeholder="Search videos"
                  className="h-10 bg-background"
                  disabled={searchStatus === "loading"}
                  aria-invalid={searchStatus === "error"}
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  disabled={searchStatus === "loading" || !searchInput.trim()}
                  aria-label="Search YouTube"
                >
                  {searchStatus === "loading" ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </label>
          </form>

          <SearchResults
            disabled={disabled || isStarting || !!startingResultId}
            results={searchResults}
            onPlayResult={playSearchResult}
            startingResultId={startingResultId}
            status={searchStatus}
            error={searchError}
          />

          <div className="relative flex items-center justify-center">
            <span className="h-px flex-1 bg-border" />
            <span className="px-3 text-[10px] font-semibold uppercase text-muted-foreground">
              or paste link
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

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
        </div>
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

function SearchResults({
  disabled,
  error,
  onPlayResult,
  results,
  startingResultId,
  status,
}: {
  disabled: boolean;
  error: string | null;
  onPlayResult: (result: YouTubeSearchResult) => void | Promise<void>;
  results: YouTubeSearchResult[];
  startingResultId: string | null;
  status: SearchStatus;
}) {
  if (status === "idle" && results.length === 0 && !error) {
    return (
      <div className="rounded-xl bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
        Search results will appear here.
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-sm">
        <LoaderCircle className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error && results.length === 0) {
    return (
      <div className="rounded-xl bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {results.map((result) => (
        <YouTubeSearchResultRow
          key={result.id}
          disabled={disabled}
          isStarting={startingResultId === result.id}
          result={result}
          onPlay={() => onPlayResult(result)}
        />
      ))}
    </div>
  );
}

function YouTubeSearchResultRow({
  disabled,
  isStarting,
  onPlay,
  result,
}: {
  disabled: boolean;
  isStarting: boolean;
  onPlay: () => void | Promise<void>;
  result: YouTubeSearchResult;
}) {
  return (
    <button
      type="button"
      onClick={() => void onPlay()}
      disabled={disabled}
      className="flex w-full gap-3 rounded-xl bg-card p-2.5 text-left shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={`Play ${result.title}`}
    >
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-sidebar">
        {/* eslint-disable-next-line @next/next/no-img-element -- Remote YouTube thumbnails are discovery metadata, not app-owned media assets. */}
        <img
          src={result.thumbnail}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <span className="absolute bottom-1 right-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground">
          {formatDuration(result.duration)}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-start gap-2 py-0.5">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
            {result.title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {result.channel}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatViewCount(result.viewCount)}
          </p>
        </div>

        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {isStarting ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </button>
  );
}

function formatDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return "--:--";

  const totalSeconds = Math.floor(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatViewCount(viewCount: number) {
  if (!Number.isFinite(viewCount) || viewCount < 0) return "Views unavailable";

  return `${Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(viewCount)} views`;
}
