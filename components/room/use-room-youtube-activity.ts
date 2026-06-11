"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { parseYouTubeVideoId } from "@/lib/youtube/parse-youtube-url";
import type {
  YouTubeActivitySession,
  YouTubePlaybackCommand,
  YouTubePlaybackStatus,
} from "./room-types";
import {
  createFreshYouTubeSessionSnapshot,
  getExpectedYouTubePosition,
} from "./youtube-activity-utils";

type StartResult = "failed" | "invalid" | "occupied" | "started";

type YouTubeActivityPacket =
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
    };

interface UseRoomYouTubeActivityInput {
  enabled: boolean;
  screenShareActive: boolean;
  userId: string;
}

const DATA_TOPIC = "niribi.youtube.activity";
const POSITION_EPSILON_SECONDS = 0.5;
const HOST_MISSING_CLEAR_DELAY_MS = 1_500;
const STATE_RECOVERY_RETRY_DELAYS_MS = [0, 800, 2_000] as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlaybackStatus(
  value: unknown
): value is YouTubeActivitySession["playbackStatus"] {
  return value === "buffering" || value === "paused" || value === "playing";
}

function parseSession(value: unknown) {
  if (!isObject(value)) return null;
  if (
    typeof value.hostIdentity !== "string" ||
    !isPlaybackStatus(value.playbackStatus) ||
    typeof value.positionSeconds !== "number" ||
    typeof value.revision !== "number" ||
    typeof value.sessionId !== "string" ||
    typeof value.updatedAt !== "number" ||
    typeof value.videoId !== "string"
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

function parsePacket(payload: Uint8Array) {
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
      const session = parseSession(packet.session);
      if (!session || typeof packet.sentAt !== "number") return null;
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
        typeof packet.sessionId !== "string" ||
        typeof packet.sentAt !== "number"
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
        typeof packet.sentAt !== "number"
      ) {
        return null;
      }
      return {
        requestId: packet.requestId,
        sentAt: packet.sentAt,
        type: "youtube:state-request",
      } satisfies YouTubeActivityPacket;
    }
  } catch {
    return null;
  }

  return null;
}

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function shouldReplaceSession(
  current: YouTubeActivitySession | null,
  candidate: YouTubeActivitySession
) {
  if (!current) return true;

  if (current.sessionId === candidate.sessionId) {
    return candidate.revision >= current.revision;
  }

  return candidate.sessionId < current.sessionId;
}

