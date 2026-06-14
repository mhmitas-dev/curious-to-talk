import type { YouTubeActivitySession } from "./room-types";

export const YOUTUBE_ACTIVITY_DATA_TOPIC = "niribi.youtube.activity";
export const YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS = 5_000;
export const YOUTUBE_HANDOFF_RESULT_TIMEOUT_MS = 8_000;

export type YouTubeReplacementRejectionReason =
  | "busy"
  | "invalid"
  | "stale";
export type YouTubeReplacementRequestDecision =
  | "accept"
  | YouTubeReplacementRejectionReason;

export type YouTubeActivityPacket =
  | {
      type:
        | "youtube:buffering"
        | "youtube:pause"
        | "youtube:play"
        | "youtube:seek"
        | "youtube:start"
        | "youtube:state-response";
      requestId?: string;
      sentAt: number;
      session: YouTubeActivitySession;
    }
  | {
      hostIdentity: string;
      sessionId: string;
      sentAt: number;
      type: "youtube:end";
    }
  | {
      requestId: string;
      sentAt: number;
      type: "youtube:state-request";
    }
  | {
      activeSessionId: string;
      expiresAt: number;
      requestId: string;
      sentAt: number;
      type: "youtube:replace-request";
      videoId: string;
    }
  | {
      previousSessionId: string;
      requestId: string;
      sentAt: number;
      session: YouTubeActivitySession;
      type: "youtube:replace";
    }
  | {
      activeSessionId: string;
      reason: YouTubeReplacementRejectionReason;
      requestId: string;
      sentAt: number;
      type: "youtube:replace-rejected";
    };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPlaybackStatus(
  value: unknown
): value is YouTubeActivitySession["playbackStatus"] {
  return value === "buffering" || value === "paused" || value === "playing";
}

function isReplacementRejectionReason(
  value: unknown
): value is YouTubeReplacementRejectionReason {
  return value === "busy" || value === "invalid" || value === "stale";
}

