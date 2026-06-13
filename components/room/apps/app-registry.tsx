"use client";

import { FaSpotify, FaYoutube } from "react-icons/fa";
import { MdScreenShare } from "react-icons/md";
import type { RoomAppId } from "../room-types";
import { PreviewApp } from "./preview-app";
import type { RoomAppModule } from "./room-app-types";
import { ScreenShareApp } from "./screen-share-app";
import { YouTubeApp } from "./youtube-app";

export const ROOM_APPS: RoomAppModule[] = [
  {
    id: "screenShare",
    label: "Screen Share",
    description: "Present a window, tab, or document.",
    Icon: MdScreenShare,
    isActive: ({ screenShareApp }) => screenShareApp.screenShare.iAmSharing,
    render: ({ screenShareApp }) => <ScreenShareApp {...screenShareApp} />,
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "Watch together.",
    Icon: FaYoutube,
    keepAlive: true,
    isActive: ({ youtubeApp }) => !!youtubeApp.activity,
    render: ({ youtubeApp }) => <YouTubeApp {...youtubeApp} />,
  },
  {
    id: "spotify",
    label: "Spotify",
    description: "Music controls later.",
    Icon: FaSpotify,
    render: ({ app }) => <PreviewApp app={app} />,
  },
];

export function getRoomApp(appId: RoomAppId | null) {
  if (!appId) return null;
  return ROOM_APPS.find((app) => app.id === appId) ?? null;
}
