# Room Stage And Shared Media

## Purpose

Every Niribi room has one visible stage. The stage is for live activity, not saved history. A room activity should feel closer to Screen Share than to a durable document: if the person hosting it leaves, the activity ends and the stage becomes free.

The current production-grade stage behavior is Screen Share. YouTube is intentionally reset to a placeholder until it is rebuilt with a LiveKit-first session model.

## Current Decision: YouTube Is Live Session State

YouTube should not use Supabase tables, Supabase Realtime, or database RPCs for active playback.

The previous Supabase-backed YouTube work is removed from the runtime because it made a temporary room activity behave like durable room state. That created unnecessary database load and confusing recovery behavior, especially after video end, refresh, and reconnect.

The next YouTube implementation should use:

- **LiveKit participant attributes** for the lightweight current host snapshot.
- **LiveKit reliable data packets** for immediate commands such as start, pause, resume, seek, and end.
- **LiveKit RPC** for a newly joined participant to ask the host for the freshest snapshot.
- **React state in the always-mounted room shell** for local rendering.

Supabase remains for durable product data: users, rooms, profiles, approvals, persisted direct messages, and admin-managed records. YouTube stage activity is not durable product data.

## Product Rules

- A YouTube session exists only while its host is in the LiveKit room.
- If the host leaves, refreshes, or disconnects long enough to disappear from LiveKit presence, YouTube ends and the stage becomes free.
- If everyone leaves the room, YouTube ends.
- Refreshing the browser resets the local YouTube session. A refreshed viewer may rejoin an active session by asking the current host over LiveKit.
- Only one participant can host YouTube at a time.
- Non-host viewers cannot control the shared YouTube session.
- Queueing, takeover, and collaborative controls are out of scope until the simple host/viewer model is stable.

## LiveKit Responsibilities

### Participant Attributes

The host should publish a small attribute snapshot that tells late joiners who is hosting and what to load.

Example shape:

```ts
interface YouTubeHostSnapshot {
  sessionId: string;
  hostIdentity: string;
  videoId: string;
  playbackStatus: "playing" | "paused";
  positionSeconds: number;
  updatedAt: number;
}
```

This data must stay small and low-frequency. Participant attributes are synchronized to new participants, but they are not for high-frequency playback progress.

### Data Packets

The host should broadcast authoritative YouTube commands with a dedicated topic such as `niribi.youtube`.

Commands should be reliable because they represent user intent:

- `youtube:start`
- `youtube:pause`
- `youtube:resume`
- `youtube:seek`
- `youtube:end`

Packets are still best-effort for currently connected participants. They are not durable and are not replayed to users who were disconnected when the packet was sent. That is why late joiners use attributes plus RPC.

### RPC

When a participant joins or refreshes:

1. Read participant attributes to find the current YouTube host.
2. If a host exists, call a registered host RPC method such as `niribi.youtube.snapshot`.
3. If the host responds, load the returned snapshot.
4. If the host does not respond, keep the stage empty.

RPC is request/response coordination. It should not be used for frequent playback progress updates.

## Local State

Shared YouTube state should live in the always-mounted room shell, not inside the conditionally rendered YouTube app page. Switching sidebar tabs must not stop an active hosted session.

Browser `localStorage` may be used only for local preferences such as volume, caption preference, or the last opened app page. It must not decide what the room is currently playing.

## Database Boundary

The database stage owner currently supports Screen Share only:

```text
idle | screen_share
```

Do not add a `room_youtube_sessions` table or YouTube RPC surface unless the product explicitly changes direction and needs durable recovery after the host leaves. If that happens, update this document before writing code.

If an environment previously ran the removed YouTube SQL, run `supabase/cleanup_youtube_stage_state.sql` once to drop the stale YouTube database objects and restore the Screen Share-only stage constraint.

## Existing Screen Share Contract

Screen Share still uses the authoritative database-backed stage state because it coordinates a browser capture track and prevents two people from sharing at once.

Screen Share rules:

- Only one participant may publish a screen share at a time.
- The sharing browser must stop its own capture when sharing ends.
- If the sharer disappears from LiveKit presence, other clients may release stale stage ownership after the existing grace period.
- Screen Share state remains warm in the room shell and is not owned by the Apps tab UI.

## Rebuild Plan For YouTube

When we rebuild YouTube, start from a clean implementation:

1. Add a focused LiveKit YouTube session hook in the room shell.
2. Register the snapshot RPC before or immediately after connecting.
3. Read participant attributes on join to discover an active host.
4. Add host-only start/end behavior from the YouTube app page.
5. Add stage rendering for host and viewers.
6. Add host-only commands through reliable data packets.
7. Add viewer sync and late-join recovery.
8. Test refresh, host leave, viewer join, mobile autoplay, and video end before adding queue or takeover behavior.

Keep the first rebuild intentionally small. The correct first version is one host, one video, viewer-only followers, and stage reset when the host leaves.
