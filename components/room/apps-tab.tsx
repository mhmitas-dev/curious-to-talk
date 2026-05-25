"use client";

import { useEffect } from "react";
import { useLocalParticipant, useTracks } from "@livekit/components-react";
import { AudioPresets, ScreenSharePresets, Track } from "livekit-client";
import { MonitorOff, MonitorUp } from "lucide-react";
import type { ScreenFPS, ScreenQuality } from "./room-types";

interface AppsTabProps {
  screenQuality: ScreenQuality;
  screenFps: ScreenFPS;
}

export function AppsTab({ screenQuality, screenFps }: AppsTabProps) {
  const { localParticipant } = useLocalParticipant();
  const screenShareTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const iAmSharing = localParticipant.isScreenShareEnabled;
  const activeSharingParticipant = screenShareTracks[0]?.participant;
  const someoneElseIsSharing = !!activeSharingParticipant && !iAmSharing;
  const sharerName =
    activeSharingParticipant?.name ?? activeSharingParticipant?.identity ?? "Someone";

  useEffect(() => {
    if (!iAmSharing) return;
    const timer = setTimeout(() => {
      const pub = localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
      const mst = (pub?.track as { mediaStreamTrack?: MediaStreamTrack } | undefined)
        ?.mediaStreamTrack;
      if (mst && "contentHint" in mst) {
        mst.contentHint = "music";
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [iAmSharing, localParticipant]);

  const toggleScreenShare = async () => {
    if (someoneElseIsSharing) return;
    try {
      const preset =
        screenQuality === "1080p"
          ? screenFps === 30
            ? ScreenSharePresets.h1080fps30
            : ScreenSharePresets.h1080fps15
          : screenFps === 30
          ? ScreenSharePresets.h720fps30
          : ScreenSharePresets.h720fps15;
      await localParticipant.setScreenShareEnabled(!iAmSharing, {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
        },
        resolution: preset,
      }, { audioPreset: AudioPresets.musicHighQualityStereo, forceStereo: true });
    } catch (e) {
      console.error("Failed to toggle screen share", e);
    }
  };

  return (
    <div className="flex h-full flex-col p-4 gap-4">
      <h3 className="text-sm font-semibold text-muted-foreground px-2 uppercase tracking-wider">
        Applications
      </h3>

      <button
        onClick={toggleScreenShare}
        disabled={someoneElseIsSharing}
        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
          iAmSharing
            ? "bg-primary/10 border-primary/30 text-primary"
            : someoneElseIsSharing
            ? "bg-card/50 border-border text-muted-foreground opacity-50 cursor-not-allowed"
            : "bg-card border-border hover:bg-accent/50 text-foreground"
        }`}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${
            iAmSharing ? "bg-primary text-primary-foreground" : "bg-accent"
          }`}
        >
          {iAmSharing ? <MonitorOff className="h-6 w-6" /> : <MonitorUp className="h-6 w-6" />}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">
            {iAmSharing
              ? "Stop Sharing"
              : someoneElseIsSharing
              ? "Screen Sharing"
              : "Share Screen"}
          </span>
          <span className="text-xs opacity-70">
            {iAmSharing
              ? "You are presenting"
              : someoneElseIsSharing
              ? `${sharerName} is presenting`
              : "Share a window or your entire screen"}
          </span>
        </div>
      </button>

      <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/50 opacity-50 grayscale cursor-not-allowed">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
          <span className="text-xl">🚀</span>
        </div>
        <div className="flex flex-col items-start text-left">
          <span className="font-medium">More Apps</span>
          <span className="text-xs">Coming soon</span>
        </div>
      </div>
    </div>
  );
}
