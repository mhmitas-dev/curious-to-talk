"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { LogOut, MessageSquare, Mic, MicOff, PanelRight } from "lucide-react";
import type { SidebarTab } from "./room-types";

interface TopBarProps {
  onLeave: () => void;
  sidebarOpen: boolean;
  unreadChatCount: number;
  onToggleSidebar: () => void;
  onOpenChat: () => void;
  isActive: (tab: SidebarTab) => boolean;
}

export function TopBar({
  onLeave,
  sidebarOpen,
  unreadChatCount,
  onToggleSidebar,
  onOpenChat,
  isActive,
}: TopBarProps) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(!localParticipant.isMicrophoneEnabled);

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  return (
    <div className="z-10 flex h-14 shrink-0 items-center justify-between bg-card px-3 shadow-sm">
      {/* ── Left: voice controls ─────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Mic toggle */}
        <button
          onClick={toggleMic}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 ${
            isMuted
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "bg-[var(--success)] text-white shadow-[0_0_12px_var(--success)]/40 hover:brightness-110"
          }`}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        {/* Separator */}
        <span className="mx-1 h-5 w-px bg-border/60" aria-hidden />

        {/* Leave */}
        <button
          onClick={onLeave}
          className="flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
          aria-label="Leave room"
        >
          <LogOut className="h-5 w-5" />
          Leave
        </button>
      </div>

      {/* ── Right: sidebar toggles ───────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Chat */}
        <ChatButtonInBar
          onOpen={onOpenChat}
          isActive={isActive("chat")}
          unreadCount={unreadChatCount}
        />

        {/* Sidebar panel */}
        <button
          onClick={onToggleSidebar}
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 ${
            sidebarOpen
              ? "bg-primary/15 text-primary ring-1 ring-primary/30"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar"
        >
          <PanelRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ChatButtonInBar({
  onOpen,
  isActive,
  unreadCount,
}: {
  onOpen: () => void;
  isActive: boolean;
  unreadCount: number;
}) {
  return (
    <button
      onClick={onOpen}
      className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 ${
        isActive
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      aria-label="Chat"
      title="Chat"
    >
      <MessageSquare className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
