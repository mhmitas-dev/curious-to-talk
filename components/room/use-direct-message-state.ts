"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  markDirectConversationReadAction,
  openDirectConversation,
  sendDirectMessageAction,
} from "@/app/actions/direct-messages";
import {
  fetchDirectConversations,
  fetchDirectMessages,
} from "@/lib/direct-messages/client";
import type {
  DirectConversation,
  DirectConversationSummary,
  DirectMessage,
} from "@/lib/direct-messages/types";
import { useDirectMessageRealtime } from "./use-direct-message-realtime";

interface UseDirectMessageStateInput {
  enabled: boolean;
  userId: string;
}

export interface DirectMessageState {
  activeConversation: DirectConversationSummary | DirectConversation | null;
  activeConversationId: string | null;
  activeMessages: DirectMessage[];
  closeConversation: () => void;
  conversations: DirectConversationSummary[];
  error: string | null;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  markActiveConversationRead: () => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  openConversationWithUser: (userId: string) => Promise<void>;
  refreshConversations: () => Promise<DirectConversationSummary[]>;
  sendMessage: (body: string) => Promise<void>;
  unreadTotal: number;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function useDirectMessageState({
  enabled,
  userId,
}: UseDirectMessageStateInput): DirectMessageState {
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversationFallback, setActiveConversationFallback] =
    useState<DirectConversation | null>(null);
  const [activeMessages, setActiveMessages] = useState<DirectMessage[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationsRequestRef = useRef(0);
  const messagesRequestRef = useRef(0);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    activeConversationFallback;
  const realtimeConversationIds = useMemo(() => {
    const ids = new Set(conversations.map((conversation) => conversation.id));

    if (activeConversationId) {
      ids.add(activeConversationId);
    }

    return Array.from(ids);
  }, [activeConversationId, conversations]);
  const unreadTotal = conversations.reduce(
    (total, conversation) => total + conversation.unreadCount,
    0
  );

  const refreshConversations = useCallback(async () => {
    if (!enabled) return [];

    const requestId = conversationsRequestRef.current + 1;
    conversationsRequestRef.current = requestId;
    setIsLoadingConversations(true);
    setError(null);

    try {
      const nextConversations = await fetchDirectConversations(userId);

      if (conversationsRequestRef.current === requestId) {
        setConversations(nextConversations);
      }

      return nextConversations;
    } catch (refreshError) {
      if (conversationsRequestRef.current === requestId) {
        setError(getErrorMessage(refreshError));
      }
      return [];
    } finally {
      if (conversationsRequestRef.current === requestId) {
        setIsLoadingConversations(false);
      }
    }
  }, [enabled, userId]);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      const result = await markDirectConversationReadAction(conversationId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, unreadCount: 0 }
            : conversation
        )
      );
    },
    []
  );

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!enabled) return;

      const requestId = messagesRequestRef.current + 1;
      messagesRequestRef.current = requestId;
      setActiveConversationId(conversationId);
      setActiveConversationFallback(null);
      setIsLoadingMessages(true);
      setError(null);

      try {
        const messages = await fetchDirectMessages(conversationId);

        if (messagesRequestRef.current === requestId) {
          setActiveMessages(messages);
        }

        await markConversationRead(conversationId);
      } catch (openError) {
        if (messagesRequestRef.current === requestId) {
          setError(getErrorMessage(openError));
        }
      } finally {
        if (messagesRequestRef.current === requestId) {
          setIsLoadingMessages(false);
        }
      }
    },
    [enabled, markConversationRead]
  );

  const openConversationWithUser = useCallback(
    async (otherUserId: string) => {
      if (!enabled) return;

      setError(null);
      const result = await openDirectConversation(otherUserId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setActiveConversationFallback(result.data);
      await refreshConversations();
      await openConversation(result.data.id);
    },
    [enabled, openConversation, refreshConversations]
  );

  const closeConversation = useCallback(() => {
    setActiveConversationId(null);
    setActiveConversationFallback(null);
    setActiveMessages([]);
  }, []);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!enabled || !activeConversationId || isSending) return;

      const trimmedBody = body.trim();
      if (!trimmedBody) return;

      setIsSending(true);
      setError(null);

      try {
        const result = await sendDirectMessageAction(activeConversationId, trimmedBody);

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setActiveMessages((currentMessages) => [...currentMessages, result.data]);
        await refreshConversations();
      } finally {
        setIsSending(false);
      }
    },
    [activeConversationId, enabled, isSending, refreshConversations]
  );

  const markActiveConversationRead = useCallback(async () => {
    if (!activeConversationId) return;
    await markConversationRead(activeConversationId);
  }, [activeConversationId, markConversationRead]);

  const handleRealtimeMessageInserted = useCallback(
    (message: DirectMessage) => {
      if (message.conversationId !== activeConversationId) return;

      setActiveMessages((currentMessages) => {
        if (currentMessages.some((currentMessage) => currentMessage.id === message.id)) {
          return currentMessages;
        }

        return [...currentMessages, message];
      });

      if (message.senderId !== userId) {
        void markConversationRead(message.conversationId);
      }
    },
    [activeConversationId, markConversationRead, userId]
  );

  useEffect(() => {
    if (!enabled) return;

    queueMicrotask(() => {
      void refreshConversations();
    });
  }, [enabled, refreshConversations]);

  useDirectMessageRealtime({
    conversationIds: realtimeConversationIds,
    enabled,
    onConversationChanged: refreshConversations,
    onMessageInserted: handleRealtimeMessageInserted,
    userId,
  });

  return useMemo(
    () => ({
      activeConversation,
      activeConversationId,
      activeMessages,
      closeConversation,
      conversations,
      error,
      isLoadingConversations,
      isLoadingMessages,
      isSending,
      markActiveConversationRead,
      openConversation,
      openConversationWithUser,
      refreshConversations,
      sendMessage,
      unreadTotal,
    }),
    [
      activeConversation,
      activeConversationId,
      activeMessages,
      closeConversation,
      conversations,
      error,
      isLoadingConversations,
      isLoadingMessages,
      isSending,
      markActiveConversationRead,
      openConversation,
      openConversationWithUser,
      refreshConversations,
      sendMessage,
      unreadTotal,
    ]
  );
}
