"use client";

import { AppLauncher } from "./apps/app-launcher";
import { getRoomApp, ROOM_APPS } from "./apps/app-registry";
import { AppsWorkspaceHeader } from "./apps/apps-workspace-header";
import type {
  RoomAppRenderContext,
  ScreenShareAppSettings,
} from "./apps/room-app-types";
import type {
  RoomAppId,
  ScreenShareState,
  YouTubeActivitySession,
  YouTubeHandoffResult,
  YouTubePlayResult,
} from "./room-types";

interface AppsTabProps extends ScreenShareAppSettings {
  activeApp: RoomAppId | null;
  screenShare: ScreenShareState;
  stageError: string | null;
  stageOccupied: boolean;
  stageReady: boolean;
  stageTransitioning: boolean;
  visible: boolean;
  goAppsHome: () => void;
  onToggleScreenShare: () => void | Promise<void>;
  openApp: (appId: RoomAppId) => void;
  visitedAppIds: readonly RoomAppId[];
  youtubeDisabledReason: string | null;
  youtubeError: string | null;
  youtubeIsHost: boolean;
  youtubeIsRecovering: boolean;
  youtubeIsRequestingHandoff: boolean;
  youtubeIsReplacing: boolean;
  youtubeIsStarting: boolean;
  youtubeSession: YouTubeActivitySession | null;
  onEndYouTube: () => void | Promise<void>;
  onPlayYouTube: (input: string) => Promise<YouTubePlayResult>;
  onRequestYouTubeHandoff: (input: string) => Promise<YouTubeHandoffResult>;
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
  visible,
  goAppsHome,
  onToggleScreenShare,
  openApp,
  visitedAppIds,
  youtubeDisabledReason,
  youtubeError,
  youtubeIsHost,
  youtubeIsRecovering,
  youtubeIsRequestingHandoff,
  youtubeIsReplacing,
  youtubeIsStarting,
  youtubeSession,
  onEndYouTube,
  onPlayYouTube,
  onRequestYouTubeHandoff,
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
      isRequestingHandoff: youtubeIsRequestingHandoff,
      isReplacing: youtubeIsReplacing,
      isStarting: youtubeIsStarting,
      visible: visible && selectedApp?.id === "youtube",
      session: youtubeSession,
      onEnd: onEndYouTube,
      onPlay: onPlayYouTube,
      onRequestHandoff: onRequestYouTubeHandoff,
    },
  };
  const visitedKeepAliveApps = ROOM_APPS.filter(
    (app) => app.keepAlive && visitedAppIds.includes(app.id)
  );

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <AppsWorkspaceHeader
        activeApp={selectedApp}
        onGoHome={goAppsHome}
      />

      <div
        aria-hidden={!!selectedApp}
        className={selectedApp ? "hidden" : "flex h-full flex-col"}
      >
        <AppLauncher appContext={appContext} onOpenApp={openApp} />
      </div>

      {visitedKeepAliveApps.map((app) => (
        <div
          key={app.id}
          aria-hidden={selectedApp?.id !== app.id}
          className={
            selectedApp?.id === app.id
              ? "flex h-full flex-col"
              : "hidden"
          }
        >
          {app.render({ ...appContext, app })}
        </div>
      ))}

      {selectedApp && !selectedApp.keepAlive
        ? selectedApp.render({ ...appContext, app: selectedApp })
        : null}
    </div>
  );
}
