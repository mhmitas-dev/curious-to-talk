"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { parseYouTubeVideoId } from "@/lib/youtube/parse-youtube-url";
import type {
  YouTubePlaybackStatus,
  YouTubeSessionSnapshot,
} from "./room-types";

type StartResult = "failed" | "invalid" | "occupied" | "started";

type YouTubePacket =
  | {
      type: "youtube:end";
      hostIdentity: string;
      sessionId: string;
    }
  | {
      type: "youtube:start" | "youtube:update";
      snapshot: YouTubeSessionSnapshot;
    };

interface UseRoomYouTubeSessionInput {
  enabled: boolean;
  screenShareActive: boolean;
  userId: string;
}

const ATTRIBUTE_KEY = "niribi.youtube.host";
const DATA_TOPIC = "niribi.youtube";
const SNAPSHOT_RPC_METHOD = "niribi.youtube.snapshot";
const HOST_MISSING_CLEAR_DELAY_MS = 1_500;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlaybackStatus(value: unknown): value is YouTubePlaybackStatus {
  return value === "paused" || value === "playing";
}

function parseSnapshot(value: string | undefined, identity: string) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isObject(parsed)) return null;
    if (parsed.hostIdentity !== identity) return null;
    if (
      typeof parsed.sessionId !== "string" ||
      typeof parsed.videoId !== "string" ||
      !isPlaybackStatus(parsed.playbackStatus) ||
      typeof parsed.positionSeconds !== "number" ||
      typeof parsed.revision !== "number" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return {
      hostIdentity: parsed.hostIdentity,
      playbackStatus: parsed.playbackStatus,
      positionSeconds: parsed.positionSeconds,
      revision: parsed.revision,
      sessionId: parsed.sessionId,
      updatedAt: parsed.updatedAt,
      videoId: parsed.videoId,
    } satisfies YouTubeSessionSnapshot;
  } catch {
    return null;
  }
}

function parsePacket(payload: Uint8Array) {
  try {
    const packet = JSON.parse(decoder.decode(payload)) as unknown;
    if (!isObject(packet) || typeof packet.type !== "string") return null;
    return packet as YouTubePacket;
  } catch {
    return null;
  }
}

function getExpectedPosition(snapshot: YouTubeSessionSnapshot, now = Date.now()) {
  if (snapshot.playbackStatus !== "playing") {
    return Math.max(0, snapshot.positionSeconds);
  }

  const elapsedSeconds = Math.max(0, (now - snapshot.updatedAt) / 1_000);
  return Math.max(0, snapshot.positionSeconds + elapsedSeconds);
}

function normalizeIncomingSnapshot(snapshot: YouTubeSessionSnapshot) {
  const now = Date.now();
  return {
    ...snapshot,
    positionSeconds: getExpectedPosition(snapshot, now),
    updatedAt: now,
  };
}

