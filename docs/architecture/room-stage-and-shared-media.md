# Room Stage And Shared Media

## Purpose

Every Niribi room has one visible stage. The stage is for live activity, not saved history. A stage activity should feel temporary: if the person hosting it leaves, the activity can end and the stage can become free.

The current stable stage behavior is **Screen Share**, plus a Phase 7 YouTube viewer-sync, recovery, buffering, and stage-clarity shell.

The YouTube shell can create and end a room session over LiveKit, visibly occupy the stage, render React Player for the YouTube host, render React Player playback with local-only native controls for viewers, recover active session state for late-joining or refreshed viewers through bounded LiveKit state requests, pause viewers when the host is meaningfully buffering, and show a lightweight role/status cue on the stage. There is no Supabase table for active YouTube playback.

## Current Stage Contract

The room stage owner is:

```text
idle | screen_share
```

Screen Share is the only implemented playable shared media owner.

YouTube is a LiveKit-only stage activity layered above the idle stage when the database stage owner is `idle`. The database stage owner remains Screen Share-only; do not add YouTube to `room_stage_state.owner` in this phase.

Screen Share uses the authoritative database-backed stage state because it coordinates a browser capture track and prevents two people from sharing at once.

Screen Share rules:

- Only one participant may publish a screen share at a time.
- The sharing browser must stop its own capture when sharing ends.
- If the sharer disappears from LiveKit presence, other clients may release stale stage ownership after the existing grace period.
- Screen Share state remains warm in the room shell and is not owned by the Applications tab UI.

## YouTube Cleanup Decision And Rebuild State

YouTube was explored in two forms:

1. Supabase-backed durable playback state.
2. LiveKit-first temporary playback state using participant attributes, reliable data packets, RPC, and a React Player stage wrapper.

Both attempts were removed from runtime code.

The Supabase approach made a temporary room activity behave like durable room history. That created unnecessary database load and confusing recovery behavior after video end, refresh, and reconnect.

The initial LiveKit/React Player approach was closer to the product direction, but the implementation became a hybrid of player events, participant attribute updates, local drift correction, and custom UI. It produced synchronization bugs and LiveKit metadata timeouts. Rather than patching around those problems, the runtime was removed so the feature can be redesigned cleanly.

This cleanup is deliberate. Do not repair or reintroduce deleted YouTube files piecemeal.

Phase 1 of the rebuild has reintroduced only a lifecycle shell:

- `components/room/use-room-youtube-activity.ts` owns LiveKit data-packet session lifecycle.
- `components/room/apps/youtube-app.tsx` starts and ends a YouTube room session from Applications.
- `lib/youtube/parse-youtube-url.ts` validates YouTube links and raw video IDs.

This shell is intentionally not playback. It exists to prove ownership, start/end propagation, state request/response, and host-disconnect cleanup before React Player returns.

Phase 2 adds only visible stage occupation:

- `components/room/stage/youtube-activity-stage.tsx` renders a placeholder when a YouTube session exists.
- `components/room/stage/room-stage.tsx` chooses Screen Share first, then YouTube placeholder, then idle.
- Ended YouTube session IDs are remembered locally so delayed packets cannot resurrect a session after `youtube:end`.

Phase 3 adds host playback only:

- `react-player` is installed as the player boundary.
- `components/room/stage/youtube-host-player.tsx` renders React Player for the YouTube host.
- Host play, pause, and seek events update the host's local YouTube session snapshot.
- Host video end calls the existing `youtube:end` lifecycle and clears the room stage.
- Viewers still see a placeholder. Viewer playback sync begins in Phase 4.

Phase 4 adds viewer playback synchronization:

- Host play, pause, and seek events publish LiveKit reliable packets.
- Host playback commands read position and paused state from the React Player ref. Do not rely on synthetic event targets for YouTube iframe timing.
- Meaningful host `seeking` jumps and completed `seeked` events are both treated as seek commands; duplicate same-position commands are suppressed before publishing.
- Viewers render `components/room/stage/youtube-viewer-player.tsx`.
- Viewer players expose native YouTube controls for local comfort, but they do not publish playback commands.
- If a viewer locally pauses, plays, or seeks, drift correction pulls them back to the host's shared state shortly after.
- Viewer players use local drift correction only; they do not poll the network.
- Delayed packets for ended sessions are still ignored so `youtube:end` remains terminal.

Phase 5 hardens recovery:

- Late-joining or refreshed clients send a small bounded burst of `youtube:state-request` packets.
- The burst is not a playback polling loop; it stops after a few attempts or as soon as a session is recovered.
- While recovery is pending, the YouTube app briefly disables new starts to avoid racing an existing host response.
- If the YouTube host disappears from LiveKit presence, clients mark that session ended and clear the stage after the existing grace delay.
- Ended session IDs remain locally ignored so delayed start, seek, or state-response packets cannot resurrect an ended video.

