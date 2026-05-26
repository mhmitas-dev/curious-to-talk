"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";

const PRESENCE_POLL_INTERVAL_MS = 7_500;

export interface RoomWithPresence {
  id: string;
  name: string;
  description: string | null;
  participantCount: number;
}

interface PresenceResponse {
  counts?: Record<string, number>;
}

const voiceIconStyle = {
  background:
    "linear-gradient(135deg, color-mix(in oklch, var(--brand) 20%, transparent), color-mix(in oklch, var(--brand-deep) 14%, transparent))",
};

export function RoomsPresenceList({ rooms }: { rooms: RoomWithPresence[] }) {
  const roomIds = useMemo(() => rooms.map((room) => room.id), [rooms]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(rooms.map((room) => [room.id, room.participantCount]))
  );

  useEffect(() => {
    if (roomIds.length === 0) return;

    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const scheduleNextPoll = () => {
      if (stopped) return;
      timeoutId = setTimeout(fetchPresence, PRESENCE_POLL_INTERVAL_MS);
    };

    const fetchPresence = async () => {
      if (document.visibilityState === "hidden") {
        scheduleNextPoll();
        return;
      }

      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch("/api/rooms/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomIds }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Presence request failed with ${response.status}`);
        }

        const payload = (await response.json()) as PresenceResponse;
        if (!payload.counts || stopped) return;

        setParticipantCounts((currentCounts) => {
          let changed = false;
          const nextCounts = { ...currentCounts };

          for (const roomId of roomIds) {
            const nextCount = payload.counts?.[roomId] ?? 0;
            if (nextCounts[roomId] !== nextCount) {
              nextCounts[roomId] = nextCount;
              changed = true;
            }
          }

          return changed ? nextCounts : currentCounts;
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to refresh room presence", error);
      } finally {
        scheduleNextPoll();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (timeoutId) clearTimeout(timeoutId);
      void fetchPresence();
    };

    void fetchPresence();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomIds]);

  return (
    <ul className="flex flex-col gap-3">
      {rooms.map((room) => (
        <li key={room.id}>
          <RoomListItem
            room={{
              ...room,
              participantCount: participantCounts[room.id] ?? room.participantCount,
            }}
          />
        </li>
      ))}
    </ul>
  );
}

function RoomListItem({ room }: { room: RoomWithPresence }) {
  const hasParticipants = room.participantCount > 0;
  const participantLabel =
    room.participantCount > 99 ? "99+ here" : `${room.participantCount} here`;

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="flex items-center gap-4 rounded-xl bg-card/55 p-4 shadow-sm transition-colors hover:bg-card"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={voiceIconStyle}
      >
        🔊
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground truncate">{room.name}</p>
        {room.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {room.description}
          </p>
        )}
      </div>
      <div
        className={`flex min-w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          hasParticipants
            ? "bg-primary/15 text-primary"
            : "bg-[var(--button-dark)] text-muted-foreground"
        }`}
        aria-label={`${room.participantCount} participant${
          room.participantCount === 1 ? "" : "s"
        } in ${room.name}`}
        title={`${room.participantCount} participant${
          room.participantCount === 1 ? "" : "s"
        } in ${room.name}`}
      >
        <UsersRound className="h-3.5 w-3.5" />
        <span>{hasParticipants ? participantLabel : "Empty"}</span>
      </div>
    </Link>
  );
}
