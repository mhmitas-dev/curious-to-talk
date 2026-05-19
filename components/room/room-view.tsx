"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  useChat,
  useTracks,
  VideoTrack,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";
import { Mic, MicOff, LogOut, MessageSquare, Menu, X, Radio, MonitorUp, MonitorOff, Monitor, Maximize, Minimize } from "lucide-react";
import { ChatTab } from "./chat-tab";

interface Room {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  room: Room;
  token: string;
  livekitUrl: string;
  userId: string;
  displayName: string;
}

type SidebarTab = "apps" | "chat" | "settings";

// ── Root component ────────────────────────────────────────────
export function RoomView({ room, token, livekitUrl, userId, displayName }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const router = useRouter();

  const handleLeave = () => {
    router.push("/");
  };

  const openSidebarTo = (tab: SidebarTab) => {
    setSidebarTab(tab);
    setSidebarOpen(true);
  };

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background">
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect={true}
        audio={false}
        video={false}
        options={{ adaptiveStream: true }}
        onDisconnected={() => router.push("/")}
        style={{ display: "contents" }}
      >
        <RoomAudioRenderer />

        {/* 1. Main Room Area */}
        <main
          className={`relative flex flex-1 min-w-0 min-h-0 flex-col transition-all duration-300 ${
            sidebarOpen ? "md:pr-80" : "pr-0"
          }`}
        >
          {/* ── Top Floating Controls ───────────────────────── */}
          <div className="absolute left-4 right-4 top-4 z-10 flex justify-between items-start pointer-events-none">
            <div className="w-10" /> {/* Spacer to balance center */}
            
            {/* Center Main Controls (Mic, Leave) */}
            <TopControls onLeave={handleLeave} />

            {/* Right Side Tools (Chat, Menu) */}
            <div className="flex flex-col gap-3 pointer-events-auto">
              <ChatButton
                onClick={() => {
                  if (sidebarOpen && sidebarTab === "chat") {
                    setSidebarOpen(false);
                  } else {
                    openSidebarTo("chat");
                  }
                }}
                isActive={sidebarOpen && sidebarTab === "chat"}
              />
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-md border border-border transition-colors shadow-lg ${
                  sidebarOpen 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-card/80 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                aria-label="Toggle Sidebar"
              >
                <Menu className="h-[22px] w-[22px]" />
              </button>
            </div>
          </div>

          {/* ── Stage (spotlight) ──────────────────────────── */}
          <VoiceStage />

          {/* ── Participant strip ─────────────────────────── */}
          <ParticipantStripContainer />
        </main>

        {/* 2. Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* 3. The Sidebar */}
        <aside
          className={`fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-[320px] flex-col border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Sidebar Header / Tabs */}
          <div className="flex items-center justify-between border-b border-border px-2 pt-2 pb-0">
            <div className="flex flex-1 gap-1">
              {(["apps", "chat", "settings"] as SidebarTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  className={`relative px-3 py-2.5 text-xs font-semibold capitalize transition-colors ${
                    sidebarTab === tab
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                  {sidebarTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mr-1"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "apps" && <AppsTab />}
            {sidebarTab === "chat" && <ChatTab localIdentity={userId} />}
            {sidebarTab === "settings" && <SettingsTab />}
          </div>
        </aside>
      </LiveKitRoom>
    </div>
  );
}

// ── Top Controls ──────────────────────────────────────────────
function TopControls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(!localParticipant.isMicrophoneEnabled);

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  return (
    <div className="flex items-center gap-3 pointer-events-auto">
      <button
        onClick={toggleMic}
        className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md border transition-all shadow-xl ${
          isMuted
            ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
            : "bg-card/80 border-border text-foreground hover:bg-accent"
        }`}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </button>

      <button
        onClick={onLeave}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/90 backdrop-blur-md border border-red-400/50 text-white hover:bg-red-500 transition-all shadow-xl"
        aria-label="Leave room"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  );
}

// ── Stage ─────────────────────────────────────────────────────
function VoiceStage() {
  const screenShareTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const activeShare = screenShareTracks[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (activeShare && activeShare.publication) {
    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col items-center justify-center p-2 md:p-4 bg-black/95">
        <div
          ref={containerRef}
          className="relative w-full h-full max-h-full flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-black/95"
        >
          <VideoTrack
            trackRef={activeShare}
            className="w-full h-full object-contain"
          />
          <button
            onClick={toggleFullscreen}
            className="absolute bottom-4 right-4 p-2 rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-colors z-10 shadow-lg border border-white/10"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pointer-events-none opacity-30 select-none">
      <div className="flex h-24 w-24 items-center justify-center rounded-full border border-foreground/10" style={{ background: "radial-gradient(circle, oklch(0.2 0 0) 0%, transparent 100%)" }}>
        <Radio className="h-8 w-8 text-muted-foreground animate-pulse" style={{ animationDuration: "3s" }} />
      </div>
      <p className="mt-6 text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
        Curious to Talk
      </p>
    </div>
  );
}

// ── Participant Strip Container ───────────────────────────────
function ParticipantStripContainer() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  if (participants.length === 0) return null;

  return (
    <div className="shrink-0 border-t border-border bg-background/50 backdrop-blur-sm pb-safe">
      <div className="flex gap-3 overflow-x-auto px-4 py-4 scrollbar-none items-center justify-center">
        {participants.map((participant) => (
          <ParticipantTile
            key={participant.identity}
            participant={participant}
            isLocal={participant.identity === localParticipant.identity}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantTile({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  const isScreenShareEnabled = participant.isScreenShareEnabled;

  const avatarUrl = `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(participant.identity)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 group relative">
      <div
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl overflow-visible"
        style={{
          boxShadow: isScreenShareEnabled
            ? "0 0 0 2.5px white, 0 0 0 4px oklch(0.60 0.22 285)"
            : "0 0 0 1px oklch(0.22 0.01 265)",
        }}
      >
        <img src={avatarUrl} alt={participant.name ?? participant.identity} className="h-full w-full object-cover rounded-2xl" />

        {/* Screen Share Badge */}
        {isScreenShareEnabled && (
          <div className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary border border-border shadow-md z-20 text-primary-foreground animate-in zoom-in">
            <Monitor className="h-3 w-3" />
          </div>
        )}

        {/* Status Badge (Mic) */}
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow-sm overflow-hidden z-10">
          {isMuted ? (
            <MicOff className="h-[11px] w-[11px] text-muted-foreground" />
          ) : (
            <>
              {isSpeaking && <span className="absolute inset-0 bg-green-500/20 animate-pulse" style={{ animationDuration: '0.8s' }} />}
              <Mic className={`relative z-10 h-[11px] w-[11px] ${isSpeaking ? "text-green-500" : "text-muted-foreground"}`} />
            </>
          )}
        </div>
      </div>
      <span className="max-w-[64px] truncate text-center text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        {isLocal ? "You" : (participant.name ?? participant.identity)}
      </span>
    </div>
  );
}

// ── Chat button with unread badge ────────────────────────────
// Must be inside <LiveKitRoom> to use useChat()
function ChatButton({ onClick, isActive }: { onClick: () => void; isActive: boolean }) {
  const { chatMessages } = useChat();
  const [seenCount, setSeenCount] = useState(0);

  // Reset unread count when the chat sidebar is open
  useEffect(() => {
    if (isActive) {
      setSeenCount(chatMessages.length);
    }
  }, [isActive, chatMessages.length]);

  const unread = Math.max(0, chatMessages.length - seenCount);

  return (
    <button
      onClick={onClick}
      className="relative flex h-12 w-12 items-center justify-center rounded-full bg-card/80 backdrop-blur-md border border-border transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground shadow-lg"
      aria-label="Open Chat"
    >
      <MessageSquare className="h-[22px] w-[22px]" />
      {unread > 0 && !isActive && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))" }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// ── Apps Tab ──────────────────────────────────────────────────
function AppsTab() {
  const { localParticipant } = useLocalParticipant();
  const screenShareTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);

  const iAmSharing = localParticipant.isScreenShareEnabled;
  const activeSharingParticipant = screenShareTracks[0]?.participant;
  const someoneElseIsSharing = !!activeSharingParticipant && !iAmSharing;
  const sharerName = activeSharingParticipant?.name ?? activeSharingParticipant?.identity ?? "Someone";

  const toggleScreenShare = async () => {
    if (someoneElseIsSharing) return;
    try {
      await localParticipant.setScreenShareEnabled(!iAmSharing, { audio: true });
    } catch (e) {
      console.error("Failed to toggle screen share", e);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Applications</h3>
      
      <button
        onClick={toggleScreenShare}
        disabled={someoneElseIsSharing}
        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
          iAmSharing
            ? "bg-primary/10 border-primary/30 text-primary"
            : someoneElseIsSharing
            ? "bg-card/50 border-border text-muted-foreground opacity-50 cursor-not-allowed"
            : "bg-card border-border hover:bg-accent/50 text-foreground"
        }`}
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          iAmSharing ? "bg-primary text-primary-foreground" : "bg-accent"
        }`}>
          {iAmSharing ? <MonitorOff className="h-6 w-6" /> : <MonitorUp className="h-6 w-6" />}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">
            {iAmSharing ? "Stop Sharing" : someoneElseIsSharing ? "Screen Sharing" : "Share Screen"}
          </span>
          <span className="text-xs opacity-70">
            {iAmSharing
              ? "You are presenting"
              : someoneElseIsSharing
              ? `${sharerName} is presenting`
              : "Share a window or your entire screen"}
          </span>
        </div>
      </button>

      {/* Placeholder for future apps */}
      <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/50 opacity-50 grayscale cursor-not-allowed">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
          <span className="text-xl">🚀</span>
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">More Apps</span>
          <span className="text-xs">Coming soon</span>
        </div>
      </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl">⚙️</div>
      <p className="text-sm font-medium">Settings coming soon</p>
    </div>
  );
}
