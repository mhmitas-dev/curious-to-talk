# Progressive Web App

## Purpose

Niribi is installable as a Progressive Web App while preserving its existing
online-only realtime model. Installation provides a standalone app window and
home-screen icon. It does not imply that a voice room can continue offline.

## Ownership

- `app/manifest.ts` owns install metadata, theme colors, and app icons.
- `components/pwa-service-worker.tsx` registers the production service worker.
- `components/pwa-install-prompt.tsx` owns the home-page installation action,
  browser install event, installed-state detection, and platform fallback
  instructions.
- `public/sw.js` owns the narrowly scoped offline navigation fallback.
- `app/offline/page.tsx` is the only application document stored by the service
  worker.
- `next.config.ts` owns service-worker response headers.
- `proxy.ts` keeps the manifest, worker, and fallback outside the authenticated
  proxy boundary so installation and offline startup do not depend on a session
  refresh.

## Cache Boundary

The service worker is network-first for top-level document navigations. It
returns the cached `/offline` document only when the navigation request fails.
It must not cache or synthesize responses for:

- Supabase authentication or database requests;
- Next.js Server Actions or API routes;
- LiveKit tokens, signaling, tracks, or data packets;
- direct messages, room presence, or room stage state;
- YouTube, screen-share, or other media resources.

This boundary prevents stale authenticated pages or realtime state from being
presented as current. Future offline features must use explicit local data
ownership and conflict behavior rather than broadening the worker's fetch cache.

## Lifecycle

Service-worker registration runs only in production so local development does
not retain a worker that masks current code. Updated workers use the browser's
normal waiting lifecycle instead of forcing activation during a live room. On
activation, the worker removes older Niribi offline caches and claims clients.

The offline page is intentionally informational. Voice, messaging, shared
media, authentication refresh, and room recovery still require connectivity.

## Installation UI

The authenticated home page shows an install card while Niribi is running in a
browser tab. Chromium's `beforeinstallprompt` event opens the native installer
when available. Browsers may delay or suppress that event, so the same action
falls back to Android browser-menu or iOS Share-menu instructions. The card is
hidden in standalone display mode and after the browser reports installation.
