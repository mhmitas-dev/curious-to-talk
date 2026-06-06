# Room Stage And Shared Media

## Purpose

Every Niribi room has one visible stage. The stage is for live activity, not saved history. A stage activity should feel temporary: if the person hosting it leaves, the activity can end and the stage can become free.

The current stable stage behavior is **Screen Share only**.

YouTube is intentionally paused as a runtime feature. The Applications launcher may show a YouTube placeholder, but there is no active YouTube stage session, player, LiveKit command loop, Supabase table, or React Player integration in production code.

## Current Stage Contract

The room stage owner is:

```text
idle | screen_share
```

Screen Share is the only implemented shared media owner.

Screen Share uses the authoritative database-backed stage state because it coordinates a browser capture track and prevents two people from sharing at once.

Screen Share rules:

- Only one participant may publish a screen share at a time.
- The sharing browser must stop its own capture when sharing ends.
- If the sharer disappears from LiveKit presence, other clients may release stale stage ownership after the existing grace period.
- Screen Share state remains warm in the room shell and is not owned by the Applications tab UI.

## YouTube Cleanup Decision

YouTube was explored in two forms:

1. Supabase-backed durable playback state.
2. LiveKit-first temporary playback state using participant attributes, reliable data packets, RPC, and a React Player stage wrapper.

Both attempts were removed from runtime code.

The Supabase approach made a temporary room activity behave like durable room history. That created unnecessary database load and confusing recovery behavior after video end, refresh, and reconnect.

The initial LiveKit/React Player approach was closer to the product direction, but the implementation became a hybrid of player events, participant attribute updates, local drift correction, and custom UI. It produced synchronization bugs and LiveKit metadata timeouts. Rather than patching around those problems, the runtime was removed so the feature can be redesigned cleanly.

This cleanup is deliberate. Do not repair or reintroduce deleted YouTube files piecemeal.

## Database Boundary

Supabase remains for durable product data:

- users;
- profiles;
- approvals;
- rooms;
- persisted direct messages;
- admin-managed records.

Supabase should not own active YouTube playback unless the product explicitly changes direction and needs durable recovery after the host leaves.

If an environment previously ran the removed YouTube SQL, run `supabase/cleanup_youtube_stage_state.sql` once to drop stale YouTube database objects and restore the Screen Share-only stage constraint.

## Future YouTube Design Guardrails

When YouTube is redesigned, start from product behavior and failure modes before writing code.

Known product direction:

- A room has one stage and one visible shared content owner.
- Screen Share and YouTube must not both occupy the stage.
- YouTube should feel like a live room activity, not permanent room history.
- If the YouTube host leaves, refreshes, or disconnects, the stage should become free.
- Only the YouTube host should control playback in the first stable model.
- Viewers should not accidentally move shared playback by touching their local player.

Likely technical direction:

- Use LiveKit for in-room coordination, not Supabase Realtime.
- Use participant presence to know whether the host is still in the room.
- Use LiveKit data packets for low-frequency user intent such as start, pause, seek, and end.
- Use RPC or a similar host query only for join/reconnect snapshot recovery.
- Keep high-frequency progress updates out of participant attributes and out of the database.
- Keep long-lived shared media state in the always-mounted room shell, not inside a conditionally mounted app page.

Open design questions:

- Whether to use React Player, the YouTube IFrame API directly, or another player wrapper.
- Whether native YouTube controls should be host-only, hidden, or replaced by Niribi controls.
- How captions should work without giving viewers playback authority.
- Whether queueing belongs in this product at all.
- How takeover should work, if it is ever added.

## Current Runtime Files

- `components/room/stage/room-stage.tsx` chooses the current stage surface.
- `components/room/stage/screen-share-stage.tsx` renders the active Screen Share track.
- `components/room/use-room-stage-state.ts` coordinates the database-backed Screen Share stage state.
- `components/room/use-screen-share-state.ts` owns LiveKit screen-share publishing and subscription state.
- `components/room/apps/screen-share-app.tsx` renders Screen Share controls inside Applications.

There are intentionally no YouTube runtime files in this list.
