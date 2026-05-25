"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LiveKitRoom, RoomAudioRenderer, useChat } from "@livekit/components-react";
import { LayoutGrid, MessageSquare, Settings, UsersRound, X } from "lucide-react";
import { AppsTab } from "./apps-tab";
import { ChatTab } from "./chat-tab";
import { ParticipantPanel } from "./participant-panel";
import type { BufferTime, ScreenFPS, ScreenQuality, SidebarTab } from "./room-types";
import { SettingsTab } from "./settings-tab";
import { TopBar } from "./top-bar";
import { useLocalStorage } from "./use-local-storage";
import { useScreenShareState } from "./use-screen-share-state";
import { VoiceStage } from "./voice-stage";

interface Props {
  token: string;
  livekitUrl: string;
  userId: string;
}

export function RoomView({ token, livekitUrl, userId }: Props) {
  const router = useRouter();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        audio={false}
        video={false}
        options={{
          adaptiveStream: true,
          publishDefaults: {
            audioPreset: {
              maxBitrate: 96000,
            },
            screenShareEncoding: { maxBitrate: 1500000 },
          },
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        }}
        onDisconnected={() => router.push("/")}
        style={{ display: "contents" }}
      >
        <RoomChrome userId={userId} />
      </LiveKitRoom>
    </div>
  );
}

function RoomChrome({ userId }: { userId: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [screenQuality, setScreenQuality] = useLocalStorage<ScreenQuality>("ctt_screenQuality", "720p");
  const [screenFps, setScreenFps] = useLocalStorage<ScreenFPS>("ctt_screenFps", 30);
  const [bufferTime, setBufferTime] = useLocalStorage<BufferTime>("ctt_bufferTime", 0);
  const { screenShare, toggleScreenShare } = useScreenShareState({
    screenQuality,
    screenFps,
  });
  const { chatMessages } = useChat();
  const router = useRouter();
  const chatIsActive = sidebarOpen && sidebarTab === "chat";
  const unreadChatCount = chatIsActive
    ? 0
    : Math.max(0, chatMessages.length - seenChatCount);

  const markChatSeen = () => {
    setSeenChatCount(chatMessages.length);
  };

  const openSidebarTo = (tab: SidebarTab) => {
    if (sidebarTab === "chat") {
      markChatSeen();
    }
    if (tab === "chat") {
      markChatSeen();
    }
    setSidebarTab(tab);
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    if (sidebarTab === "chat") {
      markChatSeen();
    }
    setSidebarOpen(false);
  };

  const toggleSidebar = () => {
    if (sidebarOpen) {
      closeSidebar();
    } else {
      setSidebarOpen(true);
    }
  };

  return (
    <>
      <RoomAudioRenderer />

      <TopBar
        onLeave={() => router.push("/")}
        sidebarOpen={sidebarOpen}
        unreadChatCount={unreadChatCount}
        onToggleSidebar={toggleSidebar}
        onOpenChat={() => {
          if (sidebarOpen && sidebarTab === "chat") closeSidebar();
          else openSidebarTo("chat");
        }}
        isActive={(tab: SidebarTab) => sidebarOpen && sidebarTab === tab}
      />

      <div
        className={`relative flex flex-1 min-h-0 flex-col transition-all duration-300 ${sidebarOpen ? "md:pr-[380px]" : ""
          }`}
      >
        <VoiceStage bufferTime={bufferTime} />
        <ParticipantPanel
          expanded={participantsExpanded}
          onToggle={() => setParticipantsExpanded((prev) => !prev)}
        />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 md:hidden"
          onClick={closeSidebar}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-[380px] flex-col border-l border-border/35 bg-sidebar shadow-2xl transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        <div className="grid grid-cols-[1fr_auto] bg-card px-2 pt-2 pb-0 shadow-sm">
          <div className="grid grid-cols-4">
            {(["chat", "apps", "social", "settings"] as SidebarTab[]).map((tab) => {
              const Icon =
                tab === "chat"
                  ? MessageSquare
                  : tab === "apps"
                    ? LayoutGrid
                    : tab === "social"
                      ? UsersRound
                      : Settings;
              return (
                <button
                  key={tab}
                  onClick={() => openSidebarTo(tab)}
                  className={`relative flex flex-1 items-center justify-center py-3 transition-colors ${sidebarTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                  title={tab}
                  aria-label={tab}
                >
                  <Icon className="h-5 w-5" />
                  {sidebarTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={closeSidebar}
            className="relative flex w-12 items-center justify-center py-3 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close sidebar"
            title="close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebarTab === "apps" && (
            <AppsTab
              screenQuality={screenQuality}
              screenFps={screenFps}
              screenShare={screenShare}
              onToggleScreenShare={toggleScreenShare}
            />
          )}
          {sidebarTab === "chat" && <ChatTab localIdentity={userId} />}
          {sidebarTab === "social" && <div className="h-full bg-sidebar" />}
          {sidebarTab === "settings" && (
            <SettingsTab
              screenQuality={screenQuality}
              setScreenQuality={setScreenQuality}
              screenFps={screenFps}
              setScreenFps={setScreenFps}
              bufferTime={bufferTime}
              setBufferTime={setBufferTime}
            />
          )}
        </div>
      </aside>
    </>
  );
}
