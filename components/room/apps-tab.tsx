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
  YouTubeSessionSnapshot,
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
  youtubeIsStarting: boolean;
  youtubeSession: YouTubeSessionSnapshot | null;
  onEndYouTube: () => void | Promise<void>;
  onStartYouTube: (input: string) => Promise<"invalid" | "occupied" | "started" | "failed">;
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
      disabled: !!youtubeDisabledReason,
      disabledReason: youtubeDisabledReason,
      error: youtubeError,
      isHost: youtubeIsHost,
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
