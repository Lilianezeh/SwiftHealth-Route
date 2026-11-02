/* The service worker of SwiftHealth Route. Requirements: FR-17, NFR-03 (the emergency page and the blood bank page work offline after
 * one visit; the site can be installed), NFR-07.
 * Spec: specs/2026-10-17-swiftrescue/requirements.md, decision A6; specs/2026-10-22-blood-offline/requirements.md, decision N6;
 * specs/2026-11-02-installable-pwa/ (the whole site registers it; an offline page; updates wait for the visitor).
 * Tests: tests/unit/serviceWorker.test.ts.
 *
 * WHAT IT KEEPS, and nothing else: the pages /emergency and /blood, the files under /_next/static/ (scripts and styles), the two small
 * SwiftRescue photos, and the offline page (/offline.html, kept when the worker is installed). A page is fetched from the network
 * first (so a new version shows at once) and the kept copy is the fallback. The static files and the photos are kept first (their
 * names change with every build, or never).
 * WHAT IT NEVER KEEPS: the pages of people who are logged in (the admin and provider screens, the account, the login and sign-up
 * pages, the payment pages), any page with a query, anything of another site (so no answer of the API, which is another address), a
 * POST, a redirect, or an answer that says it is private or not to be stored. The visitor's position is never in a kept address.
 * Contacts and blood banks for offline use are saved by the page itself, without a position.
 * ANY OTHER PAGE is opened from the network as usual and never kept; when the network fails the offline page is shown instead.
 * UPDATES: a new version does not take over by itself (no skipWaiting at install). It waits, the page shows "A new version is
 * available" and, when the visitor taps Refresh, the page sends "skip-waiting" and reloads. The cache name carries the version, so
 * old files do not stay for ever.
 */
const CACHE_NAME = "swiftrescue-v2";
const CACHE_PREFIX = "swiftrescue-";
const OFFLINE_PAGE = "/offline.html";
const PAGE_PATHS = ["/emergency", "/blood"];
const STATIC_PREFIX = "/_next/static/";
const PHOTO_PATHS = ["/images/emergency/ambulance.webp", "/images/emergency/fire.webp"];
// Pages for people who are logged in, and the payment pages (under /provider). Matched as a whole path or a folder: "/admin" and
// "/admin/anything", not "/administration".
const PRIVATE_PREFIXES = [
  "/admin",
  "/provider",
  "/account",
  "/log-in",
  "/sign-up",
  "/forgot-password",
  "/staff-portal",
  "/list-your-facility",
];

/** True for a path of a private page or anything under it. */
function isPrivatePath(path) {
  return PRIVATE_PREFIXES.some(function (prefix) {
    return path === prefix || path.indexOf(prefix + "/") === 0;
  });
}

/** True for the addresses the worker may keep: this site, no query at all, not private, and the page, the offline page or a static file. */
function isKeepableUrl(address) {
  let url;
  try {
    url = new URL(address);
  } catch (error) {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  if (url.search !== "" || url.searchParams.has("lat") || url.searchParams.has("lng")) return false;
  if (isPrivatePath(url.pathname)) return false;
  return (
    PAGE_PATHS.indexOf(url.pathname) !== -1 ||
    PHOTO_PATHS.indexOf(url.pathname) !== -1 ||
    url.pathname === OFFLINE_PAGE ||
    url.pathname.startsWith(STATIC_PREFIX)
  );
}

/** True for an answer that may be kept: it worked, it is not a redirect, it is from this site, and it does not say "private" or "no-store". */
function isKeepableResponse(response) {
  if (!response || !response.ok || response.redirected) return false;
  if (response.type === "opaque" || response.type === "opaqueredirect" || response.type === "error") return false;
  const rule = response.headers.get("cache-control") || "";
  return !/no-store|private/i.test(rule);
}

async function keepCopy(request, response) {
  if (!isKeepableResponse(response)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function offlinePage() {
  const cache = await caches.open(CACHE_NAME);
  return cache.match(OFFLINE_PAGE);
}

/** SwiftRescue and Find blood: network first, the kept copy when the network fails, the offline page when there is no copy. */
async function pageFromNetworkOrCopy(request) {
  try {
    const response = await fetch(request);
    await keepCopy(request, response);
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const copy = await cache.match(request);
    if (copy) return copy;
    const offline = await offlinePage();
    if (offline) return offline;
    throw error;
  }
}

/** Every other page: from the network as usual, never kept; the offline page when the network fails. */
async function pageOrOfflinePage(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const offline = await offlinePage();
    if (offline) return offline;
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

// The offline page is kept now, so it is there when the network is not. If it cannot be kept the worker does not finish installing
// (the browser tries again later). No skipWaiting: a new version waits until the visitor taps Refresh.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.add(OFFLINE_PAGE);
    }),
  );
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
  if (request.method !== "GET") return; // the browser handles it as usual
  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (url.origin !== self.location.origin) return; // another site, the API included
  if (isKeepableUrl(request.url)) {
    const isPage = PAGE_PATHS.indexOf(url.pathname) !== -1;
    event.respondWith(isPage ? pageFromNetworkOrCopy(request) : staticFromCopyOrNetwork(request));
    return;
  }
  // A page of this site that may not be kept: only when a page is opened (not a file or a call of a page), so the offline page can
  // replace the browser's own error.
  if (request.mode === "navigate") event.respondWith(pageOrOfflinePage(request));
});

/* Messages from the page:
   - "skip-waiting": the visitor tapped Refresh; this new version takes over now.
   - "keep-urls": on the first visit the worker starts after the page has loaded, so it did not see the files. The page sends their
     addresses and the worker keeps those it may keep. */
self.addEventListener("message", function (event) {
  const message = event.data;
  if (!message) return;
  if (message.type === "skip-waiting") {
    self.skipWaiting();
    return;
  }
  if (message.type !== "keep-urls" || !Array.isArray(message.urls)) return;
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
