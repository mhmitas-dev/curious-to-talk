# Room Sidebar Applications

## Purpose

The Applications tab is a lightweight workspace inside a LiveKit room. It is designed to host small room activities such as Screen Share, YouTube, and Spotify without turning the room sidebar into a dense dashboard.

The product direction is **quiet, simple, lightweight**. New apps should feel like focused tools with their own small internal experience, not like unrelated controls added to one long settings page.

## Current User Model

The room sidebar has four top-level tabs:

- Chat
- Applications
- Social
- Settings

Applications has two internal states:

1. **Launcher** - displays the available apps as phone-like app icons.
2. **App page** - displays the selected app inside the same sidebar space.

The Applications header always shows:

- a chevron button on the left, disabled on the launcher and enabled inside an app;
- the stable `Applications` title;
- a fixed right-side slot that shows only the current app icon while inside an app.

The header does not expose a last-used app shortcut. Apps are reopened from the launcher, while the workspace state remembers where the user left them.

Returning to the launcher does not end or reset an app. Switching to another sidebar tab also does not reset the current Applications page.

## Important Design Decision: Remember State, Do Not Keep Every App Mounted

Applications uses remembered workspace state rather than keeping all app components mounted.

This distinction matters:

- The active app and last-used app remain known when the Applications tab unmounts.
- Inactive app UI does not remain mounted merely to preserve navigation.
- Realtime or media state that must stay alive belongs above the tab UI in the always-mounted room shell or in a dedicated service/hook.
- An app can later persist its own lightweight page state when needed.

This keeps mobile resource usage predictable while allowing users to return to an app where they left it.

Do not solve app persistence by mounting every app indefinitely. An app that needs background playback or a continuous room session should explicitly move that lifecycle into an always-mounted owner.

## Ownership Boundaries

### `RoomChrome`

Location: `components/room/room-view.tsx`

`RoomChrome` is the always-mounted client shell inside `LiveKitRoom`. It owns room-wide state and services, including:

- sidebar open state and active top-level tab;
- screen-share state and settings;
- direct-message state;
- chat unread accounting;
- wake lock state;
- the Applications workspace state from `useRoomAppsState`.

Room-wide realtime or media state should remain here or in hooks called here. App pages should receive that state through explicit props/context objects.

### `RoomSidebar`

Location: `components/room/room-sidebar.tsx`

`RoomSidebar` is shell-only. It handles the sidebar frame, top-level tab controls, close behavior, unread badges, and rendering the supplied tab content.

It must not become the owner of LiveKit, direct-message, or app-specific business state.

### `AppsTab`

Location: `components/room/apps-tab.tsx`

`AppsTab` composes the Applications workspace. It:

- resolves the current app from the registry;
- builds the app render context from room-owned state;
- renders the workspace header;
- renders either the launcher or the selected app.

It is controlled by `RoomChrome`; it does not own the persistent navigation state itself.

### `useRoomAppsState`

Location: `components/room/use-room-apps-state.ts`

This hook owns session-scoped Applications navigation:

- `activeApp` - app currently visible, or `null` for the launcher;
- `lastActiveApp` - most recently opened app;
- `sessions` - lightweight remembered state for registered apps;
- `openApp(appId)` - opens or returns to an app;
- `goAppsHome()` - returns to the launcher without clearing app state;
- `closeApp(appId)` - clears an app session when an explicit end/close flow is introduced.

The state intentionally resets on a full page refresh. Browser persistence should only be added for app data that has a clear product reason to survive a room session.

### App Registry

Location: `components/room/apps/app-registry.tsx`

`ROOM_APPS` is the source of truth for apps visible in the launcher. Each module provides:

- a typed app ID;
- label and description metadata;
- a `react-icons` icon;
- an optional active-state predicate;
- a render function.

The launcher and workspace must use the registry rather than duplicating app lists or app-specific branching.

### App Contracts

Location: `components/room/apps/room-app-types.ts`

This file defines the shared module metadata and render context. Keep the common contract small. App-specific state may be represented as a focused property on the render context, but unrelated app internals should not be combined into one large generic state object.

## Current Apps

### Screen Share

Status: functional.

Component: `components/room/apps/screen-share-app.tsx`

The Screen Share page displays status, starts/stops sharing, and owns the settings UI. The underlying LiveKit state remains warm in `useScreenShareState`, called from `RoomChrome`, so switching sidebar tabs does not cause screen-share status to be rediscovered or interrupted.

Screen-share settings are stored in local storage by `RoomChrome` and passed down explicitly. Mode, resolution, and frame-rate settings apply when a new share starts. Viewer buffer is applied to received playback by `ScreenShareStage` and has a different lifecycle.

### YouTube

