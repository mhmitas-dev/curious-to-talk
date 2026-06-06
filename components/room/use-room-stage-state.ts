"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParticipants } from "@livekit/components-react";
import { createClient } from "@/lib/supabase/client";
import {
  claimRoomScreenShare,
  fetchRoomStageSnapshot,
  releaseRoomScreenShare,
  releaseStaleRoomScreenShare,
} from "@/lib/room-stage/client";
import type { RoomStageSnapshot } from "@/lib/room-stage/types";
import type { RoomStageOwner, ScreenShareState } from "./room-types";
import { useRoomStageRealtime } from "./use-room-stage-realtime";

interface UseRoomStageStateInput {
  enabled: boolean;
  roomId: string;
  screenShare: ScreenShareState;
  startScreenShare: () => Promise<boolean>;
  stopScreenShare: () => Promise<boolean>;
  userId: string;
}

const OWNED_SHARE_RELEASE_DELAY_MS = 750;
const STALE_SHARE_RELEASE_DELAY_MS = 5_500;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unable to update the room stage.";
}

function isStageConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "40001"
  );
}

export function useRoomStageState({
  enabled,
  roomId,
  screenShare,
  startScreenShare,
  stopScreenShare,
  userId,
}: UseRoomStageStateInput) {
  const supabase = useMemo(() => createClient(), []);
  const participants = useParticipants();
  const participantIds = useMemo(
    () => new Set(participants.map((participant) => participant.identity)),
    [participants]
  );
  const [stage, setStage] = useState<RoomStageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionRef = useRef(false);

  const applySnapshot = useCallback((snapshot: RoomStageSnapshot) => {
    setStage((current) =>
      !current || snapshot.revision >= current.revision ? snapshot : current
    );
  }, []);

  const refreshStage = useCallback(async () => {
    if (!enabled) return null;

    try {
      const snapshot = await fetchRoomStageSnapshot(supabase, roomId);
      applySnapshot(snapshot);
      setError(null);
      return snapshot;
    } catch (refreshError) {
      setError(getErrorMessage(refreshError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, enabled, roomId, supabase]);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => {
        setStage(null);
        setError(null);
        setIsLoading(false);
      });
      return;
    }

    queueMicrotask(() => {
      setIsLoading(true);
      void refreshStage();
    });
  }, [enabled, refreshStage]);

  useRoomStageRealtime({
    enabled,
    onSnapshot: applySnapshot,
    onSubscribed: () => {
      void refreshStage();
    },
    roomId,
    supabase,
  });

  const runTransition = useCallback(async (operation: () => Promise<void>) => {
    if (transitionRef.current) return;

    transitionRef.current = true;
    setIsTransitioning(true);
    setError(null);

    try {
      await operation();
    } catch (transitionError) {
      await refreshStage();
      if (!isStageConflict(transitionError)) {
        setError(getErrorMessage(transitionError));
      }
    } finally {
      transitionRef.current = false;
      setIsTransitioning(false);
    }
  }, [refreshStage]);

  const releaseOwnedShare = useCallback(
    async (snapshot: RoomStageSnapshot) => {
      const nextStage = await releaseRoomScreenShare(
        supabase,
        roomId,
        snapshot.revision
      );
      applySnapshot(nextStage);
    },
    [applySnapshot, roomId, supabase]
  );

  const toggleScreenShare = useCallback(async () => {
    if (!enabled) return;

    if (screenShare.iAmSharing && (!stage || isLoading)) {
      await runTransition(async () => {
        await stopScreenShare();
      });
      return;
    }

    if (!stage || isLoading) return;

    await runTransition(async () => {
      if (screenShare.iAmSharing) {
        const stopped = await stopScreenShare();
        if (!stopped) return;

        if (
          stage.owner === "screenShare" &&
          stage.screenShareParticipantId === userId
        ) {
          await releaseOwnedShare(stage);
        }
        return;
      }

      if (stage.owner !== "idle" || screenShare.someoneElseIsSharing) return;

      const started = await startScreenShare();
      if (!started) return;

      try {
        const nextStage = await claimRoomScreenShare(
          supabase,
          roomId,
          stage.revision
        );
        applySnapshot(nextStage);
      } catch (claimError) {
        await stopScreenShare();
        throw claimError;
      }
    });
  }, [
    applySnapshot,
    enabled,
    isLoading,
    releaseOwnedShare,
    roomId,
    runTransition,
    screenShare.iAmSharing,
    screenShare.someoneElseIsSharing,
    stage,
    startScreenShare,
    stopScreenShare,
    supabase,
    userId,
  ]);

  useEffect(() => {
    if (
      !enabled ||
      !stage ||
      stage.owner !== "screenShare" ||
      stage.screenShareParticipantId !== userId ||
      screenShare.iAmSharing ||
      isTransitioning
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void runTransition(() => releaseOwnedShare(stage));
    }, OWNED_SHARE_RELEASE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    enabled,
    isTransitioning,
    releaseOwnedShare,
    runTransition,
    screenShare.iAmSharing,
    stage,
    userId,
  ]);

  useEffect(() => {
    const sharerId = stage?.screenShareParticipantId;
    if (
      !enabled ||
      !stage ||
      stage.owner !== "screenShare" ||
      !sharerId ||
      sharerId === userId ||
      participantIds.has(sharerId) ||
      isTransitioning
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void runTransition(async () => {
        const nextStage = await releaseStaleRoomScreenShare(
          supabase,
          roomId,
          stage.revision,
          sharerId
        );
        applySnapshot(nextStage);
      });
    }, STALE_SHARE_RELEASE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    applySnapshot,
    enabled,
    isTransitioning,
    participantIds,
    roomId,
    runTransition,
    stage,
    supabase,
    userId,
  ]);

  const fallbackOwner: RoomStageOwner =
    screenShare.iAmSharing || screenShare.someoneElseIsSharing
      ? "screenShare"
      : "idle";

  return {
    error,
    isLoading,
    isTransitioning,
    owner: stage?.owner ?? fallbackOwner,
    refreshStage,
    stage,
    toggleScreenShare,
  };
}
