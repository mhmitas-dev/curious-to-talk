"use client";

import { AppLauncher } from "./apps/app-launcher";
import { getRoomApp } from "./apps/app-registry";
import { AppsWorkspaceHeader } from "./apps/apps-workspace-header";
import type {
  RoomAppRenderContext,
  ScreenShareAppSettings,
} from "./apps/room-app-types";
import type { RoomAppId, ScreenShareState } from "./room-types";

interface AppsTabProps extends ScreenShareAppSettings {
  activeApp: RoomAppId | null;
  screenShare: ScreenShareState;
  goAppsHome: () => void;
  onToggleScreenShare: () => void | Promise<void>;
  openApp: (appId: RoomAppId) => void;
}

export function AppsTab({
  activeApp,
  bufferTime,
  screenShare,
  screenFps,
  screenQuality,
  screenShareMode,
  goAppsHome,
  onToggleScreenShare,
  openApp,
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
      onToggleScreenShare,
      setBufferTime,
      setScreenFps,
      setScreenQuality,
      setScreenShareMode,
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
