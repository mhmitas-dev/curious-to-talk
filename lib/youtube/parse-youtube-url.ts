const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (YOUTUBE_VIDEO_ID_PATTERN.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)
        ? videoId
        : null;
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      if (videoId && YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) return videoId;

      const [, pathVideoId] = url.pathname.match(
        /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/
      ) ?? [null, null];
      return pathVideoId ?? null;
    }
  } catch {
    return null;
  }

  return null;
}