function createSessionId() {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${Date.now().toString(36)}-${random}`;
}

export function useRoomYouTubeSession({
  enabled,
  screenShareActive,
  userId,
}: UseRoomYouTubeSessionInput) {
  const room = useRoomContext();
  const [session, setSession] = useState<YouTubeSessionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const sessionRef = useRef<YouTubeSessionSnapshot | null>(null);
  const hostMissingTimerRef = useRef<number | null>(null);

  const applySession = useCallback((next: YouTubeSessionSnapshot | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const applyCandidate = useCallback(
    (candidate: YouTubeSessionSnapshot) => {
      const normalized = normalizeIncomingSnapshot(candidate);
      const current = sessionRef.current;

      if (!current) {
        applySession(normalized);
        return;
      }

      if (current.sessionId === normalized.sessionId) {
        if (normalized.revision >= current.revision) {
          applySession(normalized);
        }
        return;
      }

      if (normalized.sessionId < current.sessionId) {
        applySession(normalized);
      }
    },
    [applySession]
  );

  const clearHostMissingTimer = useCallback(() => {
    if (hostMissingTimerRef.current !== null) {
      window.clearTimeout(hostMissingTimerRef.current);
      hostMissingTimerRef.current = null;
    }
  }, []);

  const findHostSnapshot = useCallback(() => {
    const snapshots: YouTubeSessionSnapshot[] = [];
    const localSnapshot = parseSnapshot(
      room.localParticipant.attributes[ATTRIBUTE_KEY],
      room.localParticipant.identity
    );
    if (localSnapshot) snapshots.push(localSnapshot);

    for (const participant of room.remoteParticipants.values()) {
      const snapshot = parseSnapshot(
        participant.attributes[ATTRIBUTE_KEY],
        participant.identity
      );
      if (snapshot) snapshots.push(snapshot);
    }

    return snapshots.sort((a, b) => a.sessionId.localeCompare(b.sessionId))[0] ?? null;
  }, [room.localParticipant, room.remoteParticipants]);

  const requestFreshSnapshot = useCallback(
    async (hostIdentity: string) => {
      if (hostIdentity === userId) return;

      try {
        const response = await room.localParticipant.performRpc({
          destinationIdentity: hostIdentity,
          method: SNAPSHOT_RPC_METHOD,
          payload: "{}",
          responseTimeout: 8_000,
        });
        const snapshot = parseSnapshot(response, hostIdentity);
        if (snapshot) applyCandidate(snapshot);
      } catch {
        // The host may have left between attribute discovery and the RPC call.
      }
    },
    [applyCandidate, room.localParticipant, userId]
  );

  const rescanParticipants = useCallback(() => {
    const discovered = findHostSnapshot();
    if (discovered) {
      clearHostMissingTimer();
      applyCandidate(discovered);
      void requestFreshSnapshot(discovered.hostIdentity);
      return;
    }

    const current = sessionRef.current;
    if (!current) return;

    clearHostMissingTimer();
    hostMissingTimerRef.current = window.setTimeout(() => {
      applySession(null);
      hostMissingTimerRef.current = null;
    }, HOST_MISSING_CLEAR_DELAY_MS);
  }, [
    applyCandidate,
    applySession,
    clearHostMissingTimer,
    findHostSnapshot,
    requestFreshSnapshot,
  ]);

  const publishPacket = useCallback(
    async (packet: YouTubePacket) => {
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(packet)), {
        reliable: true,
        topic: DATA_TOPIC,
      });
    },
    [room.localParticipant]
  );

  const publishHostSnapshot = useCallback(
    async (snapshot: YouTubeSessionSnapshot, type: "youtube:start" | "youtube:update") => {
      applySession(snapshot);
      await room.localParticipant.setAttributes({
        [ATTRIBUTE_KEY]: JSON.stringify(snapshot),
      });
      await publishPacket({ type, snapshot });
    },
    [applySession, publishPacket, room.localParticipant]
  );

  const start = useCallback(
    async (input: string): Promise<StartResult> => {
      const videoId = parseYouTubeVideoId(input);
      if (!videoId) return "invalid";
      if (screenShareActive || findHostSnapshot()) return "occupied";

      const now = Date.now();
      const snapshot: YouTubeSessionSnapshot = {
        hostIdentity: userId,
        playbackStatus: "playing",
        positionSeconds: 0,
        revision: 1,
        sessionId: createSessionId(),
        updatedAt: now,
        videoId,
      };

      setIsStarting(true);
      setError(null);
      try {
        await publishHostSnapshot(snapshot, "youtube:start");
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
    [
      applySession,
      findHostSnapshot,
      publishHostSnapshot,
      screenShareActive,
      userId,
    ]
  );

  const updatePlayback = useCallback(
    async (playbackStatus: YouTubePlaybackStatus, positionSeconds: number) => {
      const current = sessionRef.current;
      if (!current || current.hostIdentity !== userId) return false;

      const snapshot: YouTubeSessionSnapshot = {
        ...current,
        playbackStatus,
        positionSeconds: Math.max(0, positionSeconds),
        revision: current.revision + 1,
        updatedAt: Date.now(),
      };

      try {
        await publishHostSnapshot(snapshot, "youtube:update");
        return true;
      } catch (updateError) {
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Unable to update YouTube."
        );
        return false;
      }
    },
    [publishHostSnapshot, userId]
  );

  const end = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || current.hostIdentity !== userId) return;

    applySession(null);
    setError(null);

    try {
      await room.localParticipant.setAttributes({ [ATTRIBUTE_KEY]: "" });
      await publishPacket({
        type: "youtube:end",
        hostIdentity: userId,
        sessionId: current.sessionId,
      });
    } catch (endError) {
      setError(
        endError instanceof Error ? endError.message : "Unable to end YouTube."
      );
    }
  }, [applySession, publishPacket, room.localParticipant, userId]);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        applySession(null);
        clearHostMissingTimer();
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

      if (packet.type === "youtube:end") {
        const current = sessionRef.current;
        if (
          current?.sessionId === packet.sessionId &&
          packet.hostIdentity === participant.identity
        ) {
          applySession(null);
        }
        return;
      }

      if (packet.snapshot.hostIdentity !== participant.identity) return;
      applyCandidate(packet.snapshot);
    };

    const handleAttributesChanged = () => {
      rescanParticipants();
    };

    const handleParticipantDisconnected = () => {
      rescanParticipants();
    };

    try {
      room.unregisterRpcMethod(SNAPSHOT_RPC_METHOD);
    } catch {
      // Method may not be registered yet.
    }

    room.registerRpcMethod(SNAPSHOT_RPC_METHOD, async () => {
      const current = sessionRef.current;
      if (!current || current.hostIdentity !== userId) return "";
      return JSON.stringify({
        ...current,
        positionSeconds: getExpectedPosition(current),
        updatedAt: Date.now(),
      });
    });

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantAttributesChanged, handleAttributesChanged);
    room.on(RoomEvent.ParticipantConnected, handleAttributesChanged);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    rescanParticipants();

    return () => {
      clearHostMissingTimer();
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantAttributesChanged, handleAttributesChanged);
      room.off(RoomEvent.ParticipantConnected, handleAttributesChanged);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      try {
        room.unregisterRpcMethod(SNAPSHOT_RPC_METHOD);
      } catch {
        // Ignore cleanup races during room disconnect.
      }
    };
  }, [
    applyCandidate,
    applySession,
    clearHostMissingTimer,
    enabled,
    rescanParticipants,
    room,
    userId,
  ]);

  useEffect(() => {
    if (screenShareActive && sessionRef.current?.hostIdentity === userId) {
      void end();
    } else if (screenShareActive && sessionRef.current) {
      applySession(null);
    }
  }, [applySession, end, screenShareActive, userId]);

  return {
    end,
    error,
    isActive: !!session,
    isHost: session?.hostIdentity === userId,
    isStarting,
    session,
    start,
    updatePlayback,
  };
}
