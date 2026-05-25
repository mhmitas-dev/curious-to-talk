"use client";

import { useEffect } from "react";
import { useLocalParticipant, useTracks } from "@livekit/components-react";
import { AudioPresets, ScreenSharePresets, Track } from "livekit-client";
import type { ScreenFPS, ScreenQuality, ScreenShareState } from "./room-types";

interface UseScreenShareStateInput {
  screenQuality: ScreenQuality;
  screenFps: ScreenFPS;
}

export function useScreenShareState({
  screenQuality,
  screenFps,
}: UseScreenShareStateInput) {
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

  const screenShare: ScreenShareState = {
    iAmSharing,
    someoneElseIsSharing,
    sharerName,
  };

  return {
    screenShare,
    toggleScreenShare,
  };
}
