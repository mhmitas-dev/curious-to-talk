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
import { Track, ScreenSharePresets, RemoteTrack, type Participant } from "livekit-client";
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

type ScreenQuality = "720p" | "1080p";
type ScreenFPS = 15 | 30;
type BufferTime = 0 | 1 | 3 | 5;

// ── Custom Hook: useLocalStorage ──────────────────────────────
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

// ── Root component ────────────────────────────────────────────
export function RoomView({ room, token, livekitUrl, userId, displayName }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [screenQuality, setScreenQuality] = useLocalStorage<ScreenQuality>("ctt_screenQuality", "720p");
  const [screenFps, setScreenFps] = useLocalStorage<ScreenFPS>("ctt_screenFps", 30);
  const [bufferTime, setBufferTime] = useLocalStorage<BufferTime>("ctt_bufferTime", 0);
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
          <VoiceStage bufferTime={bufferTime} />

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
            {sidebarTab === "apps" && <AppsTab screenQuality={screenQuality} screenFps={screenFps} />}
            {sidebarTab === "chat" && <ChatTab localIdentity={userId} />}
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
function VoiceStage({ bufferTime }: { bufferTime: BufferTime }) {
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

  useEffect(() => {
    const track = activeShare?.publication?.track;
    if (track instanceof RemoteTrack && typeof track.setPlayoutDelay === 'function') {
      track.setPlayoutDelay(bufferTime);
    }
  }, [activeShare?.publication?.track, bufferTime]);

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

  let avatarUrl = `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(participant.identity)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  
  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      if (meta.avatar_url) {
        avatarUrl = meta.avatar_url;
      }
    } catch (e) {
      console.error("Failed to parse participant metadata", e);
    }
  }

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
function AppsTab({ screenQuality, screenFps }: { screenQuality: ScreenQuality; screenFps: ScreenFPS }) {
  const { localParticipant } = useLocalParticipant();
  const screenShareTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);

  const iAmSharing = localParticipant.isScreenShareEnabled;
  const activeSharingParticipant = screenShareTracks[0]?.participant;
  const someoneElseIsSharing = !!activeSharingParticipant && !iAmSharing;
  const sharerName = activeSharingParticipant?.name ?? activeSharingParticipant?.identity ?? "Someone";

  const toggleScreenShare = async () => {
    if (someoneElseIsSharing) return;
    try {
      const preset = screenQuality === "1080p" 
        ? (screenFps === 30 ? ScreenSharePresets.h1080fps30 : ScreenSharePresets.h1080fps15)
        : (screenFps === 30 ? ScreenSharePresets.h720fps30 : ScreenSharePresets.h720fps15);
        
      await localParticipant.setScreenShareEnabled(!iAmSharing, { 
        audio: true,
        resolution: preset,
      });
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

function SettingsTab({
  screenQuality,
  setScreenQuality,
  screenFps,
  setScreenFps,
  bufferTime,
  setBufferTime,
}: {
  screenQuality: ScreenQuality;
  setScreenQuality: (q: ScreenQuality) => void;
  screenFps: ScreenFPS;
  setScreenFps: (fps: ScreenFPS) => void;
  bufferTime: BufferTime;
  setBufferTime: (b: BufferTime) => void;
}) {
  const [view, setView] = useState<"main" | "screenShare">("main");

  if (view === "main") {
    return (
      <div className="flex h-full flex-col p-4 gap-6">
        <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">Settings</h3>
        
        <div className="flex flex-col gap-2 px-2">
          <button
            onClick={() => setView("screenShare")}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Monitor className="h-5 w-5" />
              </div>
              <span className="font-medium text-foreground">Screen Share</span>
            </div>
            <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-4 gap-6 animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center gap-2 px-2">
        <button
          onClick={() => setView("main")}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors -ml-2"
          aria-label="Back to settings menu"
        >
          <span className="text-xl leading-none mb-1">←</span>
        </button>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Screen Share</h3>
      </div>

      <div className="flex flex-col gap-5 px-2">
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-orange-400 text-center">Quality</label>
            <select
              value={screenQuality}
              onChange={(e) => setScreenQuality(e.target.value as ScreenQuality)}
              className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-orange-400/50 appearance-none cursor-pointer"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
            >
              <option value="720p">720p (HD)</option>
              <option value="1080p">1080p (FHD)</option>
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-orange-400 text-center">Frame Rate</label>
            <select
              value={screenFps}
              onChange={(e) => setScreenFps(Number(e.target.value) as ScreenFPS)}
              className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-orange-400/50 appearance-none cursor-pointer"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
            >
              <option value={15}>15 fps</option>
              <option value={30}>30 fps</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-orange-400 text-center">Buffer Time</label>
          <select
            value={bufferTime}
            onChange={(e) => setBufferTime(Number(e.target.value) as BufferTime)}
            className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-orange-400/50 appearance-none cursor-pointer"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center" }}
          >
            <option value={0}>No buffer - Better for Realtime</option>
            <option value={1}>1 second - Better for Quality</option>
            <option value={3}>3 seconds - Better for Quality</option>
            <option value={5}>5 seconds - Better for Quality</option>
          </select>
        </div>
      </div>
    </div>
  );
}
