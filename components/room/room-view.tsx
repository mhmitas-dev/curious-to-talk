"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useChat,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { LoaderCircle, LogOut } from "lucide-react";
import { AppsTab } from "./apps-tab";
import { ChatTab } from "./chat-tab";
import { ParticipantPanel } from "./participant-panel";
import { RoomSidebar } from "./room-sidebar";
import type {
  BufferTime,
  ScreenFPS,
  ScreenQuality,
  ScreenShareMode,
  SidebarTab,
} from "./room-types";
import { SettingsTab } from "./settings-tab";
import { SocialTab } from "./social-tab";
import { RoomStage } from "./stage/room-stage";
import { TopBar } from "./top-bar";
import { useDirectMessageState } from "./use-direct-message-state";
import { useLocalStorage } from "./use-local-storage";
import { useRoomAppsState } from "./use-room-apps-state";
import { useRoomStageState } from "./use-room-stage-state";
import { useRoomYouTubeSession } from "./use-room-youtube-session";
import { useScreenShareState } from "./use-screen-share-state";
import { useScreenWakeLock } from "./use-screen-wake-lock";

interface Props {
  roomId: string;
  token: string;
  livekitUrl: string;
  userId: string;
}

export function RoomView({ roomId, token, livekitUrl, userId }: Props) {
  const router = useRouter();
  const [hasEnteredRoom, setHasEnteredRoom] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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
            // Release the physical mic when muted so the browser/device indicator turns off.
            // Revert this if faster mic unmute or Bluetooth audio profile stability matters more.
            stopMicTrackOnMute: true,
          },
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        }}
        onConnected={() => {
          setJoinError(null);
          setHasEnteredRoom(true);
        }}
        onError={(error) => {
          setJoinError(error.message || "Unable to join this room.");
        }}
        onDisconnected={() => router.push("/")}
        style={{ display: "contents" }}
      >
        <RoomChrome
          roomId={roomId}
          userId={userId}
          hasEnteredRoom={hasEnteredRoom}
          joinError={joinError}
        />
      </LiveKitRoom>
    </div>
  );
}

