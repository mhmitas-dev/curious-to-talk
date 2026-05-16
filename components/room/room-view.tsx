"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useIsSpeaking,
  useChat,
  useParticipantAttributes,
} from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { Mic, MicOff, LogOut, MessageSquare, Menu, X, Radio, Play } from "lucide-react";
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

type SidebarTab = "chat" | "apps" | "settings";

// ── Root component ────────────────────────────────────────────
export function RoomView({ room, token, livekitUrl, userId, displayName }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [focusedIdentity, setFocusedIdentity] = useState<string | null>(null);
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
        onDisconnected={() => router.push("/")}
        style={{ display: "contents" }}
      >
        <RoomAudioRenderer />

        {/* 1. Main Room Area */}
        <main
          className={`relative flex flex-1 flex-col transition-all duration-300 ${
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
          <VoiceStage
            focusedIdentity={focusedIdentity}
            setFocusedIdentity={setFocusedIdentity}
          />

          {/* ── Participant strip ─────────────────────────── */}
          <ParticipantStripContainer
            focusedIdentity={focusedIdentity}
            setFocusedIdentity={setFocusedIdentity}
          />
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
              {(["chat", "apps", "settings"] as SidebarTab[]).map((tab) => (
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
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "chat" && <ChatTab localIdentity={userId} />}
            {sidebarTab === "apps" && <AppsTab />}
            {sidebarTab === "settings" && <SettingsTab />}
          </div>
        </aside>
      </LiveKitRoom>
    </div>
  );
}

// ── Top Controls (Mic, Leave) ─────────────────────────────────
function TopControls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();

  const toggleMic = () => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <div className="flex items-center gap-2 bg-card/80 backdrop-blur-md border border-border rounded-full p-1.5 pointer-events-auto shadow-lg">
      <button
        onClick={toggleMic}
        className="flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 border-none shadow-md"
        style={{
          background: isMicrophoneEnabled
            ? "oklch(0.65 0.15 150)" // Green when active
            : "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))", // Primary when muted
        }}
        aria-label={isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isMicrophoneEnabled ? (
          <Mic className="h-5 w-5 text-white" />
        ) : (
          <MicOff className="h-5 w-5 text-white" />
        )}
      </button>

      <button
        onClick={onLeave}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 text-destructive transition-colors hover:bg-destructive hover:text-white active:scale-95"
        aria-label="Leave room"
      >
        <LogOut className="h-5 w-5 ml-1" />
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function extractYoutubeId(url: string) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

// ── Stage ─────────────────────────────────────────────────────
function VoiceStage({
  focusedIdentity,
  setFocusedIdentity,
}: {
  focusedIdentity: string | null;
  setFocusedIdentity: (id: string | null) => void;
}) {
  const participants = useParticipants();
  const focusedParticipant = participants.find(p => p.identity === focusedIdentity);
  const { attributes } = useParticipantAttributes({ participant: focusedParticipant });
  
  const youtubeUrl = attributes?.youtubeUrl;
  const videoId = extractYoutubeId(youtubeUrl || "");

  if (focusedParticipant && videoId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-6 w-full h-full max-h-[70vh]">
        <div className="w-full h-full max-w-4xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-border/50 relative">
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          ></iframe>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
          Watching {focusedParticipant.name ?? focusedParticipant.identity}&apos;s screen
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
function ParticipantStripContainer({
  focusedIdentity,
  setFocusedIdentity,
}: {
  focusedIdentity: string | null;
  setFocusedIdentity: (id: string | null) => void;
}) {
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
            isFocused={focusedIdentity === participant.identity}
            onPress={() => setFocusedIdentity(focusedIdentity === participant.identity ? null : participant.identity)}
          />
        ))}
      </div>
    </div>
  );
}

function ParticipantTile({
  participant,
  isLocal,
  isFocused,
  onPress,
}: {
  participant: Participant;
  isLocal: boolean;
  isFocused: boolean;
  onPress: () => void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  const { attributes } = useParticipantAttributes({ participant });
  const isSharingVideo = !!attributes?.youtubeUrl;

  const avatarUrl = `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(participant.identity)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  return (
    <button onClick={onPress} className="flex shrink-0 flex-col items-center gap-1.5 transition-opacity active:opacity-70 group">
      <div
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-150 overflow-visible"
        style={{
          boxShadow: isFocused ? "0 0 0 2.5px white, 0 0 0 4px oklch(0.60 0.22 285)" : "0 0 0 1px oklch(0.22 0.01 265)",
        }}
      >
        <img src={avatarUrl} alt={participant.name ?? participant.identity} className="h-full w-full object-cover rounded-2xl" />
        
        {/* Watch Party Indicator */}
        {isSharingVideo && (
          <div className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 border border-border shadow-sm z-10 animate-pulse" style={{ animationDuration: '2s' }}>
            <Play className="h-2.5 w-2.5 text-white fill-white ml-0.5" />
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
    </button>
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

// ── Sidebar placeholder tabs ──────────────────────────────────

function AppsTab() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl">🚀</div>
      <p className="text-sm font-medium">Apps coming soon</p>
      <p className="text-xs text-muted-foreground">YouTube, Screen Share, etc.</p>
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
