"use client";

import type { ReceivedChatMessage } from "@livekit/components-core";
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Heart, Image as ImageIcon, ImagePlay, Paperclip, Reply, Send, Smile } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

interface Props {
  chatMessages: ReceivedChatMessage[];
  isSending: boolean;
  localIdentity: string;
  send: (message: string) => Promise<unknown>;
}

// ── Helpers ───────────────────────────────────────────────────
function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function getParticipantAvatarUrl(msg: ReceivedChatMessage) {
  const identity = msg.from?.identity ?? "unknown";

  if (msg.from?.metadata) {
    try {
      const meta = JSON.parse(msg.from.metadata);
      if (typeof meta.avatar_url === "string" && meta.avatar_url.length > 0) {
        return meta.avatar_url;
      }
    } catch (e) {
      console.error("Failed to parse chat participant metadata", e);
    }
  }

  return `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(identity)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// ── ChatTab component ─────────────────────────────────────────
// Must be rendered inside a <LiveKitRoom> context.
export function ChatTab({ chatMessages, isSending, localIdentity, send }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft("");
    await send(text);
    inputRef.current?.focus();
  }, [draft, isSending, send]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (but allow Shift+Enter for newlines)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-3 md:px-3 md:py-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-10">
            <p className="text-xs text-muted-foreground text-center">
              No messages yet.
              <br />
              Say hi! 👋
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => (
            <ChatBubble
              key={msg.id ?? msg.timestamp}
              msg={msg}
              isOwn={msg.from?.identity === localIdentity}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border bg-card px-2.5 pb-2.5 pt-2">
        <div>
          <div className="mb-1 flex h-5 items-center bg-card">
            <div className="flex items-stretch">
              <ComposerPlaceholderButton label="Add image">
                <ImageIcon className="h-4 w-4" />
              </ComposerPlaceholderButton>
              <ComposerPlaceholderButton label="Add GIF">
                <ImagePlay className="h-4 w-4" />
              </ComposerPlaceholderButton>
              <ComposerPlaceholderButton label="Add emoji">
                <Smile className="h-4 w-4" />
              </ComposerPlaceholderButton>
              <ComposerPlaceholderButton label="Attach file">
                <Paperclip className="h-4 w-4" />
              </ComposerPlaceholderButton>
            </div>
          </div>

          <div className="flex overflow-hidden rounded-[4px] border border-border bg-sidebar transition-colors focus-within:border-primary">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={2}
              className="min-h-[64px] max-h-28 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || isSending}
              className="flex w-9 shrink-0 items-center justify-center border-l border-primary/40 bg-primary text-primary-foreground transition-colors active:bg-primary/80 disabled:cursor-not-allowed disabled:bg-card disabled:text-muted-foreground disabled:opacity-70"
              aria-label="Send message"
            >
              <Send className="h-4 w-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Individual chat bubble ────────────────────────────────────
function ChatBubble({
  msg,
  isOwn,
}: {
  msg: ReceivedChatMessage;
  isOwn: boolean;
}) {
  const senderName = msg.from?.name ?? msg.from?.identity ?? "Unknown";
  const avatarUrl = getParticipantAvatarUrl(msg);
  const timestamp = formatTime(msg.timestamp);

  return (
    <div className="group flex gap-2">
      <Avatar size="sm" className="mt-1 h-8 w-8 bg-muted shadow-sm">
        <AvatarImage src={avatarUrl} alt={senderName} />
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 max-w-[86%] flex-col items-start gap-1.5">
        <div className="flex max-w-full items-baseline gap-2">
          <span className="truncate text-[12px] font-semibold leading-none text-foreground">
            {isOwn ? "You" : senderName}
          </span>
          <span className="shrink-0 text-[10px] font-medium leading-none text-muted-foreground">
            {timestamp}
          </span>
        </div>

        <div
          className={`rounded-lg px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm ${isOwn
              ? "bg-[color-mix(in_oklch,var(--card)_82%,var(--brand)_18%)] text-foreground"
              : "bg-card text-foreground"
            }`}
        >
          {msg.message}
        </div>

        <div className="flex items-center gap-1">
          <MessagePlaceholderButton label="React to message">
            <Heart className="h-3.5 w-3.5" />
          </MessagePlaceholderButton>
          <MessagePlaceholderButton label="Reply to message">
            <Reply className="h-3.5 w-3.5" />
          </MessagePlaceholderButton>
        </div>
      </div>
    </div>
  );
}

function ComposerPlaceholderButton({
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
      className="flex h-5 w-9 cursor-not-allowed items-center justify-center text-muted-foreground opacity-90"
      aria-label={`${label} (coming soon)`}
      title={`${label} (coming soon)`}
    >
      {children}
    </button>
  );
}

function MessagePlaceholderButton({
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
      className="flex h-6 w-6 items-center justify-center rounded-md bg-background text-muted-foreground opacity-60 shadow-sm cursor-not-allowed"
      aria-label={`${label} (coming soon)`}
      title={`${label} (coming soon)`}
    >
      {children}
    </button>
  );
}