function RoomChrome({
  roomId,
  userId,
  hasEnteredRoom,
  joinError,
}: {
  roomId: string;
  userId: string;
  hasEnteredRoom: boolean;
  joinError: string | null;
}) {
  const connectionState = useConnectionState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("chat");
  const [participantsExpanded, setParticipantsExpanded] = useState(false);
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [screenShareMode, setScreenShareMode] = useLocalStorage<ScreenShareMode>(
    "ctt_screenShareMode",
    "standard"
  );
  const [screenQuality, setScreenQuality] = useLocalStorage<ScreenQuality>("ctt_screenQuality", "720p");
  const [screenFps, setScreenFps] = useLocalStorage<ScreenFPS>("ctt_screenFps", 30);
  const [bufferTime, setBufferTime] = useLocalStorage<BufferTime>("ctt_bufferTime", 0);
  const { screenShare, startScreenShare, stopScreenShare } = useScreenShareState({
    screenShareMode,
    screenQuality,
    screenFps,
  });
  const roomStage = useRoomStageState({
    enabled: hasEnteredRoom,
    roomId,
    screenShare,
    startScreenShare,
    stopScreenShare,
    userId,
  });
  const youtube = useRoomYouTubeSession({
    enabled: hasEnteredRoom,
    screenShareActive: roomStage.owner === "screenShare",
    userId,
  });
  const chat = useChat();
  const router = useRouter();
  const screenWakeLock = useScreenWakeLock(hasEnteredRoom);
  const roomApps = useRoomAppsState();
  const directMessages = useDirectMessageState({
    enabled: hasEnteredRoom,
    userId,
  });
  const chatIsActive = sidebarOpen && sidebarTab === "chat";
  const unreadChatCount = chatIsActive
    ? 0
    : Math.max(0, chat.chatMessages.length - seenChatCount);

  const markChatSeen = () => {
    setSeenChatCount(chat.chatMessages.length);
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

  const openDirectMessageFromParticipant = useCallback(
    async (participantId: string) => {
      if (participantId === userId) return;

      setSidebarTab("social");
      setSidebarOpen(true);
      await directMessages.openConversationWithUser(participantId);
    },
    [directMessages, userId]
  );

  if (!hasEnteredRoom) {
    return (
      <>
        <RoomAudioRenderer />
        <JoiningRoomStage
          connectionState={connectionState}
          error={joinError}
          onLeave={() => router.push("/")}
        />
      </>
    );
  }

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
        <RoomStage
          bufferTime={bufferTime}
          owner={roomStage.owner}
          youtube={{
            isHost: youtube.isHost,
            session: youtube.session,
            onEnd: youtube.end,
            onPlaybackChange: youtube.updatePlayback,
          }}
        />
        <ParticipantPanel
          expanded={participantsExpanded}
          onMessageParticipant={openDirectMessageFromParticipant}
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

      <RoomSidebar
        activeTab={sidebarTab}
        appsContent={
          <AppsTab
            activeApp={roomApps.activeApp}
            bufferTime={bufferTime}
            screenShare={screenShare}
            screenFps={screenFps}
            screenQuality={screenQuality}
            screenShareMode={screenShareMode}
            goAppsHome={roomApps.goAppsHome}
            onToggleScreenShare={roomStage.toggleScreenShare}
            stageError={roomStage.error}
            stageOccupied={
              (roomStage.owner !== "idle" && !screenShare.iAmSharing) ||
              youtube.isActive
            }
            stageReady={!roomStage.isLoading && !!roomStage.stage}
            stageTransitioning={roomStage.isTransitioning}
            openApp={roomApps.openApp}
            youtubeDisabledReason={
              roomStage.owner === "screenShare"
                ? "Screen Share is currently using the stage."
                : youtube.session
                  ? youtube.isHost
                    ? "You are already hosting YouTube."
                    : "Someone is already hosting YouTube."
                  : null
            }
            youtubeError={youtube.error}
            youtubeIsHost={youtube.isHost}
            youtubeIsStarting={youtube.isStarting}
            youtubeSession={youtube.session}
            onEndYouTube={youtube.end}
            onStartYouTube={youtube.start}
            setBufferTime={setBufferTime}
            setScreenFps={setScreenFps}
            setScreenQuality={setScreenQuality}
            setScreenShareMode={setScreenShareMode}
          />
        }
        chatContent={
          <ChatTab
            chatMessages={chat.chatMessages}
            isSending={chat.isSending}
            localIdentity={userId}
            send={chat.send}
          />
        }
        onClose={closeSidebar}
        onOpenTab={openSidebarTo}
        open={sidebarOpen}
        settingsContent={
          <SettingsTab
            wakeLockStatus={screenWakeLock.status}
            wakeLockError={screenWakeLock.error}
            wakeLockEnabled={screenWakeLock.isEnabled}
            onToggleWakeLock={screenWakeLock.toggle}
          />
        }
        socialContent={
          <SocialTab
            directMessages={directMessages}
            localUserId={userId}
          />
        }
        unreadSocialCount={directMessages.unreadTotal}
      />
    </>
  );
}

function JoiningRoomStage({
  connectionState,
  error,
  onLeave,
}: {
  connectionState: ConnectionState;
  error: string | null;
  onLeave: () => void;
}) {
  const statusText = error
    ? "Could not join room"
    : connectionState === ConnectionState.Reconnecting ||
      connectionState === ConnectionState.SignalReconnecting
      ? "Reconnecting"
      : "Joining room";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-16 shrink-0 items-center justify-end bg-card px-4 shadow-sm">
        <button
          onClick={onLeave}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-destructive shadow-sm transition-all hover:bg-destructive hover:text-primary-foreground"
          aria-label="Leave room"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center bg-sidebar px-6 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/10" />
          <span className="absolute inset-2 rounded-full bg-primary/10" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-sm">
            <LoaderCircle
              className={`h-6 w-6 text-primary ${error ? "" : "animate-spin"}`}
            />
          </div>
        </div>

        <p className="mt-5 text-sm font-semibold text-foreground">
          {statusText}
        </p>
        <p className="mt-1 max-w-60 text-xs leading-relaxed text-muted-foreground">
          {error ?? "Setting up voice, chat, and everyone already here."}
        </p>
      </div>
    </div>
  );
}
