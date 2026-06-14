"use client";

import { useParticipants } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import type {
  YouTubeActivitySession,
  YouTubePlaybackCommand,
  YouTubePlaybackStatus,
} from "../room-types";
import { StageMediaFrame } from "./stage-media-frame";
import { YouTubeHostPlayer } from "./youtube-host-player";
import { YouTubeViewerPlayer } from "./youtube-viewer-player";

interface YouTubeActivityStageProps {
  isHost: boolean;
  onEnd: (expectedSessionId?: string) => void | Promise<void>;
  onHostPlaybackChange: (
    sourceSessionId: string,
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
  const participants = useParticipants();
  const hostParticipant = participants.find(
    (participant) => participant.identity === session.hostIdentity
  );
  const hostName = getHostDisplayName(hostParticipant, session.hostIdentity);
  const statusLabel = getStatusLabel({ hostName, isHost, session });

  if (isHost) {
    return (
      <StageMediaFrame badge={<YouTubeStatusBadge label={statusLabel} />}>
        <YouTubeHostPlayer
          key={session.sessionId}
          session={session}
          onEnd={onEnd}
          onPlaybackChange={onHostPlaybackChange}
        />
      </StageMediaFrame>
    );
  }

  return (
    <StageMediaFrame badge={<YouTubeStatusBadge label={statusLabel} />}>
      <YouTubeViewerPlayer key={session.sessionId} session={session} />
    </StageMediaFrame>
  );
}

function getStatusLabel({
  hostName,
  isHost,
  session,
}: {
  hostName: string;
  isHost: boolean;
  session: YouTubeActivitySession;
}) {
  if (session.playbackStatus === "buffering") {
    return isHost ? "You host" : `Waiting for ${hostName}`;
  }
  if (isHost) return "You host";
  return `${hostName} is hosting`;
}

function getHostDisplayName(
  participant: Participant | undefined,
  fallbackIdentity: string
) {
  const displayName = participant?.name?.trim();
  if (displayName) return displayName;

  return fallbackIdentity;
}

function YouTubeStatusBadge({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-lg bg-black/50 px-2.5 py-1 text-xs font-medium text-white shadow-sm md:left-3 md:top-3 md:max-w-[min(22rem,calc(100%-1.5rem))]">
      {label}
    </div>
  );
}
