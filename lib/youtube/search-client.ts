const YOUTUBE_SEARCH_BASE_URL = "https://yt-search.mahfuzul.online";
const DEFAULT_SEARCH_LIMIT = 10;
const MIN_SEARCH_LIMIT = 1;
const MAX_SEARCH_LIMIT = 20;

export interface YouTubeSearchResult {
  channel: string;
  channelId: string;
  description: string;
  duration: number;
  id: string;
  thumbnail: string;
  title: string;
  uploadDate: string;
  url: string;
  viewCount: number;
}

export interface YouTubeSearchResponse {
  count: number;
  limit: number;
  query: string;
  results: YouTubeSearchResult[];
}

interface SearchYouTubeOptions {
  limit?: number;
  signal?: AbortSignal;
}

export class YouTubeSearchError extends Error {
  constructor(message = "Unable to search YouTube.") {
    super(message);
    this.name = "YouTubeSearchError";
  }
}

function getSearchLimit(limit = DEFAULT_SEARCH_LIMIT) {
  if (!Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(MIN_SEARCH_LIMIT, Math.floor(limit)));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSearchResult(value: unknown): YouTubeSearchResult | null {
  if (!isObject(value)) return null;

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.url !== "string"
  ) {
    return null;
  }

  return {
    channel: typeof value.channel === "string" ? value.channel : "",
    channelId: typeof value.channel_id === "string" ? value.channel_id : "",
    description:
      typeof value.description === "string" ? value.description : "",
    duration: typeof value.duration === "number" ? value.duration : 0,
    id: value.id,
    thumbnail:
      typeof value.thumbnail === "string" && value.thumbnail.length > 0
        ? value.thumbnail
        : `https://i.ytimg.com/vi/${value.id}/hqdefault.jpg`,
    title: value.title,
    uploadDate:
      typeof value.upload_date === "string" ? value.upload_date : "",
    url: value.url,
    viewCount: typeof value.view_count === "number" ? value.view_count : 0,
  };
}

function parseSearchResponse(value: unknown): YouTubeSearchResponse {
  if (!isObject(value) || !Array.isArray(value.results)) {
    throw new YouTubeSearchError("YouTube search returned an unexpected response.");
  }

  const results = value.results
    .map((result) => parseSearchResult(result))
    .filter((result): result is YouTubeSearchResult => result !== null);

  return {
    count: typeof value.count === "number" ? value.count : results.length,
    limit: typeof value.limit === "number" ? value.limit : DEFAULT_SEARCH_LIMIT,
    query: typeof value.query === "string" ? value.query : "",
    results,
  };
}

export async function searchYouTube(
  query: string,
  options: SearchYouTubeOptions = {}
) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return {
      count: 0,
      limit: getSearchLimit(options.limit),
      query: "",
      results: [],
    } satisfies YouTubeSearchResponse;
  }

  const searchUrl = new URL("/search", YOUTUBE_SEARCH_BASE_URL);
  searchUrl.searchParams.set("q", trimmedQuery);
  searchUrl.searchParams.set("limit", String(getSearchLimit(options.limit)));

  const response = await fetch(searchUrl, {
    headers: {
      Accept: "application/json",
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new YouTubeSearchError();
  }

  return parseSearchResponse(await response.json());
}
