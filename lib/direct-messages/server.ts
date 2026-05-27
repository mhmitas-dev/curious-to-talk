import "server-only";

import { requireApprovedProfile } from "@/lib/auth/server";
import type {
  DirectConversation,
  DirectConversationSummary,
  DirectMessage,
  DirectProfile,
} from "./types";

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_MESSAGE_LIMIT = 50;

interface ConversationRow {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

interface ReadRow {
  conversation_id: string;
  last_read_at: string;
}

function toDirectProfile(row: ProfileRow): DirectProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function toDirectConversation(row: ConversationRow): DirectConversation {
  return {
    id: row.id,
    userA: row.user_a,
    userB: row.user_b,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDirectMessage(row: MessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

function getDirectConversationPair(userId: string, otherUserId: string) {
  if (userId === otherUserId) {
    throw new Error("You cannot start a direct conversation with yourself.");
  }

  return userId < otherUserId
    ? { userA: userId, userB: otherUserId }
    : { userA: otherUserId, userB: userId };
}

function getOtherUserId(conversation: ConversationRow, userId: string) {
  return conversation.user_a === userId ? conversation.user_b : conversation.user_a;
}

function validateMessageBody(body: string) {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error("Message cannot be empty.");
  }

  if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  return trimmedBody;
}

export async function getOrCreateDirectConversation(otherUserId: string) {
  const { supabase, userId } = await requireApprovedProfile();
  const { userA, userB } = getDirectConversationPair(userId, otherUserId);

  const { data: otherProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", otherUserId)
    .eq("status", "approved")
    .single();

  if (profileError || !otherProfile) {
    throw new Error("This user is not available for direct messages.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("direct_conversations")
    .select("id, user_a, user_b, created_at, updated_at")
    .eq("user_a", userA)
    .eq("user_b", userB)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return toDirectConversation(existing as ConversationRow);
  }

  const { data: created, error: createError } = await supabase
    .from("direct_conversations")
    .insert({ user_a: userA, user_b: userB })
    .select("id, user_a, user_b, created_at, updated_at")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("direct_conversations")
        .select("id, user_a, user_b, created_at, updated_at")
        .eq("user_a", userA)
        .eq("user_b", userB)
        .single();

      if (duplicateError) {
        throw duplicateError;
      }

      return toDirectConversation(duplicate as ConversationRow);
    }

    throw createError;
  }

  return toDirectConversation(created as ConversationRow);
}

export async function listDirectConversations() {
  const { supabase, userId } = await requireApprovedProfile();

  const { data: conversations, error: conversationsError } = await supabase
    .from("direct_conversations")
    .select("id, user_a, user_b, created_at, updated_at")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (conversationsError) {
    throw conversationsError;
  }

  const conversationRows = (conversations ?? []) as ConversationRow[];
  if (conversationRows.length === 0) {
    return [];
  }

  const conversationIds = conversationRows.map((conversation) => conversation.id);
  const otherUserIds = Array.from(
    new Set(conversationRows.map((conversation) => getOtherUserId(conversation, userId)))
  );

  const [
    { data: profiles, error: profilesError },
    { data: messages, error: messagesError },
    { data: reads, error: readsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", otherUserIds),
    supabase
      .from("direct_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("direct_conversation_reads")
      .select("conversation_id, last_read_at")
      .in("conversation_id", conversationIds)
      .eq("user_id", userId),
  ]);

  if (profilesError) throw profilesError;
  if (messagesError) throw messagesError;
  if (readsError) throw readsError;

  const profileById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, toDirectProfile(profile)])
  );
  const readByConversationId = new Map(
    ((reads ?? []) as ReadRow[]).map((read) => [read.conversation_id, read.last_read_at])
  );
  const messagesByConversationId = new Map<string, DirectMessage[]>();

  for (const message of (messages ?? []) as MessageRow[]) {
    const mappedMessage = toDirectMessage(message);
    const existingMessages = messagesByConversationId.get(message.conversation_id) ?? [];
    existingMessages.push(mappedMessage);
    messagesByConversationId.set(message.conversation_id, existingMessages);
  }

  return conversationRows
    .map((conversation): DirectConversationSummary | null => {
      const otherUserId = getOtherUserId(conversation, userId);
      const otherUser = profileById.get(otherUserId);

      if (!otherUser) {
        return null;
      }

      const conversationMessages = messagesByConversationId.get(conversation.id) ?? [];
      const lastReadAt = readByConversationId.get(conversation.id);
      const unreadCount = conversationMessages.filter(
        (message) =>
          message.senderId !== userId &&
          (!lastReadAt || message.createdAt > lastReadAt)
      ).length;

      return {
        ...toDirectConversation(conversation),
        otherUser,
        lastMessage: conversationMessages[0] ?? null,
        unreadCount,
      };
    })
    .filter((conversation): conversation is DirectConversationSummary => !!conversation);
}

export async function listDirectMessages(
  conversationId: string,
  limit = DEFAULT_MESSAGE_LIMIT
) {
  await getDirectConversation(conversationId);
  const { supabase } = await requireApprovedProfile();

  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as MessageRow[]).map(toDirectMessage).reverse();
}

export async function getDirectConversation(conversationId: string) {
  const { supabase } = await requireApprovedProfile();

  const { data, error } = await supabase
    .from("direct_conversations")
    .select("id, user_a, user_b, created_at, updated_at")
    .eq("id", conversationId)
    .single();

  if (error) {
    throw error;
  }

  return toDirectConversation(data as ConversationRow);
}

export async function sendDirectMessage(conversationId: string, body: string) {
  const { supabase, userId } = await requireApprovedProfile();
  const messageBody = validateMessageBody(body);

  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      body: messageBody,
      conversation_id: conversationId,
      sender_id: userId,
    })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();

  if (error) {
    throw error;
  }

  await markDirectConversationRead(conversationId, data.created_at as string);

  return toDirectMessage(data as MessageRow);
}

export async function markDirectConversationRead(
  conversationId: string,
  lastReadAt = new Date().toISOString()
) {
  const { supabase, userId } = await requireApprovedProfile();

  const { error } = await supabase
    .from("direct_conversation_reads")
    .upsert(
      {
        conversation_id: conversationId,
        last_read_at: lastReadAt,
        user_id: userId,
      },
      { onConflict: "conversation_id,user_id" }
    );

  if (error) {
    throw error;
  }
}
