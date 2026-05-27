"use server";

import {
  getOrCreateDirectConversation,
  markDirectConversationRead,
  sendDirectMessage,
} from "@/lib/direct-messages/server";
import type {
  DirectConversation,
  DirectMessage,
  DirectMessageActionResult,
} from "@/lib/direct-messages/types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function openDirectConversation(
  otherUserId: string
): Promise<DirectMessageActionResult<DirectConversation>> {
  try {
    const conversation = await getOrCreateDirectConversation(otherUserId);
    return { ok: true, data: conversation };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function sendDirectMessageAction(
  conversationId: string,
  body: string
): Promise<DirectMessageActionResult<DirectMessage>> {
  try {
    const message = await sendDirectMessage(conversationId, body);
    return { ok: true, data: message };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function markDirectConversationReadAction(
  conversationId: string
): Promise<DirectMessageActionResult> {
  try {
    await markDirectConversationRead(conversationId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
