import type { IconType } from "react-icons";
import type { ReactNode } from "react";
import type {
  BufferTime,
  RoomAppId,
  ScreenFPS,
  ScreenQuality,
  ScreenShareMode,
  ScreenShareState,
  YouTubeActivitySession,
} from "../room-types";

export interface RoomAppMeta {
  id: RoomAppId;
  label: string;
  description: string;
  Icon: IconType;
}

export interface ScreenShareAppSettings {
  bufferTime: BufferTime;
  screenFps: ScreenFPS;
  screenQuality: ScreenQuality;
  screenShareMode: ScreenShareMode;
  setBufferTime: (bufferTime: BufferTime) => void;
  setScreenFps: (screenFps: ScreenFPS) => void;
  setScreenQuality: (screenQuality: ScreenQuality) => void;
  setScreenShareMode: (screenShareMode: ScreenShareMode) => void;
}

export interface ScreenShareAppState extends ScreenShareAppSettings {
  screenShare: ScreenShareState;
  stageError: string | null;
  stageOccupied: boolean;
  stageReady: boolean;
  stageTransitioning: boolean;
  onToggleScreenShare: () => void | Promise<void>;
}

export interface YouTubeAppState {
  disabled: boolean;
  disabledReason: string | null;
  error: string | null;
  isHost: boolean;
  isRecovering: boolean;
  isStarting: boolean;
  session: YouTubeActivitySession | null;
  onEnd: () => void | Promise<void>;
  onStart: (input: string) => Promise<"failed" | "invalid" | "occupied" | "started">;
}

export interface RoomAppModule extends RoomAppMeta {
  isActive?: (context: RoomAppRenderContext) => boolean;
  render: (context: RoomAppRenderContext) => ReactNode;
}

export interface RoomAppRenderContext {
  app: RoomAppModule;
  screenShareApp: ScreenShareAppState;
  youtubeApp: YouTubeAppState;
}
