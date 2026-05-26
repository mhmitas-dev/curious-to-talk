"use client";

import { useEffect, useRef, useState } from "react";
import { useTracks, VideoTrack } from "@livekit/components-react";
import { RemoteAudioTrack, RemoteTrack, Track } from "livekit-client";
import { Maximize, Minimize, Radio, Volume2, VolumeX } from "lucide-react";
import type { BufferTime } from "./room-types";

export function VoiceStage({ bufferTime }: { bufferTime: BufferTime }) {
  const screenShareTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const screenAudioTracks = useTracks([
    { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
  ]);
  const activeShare = screenShareTracks[0];
  const activeAudio = screenAudioTracks[0];

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const track = activeShare?.publication?.track;
    if (track instanceof RemoteTrack && typeof track.setPlayoutDelay === "function") {
      track.setPlayoutDelay(bufferTime);
    }
  }, [activeShare?.publication?.track, bufferTime]);

  useEffect(() => {
    const track = activeAudio?.publication?.track;
    if (track instanceof RemoteAudioTrack) {
      track.setVolume(isAudioMuted ? 0 : 1);
    }
  }, [activeAudio?.publication?.track, isAudioMuted]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (activeShare && activeShare.publication) {
    return (
      <div className="flex-1 min-w-0 min-h-0 flex flex-col items-center justify-center bg-sidebar p-2 md:p-4">
        <div
          ref={containerRef}
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-sidebar"
        >
          <VideoTrack trackRef={activeShare} className="w-full h-full object-contain" />
          <div className="absolute bottom-4 right-4 flex items-center gap-2 z-10">
            {activeAudio && (
              <button
                onClick={() => setIsAudioMuted(!isAudioMuted)}
                className="rounded-lg border border-border/25 bg-card/35 p-2 text-card-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-card/55"
                aria-label={isAudioMuted ? "Unmute screen share" : "Mute screen share"}
              >
                {isAudioMuted ? <VolumeX className="h-5 w-5 text-destructive" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="rounded-lg border border-border/25 bg-card/35 p-2 text-card-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-card/55"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-sidebar px-6 pointer-events-none opacity-25 select-none">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-card shadow-sm"
      >
        <Radio className="h-7 w-7 text-muted-foreground animate-pulse" style={{ animationDuration: "3s" }} />
      </div>
      <p className="mt-5 text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
        Curious to Talk
      </p>
    </div>
  );
}
