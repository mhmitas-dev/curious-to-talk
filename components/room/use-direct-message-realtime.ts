"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DirectMessage } from "@/lib/direct-messages/types";

const MAX_FILTER_VALUES = 100;
const REFRESH_DEBOUNCE_MS = 250;

interface DirectMessageRealtimeInput {
  conversationIds: string[];
  enabled: boolean;
  onConversationChanged: () => Promise<unknown>;
  onMessageInserted: (message: DirectMessage) => void;
  userId: string;
}

interface RealtimeMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

function toDirectMessage(row: RealtimeMessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export function useDirectMessageRealtime({
  conversationIds,
  enabled,
  onConversationChanged,
  onMessageInserted,
  userId,
}: DirectMessageRealtimeInput) {
  const supabase = useMemo(() => createClient(), []);
  const onConversationChangedRef = useRef(onConversationChanged);
  const onMessageInsertedRef = useRef(onMessageInserted);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uniqueConversationIds = useMemo(
    () => Array.from(new Set(conversationIds)).sort(),
    [conversationIds]
  );
  const conversationFilterKey = uniqueConversationIds.join(",");

  useEffect(() => {
    onConversationChangedRef.current = onConversationChanged;
  }, [onConversationChanged]);

  useEffect(() => {
    onMessageInsertedRef.current = onMessageInserted;
  }, [onMessageInserted]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const scheduleConversationRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void onConversationChangedRef.current();
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`direct-conversations:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_conversations",
          filter: `user_a=eq.${userId}`,
        },
        scheduleConversationRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_conversations",
          filter: `user_b=eq.${userId}`,
        },
        scheduleConversationRefresh
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("Direct conversation realtime subscription failed.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, scheduleConversationRefresh, supabase, userId]);

  useEffect(() => {
    if (!enabled || conversationFilterKey.length === 0) return;

    const channels = chunkValues(uniqueConversationIds, MAX_FILTER_VALUES).map(
      (conversationIdChunk, index) =>
        supabase
          .channel(`direct-messages:${userId}:${index}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "direct_messages",
              filter: `conversation_id=in.(${conversationIdChunk.join(",")})`,
            },
            (payload) => {
              const message = toDirectMessage(payload.new as RealtimeMessageRow);

              onMessageInsertedRef.current(message);
              scheduleConversationRefresh();
            }
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR") {
              console.warn("Direct message realtime subscription failed.");
            }
          })
    );

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [
    conversationFilterKey,
    enabled,
    scheduleConversationRefresh,
    supabase,
    uniqueConversationIds,
    userId,
  ]);
}
