"use client";

import { ChevronLeft } from "lucide-react";
import type { RoomAppMeta } from "./room-app-types";

interface AppsWorkspaceHeaderProps {
  activeApp: RoomAppMeta | null;
  onGoHome: () => void;
}

export function AppsWorkspaceHeader({
  activeApp,
  onGoHome,
}: AppsWorkspaceHeaderProps) {
  const ActiveAppIcon = activeApp?.Icon;

  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2 px-2">
        <button
          type="button"
          onClick={onGoHome}
          disabled={!activeApp}
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
          aria-label="Back to applications"
          title={activeApp ? "Back to applications" : undefined}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="truncate text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Applications
        </h3>
      </div>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center">
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
