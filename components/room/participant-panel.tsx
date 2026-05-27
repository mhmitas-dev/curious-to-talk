"use client";

import { useState } from "react";
import { useIsSpeaking, useLocalParticipant, useParticipants } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import {
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  MessageCircle,
  MicOff,
  Monitor,
  X,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ParticipantPanelProps {
  expanded: boolean;
  onMessageParticipant: (participantId: string) => Promise<void>;
  onToggle: () => void;
}

interface ParticipantProfile {
  avatarUrl: string;
  displayName: string;
  id: string;
  isLocal: boolean;
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function getParticipantAvatarUrl(participant: Participant) {
  let avatarUrl = `https://api.dicebear.com/9.x/micah/svg?seed=${encodeURIComponent(participant.identity)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  if (participant.metadata) {
    try {
      const meta = JSON.parse(participant.metadata);
      if (meta.avatar_url) avatarUrl = meta.avatar_url;
    } catch (error) {
      console.error("Failed to parse participant metadata", error);
    }
  }

  return avatarUrl;
}

function getParticipantProfile(
  participant: Participant,
  localIdentity: string
): ParticipantProfile {
  const isLocal = participant.identity === localIdentity;

  return {
    avatarUrl: getParticipantAvatarUrl(participant),
    displayName: isLocal ? "You" : (participant.name ?? participant.identity),
    id: participant.identity,
    isLocal,
  };
}

export function ParticipantPanel({
  expanded,
  onMessageParticipant,
  onToggle,
}: ParticipantPanelProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [selectedProfile, setSelectedProfile] = useState<ParticipantProfile | null>(null);

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
              onOpenProfile={() =>
                setSelectedProfile(
                  getParticipantProfile(participant, localParticipant.identity)
                )
              }
            />
          ))}
        </div>
      </div>

      {selectedProfile && (
        <ParticipantProfileDialog
          profile={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onMessage={onMessageParticipant}
        />
      )}
    </div>
  );
}

function ParticipantTile({
  participant,
  isLocal,
  onOpenProfile,
}: {
  participant: Participant;
  isLocal: boolean;
  onOpenProfile: () => void;
}) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  const isScreenShareEnabled = participant.isScreenShareEnabled;
  const avatarUrl = getParticipantAvatarUrl(participant);
  const displayName = isLocal ? "You" : (participant.name ?? participant.identity);

  return (
    <button
      type="button"
      onClick={onOpenProfile}
      className="flex min-w-0 flex-col items-center gap-1 rounded-lg outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-ring md:w-20"
      aria-label={`Open ${displayName} profile`}
    >
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
            alt={displayName}
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
        {displayName}
      </span>
    </button>
  );
}

function ParticipantProfileDialog({
  profile,
  onClose,
  onMessage,
}: {
  profile: ParticipantProfile;
  onClose: () => void;
  onMessage: (participantId: string) => Promise<void>;
}) {
  const [isMessaging, setIsMessaging] = useState(false);

  const handleMessage = async () => {
    if (profile.isLocal || isMessaging) return;

    setIsMessaging(true);
    try {
      await onMessage(profile.id);
      onClose();
    } finally {
      setIsMessaging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-background md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.displayName} profile`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Close participant profile"
      />

      <div className="relative w-full rounded-t-2xl border-t border-border bg-sidebar px-5 pb-6 pt-3 shadow-2xl md:w-[320px] md:rounded-2xl md:border md:p-5">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border md:hidden" />

        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close profile"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 bg-muted shadow-sm">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback className="text-lg font-semibold">
              {getInitials(profile.displayName)}
            </AvatarFallback>
          </Avatar>

          <h3 className="mt-4 max-w-full truncate text-base font-semibold text-foreground">
            {profile.displayName}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {profile.isLocal ? "This is you" : "In this room now"}
          </p>

          {!profile.isLocal && (
            <Button
              type="button"
              onClick={() => void handleMessage()}
              disabled={isMessaging}
              className="mt-5 w-full"
            >
              {isMessaging ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Message
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
