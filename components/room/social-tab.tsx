"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  ImagePlay,
  LoaderCircle,
  MessageCircle,
  Paperclip,
  Send,
  Smile,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import type {
  DirectConversation,
  DirectConversationSummary,
  DirectMessage,
  DirectProfile,
} from "@/lib/direct-messages/types";
import type { DirectMessageState } from "./use-direct-message-state";

interface SocialTabProps {
  directMessages: DirectMessageState;
  localUserId: string;
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function hasOtherUser(
  conversation: DirectConversationSummary | DirectConversation | null
): conversation is DirectConversationSummary {
  return !!conversation && "otherUser" in conversation;
}

function getConversationTitle(
  conversation: DirectConversationSummary | DirectConversation | null
) {
  return hasOtherUser(conversation)
    ? conversation.otherUser.displayName
    : "Conversation";
}

function getConversationAvatar(
  conversation: DirectConversationSummary | DirectConversation | null
) {
  return hasOtherUser(conversation) ? conversation.otherUser.avatarUrl : null;
}

function getConversationInitials(
  conversation: DirectConversationSummary | DirectConversation | null
) {
  return getInitials(getConversationTitle(conversation));
}

export function SocialTab({ directMessages, localUserId }: SocialTabProps) {
  if (directMessages.activeConversationId) {
    return (
      <DirectMessageThread
        directMessages={directMessages}
        localUserId={localUserId}
      />
    );
  }

  return <DirectMessageInbox directMessages={directMessages} />;
}

function DirectMessageInbox({
  directMessages,
}: {
  directMessages: DirectMessageState;
}) {
  const isLoading = directMessages.isLoadingConversations;
  const hasContent = directMessages.conversations.length > 0;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center border-b border-border bg-sidebar px-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold leading-tight text-foreground">
            Social
          </h3>
          {isLoading && (
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          )}
        </div>
        {directMessages.error && (
          <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {directMessages.error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 md:px-3">
        {directMessages.conversations.length > 0 && (
          <section className="mb-5">
            <SectionLabel>Messages</SectionLabel>
            <div className="mt-2 flex flex-col gap-2">
              {directMessages.conversations.map((conversation) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  onOpen={() => directMessages.openConversation(conversation.id)}
                />
              ))}
            </div>
          </section>
        )}

        {!hasContent && !isLoading && (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm">
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              No messages yet
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Tap someone you meet in this room to start a conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DirectMessageThread({
  directMessages,
  localUserId,
}: {
  directMessages: DirectMessageState;
  localUserId: string;
}) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const conversation = directMessages.activeConversation;
  const title = getConversationTitle(conversation);
  const avatarUrl = getConversationAvatar(conversation);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [directMessages.activeMessages.length]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || directMessages.isSending) return;
    setDraft("");
    await directMessages.sendMessage(text);
    inputRef.current?.focus();
  }, [directMessages, draft]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 flex-col justify-center border-b border-border bg-sidebar px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={directMessages.closeConversation}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {directMessages.isLoadingMessages && (
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
          )}

          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-sm font-semibold text-foreground">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">Conversation</p>
          </div>

          <Avatar className="h-9 w-9 bg-muted shadow-sm">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={title} />}
            <AvatarFallback className="text-xs font-semibold">
              {getConversationInitials(conversation)}
            </AvatarFallback>
          </Avatar>
        </div>
        {directMessages.error && (
          <p className="mx-2 mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {directMessages.error}
          </p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-2.5 py-3 md:px-3 md:py-4">
        {directMessages.activeMessages.length === 0 && !directMessages.isLoadingMessages ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-center text-xs text-muted-foreground">
              No messages yet.
              <br />
              Start the conversation.
            </p>
          </div>
        ) : (
          directMessages.activeMessages.map((message) => (
            <DirectMessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === localUserId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-card px-2.5 pb-2.5 pt-2">
        <div>
          <div className="mb-1 flex h-5 items-center bg-card">
            <SocialComposerPlaceholderButton label="Add image">
              <ImageIcon className="h-4 w-4" />
            </SocialComposerPlaceholderButton>
            <SocialComposerPlaceholderButton label="Add GIF">
              <ImagePlay className="h-4 w-4" />
            </SocialComposerPlaceholderButton>
            <SocialComposerPlaceholderButton label="Add emoji">
              <Smile className="h-4 w-4" />
            </SocialComposerPlaceholderButton>
            <SocialComposerPlaceholderButton label="Attach file">
              <Paperclip className="h-4 w-4" />
            </SocialComposerPlaceholderButton>
          </div>

          <div className="flex overflow-hidden rounded-[4px] border border-border bg-sidebar transition-colors focus-within:border-primary">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={2}
              className="min-h-[64px] max-h-28 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!draft.trim() || directMessages.isSending}
              className="flex w-9 shrink-0 items-center justify-center border-l border-primary/40 bg-primary text-primary-foreground transition-colors active:bg-primary/80 disabled:cursor-not-allowed disabled:bg-card disabled:text-muted-foreground disabled:opacity-70"
              aria-label="Send direct message"
            >
              {directMessages.isSending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="ml-0.5 h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

function ConversationRow({
  conversation,
  onOpen,
}: {
  conversation: DirectConversationSummary;
  onOpen: () => void;
}) {
  const preview = conversation.lastMessage?.body ?? "No messages yet";
  const timestamp = conversation.lastMessage
    ? formatMessageTime(conversation.lastMessage.createdAt)
    : formatMessageTime(conversation.updatedAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent"
    >
      <ProfileAvatar profile={conversation.otherUser} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {conversation.otherUser.displayName}
          </p>
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
            {timestamp}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {preview}
        </p>
      </div>

      {conversation.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
        </span>
      )}
    </button>
  );
}

function DirectMessageBubble({
  message,
  isOwn,
}: {
  message: DirectMessage;
  isOwn: boolean;
}) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[86%] flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed shadow-sm break-words ${isOwn
              ? "bg-[color-mix(in_oklch,var(--card)_82%,var(--brand)_18%)] text-foreground"
              : "bg-card text-foreground"
            }`}
        >
          {message.body}
        </div>
        <span className="px-1 text-[10px] font-medium text-muted-foreground">
          {formatMessageTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

function SocialComposerPlaceholderButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      className="flex h-5 w-9 cursor-not-allowed items-center justify-center text-primary opacity-90"
      aria-label={`${label} (coming soon)`}
      title={`${label} (coming soon)`}
    >
      {children}
    </button>
  );
}

function ProfileAvatar({ profile }: { profile: DirectProfile }) {
  return (
    <Avatar className="h-9 w-9 bg-muted shadow-sm">
      {profile.avatarUrl && (
        <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
      )}
      <AvatarFallback className="text-xs font-semibold">
        {getInitials(profile.displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