function isYouTubeVideoId(value: string) {
  return /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export function parseYouTubeActivitySession(value: unknown) {
  if (!isObject(value)) return null;
  if (
    typeof value.hostIdentity !== "string" ||
    !isPlaybackStatus(value.playbackStatus) ||
    !isFiniteNumber(value.positionSeconds) ||
    !isFiniteNumber(value.revision) ||
    typeof value.sessionId !== "string" ||
    !isFiniteNumber(value.updatedAt) ||
    typeof value.videoId !== "string"
  ) {
    return null;
  }

  if (
    !value.hostIdentity ||
    value.positionSeconds < 0 ||
    value.revision < 1 ||
    !Number.isInteger(value.revision) ||
    !value.sessionId ||
    !value.videoId
  ) {
    return null;
  }

  return {
    hostIdentity: value.hostIdentity,
    playbackStatus: value.playbackStatus,
    positionSeconds: value.positionSeconds,
    revision: value.revision,
    sessionId: value.sessionId,
    updatedAt: value.updatedAt,
    videoId: value.videoId,
  } satisfies YouTubeActivitySession;
}

export function encodeYouTubeActivityPacket(packet: YouTubeActivityPacket) {
  return encoder.encode(JSON.stringify(packet));
}

export function parseYouTubeActivityPacket(payload: Uint8Array) {
  try {
    const packet = JSON.parse(decoder.decode(payload)) as unknown;
    if (!isObject(packet) || typeof packet.type !== "string") return null;

    if (
      packet.type === "youtube:buffering" ||
      packet.type === "youtube:pause" ||
      packet.type === "youtube:play" ||
      packet.type === "youtube:seek" ||
      packet.type === "youtube:start" ||
      packet.type === "youtube:state-response"
    ) {
      const session = parseYouTubeActivitySession(packet.session);
      if (!session || !isFiniteNumber(packet.sentAt)) return null;
      return {
        requestId:
          typeof packet.requestId === "string" ? packet.requestId : undefined,
        sentAt: packet.sentAt,
        session,
        type: packet.type,
      } satisfies YouTubeActivityPacket;
    }

    if (packet.type === "youtube:end") {
      if (
        typeof packet.hostIdentity !== "string" ||
        !packet.hostIdentity ||
        typeof packet.sessionId !== "string" ||
        !packet.sessionId ||
        !isFiniteNumber(packet.sentAt)
      ) {
        return null;
      }
      return {
        hostIdentity: packet.hostIdentity,
        sessionId: packet.sessionId,
        sentAt: packet.sentAt,
        type: "youtube:end",
      } satisfies YouTubeActivityPacket;
    }

    if (packet.type === "youtube:state-request") {
      if (
        typeof packet.requestId !== "string" ||
        !packet.requestId ||
        !isFiniteNumber(packet.sentAt)
      ) {
        return null;
      }
      return {
        requestId: packet.requestId,
        sentAt: packet.sentAt,
        type: "youtube:state-request",
      } satisfies YouTubeActivityPacket;
    }

    if (packet.type === "youtube:replace-request") {
      if (
        typeof packet.activeSessionId !== "string" ||
        !packet.activeSessionId ||
        !isFiniteNumber(packet.expiresAt) ||
        typeof packet.requestId !== "string" ||
        !packet.requestId ||
        !isFiniteNumber(packet.sentAt) ||
        typeof packet.videoId !== "string" ||
        !packet.videoId
      ) {
        return null;
      }
      if (
        packet.expiresAt <= packet.sentAt ||
        packet.expiresAt - packet.sentAt > YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS
      ) {
        return null;
      }
      return {
        activeSessionId: packet.activeSessionId,
        expiresAt: packet.expiresAt,
        requestId: packet.requestId,
        sentAt: packet.sentAt,
        type: "youtube:replace-request",
        videoId: packet.videoId,
      } satisfies YouTubeActivityPacket;
    }

    if (packet.type === "youtube:replace") {
      const session = parseYouTubeActivitySession(packet.session);
      if (
        typeof packet.previousSessionId !== "string" ||
        !packet.previousSessionId ||
        typeof packet.requestId !== "string" ||
        !packet.requestId ||
        !isFiniteNumber(packet.sentAt) ||
        !session
      ) {
        return null;
      }
      return {
        previousSessionId: packet.previousSessionId,
        requestId: packet.requestId,
        sentAt: packet.sentAt,
        session,
        type: "youtube:replace",
      } satisfies YouTubeActivityPacket;
    }

    if (packet.type === "youtube:replace-rejected") {
      if (
        typeof packet.activeSessionId !== "string" ||
        !packet.activeSessionId ||
        !isReplacementRejectionReason(packet.reason) ||
        typeof packet.requestId !== "string" ||
        !packet.requestId ||
        !isFiniteNumber(packet.sentAt)
      ) {
        return null;
      }
      return {
        activeSessionId: packet.activeSessionId,
        reason: packet.reason,
        requestId: packet.requestId,
        sentAt: packet.sentAt,
        type: "youtube:replace-rejected",
      } satisfies YouTubeActivityPacket;
    }
  } catch {
    return null;
  }

  return null;
}

export function shouldApplyYouTubeSessionPacket(
  current: YouTubeActivitySession | null,
  candidate: YouTubeActivitySession
) {
  if (!current) return true;
  if (current.sessionId !== candidate.sessionId) return false;
  return candidate.revision >= current.revision;
}

export function shouldAcceptYouTubeSessionCandidate({
  candidate,
  current,
  endedSessionIds,
  screenShareActive,
}: {
  candidate: YouTubeActivitySession;
  current: YouTubeActivitySession | null;
  endedSessionIds: ReadonlySet<string>;
  screenShareActive: boolean;
}) {
  if (endedSessionIds.has(candidate.sessionId) || screenShareActive) return false;
  return shouldApplyYouTubeSessionPacket(current, candidate);
}

export function isAuthorizedYouTubeReplacement({
  current,
  packet,
  senderIdentity,
}: {
  current: YouTubeActivitySession | null;
  packet: Extract<YouTubeActivityPacket, { type: "youtube:replace" }>;
  senderIdentity: string;
}) {
  if (!current) return false;
  if (senderIdentity !== current.hostIdentity) return false;
  if (packet.previousSessionId !== current.sessionId) return false;
  if (packet.session.sessionId === current.sessionId) return false;

  return (
    isYouTubeVideoId(packet.session.videoId) &&
    packet.session.playbackStatus === "playing" &&
    packet.session.positionSeconds === 0 &&
    packet.session.revision === 1
  );
}

export function shouldAcceptYouTubeReplacement({
  current,
  endedSessionIds,
  packet,
  screenShareActive,
  senderIdentity,
}: {
  current: YouTubeActivitySession | null;
  endedSessionIds: ReadonlySet<string>;
  packet: Extract<YouTubeActivityPacket, { type: "youtube:replace" }>;
  screenShareActive: boolean;
  senderIdentity: string;
}) {
  if (
    screenShareActive ||
    endedSessionIds.has(packet.session.sessionId)
  ) {
    return false;
  }

  return isAuthorizedYouTubeReplacement({
    current,
    packet,
    senderIdentity,
  });
}

export function isAuthorizedYouTubeReplacementRejection({
  current,
  packet,
  pendingRequestId,
  senderIdentity,
}: {
  current: YouTubeActivitySession | null;
  packet: Extract<
    YouTubeActivityPacket,
    { type: "youtube:replace-rejected" }
  >;
  pendingRequestId: string | null;
  senderIdentity: string;
}) {
  return (
    !!current &&
    senderIdentity === current.hostIdentity &&
    packet.activeSessionId === current.sessionId &&
    packet.requestId === pendingRequestId
  );
}

export function doesYouTubeReplacementCompleteRequest({
  activeSessionId,
  packet,
  requestId,
  requesterIdentity,
  videoId,
}: {
  activeSessionId: string;
  packet: Extract<YouTubeActivityPacket, { type: "youtube:replace" }>;
  requestId: string;
  requesterIdentity: string;
  videoId: string;
}) {
  return (
    packet.requestId === requestId &&
    packet.previousSessionId === activeSessionId &&
    packet.session.videoId === videoId &&
    packet.session.hostIdentity === requesterIdentity
  );
}

export function getYouTubeReplacementRequestDecision({
  activeRequestId,
  current,
  now,
  packet,
  senderIdentity,
}: {
  activeRequestId: string | null;
  current: YouTubeActivitySession | null;
  now: number;
  packet: Extract<
    YouTubeActivityPacket,
    { type: "youtube:replace-request" }
  >;
  senderIdentity: string;
}): YouTubeReplacementRequestDecision {
  if (!current || packet.activeSessionId !== current.sessionId) return "stale";
  if (packet.expiresAt <= now) return "stale";
  if (
    senderIdentity === current.hostIdentity ||
    packet.videoId === current.videoId ||
    !isYouTubeVideoId(packet.videoId)
  ) {
    return "invalid";
  }
  if (activeRequestId) return "busy";
  return "accept";
}