export function useRoomYouTubeActivity({
  enabled,
  screenShareActive,
  userId,
}: UseRoomYouTubeActivityInput) {
  const room = useRoomContext();
  const [session, setSession] = useState<YouTubeActivitySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const hostMissingTimerRef = useRef<number | null>(null);
  const endedSessionIdsRef = useRef(new Set<string>());
  const recoveryTimerIdsRef = useRef<number[]>([]);
  const sessionRef = useRef<YouTubeActivitySession | null>(null);

  const applySession = useCallback((next: YouTubeActivitySession | null) => {
    if (next) setIsRecovering(false);
    sessionRef.current = next;
    setSession(next);
  }, []);

  const clearHostMissingTimer = useCallback(() => {
    if (hostMissingTimerRef.current !== null) {
      window.clearTimeout(hostMissingTimerRef.current);
      hostMissingTimerRef.current = null;
    }
  }, []);

  const clearRecoveryTimers = useCallback(() => {
    recoveryTimerIdsRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    recoveryTimerIdsRef.current = [];
  }, []);

  const publishPacket = useCallback(
    async (
      packet: YouTubeActivityPacket,
      destinationIdentities?: string[]
    ) => {
      await room.localParticipant.publishData(
        encoder.encode(JSON.stringify(packet)),
        {
          destinationIdentities,
          reliable: true,
          topic: DATA_TOPIC,
        }
      );
    },
    [room.localParticipant]
  );

  const applyCandidate = useCallback(
    (candidate: YouTubeActivitySession) => {
      if (endedSessionIdsRef.current.has(candidate.sessionId)) return;
      if (screenShareActive) {
        endedSessionIdsRef.current.add(candidate.sessionId);
        return;
      }
      if (!shouldReplaceSession(sessionRef.current, candidate)) return;

      clearRecoveryTimers();
      setError(null);
      setIsRecovering(false);
      applySession(candidate);
    },
    [applySession, clearRecoveryTimers, screenShareActive]
  );

  const requestState = useCallback(async () => {
    try {
      await publishPacket({
        requestId: createId("youtube-request"),
        sentAt: Date.now(),
        type: "youtube:state-request",
      });
    } catch {
      // State requests are best-effort; an empty stage is the fallback.
    }
  }, [publishPacket]);

  const scheduleStateRecovery = useCallback(() => {
    clearRecoveryTimers();

    if (sessionRef.current) {
      setIsRecovering(false);
      return;
    }

    setIsRecovering(true);

    recoveryTimerIdsRef.current = STATE_RECOVERY_RETRY_DELAYS_MS.map(
      (delay, index) =>
        window.setTimeout(() => {
          if (sessionRef.current) {
            clearRecoveryTimers();
            setIsRecovering(false);
            return;
          }

          void requestState().finally(() => {
            const isFinalAttempt =
              index === STATE_RECOVERY_RETRY_DELAYS_MS.length - 1;
            if (isFinalAttempt && !sessionRef.current) {
              setIsRecovering(false);
            }
          });
        }, delay)
    );
  }, [clearRecoveryTimers, requestState]);

  const start = useCallback(
    async (input: string): Promise<StartResult> => {
      const videoId = parseYouTubeVideoId(input);
      if (!videoId) return "invalid";
      if (isRecovering) return "occupied";
      if (screenShareActive || sessionRef.current) return "occupied";

      const now = Date.now();
      const nextSession: YouTubeActivitySession = {
        hostIdentity: userId,
        playbackStatus: "playing",
        positionSeconds: 0,
        revision: 1,
        sessionId: createId("youtube-session"),
        updatedAt: now,
        videoId,
      };

      setIsStarting(true);
      setError(null);

      try {
        applySession(nextSession);
        await publishPacket({
          sentAt: now,
          session: nextSession,
          type: "youtube:start",
        });
        return "started";
      } catch (startError) {
        applySession(null);
        setError(
          startError instanceof Error
            ? startError.message
            : "Unable to start YouTube."
        );
        return "failed";
      } finally {
        setIsStarting(false);
      }
    },
    [applySession, isRecovering, publishPacket, screenShareActive, userId]
  );

  const end = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.hostIdentity !== userId) return;

    endedSessionIdsRef.current.add(current.sessionId);
    applySession(null);
    setError(null);

    try {
      await publishPacket({
        hostIdentity: userId,
        sentAt: Date.now(),
        sessionId: current.sessionId,
        type: "youtube:end",
      });
    } catch (endError) {
      setError(
        endError instanceof Error ? endError.message : "Unable to end YouTube."
      );
    }
  }, [applySession, publishPacket, userId]);

  const updateHostPlayback = useCallback(
    async (
      command: YouTubePlaybackCommand,
      playbackStatus: YouTubePlaybackStatus,
      positionSeconds: number
    ) => {
      const current = sessionRef.current;
      if (!current || current.hostIdentity !== userId) return false;

      const expectedPosition = getExpectedYouTubePosition(current);
      const nextPosition = Math.max(0, positionSeconds);
      if (
        current.playbackStatus === playbackStatus &&
        Math.abs(expectedPosition - nextPosition) < POSITION_EPSILON_SECONDS
      ) {
        return true;
      }

      const nextSession: YouTubeActivitySession = {
        ...current,
        playbackStatus,
        positionSeconds: nextPosition,
        revision: current.revision + 1,
        updatedAt: Date.now(),
      };

      applySession(nextSession);

      try {
        await publishPacket({
          sentAt: nextSession.updatedAt,
          session: nextSession,
          type: `youtube:${command}`,
        });
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Unable to update YouTube."
        );
      }

      return true;
    },
    [applySession, publishPacket, userId]
  );

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        clearHostMissingTimer();
        clearRecoveryTimers();
        endedSessionIdsRef.current.clear();
        applySession(null);
        setError(null);
        setIsRecovering(false);
        setIsStarting(false);
      });
      return;
    }

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: { identity: string },
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== DATA_TOPIC || !participant) return;

      const packet = parsePacket(payload);
      if (!packet) return;

      if (
        packet.type === "youtube:buffering" ||
        packet.type === "youtube:pause" ||
        packet.type === "youtube:play" ||
        packet.type === "youtube:seek" ||
        packet.type === "youtube:start"
      ) {
        if (packet.session.hostIdentity !== participant.identity) return;
        applyCandidate(packet.session);
        return;
      }

      if (packet.type === "youtube:end") {
        const current = sessionRef.current;
        endedSessionIdsRef.current.add(packet.sessionId);
        if (
          current?.sessionId === packet.sessionId &&
          current.hostIdentity === participant.identity &&
          packet.hostIdentity === participant.identity
        ) {
          applySession(null);
        }
        return;
      }

      if (packet.type === "youtube:state-request") {
        const current = sessionRef.current;
        if (!current || current.hostIdentity !== userId) return;
        const freshSession = createFreshYouTubeSessionSnapshot(current);
        applySession(freshSession);

        void publishPacket(
          {
            requestId: packet.requestId,
            sentAt: Date.now(),
            session: freshSession,
            type: "youtube:state-response",
          },
          [participant.identity]
        );
        return;
      }

      if (packet.type === "youtube:state-response") {
        if (packet.session.hostIdentity !== participant.identity) return;
        applyCandidate(packet.session);
      }
    };

    const handleParticipantDisconnected = (participant: { identity: string }) => {
      const current = sessionRef.current;
      if (!current || current.hostIdentity !== participant.identity) return;

      clearHostMissingTimer();
      hostMissingTimerRef.current = window.setTimeout(() => {
        const latest = sessionRef.current;
        if (latest?.hostIdentity === participant.identity) {
          endedSessionIdsRef.current.add(latest.sessionId);
          applySession(null);
        }
        hostMissingTimerRef.current = null;
      }, HOST_MISSING_CLEAR_DELAY_MS);
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    queueMicrotask(() => {
      scheduleStateRecovery();
    });

    return () => {
      clearHostMissingTimer();
      clearRecoveryTimers();
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [
    applyCandidate,
    applySession,
    clearHostMissingTimer,
    clearRecoveryTimers,
    enabled,
    publishPacket,
    room,
    scheduleStateRecovery,
    userId,
  ]);

  useEffect(() => {
    if (screenShareActive && sessionRef.current?.hostIdentity === userId) {
      void end();
    } else if (screenShareActive && sessionRef.current) {
      endedSessionIdsRef.current.add(sessionRef.current.sessionId);
      applySession(null);
    }
  }, [applySession, end, screenShareActive, userId]);

  return {
    end,
    error,
    isActive: !!session,
    isHost: session?.hostIdentity === userId,
    isRecovering,
    isStarting,
    session,
    start,
    updateHostPlayback,
  };
}
