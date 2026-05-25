"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { LogOut, Menu, MessageSquare, Mic, MicOff } from "lucide-react";
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
    <div className="z-10 flex shrink-0 items-center justify-between bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMic}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all shadow-sm ${
            isMuted
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "text-primary-foreground hover:opacity-90"
          }`}
          style={
            isMuted
              ? undefined
              : {
                  backgroundColor: "var(--chart-4)",
                }
          }
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <button
          onClick={onLeave}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-destructive shadow-sm transition-all hover:bg-destructive hover:text-primary-foreground"
          aria-label="Leave room"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <ChatButtonInBar
          onOpen={onOpenChat}
          isActive={isActive("chat")}
          unreadCount={unreadChatCount}
        />
        <button
          onClick={onToggleSidebar}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-all shadow-sm ${
            sidebarOpen
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-4 w-4" />
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
      className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-all shadow-sm ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      aria-label="Chat"
    >
      <MessageSquare className="h-4 w-4" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
