const OFFLINE_CACHE = "niribi-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE).then((cache) =>
      cache.add(
        new Request(OFFLINE_URL, {
          cache: "reload",
        }),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("niribi-offline-") && key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.mode !== "navigate" || request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cachedOfflinePage = await caches.match(OFFLINE_URL);

      return cachedOfflinePage || Response.error();
    }),
  );
});
