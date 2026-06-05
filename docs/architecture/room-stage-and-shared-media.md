# Room Stage And Shared Media

Status: proposed architecture for the YouTube integration and future shared-media apps.

## Purpose

Every Niribi room has one shared stage. The stage can present one room activity at a time, while individual apps may preserve their own session state when they are not visible.

This architecture introduces that distinction deliberately:

- **Stage ownership** answers what everyone currently sees on the room stage.
- **App session state** answers what an app remembers, such as a YouTube video, playback position, and queue.
- **Sidebar navigation state** answers which app page the local user is viewing.

These are separate concerns. Opening YouTube in the sidebar must not claim the stage, and leaving the YouTube sidebar page must not stop a shared YouTube session.

## Agreed Product Behavior

The stage has one owner:

```text
idle | screenShare | youtube | spotify
```

The initial implementation covers `idle`, `screenShare`, and `youtube`. Spotify should later use the same contract.

### YouTube

- Any participant may start a YouTube video.
- Any participant may play, pause, seek, change the current video, or manage the queue.
- The queue is shared and behaves like a room playlist.
- Only one YouTube session exists per room.
- The YouTube session remains available when YouTube is removed from the stage.
- Pressing Play while YouTube already owns the stage updates the shared YouTube session directly.

### Screen Share

- Only one participant may publish a screen share at a time.
- When Screen Share starts, it takes the stage and YouTube is removed from the stage.
- The preserved YouTube session does not automatically return when Screen Share ends.
- Ending Screen Share normally leaves the stage idle.

### YouTube Taking Over Screen Share

If someone presses YouTube Play while Screen Share owns the stage:

1. Show a confirmation explaining that the current participant's screen share will end.
2. If cancelled, make no state change.
3. If confirmed, ask the sharing participant's client to stop its local capture.
4. Wait until the screen-share track is actually unpublished.
5. Give the stage to YouTube and apply the requested playback action.

The UI must not merely hide a remote screen-share track. The publishing browser must stop its own capture so its device indicator, bandwidth usage, and local state remain truthful.

## Core State Model

### Stage Snapshot

The shared stage snapshot should be small and app-agnostic:

```ts
type StageOwner = "idle" | "screenShare" | "youtube" | "spotify";

interface RoomStageSnapshot {
  roomId: string;
  owner: StageOwner;
  revision: number;
  updatedAt: string;
  updatedBy: string;
  screenShareParticipantId: string | null;
}
```

`revision` is required. Every accepted mutation increments it so clients can ignore duplicate or stale updates and concurrent actions can be resolved predictably.

Stage state must not contain an app's full session data.

### YouTube Session Snapshot

The YouTube session is independent from stage ownership:

```ts
type YouTubePlaybackStatus = "idle" | "paused" | "playing";

interface YouTubeSessionSnapshot {
  roomId: string;
  videoId: string | null;
  status: YouTubePlaybackStatus;
  positionSeconds: number;
  effectiveAt: string;
  revision: number;
  updatedBy: string;
}
```

`positionSeconds` is an anchor, not a value written every second. If the status is `playing`, clients derive the expected position from the elapsed time since `effectiveAt`. Play, pause, seek, video changes, and queue advancement create new anchors.

The player must not continuously write playback progress to the database.

Clients must not assume their device clock is accurate. Initial snapshot responses should include the current server time so each client can estimate a server-clock offset using the request round trip. Recalculate that offset after reconnecting. Use the offset when deriving playback position from `effectiveAt`.

### Queue Items

Queue entries should be separate records rather than one large mutable JSON array:

```ts
interface YouTubeQueueItem {
  id: string;
  roomId: string;
  videoId: string;
  position: number;
  addedBy: string;
  createdAt: string;
}
```

Title and thumbnail metadata may be added later. The first version only needs a validated video ID.

## Authority And Transport

### Authoritative State

The authoritative snapshots should be stored through Supabase/Postgres, using one stage row and one YouTube session row per room, plus normalized queue rows.

Why this is necessary:

- LiveKit reliable packets are best-effort and are not buffered for disconnected participants.
- Participants joining after a packet was sent cannot reconstruct the room from that packet.
- Multiple participants may issue controls at nearly the same time.
- Reconnects and refreshes need a canonical snapshot.