Phase 6 adds conservative buffering polish:

- Host buffering is shared only after a short debounce so brief YouTube iframe loading flickers do not move the whole room.
- Host buffering does not pause the host's own player; it only publishes a `youtube:buffering` session snapshot.
- Viewers treat host buffering as read-only wait state and pause at the host position until the host publishes play again.
- Viewer buffering remains local and never publishes shared commands.

Phase 7 cleans up runtime boundaries and stage clarity:

- Shared YouTube position math lives in `components/room/youtube-activity-utils.ts`.
- Host, viewer, and LiveKit recovery code must use the same expected-position helper so drift and recovery calculations do not diverge.
- The YouTube stage shows a small non-interactive status cue: `You host`, `[name] is hosting`, or `Waiting for [name]`.
- Host display names are resolved from LiveKit participant presence at render time; the playback packet still carries only the durable room identity.
- The status cue is informational only. It must not become a control surface or a second playback UI.

Stage sizing boundary:

- `components/room/stage/stage-media-frame.tsx` owns the 16:9 media frame used by YouTube.
- Stage surfaces must fit inside the room's available height; a media iframe must never decide the room height or push the participant panel down.
- YouTube host and viewer player components fill the frame and own playback/events/overlays only. Do not reintroduce width-driven `aspect-video` wrappers inside those player components.
- Screen Share remains a full-stage `object-contain` surface because it renders a LiveKit video track rather than a fixed 16:9 media app.

Local native-controls pass:

- Phase 1 exposes native YouTube controls to viewers for local comfort.
- Viewer native controls remain local only; the viewer player still has no path to publish LiveKit playback commands.
- Phase 2 hardens the LiveKit receiver: once a YouTube session exists, packets for another session are ignored instead of replacing the active host.
- This means the accepted host remains authoritative until they end YouTube, leave, or the session is cleared.
- Simultaneous starts are intentionally not a collaborative/takeover feature; the first accepted active session wins and later competing sessions are ignored.
- Phase 3 tunes viewer drift correction for native controls: viewer pause/seek events trigger local correction, and the fallback correction interval is short enough to feel intentional without adding network polling.
- Phase 4 clarifies the viewer state cue: viewers see who is hosting so local snap-back behavior reads as intentional room sync.
- Phase 5 documents and verifies the boundary. Future work must preserve host-only publishing, viewer-local native controls, and drift correction after local viewer actions.

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

When YouTube is redesigned, start from product behavior and failure modes before writing code. Phase 0 of the rebuild locks the intended behavior below; later phases should implement it incrementally.

Known product direction:

- A room has one stage and one visible shared content owner.
- Screen Share and YouTube must not both occupy the stage.
- When YouTube is active, Screen Share is disabled until the YouTube host ends YouTube or leaves.
- When Screen Share is active, YouTube cannot start.
- YouTube should feel like a live room activity, not permanent room history.
- If the YouTube host leaves, refreshes, or disconnects, the stage should become free.
- Only the YouTube host should control playback in the first stable model.
- Viewers should not accidentally move shared playback by touching their local player.
- When the video ends, YouTube should end and the room should return to the idle stage.
- Queueing, takeover, and collaborative controls are out of scope for the first stable model.

Likely technical direction:

- Use LiveKit for in-room coordination, not Supabase Realtime.
- Use participant presence to know whether the host is still in the room.
- Use LiveKit data packets for low-frequency user intent such as start, pause, seek, and end.
- Use RPC or a similar host query only for join/reconnect snapshot recovery.
- Keep high-frequency progress updates out of participant attributes and out of the database.
- Keep long-lived shared media state in the always-mounted room shell, not inside a conditionally mounted app page.
- Use React Player as the preferred player boundary unless runtime testing shows a concrete reason not to.
- Treat React Player as local media infrastructure, not as the room authority.

### Planned YouTube Session Shape

The first rebuilt session should stay small:

```ts
interface PlannedYouTubeSession {
  hostIdentity: string;
  playbackStatus: "paused" | "playing" | "buffering";
  positionSeconds: number;
  revision: number;
  sessionId: string;
  updatedAt: number;
  videoId: string;
}
```

This shape is room session state. It is not durable room history.

`updatedAt` is for local expected-position calculation and snapshot freshness. It must not become a reason to write high-frequency progress updates to the database or participant attributes.

### Planned LiveKit Protocol

Playback control should be event-driven. Do not send network updates every few seconds merely to keep time moving.

Authoritative host commands:

- `youtube:start`
- `youtube:play`
- `youtube:pause`
- `youtube:seek`
- `youtube:buffering`
- `youtube:end`

Viewer-to-host recovery command:

- `youtube:state-request`

