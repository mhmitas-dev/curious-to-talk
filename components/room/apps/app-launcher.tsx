"use client";

import { ROOM_APPS } from "./app-registry";
import type { RoomAppId } from "../room-types";
import type { RoomAppModule, RoomAppRenderContext } from "./room-app-types";

/** Flat icon background colour per app (active vs. idle). */
const APP_ICON_COLOR: Record<string, { idle: string; active: string; icon: string }> = {
  screenShare: {
    idle:   "bg-primary/10",
    active: "bg-primary",
    icon:   "text-primary",
  },
  youtube: {
    idle:   "bg-red-500/10",
    active: "bg-red-500",
    icon:   "text-red-400",
  },
  spotify: {
    idle:   "bg-emerald-500/10",
    active: "bg-emerald-500",
    icon:   "text-emerald-400",
  },
};

interface AppLauncherProps {
  appContext: Omit<RoomAppRenderContext, "app">;
  onOpenApp: (appId: RoomAppId) => void;
}

export function AppLauncher({ appContext, onOpenApp }: AppLauncherProps) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-2">
      {ROOM_APPS.map((app) => (
        <AppLauncherButton
          key={app.id}
          app={app}
          appContext={appContext}
          onOpen={() => onOpenApp(app.id)}
        />
      ))}
    </div>
  );
}

function AppLauncherButton({
  app,
  appContext,
  onOpen,
}: {
  app: RoomAppModule;
  appContext: Omit<RoomAppRenderContext, "app">;
  onOpen: () => void;
}) {
  const isActive = app.isActive?.({ ...appContext, app }) ?? false;
  const Icon = app.Icon;
  const colors = APP_ICON_COLOR[app.id];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors duration-150
        hover:bg-accent
        active:bg-accent
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={app.label}
    >
      {/* Live dot */}
      {isActive && (
        <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-primary" />
      )}

      {/* Icon tile */}
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-150 ${
          isActive
            ? (colors?.active ?? "bg-primary")
            : (colors?.idle ?? "bg-card")
        }`}
      >
        <Icon
          className={`h-5 w-5 ${
            isActive
              ? "text-white"
              : (colors?.icon ?? "text-foreground/70")
          }`}
        />
      </span>

      {/* Label */}
      <span className="line-clamp-1 text-[11px] font-medium leading-tight text-muted-foreground group-hover:text-foreground transition-colors duration-150">
        {app.label}
      </span>
    </button>
  );
}
