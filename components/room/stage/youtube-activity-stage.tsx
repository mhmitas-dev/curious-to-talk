import type {
  YouTubeActivitySession,
  YouTubePlaybackStatus,
} from "../room-types";
import { YouTubeHostPlayer } from "./youtube-host-player";
import { YouTubeViewerPlayer } from "./youtube-viewer-player";

interface YouTubeActivityStageProps {
  isHost: boolean;
  onEnd: () => void | Promise<void>;
  onHostPlaybackChange: (
    command: "pause" | "play" | "seek",
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
  if (isHost) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-sidebar md:p-4">
        <div className="w-full max-w-6xl">
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
      <div className="w-full max-w-6xl">
        <YouTubeViewerPlayer session={session} />
      </div>
    </div>
  );
}