Mutations should use database functions or equivalent server-side transactions with expected revisions. A stale expected revision should fail as a conflict instead of silently overwriting a newer action.

The database state is room activity state, not chat history. A separate product decision can later determine whether it is cleared when a room becomes empty or retained until explicitly replaced.

### Realtime Delivery

Supabase Realtime should deliver committed stage, YouTube session, and queue changes to connected clients. Each client also fetches the current snapshots when entering a room.

The first implementation should use this single authoritative realtime path. Do not add a duplicate LiveKit packet broadcast path until measurements show that Supabase Realtime latency is inadequate. Two event paths increase duplicate handling and ordering complexity.

### Targeted Screen-Share Stop

LiveKit RPC is appropriate for the targeted request to stop another participant's screen share:

```text
niribi.screenShare.stop
```

Every room client registers this method while connected. The handler may only stop that client's own screen share and responds after the local track has been disabled/unpublished.

The caller must still observe the LiveKit track-unpublished state before committing YouTube ownership. An RPC response alone is not sufficient evidence that the media track is gone.

## Client Architecture

### `RoomChrome`

`RoomChrome` remains the always-mounted composition root inside `LiveKitRoom`. It should create and connect the following warm services:

- `useRoomStageState`
- `useScreenShareState`
- `useYouTubeSession`
- existing chat, direct-message, wake-lock, and app-navigation state

It should pass focused state/actions to the stage and sidebar views. It should not contain the detailed reducer or protocol implementation itself.

### `useRoomStageState`

This new always-mounted hook owns stage coordination:

- initial snapshot loading;
- stage realtime subscription;
- revision/conflict handling;
- stage transition commands;
- takeover confirmation state;
- reconciliation between the declared Screen Share owner and actual LiveKit tracks;
- pending transition and error state.

Its public interface should describe intent rather than expose raw setters:

```ts
interface RoomStageController {
  stage: RoomStageSnapshot;
  pending: StageTransition | null;
  requestScreenShare(): Promise<void>;
  requestYouTubePlayback(command: YouTubePlaybackCommand): Promise<void>;
  releaseScreenShare(): Promise<void>;
  confirmTakeover(): Promise<void>;
  cancelTakeover(): void;
}
```

No app should directly set `stage.owner`.

### `useScreenShareState`

This hook should remain responsible for LiveKit screen-share media facts and local publishing:

- active screen-share track and participant;
- whether the local participant is sharing;
- start local capture;
- stop local capture;
- encoding/capture settings;
- RPC registration for stopping the local share.

It should no longer decide what `VoiceStage` renders. Starting a share becomes an operation coordinated with `useRoomStageState`.

### `useYouTubeSession`

This new always-mounted hook owns the shared YouTube session:

- initial snapshot and queue loading;
- Supabase Realtime subscriptions;
- URL parsing and video ID validation;
- play, pause, seek, replace-video, enqueue, remove, and advance commands;
- optimistic UI limited to safe pending states;
- revision and duplicate suppression;
- player readiness and autoplay-blocked status.

The hook survives sidebar tab changes because it is called from `RoomChrome`.

### `RoomStage`

`VoiceStage` should evolve into an app-agnostic `RoomStage` shell:

```text
RoomStage
├── IdleStage
├── ScreenShareStage
├── YouTubeStage
└── future SpotifyStage
```

`RoomStage` renders from the authoritative stage owner, with LiveKit track presence used as a safety condition for Screen Share.

Rules:

- `idle` renders the existing Niribi idle state.
- `screenShare` renders only when the expected screen-share track exists.
- `youtube` renders the YouTube player from the YouTube session snapshot.
- transient mismatch states render a small loading/recovery state rather than the wrong activity.

Fullscreen and screen-share audio controls belong to `ScreenShareStage`. YouTube-specific player behavior belongs to `YouTubeStage`.

### `YouTubeApp`

The sidebar app is a control surface, not the owner of playback.

The first UI may be only:

- a YouTube URL input;
- a Play action;
- basic pending/error feedback.

