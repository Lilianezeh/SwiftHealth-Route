/* The service worker of SwiftRescue and Find blood. Requirements: FR-17, NFR-03 (the emergency page and the blood bank page work
 * offline after one visit), NFR-07.
 * Spec: specs/2026-10-17-swiftrescue/requirements.md, decision A6; specs/2026-10-22-blood-offline/requirements.md, decision N6.
 * Tests: tests/unit/serviceWorker.test.ts.
 *
 * It keeps only three kinds of file of this site: the pages /emergency and /blood, the files under /_next/static/ (scripts and
 * styles), and the two small SwiftRescue photos (specs/2026-10-22-home-photos/, part 6). A page is fetched from the network first (so
 * a new version shows at once) and the kept copy is the fallback. The static files and the two photos are kept first (their names
 * change with every build, or never). It never keeps an answer of the API (another address), a page with a query, any other image
 * or anything with lat or lng: the contacts and the blood banks for offline use are saved by the page itself, without a position.
 */
const CACHE_NAME = "swiftrescue-v1";
const CACHE_PREFIX = "swiftrescue-";
const PAGE_PATHS = ["/emergency", "/blood"];
const STATIC_PREFIX = "/_next/static/";
const PHOTO_PATHS = ["/images/emergency/ambulance.webp", "/images/emergency/fire.webp"];

/** True for the addresses the worker may keep: this site, no query at all, and the page or a static file. */
function isKeepableUrl(address) {
  let url;
  try {
    url = new URL(address);
  } catch (error) {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  if (url.search !== "" || url.searchParams.has("lat") || url.searchParams.has("lng")) return false;
  return (
    PAGE_PATHS.indexOf(url.pathname) !== -1 ||
    PHOTO_PATHS.indexOf(url.pathname) !== -1 ||
    url.pathname.startsWith(STATIC_PREFIX)
  );
}

async function keepCopy(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

/** The page: network first, the kept copy when the network fails. */
async function pageFromNetworkOrCopy(request) {
  try {
    const response = await fetch(request);
    await keepCopy(request, response);
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const copy = await cache.match(request);
    if (copy) return copy;
    throw error;
  }
}

/** A static file: the kept copy first, then the network (and keep what came). */
async function staticFromCopyOrNetwork(request) {
  const cache = await caches.open(CACHE_NAME);
  const copy = await cache.match(request);
  if (copy) return copy;
  const response = await fetch(request);
  await keepCopy(request, response);
  return response;
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) {
              return name.indexOf(CACHE_PREFIX) === 0 && name !== CACHE_NAME;
            })
            .map(function (name) {
              return caches.delete(name);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET" || !isKeepableUrl(request.url)) return; // the browser handles it as usual
  const isPage = PAGE_PATHS.indexOf(new URL(request.url).pathname) !== -1;
  event.respondWith(isPage ? pageFromNetworkOrCopy(request) : staticFromCopyOrNetwork(request));
});

/* On the first visit the worker starts after the page has loaded, so it did not see the files. The page sends their addresses and
   the worker keeps those it may keep. */
self.addEventListener("message", function (event) {
  const message = event.data;
  if (!message || message.type !== "keep-urls" || !Array.isArray(message.urls)) return;
  const addresses = message.urls.filter(function (address) {
    return typeof address === "string" && isKeepableUrl(address);
  });
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        addresses.map(function (address) {
          return cache.add(address).catch(function () {
            // one file failing must not stop the others
          });
        }),
      );
    }),
  );
});
