"use client";

import { ROOM_APPS } from "./app-registry";
import type { RoomAppId } from "../room-types";
import type { RoomAppModule, RoomAppRenderContext } from "./room-app-types";

interface AppLauncherProps {
  appContext: Omit<RoomAppRenderContext, "app">;
  onOpenApp: (appId: RoomAppId) => void;
}

export function AppLauncher({ appContext, onOpenApp }: AppLauncherProps) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 px-6 pb-4">
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

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex min-h-[88px] flex-col items-center justify-start rounded-xl px-1.5 py-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={app.label}
    >
      {isActive && (
        <span className="absolute right-4 top-1 h-2 w-2 rounded-full bg-primary" />
      )}
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-card text-foreground group-hover:bg-accent"
        }`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <span className="mt-2 line-clamp-2 text-xs font-medium leading-tight text-foreground">
        {app.label}
      </span>
    </button>
  );
}