Status: LiveKit playback with current-host replacement and authorized participant handoff.

Component: `components/room/apps/youtube-app.tsx`

The Applications launcher opens a YouTube page with a link field and start/end controls. Starting YouTube creates a LiveKit-only room session. The host gets React Player playback on the stage, and viewers get read-only playback synchronized by LiveKit packets. Late-joining or refreshed clients recover active YouTube state through a short bounded state-request burst owned by the room shell.

Previous YouTube runtime attempts were removed because they produced fragile synchronization behavior. The cleanup is intentional; do not repair deleted YouTube session/player files piecemeal.

The current YouTube implementation follows the guardrails documented in [Room Stage and Shared Media](./room-stage-and-shared-media.md):

- shared YouTube state is live room session state, not durable database history;
- LiveKit may coordinate low-frequency user intent;
- high-frequency progress updates must not be stored in participant attributes or the database;
- if the host leaves, the YouTube stage should end;
- Screen Share must be disabled while YouTube is active, until the YouTube host ends YouTube or leaves;
- Supabase should not own active YouTube playback.

The YouTube app must still preserve these sidebar boundaries:

- room-wide LiveKit session state should not be owned only by a conditionally mounted page;
- switching sidebar tabs must not unintentionally stop or reset an active shared activity;
- app-specific navigation belongs to the YouTube app state, not the top-level sidebar tab state;
- the app registry remains the entry point;
- inactive UI should remain lightweight.

The Applications page may own YouTube form state, validation messages, and app navigation. It must not be the only owner of an active YouTube room session. Once a user starts YouTube, the long-lived session owner belongs in the always-mounted room shell so switching sidebar tabs or closing the sidebar cannot stop or desynchronize playback.

YouTube search is a local discovery feature, not shared room state. `lib/youtube/search-client.ts` calls the external search backend for metadata only, and `components/room/apps/youtube-app.tsx` owns the search query, loading, empty, error, and result UI locally. Search is button-triggered and aborts stale requests so older responses cannot overwrite newer searches.

Selecting a search result feeds the same YouTube play command used by pasted links. It does not create a second playback path. Search results must not be written to Supabase or treated as playback authority; only the selected video ID enters the LiveKit activity protocol.

Search remains available while YouTube is already on stage so users can look around without changing the room. The current host may select another result or paste another link to replace their own active video. A viewer may select a result or paste a link, but must confirm that the current video will end and that they will become the host before the room-owned handoff API is called. Screen Share continues to block all YouTube starts and replacements.

Queueing and collaborative playback controls remain separate future work. Participant handoff must continue through requester confirmation, an explicit request, current-host authorization, and a bounded timeout; a viewer selection must never publish an authoritative replacement directly. The current host is intentionally not prompted because their room hook already validates and authorizes the transition.

Handoff timing is deliberately asymmetric. A host may begin accepting a request only during the protocol's short acceptance window, while the requester waits slightly longer for the already-authorized replacement result to arrive. Do not merge these into one timeout: doing so either permits stale requests or makes valid reliable packets appear to fail at the UI boundary.

### Spotify

Status: registered placeholder.

Spotify currently renders `PreviewApp`. No authentication, playback, or synchronization design exists yet.

## Adding An App

When adding a new room app:

1. Add its ID to `RoomAppId` in `components/room/room-types.ts`.
2. Create its focused component under `components/room/apps/`.
3. Register its metadata and renderer in `ROOM_APPS`.
4. Add only the state contract the app actually needs.
5. Decide which state is page-local, remembered, room-wide, realtime, or persistent.
6. Keep long-lived media/realtime work outside conditionally mounted app pages.
7. Verify launcher, app header, tab switching, sidebar closing, and mobile layout.
8. Update this document with new lifecycle or architectural decisions.

## Guardrails

- Do not add app controls back into the global Settings tab when they belong to one app.
- Do not make `RoomSidebar` aware of individual app behavior.
- Do not duplicate the registry with hard-coded launcher entries.
- Do not keep every app mounted as a general solution to state retention.
- Do not let an app page own a realtime subscription or media session that must survive tab changes unless that page is intentionally kept alive.
- Do not introduce URL routing inside the sidebar without a concrete navigation requirement.
- Use theme tokens and the existing compact, mobile-first sidebar language.

## Verification Expectations

For any Applications change, verify at minimum:

- launcher entries render correctly;
- opening an app shows its internal page;
- returning home does not incorrectly reset the app;
- switching Chat, Social, Settings, and Applications preserves expected app state;
- closing and reopening the sidebar preserves expected state;
- active media or realtime behavior continues when its UI unmounts;
- mobile sidebar controls remain readable and easy to tap;
- targeted lint and the production build pass.
