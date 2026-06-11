import type {
  YouTubeActivitySession,
  YouTubePlaybackCommand,
  YouTubePlaybackStatus,
} from "../room-types";
import { YouTubeHostPlayer } from "./youtube-host-player";
import { YouTubeViewerPlayer } from "./youtube-viewer-player";

interface YouTubeActivityStageProps {
  isHost: boolean;
  onEnd: () => void | Promise<void>;
  onHostPlaybackChange: (
    command: YouTubePlaybackCommand,
    playbackStatus: YouTubePlaybackStatus,
    positionSeconds: number
  ) => Promise<boolean>;
  session: YouTubeActivitySession;
}

export function YouTubeActivityStage({
  isHost,
  onEnd,
  onHostPlaybackChange,
  session,
}: YouTubeActivityStageProps) {
  const statusLabel = getStatusLabel({ isHost, session });

  if (isHost) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-sidebar md:p-4">
        <div className="relative w-full max-w-6xl">
          <YouTubeStatusBadge label={statusLabel} />
          <YouTubeHostPlayer
            session={session}
            onEnd={onEnd}
            onPlaybackChange={onHostPlaybackChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-sidebar md:p-4">
      <div className="relative w-full max-w-6xl">
        <YouTubeStatusBadge label={statusLabel} />
        <YouTubeViewerPlayer session={session} />
      </div>
    </div>
  );
}

function getStatusLabel({
  isHost,
  session,
}: {
  isHost: boolean;
  session: YouTubeActivitySession;
}) {
  if (session.playbackStatus === "buffering") return "Waiting";
  if (isHost) return "You host";
  return "Watching";
}

function YouTubeStatusBadge({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-lg bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm md:left-3 md:top-3">
      {label}
    </div>
  );
}