Later queue and playback controls can be added without changing stage ownership. Unmounting `YouTubeApp` must not destroy the player session.

## YouTube Player Contract

Use the YouTube IFrame Player API through one focused adapter component. Do not let transport code call the player instance throughout the application.

The adapter should expose commands such as:

```ts
interface SharedYouTubePlayerHandle {
  load(videoId: string, positionSeconds: number): void;
  play(): void;
  pause(): void;
  seek(positionSeconds: number): void;
  getPosition(): number;
}
```

### Shared Controls

The embedded player's native controls should not be the authoritative room controls. Native YouTube controls do not provide a clean shared-command event for every local seek/control interaction.

Use Niribi-controlled play, pause, and seek actions that first mutate the shared session and then apply the accepted snapshot to each player. The iframe may remain visually minimal.

### Feedback-Loop Prevention

Applying a remote snapshot can trigger YouTube player events. Those events must not be published back as new user commands.

The player adapter needs an `applyingRevision` or equivalent suppression mechanism so only explicit local user actions create shared mutations.

### Drift Correction

Do not synchronize every playback frame.

- Apply play, pause, seek, and video-change snapshots immediately.
- While playing, compare the local player with the derived expected position periodically.
- Ignore small drift.
- Seek only when drift exceeds a defined threshold, initially around 1-2 seconds.
- Revisit gentle playback-rate correction only if testing shows hard seeks are disruptive.

### Autoplay Restrictions

Browsers may block scripted unmuted playback, especially for remote actions or newly joined participants. `YouTubeStage` must handle the IFrame API's autoplay-blocked state and show a single user gesture such as `Tap to join playback`.

One participant being autoplay-blocked must not pause the room-wide session.

## Stage Transition State Machine

```text
idle -> youtube
idle -> screenShare
youtube -> youtube       play/pause/seek/change video
youtube -> screenShare   preserve YouTube session, remove it from stage
screenShare -> idle      normal screen-share end
screenShare -> youtube   confirmed takeover, remote share stopped first
youtube -> idle          explicit end activity
```

Spotify should later add transitions through the same coordinator rather than introducing an independent stage flag.

## Screen Share Transition Details

### Starting Screen Share

1. Check the latest stage revision.
2. If another screen share exists, reject the request.
3. Ask the browser for screen capture while the current stage remains unchanged.
4. If the user cancels or capture fails, leave the stage and YouTube session untouched.
5. Publish the LiveKit track, but do not render it as the shared stage until ownership commits.
6. Atomically commit Screen Share ownership. If YouTube owns the stage, the same transaction preserves its current derived position and pauses its session.
7. If the ownership commit loses a race, stop the newly published local track and refresh state.

The browser picker is deliberately before the shared state transition. A slow or cancelled picker must never pause YouTube or leave the room in a false Screen Share state.

### Normal Screen Share End

1. Stop the local LiveKit screen-share track.
2. Commit `idle` only if the current owner and participant identity still match.
3. Do not reactivate YouTube automatically.

### YouTube Takeover

1. Capture the desired YouTube command as a pending transition.
2. Show confirmation.
3. After confirmation, perform `niribi.screenShare.stop` against the sharing participant.
4. Wait for the matching LiveKit track to disappear.
5. Atomically commit YouTube ownership and the desired playback snapshot.
6. Clear the pending transition.

If the RPC times out but the track has already disappeared, refresh the stage snapshot and continue only if the stage is safe to claim. Otherwise show an error and leave Screen Share authoritative.

## Concurrency And Recovery

### Concurrent Controls

All shared mutations use an expected revision. If two users act at once:

- one mutation commits first;
- the other receives a conflict;
- the losing client refreshes and may retry only when the original intent is still valid.

Do not use participant-local timestamps to decide which user's action wins.

### Video End And Queue Advance

Every player may observe that a video ended. Queue advancement must be an atomic mutation guarded by the current video ID and revision. Only one client can successfully advance the queue; duplicate end events become harmless conflicts.

### Stale Screen Share State

The stage may say `screenShare` after a browser crashes or disconnects. If the expected participant/track is absent after a short grace period, clients may call an idempotent `releaseStaleScreenShare` mutation guarded by owner, participant identity, and revision.

