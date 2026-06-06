"use client";

import { AppLauncher } from "./apps/app-launcher";
import { getRoomApp } from "./apps/app-registry";
import { AppsWorkspaceHeader } from "./apps/apps-workspace-header";
import type {
  RoomAppRenderContext,
  ScreenShareAppSettings,
} from "./apps/room-app-types";
import type {
  RoomAppId,
  ScreenShareState,
  YouTubeActivitySession,
} from "./room-types";

interface AppsTabProps extends ScreenShareAppSettings {
  activeApp: RoomAppId | null;
  screenShare: ScreenShareState;
  stageError: string | null;
  stageOccupied: boolean;
  stageReady: boolean;
  stageTransitioning: boolean;
  goAppsHome: () => void;
  onToggleScreenShare: () => void | Promise<void>;
  openApp: (appId: RoomAppId) => void;
  youtubeDisabledReason: string | null;
  youtubeError: string | null;
  youtubeIsHost: boolean;
  youtubeIsRecovering: boolean;
  youtubeIsStarting: boolean;
  youtubeSession: YouTubeActivitySession | null;
  onEndYouTube: () => void | Promise<void>;
  onStartYouTube: (input: string) => Promise<"failed" | "invalid" | "occupied" | "started">;
}

export function AppsTab({
  activeApp,
  bufferTime,
  screenShare,
  screenFps,
  screenQuality,
  screenShareMode,
  stageError,
  stageOccupied,
  stageReady,
  stageTransitioning,
  goAppsHome,
  onToggleScreenShare,
  openApp,
  youtubeDisabledReason,
  youtubeError,
  youtubeIsHost,
  youtubeIsRecovering,
  youtubeIsStarting,
  youtubeSession,
  onEndYouTube,
  onStartYouTube,
  setBufferTime,
  setScreenFps,
  setScreenQuality,
  setScreenShareMode,
}: AppsTabProps) {
  const selectedApp = getRoomApp(activeApp);
  const appContext: Omit<RoomAppRenderContext, "app"> = {
    screenShareApp: {
      bufferTime,
      screenShare,
      screenFps,
      screenQuality,
      screenShareMode,
      stageError,
      stageOccupied,
      stageReady,
      stageTransitioning,
      onToggleScreenShare,
      setBufferTime,
      setScreenFps,
      setScreenQuality,
      setScreenShareMode,
    },
    youtubeApp: {
      disabled: !!youtubeDisabledReason || youtubeIsRecovering,
      disabledReason: youtubeIsRecovering
        ? "Checking whether YouTube is already active."
        : youtubeDisabledReason,
      error: youtubeError,
      isHost: youtubeIsHost,
      isRecovering: youtubeIsRecovering,
      isStarting: youtubeIsStarting,
      session: youtubeSession,
      onEnd: onEndYouTube,
      onStart: onStartYouTube,
    },
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <AppsWorkspaceHeader
        activeApp={selectedApp}
        onGoHome={goAppsHome}
      />

      {selectedApp ? (
        selectedApp.render({ ...appContext, app: selectedApp })
      ) : (
        <AppLauncher appContext={appContext} onOpenApp={openApp} />
      )}
    </div>
  );
}
