"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDataChannel } from "@livekit/components-react";

// ── Types ──────────────────────────────────────────────────────
export type WatchPartyEventType = "PLAY" | "PAUSE" | "SEEK";

export interface WatchPartyEvent {
  type: WatchPartyEventType;
  /** Playback position in seconds at the time of the event */
  position: number;
  /** Unix timestamp (ms) when the event was sent — used for clock drift correction */
  sentAt: number;
}

const TOPIC = "watch-party";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// ── Hook ───────────────────────────────────────────────────────
/**
 * useWatchParty
 *
 * Wraps LiveKit's useDataChannel to provide a clean API for sending
 * and receiving watch party sync events.
 *
 * - Admin: call sendPlay / sendPause / sendSeek when player state changes.
 * - Viewers: react to `latestEvent` and apply it to the local player.
 *
 * All events include `sentAt` so receivers can correct for clock drift:
 *   adjustedPosition = event.position + (Date.now() - event.sentAt) / 1000
 */
export function useWatchParty() {
  const [latestEvent, setLatestEvent] = useState<WatchPartyEvent | null>(null);

  const onMessage = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const event = JSON.parse(decoder.decode(msg.payload)) as WatchPartyEvent;
      setLatestEvent(event);
    } catch {
      // ignore malformed messages
    }
  }, []);

  const { send } = useDataChannel(TOPIC, onMessage);

  const dispatch = useCallback(
    (type: WatchPartyEventType, position: number) => {
      const event: WatchPartyEvent = { type, position, sentAt: Date.now() };
      send(encoder.encode(JSON.stringify(event)), { reliable: false });
    },
    [send]
  );

  const sendPlay = useCallback(
    (position: number) => dispatch("PLAY", position),
    [dispatch]
  );

  const sendPause = useCallback(
    (position: number) => dispatch("PAUSE", position),
    [dispatch]
  );

  const sendSeek = useCallback(
    (position: number) => dispatch("SEEK", position),
    [dispatch]
  );

  return { latestEvent, sendPlay, sendPause, sendSeek };
}
