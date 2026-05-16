"use client";

import { useChat } from "@livekit/components-react";
import type { ReceivedChatMessage } from "@livekit/components-core";
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Send } from "lucide-react";

interface Props {
  localIdentity: string;
}

// ── Helpers ───────────────────────────────────────────────────
function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── ChatTab component ─────────────────────────────────────────
// Must be rendered inside a <LiveKitRoom> context.
export function ChatTab({ localIdentity }: Props) {
  const { chatMessages, send, isSending } = useChat();
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
    <div className="flex h-full flex-col">
      {/* ── Messages ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
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
        {/* Invisible anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border p-3 flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none rounded-2xl bg-accent border border-border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-0 transition-colors max-h-28 overflow-y-auto"
          style={{ lineHeight: "1.4" }}
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || isSending}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background:
              draft.trim() && !isSending
                ? "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))"
                : "oklch(0.22 0.01 265)",
          }}
          aria-label="Send message"
        >
          <Send className="h-4 w-4 text-white ml-0.5" />
        </button>
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

  return (
    <div className={`flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
      {/* Sender name — only show for others */}
      {!isOwn && (
        <span className="px-1 text-[10px] font-medium text-muted-foreground">
          {senderName}
        </span>
      )}

      {/* Bubble */}
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words"
        style={
          isOwn
            ? {
                background:
                  "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
                color: "white",
                borderBottomRightRadius: "4px",
              }
            : {
                background: "oklch(0.20 0.01 265)",
                color: "oklch(0.90 0.01 265)",
                border: "1px solid oklch(0.25 0.01 265)",
                borderBottomLeftRadius: "4px",
              }
        }
      >
        {msg.message}
      </div>

      {/* Timestamp */}
      <span className="px-1 text-[10px] text-muted-foreground/60">
        {formatTime(msg.timestamp)}
      </span>
    </div>
  );
}
