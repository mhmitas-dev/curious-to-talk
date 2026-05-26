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

const controllerButtonBase =
  "flex h-10 w-10 items-center justify-center rounded-full border border-border/45 bg-[var(--button-dark)] shadow-sm transition-all hover:border-primary/35 hover:bg-[color-mix(in_oklch,var(--button-dark)_86%,var(--brand)_14%)] hover:text-foreground active:translate-y-px";

const controllerButtonActive =
  "border-primary/45 bg-[color-mix(in_oklch,var(--button-dark)_82%,var(--brand)_18%)] text-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--brand)_18%,transparent)]";

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
          className={`${controllerButtonBase} ${isMuted
              ? "text-destructive hover:border-destructive/35 hover:bg-destructive/15"
              : "text-white bg-green-600"
            }`}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <button
          onClick={onLeave}
          className={`${controllerButtonBase} text-destructive hover:border-destructive/35 hover:bg-destructive/15 hover:text-destructive`}
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
          className={`${controllerButtonBase} ${sidebarOpen
              ? controllerButtonActive
              : "text-muted-foreground"
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
      className={`relative ${controllerButtonBase} ${isActive
          ? controllerButtonActive
          : "text-muted-foreground"
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
