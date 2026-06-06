"use client";

import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomStageRow, RoomStageSnapshot } from "@/lib/room-stage/types";
import { toRoomStageSnapshot } from "@/lib/room-stage/types";

interface UseRoomStageRealtimeInput {
  enabled: boolean;
  onSnapshot: (snapshot: RoomStageSnapshot) => void;
  onSubscribed: () => void;
  roomId: string;
  supabase: SupabaseClient;
}

export function useRoomStageRealtime({
  enabled,
  onSnapshot,
  onSubscribed,
  roomId,
  supabase,
}: UseRoomStageRealtimeInput) {
  const onSnapshotRef = useRef(onSnapshot);
  const onSubscribedRef = useRef(onSubscribed);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
  }, [onSubscribed]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`room-stage:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          filter: `room_id=eq.${roomId}`,
          schema: "public",
          table: "room_stage_state",
        },
        (payload) => {
          onSnapshotRef.current(
            toRoomStageSnapshot(payload.new as RoomStageRow)
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          onSubscribedRef.current();
        } else if (status === "CHANNEL_ERROR") {
          console.warn("Room stage realtime subscription failed.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomId, supabase]);
}
