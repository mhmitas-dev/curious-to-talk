export interface Room {
  id: string;
  name: string;
  description: string | null;
}

export type SidebarTab = "apps" | "chat" | "social" | "settings";
export type RoomAppId = "screenShare" | "youtube" | "spotify";
export type RoomAppView = "main";
export type RoomStageOwner = "idle" | "screenShare";
export type ScreenShareMode = "standard" | "document";
export type ScreenQuality = "720p" | "1080p";
export type ScreenFPS = 15 | 30;
export type BufferTime = 0 | 1 | 3 | 5;
export type YouTubePlaybackStatus = "paused" | "playing";

export interface RoomAppSession {
  id: RoomAppId;
  view: RoomAppView;
  updatedAt: number;
}

export interface ScreenShareState {
  activeParticipantId: string | null;
  iAmSharing: boolean;
  someoneElseIsSharing: boolean;
  sharerName: string;
}

export interface YouTubeSessionSnapshot {
  hostIdentity: string;
  playbackStatus: YouTubePlaybackStatus;
  positionSeconds: number;
  revision: number;
  sessionId: string;
  updatedAt: number;
  videoId: string;
}
