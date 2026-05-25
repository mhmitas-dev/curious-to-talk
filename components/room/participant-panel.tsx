"use client";

import { useIsSpeaking, useLocalParticipant, useParticipants } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { ChevronDown, ChevronUp, MicOff, Monitor } from "lucide-react";

interface ParticipantPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

export function ParticipantPanel({ expanded, onToggle }: ParticipantPanelProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  if (participants.length === 0) return null;

  const COLLAPSED_MAX_H = 218;

  return (
    <div className="shrink-0 bg-card shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-center gap-2 py-2 text-muted-foreground hover:text-foreground transition-colors group"
        aria-label={expanded ? "Collapse participants" : "Expand participants"}
      >
        <span className="h-px w-8 rounded-full bg-border group-hover:bg-foreground/30 transition-colors" />
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
        <span className="h-px w-8 rounded-full bg-border group-hover:bg-foreground/30 transition-colors" />
      </button>

      <div
        className="overflow-y-auto transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "50vh" : `${COLLAPSED_MAX_H}px` }}
      >
        <div className="grid grid-cols-4 gap-2 px-3 pb-4 sm:grid-cols-5 md:flex md:flex-wrap md:justify-center md:gap-x-4 md:gap-y-3 md:px-6 lg:gap-x-5">
          {participants.map((participant) => (
            <ParticipantTile
              key={participant.identity}
              participant={participant}
              isLocal={participant.identity === localParticipant.identity}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ParticipantTile({
  participant,
  isLocal,
}: {
  participant: Participant;
  isLocal: boolean;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  const isScreenShareEnabled = participant.isScreenShareEnabled;

  let avatarUrl = `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(participant.identity)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      if (meta.avatar_url) avatarUrl = meta.avatar_url;
    } catch (e) {
      console.error("Failed to parse participant metadata", e);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-0 md:w-20">
      <div className="relative">
        <div
          className={`rounded-full transition-all duration-200 ${
            isSpeaking
              ? "bg-primary p-[2px] shadow-md"
              : "p-[2px]"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Preserve current remote avatar rendering until the avatar UI pass. */}
          <img
            src={avatarUrl}
            alt={participant.name ?? participant.identity}
            className="h-14 w-14 rounded-full object-cover bg-card block"
          />
        </div>

        {isMuted && (
          <div className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card border border-border shadow-sm">
            <MicOff className="h-[9px] w-[9px] text-destructive" />
          </div>
        )}

        {isScreenShareEnabled && (
          <div className="absolute -top-0.5 -left-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary border border-card shadow-sm text-primary-foreground">
            <Monitor className="h-[9px] w-[9px]" />
          </div>
        )}
      </div>

      <span className="w-full truncate text-center text-[10px] font-medium leading-tight text-muted-foreground">
        {isLocal ? "You" : (participant.name ?? participant.identity)}
      </span>
    </div>
  );
}
