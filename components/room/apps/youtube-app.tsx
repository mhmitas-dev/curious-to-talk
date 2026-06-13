"use client";

import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useParticipants } from "@livekit/components-react";
import { Clock, LoaderCircle, Play, Search, Square } from "lucide-react";
import { FaYoutube } from "react-icons/fa";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchYouTube,
  type YouTubeSearchResult,
} from "@/lib/youtube/search-client";
import { parseYouTubeVideoId } from "@/lib/youtube/parse-youtube-url";
import type { YouTubeAppState } from "./room-app-types";

type SearchStatus = "error" | "idle" | "loading" | "ready";
type PlaybackActionLabel = "Play" | "Play instead" | "Replace with";

interface PendingHandoffSelection {
  resultId: string | null;
  source: "link" | "search";
  title: string;
  value: string;
}

export function YouTubeApp({
  disabled,
  disabledReason,
  error: activityError,
  isHost,
  isRecovering,
  isRequestingHandoff,
  isReplacing,
  isStarting,
  visible,
  session,
  onEnd,
  onPlay,
  onRequestHandoff,
}: YouTubeAppState) {
  const participants = useParticipants();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [startingResultId, setStartingResultId] = useState<string | null>(null);
  const [pendingHandoff, setPendingHandoff] =
    useState<PendingHandoffSelection | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchResultsRef = useRef<YouTubeSearchResult[]>([]);
  const hostParticipant = session
    ? participants.find(
        (participant) => participant.identity === session.hostIdentity
      )
    : null;
  const hostName = hostParticipant?.name?.trim() || "Someone";
  const playbackActionPending =
    isStarting || isReplacing || isRequestingHandoff;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;

    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setPendingHandoff(null);
      setSearchStatus((current) =>
        current === "loading"
          ? searchResultsRef.current.length > 0
            ? "ready"
            : "idle"
          : current
      );
    };
  }, [visible]);

  const playVideo = async (value: string, invalidMessage: string) => {
    if (disabled || playbackActionPending) return;

    setError(null);

    const result = await onPlay(value);
    if (result === "invalid") {
      setError(invalidMessage);
      return false;
    }

    if (result === "already-playing") {
      setError("This video is already on stage.");
      return false;
    }

    if (result === "occupied") {
      setError("The stage is already being used.");
      return false;
    }

    if (result === "failed") {
      setError(
        session
          ? "YouTube could not change videos. Try again."
          : "YouTube could not start. Try again."
      );
      return false;
    }

    setError(null);
    return true;
  };

  const requestVideoHandoff = async (
    selection: PendingHandoffSelection,
    invalidMessage: string
  ) => {
    setError(null);

    const result = await onRequestHandoff(selection.value);
    if (result === "replaced") {
      setError(null);
      if (selection.source === "link") setInput("");
      else setSearchError(null);
      return true;
    }

    if (result === "invalid") {
      setError(invalidMessage);
    } else if (result === "already-playing") {
      setError("This video is already on stage.");
    } else if (result === "timeout") {
      setError(`${hostName} did not respond. The current video is still playing.`);
    } else if (result === "occupied") {
      setError("The room changed before this video could start. Try again.");
    } else {
      setError("YouTube could not change videos. Try again.");
    }

    return false;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (session && !isHost) {
      if (!parseYouTubeVideoId(input)) {
        setError("Enter a valid YouTube link.");
        return;
      }

      setPendingHandoff({
        resultId: null,
        source: "link",
        title: "the pasted video",
        value: input,
      });
      return;
    }

    const played = await playVideo(input, "Enter a valid YouTube link.");
    if (played) setInput("");
  };

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchInput.trim();
    if (!query) {
      setSearchError("Search for a video or artist.");
      searchResultsRef.current = [];
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

      searchResultsRef.current = response.results;
      setSearchResults(response.results);
      setSearchStatus("ready");
      if (response.results.length === 0) {
        setSearchError("No videos found.");
      }
    } catch (searchError) {
      if (abortController.signal.aborted) return;

      console.error("Failed to search YouTube", searchError);
      searchResultsRef.current = [];
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
    if (disabled || playbackActionPending || startingResultId) return;

    if (session && !isHost) {
      setPendingHandoff({
        resultId: result.id,
        source: "search",
        title: result.title,
        value: result.url || result.id,
      });
      return;
    }

    setStartingResultId(result.id);
    try {
      const played = await playVideo(
        result.url || result.id,
        "This search result cannot be played."
      );
      if (played) setSearchError(null);
    } finally {
      setStartingResultId(null);
    }
  };

  const confirmHandoff = async () => {
    const selection = pendingHandoff;
    if (!selection || isRequestingHandoff) return;

    setStartingResultId(selection.resultId);
    try {
      await requestVideoHandoff(
        selection,
        selection.source === "link"
          ? "Enter a valid YouTube link."
          : "This search result cannot be played."
      );
    } finally {
      setStartingResultId(null);
    }
  };

  const title = session ? "YouTube is on stage" : "Play YouTube";
  const status = session
    ? isHost
      ? "You are the host"
      : `${hostName} is hosting`
    : isRecovering
      ? "Checking room"
      : "Ready";

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
      <div className="rounded-xl bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              session
                ? "bg-primary text-primary-foreground"
                : "bg-sidebar text-foreground"
            }`}
          >
            <FaYoutube className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs font-medium text-primary">{status}</p>
          </div>

          {session && isHost && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="shrink-0"
              disabled={isReplacing}
              onClick={() => void onEnd()}
              aria-label="End YouTube"
            >
              <Square data-icon="inline-start" />
              End
            </Button>
          )}
        </div>
      </div>

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
          actionLabel={
            session ? (isHost ? "Replace with" : "Play instead") : "Play"
          }
          disabled={
            disabled ||
            playbackActionPending ||
            !!startingResultId
          }
          results={searchResults}
          onPlayResult={playSearchResult}
          startingResultId={startingResultId}
          status={searchStatus}
          error={searchError}
        />

        <>
          <div className="relative flex items-center justify-center">
            <span className="h-px flex-1 bg-border" />
            <span className="px-3 text-[10px] font-semibold uppercase text-muted-foreground">
              or paste link
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

            <form onSubmit={submit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-primary">
                  {session
                    ? isHost
                      ? "Replace with a link"
                      : "Play a different video"
                    : "Video link"}
                </span>
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
                  disabled={disabled || playbackActionPending}
                  aria-invalid={!!error}
                />
              </label>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={
                  disabled || playbackActionPending || !input.trim()
                }
              >
                <Play data-icon="inline-start" />
                {isRequestingHandoff
                  ? "Requesting"
                  : isReplacing
                  ? "Replacing"
                  : isStarting
                    ? "Starting"
                    : session
                      ? isHost
                        ? "Replace"
                        : "Play instead"
                      : "Play"}
              </Button>
            </form>
          </>
      </div>

      {session && (
        <div className="rounded-xl bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
          <p className="font-medium text-foreground">Video ID</p>
          <p className="mt-1 break-all">{session.videoId}</p>
        </div>
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

      <AlertDialog
        open={!!pendingHandoff}
        onOpenChange={(open) => {
          if (!open) setPendingHandoff(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Play this video instead?</AlertDialogTitle>
            <AlertDialogDescription>
              {hostName} is currently playing YouTube. Starting
              {pendingHandoff ? ` “${pendingHandoff.title}”` : " this video"}
              {" "}will end their video and make you the host.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRequestingHandoff}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isRequestingHandoff}
              onClick={() => void confirmHandoff()}
            >
              <Play data-icon="inline-start" />
              Play video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SearchResults({
  actionLabel,
  disabled,
  error,
  onPlayResult,
  results,
  startingResultId,
  status,
}: {
  actionLabel: PlaybackActionLabel;
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
          actionLabel={actionLabel}
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
  actionLabel,
  disabled,
  isStarting,
  onPlay,
  result,
}: {
  actionLabel: PlaybackActionLabel;
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
      aria-label={`${actionLabel} ${result.title}`}
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
