"use client";

import { AppLauncher } from "./apps/app-launcher";
import { getRoomApp } from "./apps/app-registry";
import { AppsWorkspaceHeader } from "./apps/apps-workspace-header";
import { PreviewApp } from "./apps/preview-app";
import { ScreenShareApp } from "./apps/screen-share-app";
import type { ScreenShareAppSettings } from "./apps/room-app-types";
import type { RoomAppId, ScreenShareState } from "./room-types";

interface AppsTabProps extends ScreenShareAppSettings {
  activeApp: RoomAppId | null;
  lastActiveApp: RoomAppId | null;
  screenShare: ScreenShareState;
  goAppsHome: () => void;
  onToggleScreenShare: () => void | Promise<void>;
  openApp: (appId: RoomAppId) => void;
}

export function AppsTab({
  activeApp,
  lastActiveApp,
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
  const lastApp = getRoomApp(lastActiveApp);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <AppsWorkspaceHeader
        activeApp={selectedApp}
        lastApp={lastApp}
        onGoHome={goAppsHome}
        onOpenApp={openApp}
      />

      {selectedApp?.id === "screenShare" ? (
        <ScreenShareApp
          bufferTime={bufferTime}
          screenShare={screenShare}
          screenFps={screenFps}
          screenQuality={screenQuality}
          screenShareMode={screenShareMode}
          onToggleScreenShare={onToggleScreenShare}
          setBufferTime={setBufferTime}
          setScreenFps={setScreenFps}
          setScreenQuality={setScreenQuality}
          setScreenShareMode={setScreenShareMode}
        />
      ) : selectedApp ? (
        <PreviewApp app={selectedApp} />
      ) : (
        <AppLauncher screenShare={screenShare} onOpenApp={openApp} />
      )}
    </div>
  );
}
