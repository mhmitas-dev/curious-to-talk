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
import { Track, ScreenSharePresets, RemoteTrack, RemoteAudioTrack, AudioPresets, type Participant } from "livekit-client";
import {
  Mic, MicOff, LogOut, MessageSquare, Menu, X, Radio,
  MonitorUp, MonitorOff, Monitor, Maximize, Minimize,
  Settings, LayoutGrid, ChevronUp, ChevronDown, Volume2, VolumeX,
} from "lucide-react";
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
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
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
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [screenQuality, setScreenQuality] = useLocalStorage<ScreenQuality>("ctt_screenQuality", "720p");
  const [screenFps, setScreenFps] = useLocalStorage<ScreenFPS>("ctt_screenFps", 30);
  const [bufferTime, setBufferTime] = useLocalStorage<BufferTime>("ctt_bufferTime", 0);
  const router = useRouter();

  const openSidebarTo = (tab: SidebarTab) => {
    setSidebarTab(tab);
    setSidebarOpen(true);
  };

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
        <RoomAudioRenderer />

        {/* ── Top Controls Bar ──────────────────────────────── */}
        <TopBar
          onLeave={() => router.push("/")}
          sidebarOpen={sidebarOpen}
          sidebarTab={sidebarTab}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenChat={() => {
            if (sidebarOpen && sidebarTab === "chat") setSidebarOpen(false);
            else openSidebarTo("chat");
          }}
          isActive={(tab: SidebarTab) => sidebarOpen && sidebarTab === tab}
        />

        {/* ── Main content: stage + participant panel ────────── */}
        <div
          className={`relative flex flex-1 min-h-0 flex-col transition-all duration-300 ${
            sidebarOpen ? "md:pr-[380px]" : ""
          }`}
        >
          {/* Stage: always visible, grows to fill available space */}
          <VoiceStage bufferTime={bufferTime} />

          {/* Participant grid: fixed at bottom, expandable upward */}
          <ParticipantPanel
            expanded={participantsExpanded}
            onToggle={() => setParticipantsExpanded((prev) => !prev)}
            localIdentity={userId}
          />
        </div>

        {/* ── Mobile Backdrop ───────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}

        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside
          className={`fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-[380px] flex-col border-l border-border bg-card/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Tabs + close */}
          <div className="flex items-center justify-between border-b border-border px-2 pt-2 pb-0">
            <div className="flex flex-1 justify-around">
              {(["chat", "apps", "settings"] as SidebarTab[]).map((tab) => {
                const Icon =
                  tab === "chat" ? MessageSquare : tab === "apps" ? LayoutGrid : Settings;
                return (
                  <button
                    key={tab}
                    onClick={() => setSidebarTab(tab)}
                    className={`relative flex flex-1 items-center justify-center py-3 transition-colors ${
                      sidebarTab === tab
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
              onClick={() => setSidebarOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mr-1"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "apps" && (
              <AppsTab screenQuality={screenQuality} screenFps={screenFps} />
            )}
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

// ── Top Bar ───────────────────────────────────────────────────
function TopBar({
  onLeave,
  sidebarOpen,
  sidebarTab,
  onToggleSidebar,
  onOpenChat,
  isActive,
}: {
  onLeave: () => void;
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  onToggleSidebar: () => void;
  onOpenChat: () => void;
  isActive: (tab: SidebarTab) => boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(!localParticipant.isMicrophoneEnabled);

  const toggleMic = async () => {
    await localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  return (
    <div className="flex shrink-0 items-center justify-between px-4 py-2.5 border-b border-border bg-background/80 backdrop-blur-md z-10">
      {/* Left: Mic + Leave */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggleMic}
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all shadow-sm ${
            isMuted
              ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
              : "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20"
          }`}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <button
          onClick={onLeave}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card border border-border text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all shadow-sm"
          aria-label="Leave room"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Right: Chat + Sidebar */}
      <div className="flex items-center gap-2.5">
        <ChatButtonInBar onOpen={onOpenChat} isActive={isActive("chat")} />
        <button
          onClick={onToggleSidebar}
          className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all shadow-sm ${
            sidebarOpen
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Chat button (with unread badge) — inside TopBar ───────────
function ChatButtonInBar({ onOpen, isActive }: { onOpen: () => void; isActive: boolean }) {
  const { chatMessages } = useChat();
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    if (isActive) setSeenCount(chatMessages.length);
  }, [isActive, chatMessages.length]);

  const unread = Math.max(0, chatMessages.length - seenCount);

  return (
    <button
      onClick={onOpen}
      className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-all shadow-sm ${
        isActive
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
      aria-label="Chat"
    >
      <MessageSquare className="h-4 w-4" />
      {unread > 0 && !isActive && (
        <span
          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
          style={{
            background: "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
          }}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// ── Stage ─────────────────────────────────────────────────────
function VoiceStage({ bufferTime }: { bufferTime: BufferTime }) {
  const screenShareTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const screenAudioTracks = useTracks([
    { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
  ]);
  const activeShare = screenShareTracks[0];
  const activeAudio = screenAudioTracks[0];

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const track = activeShare?.publication?.track;
    if (track instanceof RemoteTrack && typeof track.setPlayoutDelay === "function") {
      track.setPlayoutDelay(bufferTime);
    }
  }, [activeShare?.publication?.track, bufferTime]);

  useEffect(() => {
    const track = activeAudio?.publication?.track;
    if (track instanceof RemoteAudioTrack) {
      track.setVolume(isAudioMuted ? 0 : 1);
    }
  }, [activeAudio?.publication?.track, isAudioMuted]);

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
      <div className="flex-1 min-w-0 min-h-0 flex flex-col items-center justify-center p-2 md:p-4 bg-black/90">
        <div
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center rounded-xl overflow-hidden shadow-2xl bg-black"
        >
          <VideoTrack trackRef={activeShare} className="w-full h-full object-contain" />
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
            {activeAudio && (
              <button
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className="p-2 rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-colors shadow-lg border border-white/10"
                aria-label={isAudioMuted ? "Unmute screen share" : "Mute screen share"}
              >
                {isAudioMuted ? <VolumeX className="h-5 w-5 text-red-400" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-black/60 text-white backdrop-blur hover:bg-black/80 transition-colors shadow-lg border border-white/10"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No screen share — decorative placeholder
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pointer-events-none opacity-25 select-none">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full border border-foreground/10"
        style={{ background: "radial-gradient(circle, oklch(0.28 0.02 265) 0%, transparent 70%)" }}
      >
        <Radio className="h-7 w-7 text-muted-foreground animate-pulse" style={{ animationDuration: "3s" }} />
      </div>
      <p className="mt-5 text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
        Curious to Talk
      </p>
    </div>
  );
}

// ── Participant Panel (bottom, expandable) ────────────────────
function ParticipantPanel({
  expanded,
  onToggle,
  localIdentity,
}: {
  expanded: boolean;
  onToggle: () => void;
  localIdentity: string;
}) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  if (participants.length === 0) return null;

  // Each tile ≈ 80px tall (56px avatar + gap + 14px name + 10px padding).
  // Show 2 full rows + ~30px peek of 3rd row = 80*2 + 30 = 190px + handle 28px = 218px.
  const COLLAPSED_MAX_H = 218;

  return (
    <div className="shrink-0 border-t border-border bg-card/30 backdrop-blur-sm">
      {/* Drag-handle style toggle */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors group"
        aria-label={expanded ? "Collapse participants" : "Expand participants"}
      >
        <span className="h-px w-8 rounded-full bg-border group-hover:bg-foreground/30 transition-colors" />
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
        <span className="h-px w-8 rounded-full bg-border group-hover:bg-foreground/30 transition-colors" />
      </button>

      {/* Scrollable grid */}
      <div
        className="overflow-y-auto transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "50vh" : `${COLLAPSED_MAX_H}px` }}
      >
        <div className="grid grid-cols-4 gap-2 px-3 pb-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.identity}
              participant={participant}
              isLocal={participant.identity === localParticipant.identity}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Participant Tile ──────────────────────────────────────────
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
      if (meta.avatar_url) avatarUrl = meta.avatar_url;
    } catch (e) {
      console.error("Failed to parse participant metadata", e);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      {/* Avatar + badges */}
      <div className="relative">
        {/* Speaking ring */}
        <div
          className={`rounded-full transition-all duration-200 ${
            isSpeaking
              ? "p-[2px]"
              : "p-[2px]"
          }`}
          style={
            isSpeaking
              ? {
                  background: "linear-gradient(135deg, oklch(0.75 0.2 145), oklch(0.65 0.22 155))",
                  boxShadow: "0 0 10px oklch(0.75 0.2 145 / 0.45)",
                }
              : {
                  background: "transparent",
                }
          }
        >
          <img
            src={avatarUrl}
            alt={participant.name ?? participant.identity}
            className="h-14 w-14 rounded-full object-cover bg-card block"
          />
        </div>

        {/* Muted badge */}
        {isMuted && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card border border-border shadow-sm">
            <MicOff className="h-[9px] w-[9px] text-red-400" />
          </div>
        )}

        {/* Screen-sharing badge */}
        {isScreenShareEnabled && (
          <div className="absolute -top-0.5 -left-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary border border-card shadow-sm text-primary-foreground">
            <Monitor className="h-[9px] w-[9px]" />
          </div>
        )}
      </div>

      {/* Name */}
      <span className="w-full truncate text-center text-[10px] font-medium leading-tight text-muted-foreground">
        {isLocal ? "You" : (participant.name ?? participant.identity)}
      </span>
    </div>
  );
}

// ── Apps Tab ──────────────────────────────────────────────────
function AppsTab({
  screenQuality,
  screenFps,
}: {
  screenQuality: ScreenQuality;
  screenFps: ScreenFPS;
}) {
  const { localParticipant } = useLocalParticipant();
  const screenShareTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const iAmSharing = localParticipant.isScreenShareEnabled;
  const activeSharingParticipant = screenShareTracks[0]?.participant;
  const someoneElseIsSharing = !!activeSharingParticipant && !iAmSharing;
  const sharerName =
    activeSharingParticipant?.name ?? activeSharingParticipant?.identity ?? "Someone";

  // Fix: set contentHint='music' on the screen share audio track so the browser
  // uses music-quality Opus encoding instead of speech mode, which causes the
  // hollow/muffled sound heard when system audio is captured.
  useEffect(() => {
    if (!iAmSharing) return;
    const timer = setTimeout(() => {
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
      const mst = (pub?.track as { mediaStreamTrack?: MediaStreamTrack } | undefined)
        ?.mediaStreamTrack;
      if (mst && "contentHint" in mst) {
        mst.contentHint = "music";
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [iAmSharing, localParticipant]);

  const toggleScreenShare = async () => {
    if (someoneElseIsSharing) return;
    try {
      const preset =
        screenQuality === "1080p"
          ? screenFps === 30
            ? ScreenSharePresets.h1080fps30
            : ScreenSharePresets.h1080fps15
          : screenFps === 30
          ? ScreenSharePresets.h720fps30
          : ScreenSharePresets.h720fps15;
      await localParticipant.setScreenShareEnabled(!iAmSharing, {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2, // Force stereo for high quality
          sampleRate: 48000, // Studio quality sample rate
        },
        resolution: preset,
      // Pass publish options: use the highest-quality stereo audio preset for
      // screen share audio so it's encoded as music, not speech (256kbps stereo).
      }, { audioPreset: AudioPresets.musicHighQualityStereo, forceStereo: true });
    } catch (e) {
      console.error("Failed to toggle screen share", e);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">
        Applications
      </h3>

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
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            iAmSharing ? "bg-primary text-primary-foreground" : "bg-accent"
          }`}
        >
          {iAmSharing ? <MonitorOff className="h-6 w-6" /> : <MonitorUp className="h-6 w-6" />}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">
            {iAmSharing
              ? "Stop Sharing"
              : someoneElseIsSharing
              ? "Screen Sharing"
              : "Share Screen"}
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

// ── Settings Tab ──────────────────────────────────────────────
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
        <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">
          Settings
        </h3>
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
            <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">
              →
            </span>
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
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Screen Share
        </h3>
      </div>

      <div className="flex flex-col gap-5 px-2">
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1.5">
            <label className="text-xs font-medium text-orange-400 text-center">Quality</label>
            <select
              value={screenQuality}
              onChange={(e) => setScreenQuality(e.target.value as ScreenQuality)}
              className="bg-card text-sm border border-border rounded-lg px-3 py-2.5 text-foreground outline-none focus:border-orange-400/50 appearance-none cursor-pointer"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
              }}
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
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
              }}
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
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.75rem center",
            }}
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
