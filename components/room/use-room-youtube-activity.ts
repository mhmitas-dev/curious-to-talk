"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { parseYouTubeVideoId } from "@/lib/youtube/parse-youtube-url";
import type {
  YouTubeActivitySession,
  YouTubeHandoffResult,
  YouTubePlayResult,
  YouTubePlaybackCommand,
  YouTubePlaybackStatus,
} from "./room-types";
import {
  createFreshYouTubeSessionSnapshot,
  getExpectedYouTubePosition,
} from "./youtube-activity-utils";
import {
  doesYouTubeReplacementCompleteRequest,
  encodeYouTubeActivityPacket,
  getYouTubeReplacementRequestDecision,
  isAuthorizedYouTubeReplacementRejection,
  parseYouTubeActivityPacket,
  shouldAcceptYouTubeSessionCandidate,
  shouldAcceptYouTubeReplacement,
  YOUTUBE_ACTIVITY_DATA_TOPIC,
  YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
  YOUTUBE_HANDOFF_RESULT_TIMEOUT_MS,
  type YouTubeActivityPacket,
} from "./youtube-activity-protocol";

interface UseRoomYouTubeActivityInput {
  enabled: boolean;
  screenShareActive: boolean;
  userId: string;
}

const POSITION_EPSILON_SECONDS = 0.5;
const HOST_MISSING_CLEAR_DELAY_MS = 1_500;
const STATE_RECOVERY_RETRY_DELAYS_MS = [0, 800, 2_000] as const;

