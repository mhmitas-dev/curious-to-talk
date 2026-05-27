"use client";

import { useCallback, useReducer } from "react";
import type { RoomAppId, RoomAppSession } from "./room-types";

type RoomAppSessions = Partial<Record<RoomAppId, RoomAppSession>>;

interface RoomAppsState {
  activeApp: RoomAppId | null;
  lastActiveApp: RoomAppId | null;
  sessions: RoomAppSessions;
}

type RoomAppsAction =
  | { type: "open"; appId: RoomAppId }
  | { type: "home" }
  | { type: "close"; appId: RoomAppId };

const initialRoomAppsState: RoomAppsState = {
  activeApp: null,
  lastActiveApp: null,
  sessions: {},
};

function getMostRecentApp(sessions: RoomAppSessions) {
  return Object.values(sessions)
    .filter((session): session is RoomAppSession => Boolean(session))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
}

function roomAppsReducer(
  state: RoomAppsState,
  action: RoomAppsAction
): RoomAppsState {
  if (action.type === "home") {
    return {
      ...state,
      activeApp: null,
    };
  }

  if (action.type === "open") {
    const existingSession = state.sessions[action.appId];
    const session: RoomAppSession = {
      id: action.appId,
      view: existingSession?.view ?? "main",
      updatedAt: Date.now(),
    };

    return {
      activeApp: action.appId,
      lastActiveApp: action.appId,
      sessions: {
        ...state.sessions,
        [action.appId]: session,
      },
    };
  }

  const sessions = { ...state.sessions };
  delete sessions[action.appId];

  return {
    activeApp: state.activeApp === action.appId ? null : state.activeApp,
    lastActiveApp:
      state.lastActiveApp === action.appId
        ? getMostRecentApp(sessions)
        : state.lastActiveApp,
    sessions,
  };
}

export function useRoomAppsState() {
  const [state, dispatch] = useReducer(
    roomAppsReducer,
    initialRoomAppsState
  );

  const openApp = useCallback((appId: RoomAppId) => {
    dispatch({ type: "open", appId });
  }, []);

  const goAppsHome = useCallback(() => {
    dispatch({ type: "home" });
  }, []);

  const closeApp = useCallback((appId: RoomAppId) => {
    dispatch({ type: "close", appId });
  }, []);

  return {
    ...state,
    openApp,
    goAppsHome,
    closeApp,
  };
}
