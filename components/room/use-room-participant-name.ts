"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

const PARTICIPANT_NAME_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.ParticipantNameChanged,
] as const;

export function useRoomParticipantName(
  identity: string | null,
  fallback = "Someone"
) {
  const room = useRoomContext();

  const subscribe = useCallback(
    (notify: () => void) => {
      PARTICIPANT_NAME_EVENTS.forEach((event) => room.on(event, notify));

      return () => {
        PARTICIPANT_NAME_EVENTS.forEach((event) => room.off(event, notify));
      };
    },
    [room]
  );

  const getSnapshot = useCallback(() => {
    if (!identity) return fallback;

    const participant =
      room.localParticipant.identity === identity
        ? room.localParticipant
        : room.remoteParticipants.get(identity);

    return participant?.name?.trim() || fallback;
  }, [fallback, identity, room]);

  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