A future LiveKit webhook can make this cleanup server-driven, but the client must still tolerate stale state.

### Reconnect And Late Join

On room entry or reconnection:

1. Fetch stage, YouTube session, and queue snapshots.
2. Subscribe to realtime changes.
3. Compare revisions after subscription setup to close the fetch/subscribe race.
4. Render only after a coherent initial snapshot is available.

Realtime events are accelerators; the snapshot remains the source of truth.

## Security Boundary

Stage and YouTube mutations must verify an authenticated, approved Niribi user and a valid room. The mutation layer should be the only writer to stage/session tables.

RLS should permit approved users to read relevant room activity state. Writes should go through narrowly scoped Postgres functions or authenticated server endpoints rather than unrestricted table updates.

If room membership becomes more restrictive later, the same mutation boundary can add a current-room-membership check without rewriting the client architecture.

## Suggested Data Model

The exact SQL belongs to a later implementation phase, but the logical model is:

```text
room_stage_state
  room_id primary key
  owner
  screen_share_participant_id nullable
  revision
  updated_by
  updated_at

room_youtube_sessions
  room_id primary key
  video_id nullable
  playback_status
  position_seconds
  effective_at
  revision
  updated_by
  updated_at

room_youtube_queue
  id primary key
  room_id
  video_id
  position
  added_by
  created_at
```

Use constraints for owner/status values, non-negative positions, unique queue ordering, and foreign keys to rooms/profiles.

## Implementation Phases

### Phase 0: Contracts And Tests

- Finalize types, transition rules, error states, and confirmation copy.
- Decide room-empty persistence behavior.
- Define reducer/state-machine tests before integration.

### Phase 1: Stage Shell Extraction

- Replace `VoiceStage` with `RoomStage` plus `IdleStage` and `ScreenShareStage`.
- Introduce a local stage coordinator that preserves current Screen Share behavior.
- No YouTube or database behavior yet.

### Phase 2: Authoritative Stage State

- Add schema, RLS, atomic mutation functions, initial loading, and Realtime subscription.
- Migrate Screen Share to the versioned stage state.
- Add stale-state reconciliation.

### Phase 3: Local YouTube Session

- Add `YouTubeApp`, URL parsing, and `YouTubeStage`.
- Add the focused IFrame player adapter.
- Keep playback local while validating player lifecycle, mobile behavior, and autoplay handling.

### Phase 4: Shared Playback

- Add authoritative YouTube session mutations and Realtime updates.
- Implement shared play, pause, seek, and video replacement.
- Add revision suppression and drift correction.

### Phase 5: Stage Takeover

- Register the screen-share stop RPC.
- Add confirmation and pending-transition UX.
- Implement safe Screen Share-to-YouTube takeover and race handling.

### Phase 6: Shared Queue And Recovery

- Add queue mutations and automatic next-video advancement.
- Test simultaneous controls, reconnects, late joins, crashes, and browser autoplay failures.

Each phase must preserve existing room behavior and pass focused tests before proceeding.

## Open Decisions

These should be settled before their implementation phase:

- Whether starting Screen Share while YouTube owns the stage also requires confirmation.
- Whether the YouTube session survives when the room becomes empty.
- Whether playing a different video discards the current video or returns it to the queue.
- Whether everyone can remove and reorder every queue item; current product direction suggests yes.
- Whether the first release uses only custom controls or keeps limited native iframe controls.

None of these decisions require changing the ownership architecture.

## External Constraints

- LiveKit reliable data packets are not durable or replayed to disconnected/late participants, so they must not be the sole shared-state store.
- LiveKit RPC is suitable for a targeted request/response action such as asking the active sharer to stop its own track.
- The YouTube IFrame API provides programmatic load, play, pause, seek, state-change, and autoplay-blocked behavior. Browser autoplay policy must be treated as a normal runtime state.

References:

- [LiveKit data overview](https://docs.livekit.io/home/client/data/)
- [LiveKit data packets](https://docs.livekit.io/transport/data/packets/)
- [LiveKit RPC](https://docs.livekit.io/transport/data/rpc/)
- [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
