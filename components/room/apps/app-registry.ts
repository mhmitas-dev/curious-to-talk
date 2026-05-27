import { FaSpotify, FaYoutube } from "react-icons/fa";
import { MdScreenShare } from "react-icons/md";
import type { RoomAppId } from "../room-types";
import type { RoomAppMeta } from "./room-app-types";

export const ROOM_APPS: RoomAppMeta[] = [
  {
    id: "screenShare",
    label: "Screen Share",
    description: "Present a window, tab, or document.",
    Icon: MdScreenShare,
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "Watch together later.",
    Icon: FaYoutube,
  },
  {
    id: "spotify",
    label: "Spotify",
    description: "Music controls later.",
    Icon: FaSpotify,
  },
];

export function getRoomApp(appId: RoomAppId | null) {
  if (!appId) return null;
  return ROOM_APPS.find((app) => app.id === appId) ?? null;
}
