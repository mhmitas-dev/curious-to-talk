"use client";

import { useEffect } from "react";
import { useLocalParticipant, useTracks } from "@livekit/components-react";
import { AudioPresets, ScreenSharePresets, Track } from "livekit-client";
import type { ScreenFPS, ScreenQuality, ScreenShareState } from "./room-types";

interface UseScreenShareStateInput {
  screenQuality: ScreenQuality;
  screenFps: ScreenFPS;
}

const screenShareBitrates: Record<ScreenQuality, Record<ScreenFPS, number>> = {
  "720p": {
    15: 1_800_000,
    30: 2_800_000,
  },
  "1080p": {
    15: 3_500_000,
    30: 5_500_000,
  },
};

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
      const screenPub = localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const screenTrack = (screenPub?.track as { mediaStreamTrack?: MediaStreamTrack } | undefined)
        ?.mediaStreamTrack;
      if (screenTrack && "contentHint" in screenTrack) {
        screenTrack.contentHint = "detail";
      }

      const audioPub = localParticipant.getTrackPublication(Track.Source.ScreenShareAudio);
      const audioTrack = (audioPub?.track as { mediaStreamTrack?: MediaStreamTrack } | undefined)
        ?.mediaStreamTrack;
      if (audioTrack && "contentHint" in audioTrack) {
        audioTrack.contentHint = "music";
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
      const screenShareEncoding = {
        ...preset.encoding,
        maxBitrate: screenShareBitrates[screenQuality][screenFps],
      };

      await localParticipant.setScreenShareEnabled(!iAmSharing, {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
        },
        resolution: preset,
      }, {
        audioPreset: AudioPresets.musicHighQualityStereo,
        degradationPreference: "maintain-resolution",
        forceStereo: true,
        screenShareEncoding,
      });
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
