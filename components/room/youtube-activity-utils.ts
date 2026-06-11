import type { YouTubeActivitySession } from "./room-types";

export function getExpectedYouTubePosition(
  session: YouTubeActivitySession,
  now = Date.now()
) {
  if (session.playbackStatus !== "playing") {
    return Math.max(0, session.positionSeconds);
  }

  return Math.max(
    0,
    session.positionSeconds + Math.max(0, now - session.updatedAt) / 1_000
  );
}

export function createFreshYouTubeSessionSnapshot(
  session: YouTubeActivitySession
) {
  const now = Date.now();
  return {
    ...session,
    positionSeconds: getExpectedYouTubePosition(session, now),
    updatedAt: now,
  } satisfies YouTubeActivitySession;
}
