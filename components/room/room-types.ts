export interface Room {
  id: string;
  name: string;
  description: string | null;
}

export type SidebarTab = "apps" | "chat" | "social" | "settings";
export type ScreenQuality = "720p" | "1080p";
export type ScreenFPS = 15 | 30;
export type BufferTime = 0 | 1 | 3 | 5;