Host-to-viewer recovery response:

- `youtube:state-response`

Only the current YouTube host may publish authoritative playback commands. Viewers may request state, and may interact with their native player controls locally, but viewer player events must never publish shared play, pause, seek, buffering, resume, or end commands.

Once a client has accepted a YouTube session, it must ignore packets for a different YouTube session ID. This prevents local viewer actions, stale packets, or competing hosts from replacing the active room host.

The payload should include at minimum:

- `sessionId`;
- `hostIdentity`;
- `videoId`;
- `positionSeconds`;
- `playbackStatus`;
- `revision`;
- `sentAt`.

### Planned Lifecycle

Start:

1. User opens the YouTube app from Applications.
2. User pastes a valid YouTube link and presses Play.
3. The room shell verifies that Screen Share is not active and no YouTube session is active.
4. The local participant becomes the YouTube host.
5. The room publishes `youtube:start`.
6. The stage renders React Player for host and viewers.

Host playback:

1. Host play, pause, seek, and end events come from React Player.
2. Those events become LiveKit data packets.
3. Viewers apply those packets to their local React Player.
4. Viewers may run local drift correction, but that correction is not network polling.

Viewer join or refresh:

1. Viewer joins the LiveKit room.
2. Viewer sends `youtube:state-request`.
3. If a current host exists, the host responds with `youtube:state-response`.
4. Viewer loads the returned video and position.
5. If no host responds, the stage remains idle.

Host leave, refresh, or disconnect:

1. LiveKit presence reports the host has left.
2. Viewers clear YouTube from the stage.
3. The refreshed host returns as a normal participant; YouTube does not restore automatically.

Video end:

1. Host React Player emits ended.
2. Host publishes `youtube:end`.
3. Every participant clears YouTube and returns to the idle stage.

Buffering:

- Host buffering may affect the shared room only after a short debounce.
- Viewer buffering is local and must not affect the room.
- Host buffering must not set the host player's `playing` prop to false; the host player should keep trying to play while viewers wait.

### Implementation Boundaries

The rebuild should proceed in small phases:

1. Session lifecycle shell, without a player. **Complete.**
2. Stage ownership integration, without a player. **Complete.**
3. Host React Player playback. **Complete.**
4. Viewer synchronization. **Complete.**
5. Join, refresh, leave, and end recovery. **Complete.**
6. Buffering and mobile polish. **Complete.**
7. Runtime cleanup and stage clarity. **Complete.**

Do not skip directly to a full player implementation. Stage ownership and host lifecycle must work before playback sync is introduced.

Open design questions:

- Whether native YouTube controls should be host-only, hidden, or replaced by Niribi controls.
- How captions should work without giving viewers playback authority.
- How takeover should work, if it is ever added.

## Current Runtime Files

- `components/room/stage/room-stage.tsx` chooses the current stage surface.
- `components/room/stage/stage-media-frame.tsx` contains fixed-aspect media apps inside the available stage area.
- `components/room/stage/screen-share-stage.tsx` renders the active Screen Share track.
- `components/room/stage/youtube-activity-stage.tsx` renders the active YouTube stage surface.
- `components/room/stage/youtube-host-player.tsx` renders React Player for the YouTube host.
- `components/room/stage/youtube-viewer-player.tsx` renders React Player for viewers with local-only native controls and no shared publishing path.
- `components/room/youtube-activity-utils.ts` owns shared YouTube timing helpers.
- `components/room/use-room-stage-state.ts` coordinates the database-backed Screen Share stage state.
- `components/room/use-room-youtube-activity.ts` coordinates the LiveKit-only YouTube lifecycle shell.
- `components/room/use-screen-share-state.ts` owns LiveKit screen-share publishing and subscription state.
- `components/room/apps/screen-share-app.tsx` renders Screen Share controls inside Applications.
- `components/room/apps/youtube-app.tsx` renders the Phase 1 YouTube start/end shell inside Applications.

Queueing, takeover, collaborative controls, and a custom YouTube control surface remain intentionally deferred.

## Local Native Controls Verification

Use this checklist when changing YouTube viewer controls:

- Host play, pause, seek, buffering, and end still publish shared LiveKit commands.
- Host volume, mute, captions, fullscreen, quality, and YouTube settings remain local.
- Viewer native controls are visible and usable.
- Viewer volume, mute, captions, fullscreen, quality, and YouTube settings remain local.
- Viewer play, pause, and seek never publish LiveKit commands.
- Viewer local pause while the host is playing is corrected back to host playback.
- Viewer local seek is corrected back to the host position.
- Viewer local play while the host is paused is corrected back to paused.
- Viewer drift correction stays local; it must not become database writes, participant attributes, or high-frequency network packets.
- The stage badge says `Following host` for viewers so snap-back behavior is understandable.