interface PendingYouTubeHandoff {
  activeSessionId: string;
  requestId: string;
  resolve: (result: YouTubeHandoffResult) => void;
  timeoutId: number;
  videoId: string;
}

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${Date.now().toString(36)}-${random}`;
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
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const hostMissingTimerRef = useRef<number | null>(null);
  const endedSessionIdsRef = useRef(new Set<string>());
  const activeReplacementRequestIdRef = useRef<string | null>(null);
  const activeOperationIdRef = useRef<string | null>(null);
  const enabledRef = useRef(enabled);
  const pendingHandoffRef = useRef<PendingYouTubeHandoff | null>(null);
  const recoveryTimerIdsRef = useRef<number[]>([]);
  const screenShareActiveRef = useRef(screenShareActive);
  const sessionRef = useRef<YouTubeActivitySession | null>(null);

  useEffect(() => {
    screenShareActiveRef.current = screenShareActive;
  }, [screenShareActive]);

  useEffect(() => {
    enabledRef.current = enabled;

    return () => {
      enabledRef.current = false;
    };
  }, [enabled]);

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

  const settlePendingHandoff = useCallback(
    (result: YouTubeHandoffResult, expectedRequestId?: string) => {
      const pending = pendingHandoffRef.current;
      if (!pending) return false;
      if (expectedRequestId && pending.requestId !== expectedRequestId) {
        return false;
      }

      window.clearTimeout(pending.timeoutId);
      pendingHandoffRef.current = null;
      setIsRequestingHandoff(false);
      pending.resolve(result);
      return true;
    },
    []
  );

  const scheduleMissingHostClear = useCallback(
    (hostIdentity: string) => {
      clearHostMissingTimer();
      hostMissingTimerRef.current = window.setTimeout(() => {
        const latest = sessionRef.current;
        if (latest?.hostIdentity === hostIdentity) {
          endedSessionIdsRef.current.add(latest.sessionId);
          const pending = pendingHandoffRef.current;
          if (pending?.activeSessionId === latest.sessionId) {
            settlePendingHandoff("occupied", pending.requestId);
          }
          applySession(null);
        }
        hostMissingTimerRef.current = null;
      }, HOST_MISSING_CLEAR_DELAY_MS);
    },
    [applySession, clearHostMissingTimer, settlePendingHandoff]
  );

  const publishPacket = useCallback(
    async (
      packet: YouTubeActivityPacket,
      destinationIdentities?: string[]
    ) => {
      await room.localParticipant.publishData(
        encodeYouTubeActivityPacket(packet),
        {
          destinationIdentities,
          reliable: true,
          topic: YOUTUBE_ACTIVITY_DATA_TOPIC,
        }
      );
    },
    [room.localParticipant]
  );

  const applyCandidate = useCallback(
    (candidate: YouTubeActivitySession) => {
      if (screenShareActive) {
        endedSessionIdsRef.current.add(candidate.sessionId);
      }
      if (
        !shouldAcceptYouTubeSessionCandidate({
          candidate,
          current: sessionRef.current,
          endedSessionIds: endedSessionIdsRef.current,
          screenShareActive,
        })
      ) return;

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

  const play = useCallback(
    async (input: string): Promise<YouTubePlayResult> => {
      const videoId = parseYouTubeVideoId(input);
      if (!videoId) return "invalid";
      if (isRecovering || activeOperationIdRef.current) return "occupied";
      if (screenShareActiveRef.current) return "occupied";

      const current = sessionRef.current;
      if (current?.videoId === videoId) return "already-playing";
      if (current && current.hostIdentity !== userId) return "occupied";

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

      const operationId = createId("youtube-operation");
      activeOperationIdRef.current = operationId;
      if (current) setIsReplacing(true);
      else setIsStarting(true);
      setError(null);

      try {
        if (current) {
          await publishPacket({
            previousSessionId: current.sessionId,
            requestId: createId("youtube-replace"),
            sentAt: now,
            session: nextSession,
            type: "youtube:replace",
          });

          if (
            activeOperationIdRef.current !== operationId ||
            !enabledRef.current ||
            screenShareActiveRef.current
          ) {
            return "occupied";
          }

          endedSessionIdsRef.current.add(current.sessionId);
          applySession(nextSession);
          return "replaced";
        }

        applySession(nextSession);
        await publishPacket({
          sentAt: now,
          session: nextSession,
          type: "youtube:start",
        });

        if (
          activeOperationIdRef.current !== operationId ||
          !enabledRef.current ||
          screenShareActiveRef.current
        ) {
          endedSessionIdsRef.current.add(nextSession.sessionId);
          if (sessionRef.current?.sessionId === nextSession.sessionId) {
            applySession(null);
          }
          return "occupied";
        }

        return "started";
      } catch (startError) {
        if (!current) applySession(null);
        if (enabledRef.current) {
          setError(
            startError instanceof Error
              ? startError.message
              : current
                ? "Unable to replace YouTube."
                : "Unable to start YouTube."
          );
        }
        return "failed";
      } finally {
        if (activeOperationIdRef.current === operationId) {
          activeOperationIdRef.current = null;
          setIsReplacing(false);
          setIsStarting(false);
        }
      }
    },
    [applySession, isRecovering, publishPacket, userId]
  );

  const requestHandoff = useCallback(
    async (input: string): Promise<YouTubeHandoffResult> => {
      const videoId = parseYouTubeVideoId(input);
      if (!videoId) return "invalid";
      if (
        isRecovering ||
        activeOperationIdRef.current ||
        pendingHandoffRef.current ||
        screenShareActiveRef.current
      ) {
        return "occupied";
      }

      const current = sessionRef.current;
      if (!current || current.hostIdentity === userId) return "occupied";
      if (current.videoId === videoId) return "already-playing";

      const requestId = createId("youtube-handoff");
      setError(null);
      setIsRequestingHandoff(true);

      return new Promise<YouTubeHandoffResult>((resolve) => {
        const sentAt = Date.now();
        const timeoutId = window.setTimeout(() => {
          settlePendingHandoff("timeout", requestId);
        }, YOUTUBE_HANDOFF_RESULT_TIMEOUT_MS);

        pendingHandoffRef.current = {
          activeSessionId: current.sessionId,
          requestId,
          resolve,
          timeoutId,
          videoId,
        };

        void publishPacket(
          {
            activeSessionId: current.sessionId,
            expiresAt: sentAt + YOUTUBE_HANDOFF_ACCEPT_WINDOW_MS,
            requestId,
            sentAt,
            type: "youtube:replace-request",
            videoId,
          },
          [current.hostIdentity]
        ).catch((requestError) => {
          if (settlePendingHandoff("failed", requestId)) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Unable to request YouTube."
            );
          }
        });
      });
    }, [isRecovering, publishPacket, settlePendingHandoff, userId]
  );

  const end = useCallback(async (expectedSessionId?: string) => {
    if (activeOperationIdRef.current) return;

    const current = sessionRef.current;
    if (!current || current.hostIdentity !== userId) return;
    if (expectedSessionId && current.sessionId !== expectedSessionId) return;

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
      sourceSessionId: string,
      command: YouTubePlaybackCommand,
      playbackStatus: YouTubePlaybackStatus,
      positionSeconds: number
    ) => {
      if (activeOperationIdRef.current) return false;

      const current = sessionRef.current;
      if (
        !current ||
        current.hostIdentity !== userId ||
        current.sessionId !== sourceSessionId
      ) {
        return false;
      }

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
        settlePendingHandoff("failed");
        endedSessionIdsRef.current.clear();
        activeReplacementRequestIdRef.current = null;
        applySession(null);
        setError(null);
        setIsRecovering(false);
        setIsRequestingHandoff(false);
        setIsReplacing(false);
        setIsStarting(false);
        activeOperationIdRef.current = null;
      });
      return;
    }

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: { identity: string },
      _kind?: unknown,
      topic?: string
    ) => {
      if (topic !== YOUTUBE_ACTIVITY_DATA_TOPIC || !participant) return;

      const packet = parseYouTubeActivityPacket(payload);
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
          const pending = pendingHandoffRef.current;
          if (pending?.activeSessionId === packet.sessionId) {
            settlePendingHandoff("occupied", pending.requestId);
          }
          applySession(null);
        }
        return;
      }

      if (packet.type === "youtube:replace-request") {
        const current = sessionRef.current;
        if (!current || current.hostIdentity !== userId) return;
        if (activeReplacementRequestIdRef.current === packet.requestId) return;

        const decision =
          activeOperationIdRef.current || screenShareActiveRef.current
            ? "busy"
            : getYouTubeReplacementRequestDecision({
                activeRequestId: activeReplacementRequestIdRef.current,
                current,
                now: Date.now(),
                packet,
                senderIdentity: participant.identity,
              });

        if (decision !== "accept") {
          void publishPacket(
            {
              activeSessionId: current.sessionId,
              reason: decision,
              requestId: packet.requestId,
              sentAt: Date.now(),
              type: "youtube:replace-rejected",
            },
            [participant.identity]
          ).catch(() => {
            // The requester has its own timeout if this best-effort rejection fails.
          });
          return;
        }

        activeReplacementRequestIdRef.current = packet.requestId;
        const operationId = createId("youtube-operation");
        activeOperationIdRef.current = operationId;
        setIsReplacing(true);
        setError(null);

        const now = Date.now();
        const nextSession: YouTubeActivitySession = {
          hostIdentity: participant.identity,
          playbackStatus: "playing",
          positionSeconds: 0,
          revision: 1,
          sessionId: createId("youtube-session"),
          updatedAt: now,
          videoId: packet.videoId,
        };

        void publishPacket({
          previousSessionId: current.sessionId,
          requestId: packet.requestId,
          sentAt: now,
          session: nextSession,
          type: "youtube:replace",
        })
          .then(() => {
            const latest = sessionRef.current;
            if (
              activeOperationIdRef.current !== operationId ||
              !enabledRef.current ||
              screenShareActiveRef.current ||
              latest?.sessionId !== current.sessionId
            ) {
              return;
            }

            endedSessionIdsRef.current.add(current.sessionId);
            applySession(nextSession);
            if (!room.remoteParticipants.has(nextSession.hostIdentity)) {
              scheduleMissingHostClear(nextSession.hostIdentity);
            }
          })
          .catch((replacementError) => {
            if (enabledRef.current) {
              setError(
                replacementError instanceof Error
                  ? replacementError.message
                  : "Unable to hand off YouTube."
              );
            }
          })
          .finally(() => {
            if (activeReplacementRequestIdRef.current === packet.requestId) {
              activeReplacementRequestIdRef.current = null;
            }
            if (activeOperationIdRef.current === operationId) {
              activeOperationIdRef.current = null;
              setIsReplacing(false);
            }
          });
        return;
      }

      if (packet.type === "youtube:replace") {
        const current = sessionRef.current;
        if (
          !shouldAcceptYouTubeReplacement({
            current,
            endedSessionIds: endedSessionIdsRef.current,
            packet,
            screenShareActive: screenShareActiveRef.current,
            senderIdentity: participant.identity,
          })
        ) {
          return;
        }

        const pending = pendingHandoffRef.current;
        const completesPendingHandoff =
          !!pending &&
          doesYouTubeReplacementCompleteRequest({
            activeSessionId: pending.activeSessionId,
            packet,
            requestId: pending.requestId,
            requesterIdentity: userId,
            videoId: pending.videoId,
          });

        endedSessionIdsRef.current.add(packet.previousSessionId);
        clearHostMissingTimer();
        clearRecoveryTimers();
        setError(null);
        setIsRecovering(false);
        applySession(packet.session);
        if (
          packet.session.hostIdentity !== userId &&
          !room.remoteParticipants.has(packet.session.hostIdentity)
        ) {
          scheduleMissingHostClear(packet.session.hostIdentity);
        }
        if (completesPendingHandoff) {
          settlePendingHandoff("replaced", packet.requestId);
        }
        return;
      }

      if (packet.type === "youtube:replace-rejected") {
        const pending = pendingHandoffRef.current;
        if (
          !isAuthorizedYouTubeReplacementRejection({
            current: sessionRef.current,
            packet,
            pendingRequestId: pending?.requestId ?? null,
            senderIdentity: participant.identity,
          })
        ) {
          return;
        }

        settlePendingHandoff(
          packet.reason === "invalid" ? "invalid" : "occupied",
          packet.requestId
        );
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
      scheduleMissingHostClear(participant.identity);
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
    scheduleMissingHostClear,
    settlePendingHandoff,
    userId,
  ]);

  useEffect(() => {
    return () => {
      settlePendingHandoff("failed");
    };
  }, [settlePendingHandoff]);

  useEffect(() => {
    if (screenShareActive) {
      settlePendingHandoff("occupied");
    }
    if (!screenShareActive) return;

    const current = sessionRef.current;
    if (!current) return;

    endedSessionIdsRef.current.add(current.sessionId);
    activeOperationIdRef.current = null;
    activeReplacementRequestIdRef.current = null;
    applySession(null);
    setIsReplacing(false);
    setIsStarting(false);

    if (current.hostIdentity === userId) {
      void publishPacket({
        hostIdentity: userId,
        sentAt: Date.now(),
        sessionId: current.sessionId,
        type: "youtube:end",
      }).catch(() => {
        // Screen Share already owns the local stage; remote clients also clear
        // YouTube when their Screen Share state arrives.
      });
    }
  }, [applySession, publishPacket, screenShareActive, settlePendingHandoff, userId]);

  return {
    end,
    error,
    isActive: !!session,
    isHost: session?.hostIdentity === userId,
    isRecovering,
    isRequestingHandoff,
    isReplacing,
    isStarting,
    play,
    requestHandoff,
    session,
    updateHostPlayback,
  };
}
