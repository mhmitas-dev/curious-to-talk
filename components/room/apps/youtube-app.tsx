"use client";

import {
  type FormEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Copy,
  Eye,
  Info,
  LoaderCircle,
  Play,
  Search,
  Square,
  Tv2,
} from "lucide-react";
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
import { useRoomParticipantName } from "../use-room-participant-name";
import type { YouTubeAppState } from "./room-app-types";

type SearchStatus = "error" | "idle" | "loading" | "ready";
type PlaybackActionLabel = "Play" | "Play instead" | "Replace with";

interface PendingHandoffSelection {
  resultId: string | null;
  source: "link" | "search";
  title: string;
  value: string;
}

const viewCountFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const YouTubeApp = memo(function YouTubeApp({
  activity,
  disabled,
  disabledReason,
  error: activityError,
  isHost,
  isRecovering,
  isRequestingHandoff,
  isReplacing,
  isStarting,
  visible,
  onEnd,
  onPlay,
  onRequestHandoff,
}: YouTubeAppState) {
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
  const hostName = useRoomParticipantName(activity?.hostIdentity ?? null);
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

  const playVideo = useCallback(async (value: string, invalidMessage: string) => {
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
        activity
          ? "YouTube could not change videos. Try again."
          : "YouTube could not start. Try again."
      );
      return false;
    }

    setError(null);
    return true;
  }, [activity, disabled, onPlay, playbackActionPending]);

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

    if (activity && !isHost) {
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

  const playSearchResult = useCallback(async (result: YouTubeSearchResult) => {
    if (disabled || playbackActionPending || startingResultId) return;

    if (activity && !isHost) {
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
  }, [activity, disabled, isHost, playVideo, playbackActionPending, startingResultId]);

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

  const title = activity ? "YouTube is on stage" : "Play YouTube";
  const status = activity
    ? isHost
      ? "You are the host"
      : `${hostName} is hosting`
    : isRecovering
      ? "Checking room"
      : "Ready";

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-4">
      {/* ── Status card ─────────────────────────────────────────────── */}
      <div
        className={`rounded-xl p-4 transition-colors ${
          activity ? "bg-red-500/10" : "bg-card"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
              activity
                ? "bg-red-500 text-white"
                : "bg-accent text-muted-foreground"
            }`}
          >
            <FaYoutube className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <div className="mt-1 flex items-center gap-1.5">
              {activity && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  aria-label="Live"
                />
              )}
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
          </div>

          {activity && isHost && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="shrink-0"
              disabled={isReplacing}
              onClick={() => void onEnd()}
              aria-label="End YouTube"
            >
              {isReplacing ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <Square data-icon="inline-start" />
              )}
              End
            </Button>
          )}
        </div>
      </div>

      {/* ── Inline notices ──────────────────────────────────────────── */}
      {disabledReason && (
        <div className="flex items-start gap-2.5 rounded-lg bg-card px-3 py-2.5 ring-1 ring-border">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {disabledReason}
          </p>
        </div>
      )}
      {(error ?? activityError) && (
        <div className="flex items-start gap-2.5 rounded-lg bg-[oklch(0.22_0.04_24/1)] px-3 py-2.5 ring-1 ring-destructive/30">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0 text-destructive" />
          <p className="text-xs leading-relaxed text-destructive">
            {error ?? activityError}
          </p>
        </div>
      )}

      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <form onSubmit={submitSearch} className="flex flex-col gap-2">
          <label
            htmlFor="youtube-search"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Search
          </label>
          <div className="flex items-stretch gap-2">
            <Input
              id="youtube-search"
              name="youtube-search"
              type="search"
              enterKeyHint="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                if (searchError) setSearchError(null);
              }}
              placeholder="Artist, song, or title…"
              className="h-10 bg-background"
              disabled={searchStatus === "loading"}
              aria-invalid={searchStatus === "error"}
            />
            <Button
              type="submit"
              size="icon-lg"
              className="size-10"
              disabled={searchStatus === "loading" || !searchInput.trim()}
              aria-label="Search YouTube"
            >
              {searchStatus === "loading" ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <Search data-icon="inline-start" />
              )}
            </Button>
          </div>
        </form>

        <SearchResults
          actionLabel={
            activity ? (isHost ? "Replace with" : "Play instead") : "Play"
          }
          disabled={disabled || playbackActionPending || !!startingResultId}
          results={searchResults}
          onPlayResult={playSearchResult}
          startingResultId={startingResultId}
          status={searchStatus}
          error={searchError}
        />
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          or paste link
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* ── Link form ───────────────────────────────────────────────── */}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {activity
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
            placeholder="https://youtube.com/watch?v=…"
            className="h-10 bg-background"
            disabled={disabled || playbackActionPending}
            aria-invalid={!!error}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={disabled || playbackActionPending || !input.trim()}
        >
          {isRequestingHandoff || isReplacing || isStarting ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          {isRequestingHandoff
            ? "Requesting…"
            : isReplacing
            ? "Replacing…"
            : isStarting
            ? "Starting…"
            : activity
            ? isHost
              ? "Replace"
              : "Play instead"
            : "Play"}
        </Button>
      </form>

      {/* ── Now playing detail ──────────────────────────────────────── */}
      {activity && (
        <NowPlayingDetail videoId={activity.videoId} />
      )}

      {/* ── Handoff confirmation dialog ──────────────────────────────── */}
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
              {pendingHandoff ? ` "${pendingHandoff.title}"` : " this video"}
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
              {isRequestingHandoff ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <Play data-icon="inline-start" />
              )}
              Play video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

function NowPlayingDetail({ videoId }: { videoId: string }) {
  const [copied, setCopied] = useState(false);
  const videoUrl = `https://youtube.com/watch?v=${videoId}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(videoUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-border">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar text-muted-foreground">
        <Tv2 className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Now playing
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-foreground">
          {videoId}
        </p>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy video link"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Copy className={`h-3.5 w-3.5 transition-opacity ${copied ? "opacity-0" : "opacity-100"}`} />
        {copied && (
          <span className="absolute text-[10px] font-medium text-primary">
            ✓
          </span>
        )}
      </button>
    </div>
  );
}

const SearchResults = memo(function SearchResults({
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
      <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-4 py-7 text-center shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar text-muted-foreground/50">
          <Search className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">Search results will appear here.</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-xl bg-card p-2.5 shadow-sm"
            style={{ opacity: 1 - i * 0.25 }}
          >
            <div className="h-16 w-24 shrink-0 animate-pulse rounded-lg bg-sidebar" />
            <div className="flex flex-1 flex-col justify-center gap-2 py-1">
              <div className="h-2.5 w-4/5 animate-pulse rounded bg-sidebar" />
              <div className="h-2 w-2/5 animate-pulse rounded bg-sidebar" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && results.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-card px-4 py-3.5 shadow-sm">
        <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
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
          onPlayResult={onPlayResult}
        />
      ))}
    </div>
  );
});

const YouTubeSearchResultRow = memo(function YouTubeSearchResultRow({
  actionLabel,
  disabled,
  isStarting,
  onPlayResult,
  result,
}: {
  actionLabel: PlaybackActionLabel;
  disabled: boolean;
  isStarting: boolean;
  onPlayResult: (result: YouTubeSearchResult) => void | Promise<void>;
  result: YouTubeSearchResult;
}) {
  return (
    <button
      type="button"
      onClick={() => void onPlayResult(result)}
      disabled={disabled}
      className="group flex w-full gap-3 rounded-xl bg-card p-2.5 text-left shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      aria-label={`${actionLabel} ${result.title}`}
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-sidebar">
        {/* eslint-disable-next-line @next/next/no-img-element -- Remote YouTube thumbnails are discovery metadata, not app-owned media assets. */}
        <img
          src={result.thumbnail}
          alt=""
          className="h-full w-full object-cover md:transition-transform md:duration-300 md:group-hover:scale-105"
          loading="lazy"
        />
        {/* Play overlay */}
        <span className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/0 transition-colors duration-200 md:flex md:group-hover:bg-black/40">
          <span className="flex h-7 w-7 scale-75 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-md transition-all duration-200 group-hover:scale-100 group-hover:opacity-100">
            {isStarting ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-black" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 text-black" />
            )}
          </span>
        </span>
        {/* Duration badge */}
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          {formatDuration(result.duration)}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5">
        <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
          {result.title}
        </h3>
        <p className="truncate text-[11px] text-muted-foreground">
          {result.channel}
        </p>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Eye className="h-2.5 w-2.5" />
          {formatViewCount(result.viewCount)}
        </p>
      </div>

      {/* Play button — visible only when NOT hovering (hover shows overlay instead) */}
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
          isStarting
            ? "bg-primary text-primary-foreground"
            : "bg-sidebar text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground"
        }`}
      >
        {isStarting ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5" />
        )}
      </span>
    </button>
  );
});

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

  return `${viewCountFormatter.format(viewCount)} views`;
}
