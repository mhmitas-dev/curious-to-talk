export interface DirectProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface DirectConversation {
  id: string;
  userA: string;
  userB: string;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface DirectConversationSummary extends DirectConversation {
  otherUser: DirectProfile;
  lastMessage: DirectMessage | null;
  unreadCount: number;
}

export type DirectMessageActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };
