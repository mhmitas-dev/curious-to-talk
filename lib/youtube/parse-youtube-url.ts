export function parseYouTubeVideoId(value: string) {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      return normalizeVideoId(url.pathname.slice(1));
    }

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      if (url.pathname === "/watch") {
        return normalizeVideoId(url.searchParams.get("v") ?? "");
      }

      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        return normalizeVideoId(url.pathname.split("/")[2] ?? "");
      }
    }
  } catch {
    return normalizeVideoId(input);
  }

  return null;
}

function normalizeVideoId(value: string) {
  const candidate = value.trim();
  return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
}
