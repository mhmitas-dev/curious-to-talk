"use client";

import { ChevronLeft } from "lucide-react";
import type { RoomAppId } from "../room-types";
import type { RoomAppMeta } from "./room-app-types";

interface AppsWorkspaceHeaderProps {
  activeApp: RoomAppMeta | null;
  lastApp: RoomAppMeta | null;
  onGoHome: () => void;
  onOpenApp: (appId: RoomAppId) => void;
}

export function AppsWorkspaceHeader({
  activeApp,
  lastApp,
  onGoHome,
  onOpenApp,
}: AppsWorkspaceHeaderProps) {
  const ActiveAppIcon = activeApp?.Icon;
  const LastAppIcon = !activeApp ? lastApp?.Icon : null;

  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2 px-2">
        {activeApp && (
          <button
            type="button"
            onClick={onGoHome}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Back to applications"
            title="Back to applications"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <h3 className="truncate text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Applications
        </h3>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {LastAppIcon && lastApp && (
          <button
            type="button"
            onClick={() => onOpenApp(lastApp.id)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-card text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Return to ${lastApp.label}`}
            title={lastApp.label}
          >
            <LastAppIcon className="h-4 w-4" />
          </button>
        )}
        {ActiveAppIcon && activeApp && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-card text-foreground shadow-sm"
            aria-label={activeApp.label}
            title={activeApp.label}
          >
            <ActiveAppIcon className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
