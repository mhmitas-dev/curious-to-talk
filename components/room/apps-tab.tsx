"use client";

import { useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { MonitorPlay } from "lucide-react";

export function AppsTab() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/50 mb-4">
        <MonitorPlay className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold mb-1">Watch Party</h3>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        Share YouTube videos and watch them together. Coming soon!
      </p>
    </div>
  );
}
