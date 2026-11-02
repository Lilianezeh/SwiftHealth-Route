/** The service worker of SwiftRescue (public/sw.js). Requirements: FR-17, NFR-03, NFR-07, NFR-05.
 * Decision A6 in specs/2026-10-17-swiftrescue/requirements.md; specs/2026-11-02-installable-pwa/ (the site is installable: an offline
 * page for every other page, never a private page or an answer with personal data, and an update that waits for the visitor).
 * The file is plain JavaScript that runs in the browser's worker; these tests run its source against a fake worker scope, a fake
 * cache and a fake fetch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://swifthealth-ng.netlify.app";
const CACHE = "swiftrescue-v2";
const OFFLINE_PAGE = "/offline.html";
// The pages of people who are logged in, and the payment pages: never kept, whatever the network does.
const PRIVATE_PAGES = [
  "/admin",
  "/admin/listings",
  "/admin/owner-requests",
  "/provider",
  "/provider/edit",
  "/provider/featured",
  "/provider/payment-complete",
  "/provider/fee-complete",
  "/account",
  "/log-in",
  "/sign-up",
  "/sign-up/confirm",
  "/forgot-password",
  "/staff-portal",
  "/list-your-facility",
];

type Handler = (event: Record<string, unknown>) => void;

/** A fake cache that holds Response objects by URL (the whole address, as a string). */
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const open = vi.fn(async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name) as Map<string, Response>;
    return {
      match: async (request: Request | string) => store.get(typeof request === "string" ? request : request.url)?.clone(),
      put: async (request: Request | string, response: Response) => {
        store.set(typeof request === "string" ? request : request.url, response);
      },
      add: async (address: string) => {
        const response = await fakeFetch(address);
        if (!response.ok) throw new Error("not ok");
        store.set(address, response);
      },
    };
  });
  const keys = vi.fn(async () => [...stores.keys()]);
  const remove = vi.fn(async (name: string) => stores.delete(name));
  return { stores, caches: { open, keys, delete: remove } };
}

let fakeFetch: (input: Request | string) => Promise<Response> = async () => new Response("network", { status: 200 });

function loadWorker(initial?: { cachedUrls?: Record<string, string>; networkWorks?: boolean; withOfflinePage?: boolean }) {
  const handlers: Record<string, Handler> = {};
  const { stores, caches } = fakeCaches();
  const fetchCalls: string[] = [];
  const networkWorks = initial?.networkWorks ?? true;
  fakeFetch = async (input) => {
    const address = typeof input === "string" ? input : input.url;
    fetchCalls.push(address);
    if (!networkWorks) throw new TypeError("Failed to fetch");
    return new Response(`network:${address}`, { status: 200 });
  };
  for (const [address, body] of Object.entries(initial?.cachedUrls ?? {})) {
    if (!stores.has(CACHE)) stores.set(CACHE, new Map());
    stores.get(CACHE)?.set(address, new Response(body));
  }
  if (initial?.withOfflinePage !== false) {
    // What the install step keeps: the offline page. (Tests of the install step itself pass withOfflinePage: false.)
    if (!stores.has(CACHE)) stores.set(CACHE, new Map());
    stores.get(CACHE)?.set(OFFLINE_PAGE, new Response("the offline page"));
  }
  const scope = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
  };
  // The worker's own file, run in a separate context that has only what a worker scope offers (node:vm).
  const sandbox = { self: scope, caches, fetch: (input: Request | string) => fakeFetch(input), URL, Response };
  const exported = runInNewContext(`${SOURCE}\n({ isKeepableUrl, isPrivatePath })`, sandbox) as {
    isKeepableUrl: (address: string) => boolean;
    isPrivatePath: (path: string) => boolean;
  };
  return {
    handlers,
    stores,
    caches,
    scope,
    fetchCalls,
    isKeepableUrl: exported.isKeepableUrl,
    isPrivatePath: exported.isPrivatePath,
  };
}

/** Runs the fetch handler. Returns the response if the worker answered, or null if it left the request alone. */
async function sendRequest(
  worker: ReturnType<typeof loadWorker>,
  address: string,
  options: { method?: string; mode?: string } = {},
): Promise<Response | null> {
  let answer: Promise<Response> | null = null;
  const request = { url: address, method: options.method ?? "GET", mode: options.mode ?? "no-cors" } as Request;
  worker.handlers.fetch({ request, respondWith: (promise: Promise<Response>) => (answer = promise) });
  return answer ? await answer : null;
}

describe("what the worker may keep", () => {
  const { isKeepableUrl } = loadWorker();

  it.each([
    `${ORIGIN}/emergency`,
    `${ORIGIN}/blood`, // Find blood works offline too (feature blood-offline, N1)
    `${ORIGIN}/_next/static/chunks/main-abc123.js`,
    `${ORIGIN}/_next/static/css/app.css`,
    `${ORIGIN}/images/emergency/ambulance.webp`, // the two SwiftRescue photos (home-photos feature, part 6)
    `${ORIGIN}/images/emergency/fire.webp`,
    `${ORIGIN}${OFFLINE_PAGE}`, // the offline page, kept when the worker is installed
  ])("keeps %s", (address) => {
    expect(isKeepableUrl(address)).toBe(true);
  });

  it.each(PRIVATE_PAGES)("never keeps the private page %s, nor anything under it", (path) => {
    expect(isKeepableUrl(`${ORIGIN}${path}`)).toBe(false);
    expect(isKeepableUrl(`${ORIGIN}${path}/something`)).toBe(false);
    expect(isKeepableUrl(`${ORIGIN}${path}?next=/provider`)).toBe(false);
  });

  it.each(PRIVATE_PAGES)("names %s as a private path", (path) => {
    const { isPrivatePath } = loadWorker();

    expect(isPrivatePath(path)).toBe(true);
    expect(isPrivatePath(`${path}/deeper/page`)).toBe(true);
  });

  it.each(["/", "/find", "/search", "/emergency", "/blood", "/for-facilities", "/listing/night-pharmacy", "/administration-of-care"])(
    "does not name the public page %s as private (a path counts whole: /admin is private, /administration-of-care is not)",
    (path) => {
      const { isPrivatePath } = loadWorker();

      expect(isPrivatePath(path)).toBe(false);
    },
  );

  it.each([
    [`${ORIGIN}/search?category=pharmacy`, "another page"],
    [`${ORIGIN}/listing/night-pharmacy`, "a listing page"],
    [`${ORIGIN}/`, "the home page"],
    [`${ORIGIN}/emergency?lat=6.45&lng=7.5`, "the emergency page with a position in the address"],
    [`${ORIGIN}/_next/static/chunks/a.js?lat=6.45&lng=7.5`, "a file with a position in the address"],
    [`${ORIGIN}/emergency?x=1`, "the emergency page with a query"],
    ["https://swifthealth-api.onrender.com/emergency", "the API (another origin)"],
    ["https://swifthealth-api.onrender.com/emergency?lat=6.4&lng=7.5", "the API with a position"],
    [`${ORIGIN}/emergency/other`, "a page under the emergency path"],
    [`${ORIGIN}/blood/donate`, "Donate blood (not kept, N1)"],
    [`${ORIGIN}/blood?lat=6.45&lng=7.5`, "Find blood with a position in the address"],
    [`${ORIGIN}/blood?blood_group=O%2B`, "Find blood with a query"],
    [`${ORIGIN}/blood/`, "a page under the blood path"],
    ["https://swifthealth-api.onrender.com/blood/banks?lat=6.4&lng=7.5", "the blood bank answers of the API (another origin)"],
    [`${ORIGIN}/_next/data/build/emergency.json`, "Next's data files"],
    [`${ORIGIN}/images/emergency/other.webp`, "any other file of the emergency image folder"],
    [`${ORIGIN}/images/emergency/`, "the emergency image folder"],
    [`${ORIGIN}/images/emergency/ambulance.webp?lat=6.4&lng=7.5`, "a photo with a position in the address"],
    [`${ORIGIN}/images/emergency/ambulance.webp?x=1`, "a photo with a query"],
    [`${ORIGIN}/images/sections/laboratory-800.webp`, "a photo of the home page (not needed offline)"],
    [`${ORIGIN}/images/home/hero3.webp`, "the hero photo"],
    ["https://example.com/images/emergency/fire.webp", "the same path on another site"],
    ["not an address", "text that is not an address"],
  ])("never keeps %s (%s)", (address) => {
    expect(isKeepableUrl(address)).toBe(false);
  });
});

describe("the fetch handler", () => {
  it("leaves requests it may not keep to the browser: other pages, the API, and every non-GET", async () => {
    const worker = loadWorker();

    // None of these is a page load (mode "navigate"): a file or a call of the page. The browser handles them as usual.
    expect(await sendRequest(worker, `${ORIGIN}/search?category=pharmacy`)).toBeNull();
    expect(await sendRequest(worker, "https://swifthealth-api.onrender.com/emergency?lat=6.4&lng=7.5")).toBeNull();
    expect(await sendRequest(worker, "https://swifthealth-api.onrender.com/provider/listings")).toBeNull();
    expect(await sendRequest(worker, `${ORIGIN}/emergency`, { method: "POST" })).toBeNull();
    expect(await sendRequest(worker, `${ORIGIN}/admin`, { method: "POST", mode: "navigate" })).toBeNull();
    expect(worker.fetchCalls).toEqual([]);
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it("serves the emergency page from the network and keeps a copy", async () => {
    const worker = loadWorker();

    const response = await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(await response?.text()).toBe(`network:${ORIGIN}/emergency`);
    expect(worker.stores.get(CACHE)?.has(`${ORIGIN}/emergency`)).toBe(true);
  });

  it("serves the emergency page from the kept copy when the network fails", async () => {
    const worker = loadWorker({ cachedUrls: { [`${ORIGIN}/emergency`]: "saved page" }, networkWorks: false });

    const response = await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(await response?.text()).toBe("saved page");
  });

  it("serves Find blood from the network and keeps a copy, and from the kept copy when the network fails", async () => {
    const online = loadWorker();
    const first = await sendRequest(online, `${ORIGIN}/blood`, { mode: "navigate" });
    expect(await first?.text()).toBe(`network:${ORIGIN}/blood`);
    expect(online.stores.get(CACHE)?.has(`${ORIGIN}/blood`)).toBe(true);

    const offline = loadWorker({ cachedUrls: { [`${ORIGIN}/blood`]: "saved blood page" }, networkWorks: false });
    const second = await sendRequest(offline, `${ORIGIN}/blood`, { mode: "navigate" });
    expect(await second?.text()).toBe("saved blood page");
  });

  it("does not keep a failed answer of the page", async () => {
    const worker = loadWorker();
    fakeFetch = async () => new Response("down", { status: 503 });

    await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(worker.stores.get(CACHE)?.has(`${ORIGIN}/emergency`) ?? false).toBe(false);
  });

  it("does not keep an answer that says it is private or not to be stored, or one that came by a redirect", async () => {
    for (const headers of [{ "cache-control": "no-store" }, { "cache-control": "private, max-age=0" }]) {
      const worker = loadWorker();
      fakeFetch = async () => new Response("page", { status: 200, headers });

      await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

      expect(worker.stores.get(CACHE)?.has(`${ORIGIN}/emergency`) ?? false).toBe(false);
    }
    const redirected = loadWorker();
    const answer = new Response("page", { status: 200 });
    Object.defineProperty(answer, "redirected", { value: true });
    fakeFetch = async () => answer;

    await sendRequest(redirected, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(redirected.stores.get(CACHE)?.has(`${ORIGIN}/emergency`) ?? false).toBe(false);
  });
});

describe("the other pages and the offline page", () => {
  it("opens another page from the network as usual, and keeps nothing of it", async () => {
    const worker = loadWorker();

    const response = await sendRequest(worker, `${ORIGIN}/for-facilities`, { mode: "navigate" });

    expect(await response?.text()).toBe(`network:${ORIGIN}/for-facilities`);
    expect([...(worker.stores.get(CACHE)?.keys() ?? [])]).toEqual([OFFLINE_PAGE]); // only the offline page is in the cache
  });

  it("shows the offline page when another page cannot be reached", async () => {
    const worker = loadWorker({ networkWorks: false });

    for (const address of [`${ORIGIN}/`, `${ORIGIN}/find`, `${ORIGIN}/search?category=pharmacy`, `${ORIGIN}/listing/night-pharmacy`]) {
      const response = await sendRequest(worker, address, { mode: "navigate" });

      expect(await response?.text(), address).toBe("the offline page");
    }
  });

  it("shows the offline page, not a browser error, for Donate blood and for Find blood with a query", async () => {
    const worker = loadWorker({ networkWorks: false });

    expect(await (await sendRequest(worker, `${ORIGIN}/blood/donate`, { mode: "navigate" }))?.text()).toBe("the offline page");
    expect(await (await sendRequest(worker, `${ORIGIN}/blood?lat=6.45&lng=7.5`, { mode: "navigate" }))?.text()).toBe(
      "the offline page",
    );
  });

  it("shows the offline page, and not a kept copy, for SwiftRescue when nothing was kept yet", async () => {
    const worker = loadWorker({ networkWorks: false });

    const response = await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(await response?.text()).toBe("the offline page");
  });

  it.each(PRIVATE_PAGES)("passes the private page %s to the network and keeps nothing of it, online or not", async (path) => {
    const online = loadWorker();
    const answer = await sendRequest(online, `${ORIGIN}${path}`, { mode: "navigate" });
    expect(await answer?.text()).toBe(`network:${ORIGIN}${path}`);
    expect([...(online.stores.get(CACHE)?.keys() ?? [])]).toEqual([OFFLINE_PAGE]);

    const offline = loadWorker({ networkWorks: false });
    const none = await sendRequest(offline, `${ORIGIN}${path}`, { mode: "navigate" });
    expect(await none?.text()).toBe("the offline page"); // a page for people who are logged in is never served from a copy
    expect([...(offline.stores.get(CACHE)?.keys() ?? [])]).toEqual([OFFLINE_PAGE]);
  });

  it("does not serve a private page from the cache even if a copy of it somehow is there", async () => {
    const worker = loadWorker({ cachedUrls: { [`${ORIGIN}/admin`]: "a copy that must not exist" }, networkWorks: false });

    const response = await sendRequest(worker, `${ORIGIN}/admin`, { mode: "navigate" });

    expect(await response?.text()).toBe("the offline page");
  });

  it("lets the failure through when there is no network and the offline page was never kept", async () => {
    const worker = loadWorker({ networkWorks: false, withOfflinePage: false });

    await expect(sendRequest(worker, `${ORIGIN}/find`, { mode: "navigate" })).rejects.toThrow();
  });

  it("never keeps, serves or asks the network for the API, whatever the page does", async () => {
    const worker = loadWorker({ networkWorks: false });

    for (const address of [
      "https://swifthealth-api.onrender.com/auth/me",
      "https://swifthealth-api.onrender.com/provider/listings",
      "https://swifthealth-api.onrender.com/payments/owner-fee",
      "https://swifthealth-api.onrender.com/search",
    ]) {
      expect(await sendRequest(worker, address)).toBeNull();
      expect(await sendRequest(worker, address, { mode: "cors" })).toBeNull();
    }
    expect(worker.fetchCalls).toEqual([]);
  });
});

describe("the files it keeps first", () => {
  it("serves a static file from the kept copy first, without going to the network", async () => {
    const address = `${ORIGIN}/_next/static/chunks/main-abc123.js`;
    const worker = loadWorker({ cachedUrls: { [address]: "kept script" } });

    const response = await sendRequest(worker, address);

    expect(await response?.text()).toBe("kept script");
    expect(worker.fetchCalls).toEqual([]);
  });

  it("serves a SwiftRescue photo from the kept copy first (cache first), and keeps one it did not have yet", async () => {
    const kept = `${ORIGIN}/images/emergency/ambulance.webp`;
    const fresh = `${ORIGIN}/images/emergency/fire.webp`;
    const worker = loadWorker({ cachedUrls: { [kept]: "kept photo" } });

    const fromCopy = await sendRequest(worker, kept);
    expect(await fromCopy?.text()).toBe("kept photo");
    expect(worker.fetchCalls).toEqual([]);

    const fromNetwork = await sendRequest(worker, fresh);
    expect(await fromNetwork?.text()).toBe(`network:${fresh}`);
    expect(worker.stores.get(CACHE)?.has(fresh)).toBe(true);
  });

  it("fetches a static file it does not have yet, and keeps it", async () => {
    const address = `${ORIGIN}/_next/static/chunks/new-def456.js`;
    const worker = loadWorker();

    const response = await sendRequest(worker, address);

    expect(await response?.text()).toBe(`network:${address}`);
    expect(worker.stores.get(CACHE)?.has(address)).toBe(true);
  });
});

describe("the message from the page: keep what you loaded on the first visit", () => {
  it("keeps the files that may be kept and ignores the rest", async () => {
    const worker = loadWorker();
    let finished: Promise<unknown> = Promise.resolve();

    worker.handlers.message({
      data: {
        type: "keep-urls",
        urls: [
          `${ORIGIN}/emergency`,
          `${ORIGIN}/blood`,
          `${ORIGIN}/blood/donate`,
          `${ORIGIN}/_next/static/chunks/main-abc123.js`,
          `${ORIGIN}/images/emergency/fire.webp`,
          `${ORIGIN}/images/sections/laboratory-800.webp`,
          "https://swifthealth-api.onrender.com/emergency?lat=6.4&lng=7.5",
          `${ORIGIN}/search?lat=6.4&lng=7.5`,
          42,
        ],
      },
      waitUntil: (promise: Promise<unknown>) => (finished = promise),
    });
    await finished;

    expect([...(worker.stores.get(CACHE)?.keys() ?? [])].sort()).toEqual([
      OFFLINE_PAGE, // kept when the worker was installed
      `${ORIGIN}/_next/static/chunks/main-abc123.js`,
      `${ORIGIN}/blood`,
      `${ORIGIN}/emergency`,
      `${ORIGIN}/images/emergency/fire.webp`,
    ]);
  });

  it("ignores any other message, and a message with no list", async () => {
    const worker = loadWorker();
    const waitUntil = vi.fn();

    worker.handlers.message({ data: { type: "something-else", urls: [`${ORIGIN}/emergency`] }, waitUntil });
    worker.handlers.message({ data: { type: "keep-urls" }, waitUntil });
    worker.handlers.message({ data: "hello", waitUntil });

    expect(waitUntil).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
    expect(worker.scope.skipWaiting).not.toHaveBeenCalled();
  });

  it("never keeps a private page it is asked to keep", async () => {
    const worker = loadWorker();
    let finished: Promise<unknown> = Promise.resolve();

    worker.handlers.message({
      data: { type: "keep-urls", urls: PRIVATE_PAGES.map((path) => `${ORIGIN}${path}`) },
      waitUntil: (promise: Promise<unknown>) => (finished = promise),
    });
    await finished;

    expect([...(worker.stores.get(CACHE)?.keys() ?? [])]).toEqual([OFFLINE_PAGE]);
  });
});

describe("install, update and activate", () => {
  it("keeps the offline page when it is installed, and waits for the visitor before it takes over (no skipWaiting of its own)", async () => {
    const worker = loadWorker({ withOfflinePage: false });
    let finished: Promise<unknown> = Promise.resolve();

    worker.handlers.install({ waitUntil: (promise: Promise<unknown>) => (finished = promise) });
    await finished;

    expect([...(worker.stores.get(CACHE)?.keys() ?? [])]).toEqual([OFFLINE_PAGE]);
    expect(worker.scope.skipWaiting).not.toHaveBeenCalled(); // a new version waits until the visitor taps Refresh
  });

  it("does not finish installing when the offline page cannot be kept, so a worker without it never takes over", async () => {
    const worker = loadWorker({ withOfflinePage: false, networkWorks: false });
    let finished: Promise<unknown> = Promise.resolve();

    worker.handlers.install({ waitUntil: (promise: Promise<unknown>) => (finished = promise) });

    await expect(finished).rejects.toThrow();
  });

  it("takes over when the page tells it to (the visitor tapped Refresh), and only then", async () => {
    const worker = loadWorker();

    worker.handlers.message({ data: { type: "skip-waiting" }, waitUntil: vi.fn() });

    expect(worker.scope.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("ignores a skip-waiting that is not exactly that message", () => {
    const worker = loadWorker();

    worker.handlers.message({ data: { type: "skip-waiting-please" }, waitUntil: vi.fn() });
    worker.handlers.message({ data: "skip-waiting", waitUntil: vi.fn() });

    expect(worker.scope.skipWaiting).not.toHaveBeenCalled();
  });

  it("claims the open pages when it activates, and removes older copies of its own cache only", async () => {
    const worker = loadWorker();
    worker.stores.set("swiftrescue-v0", new Map());
    worker.stores.set("swiftrescue-v1", new Map()); // the cache of the old worker: its pages and files go with it
    worker.stores.set("another-app-cache", new Map());
    let finished: Promise<unknown> = Promise.resolve();

    worker.handlers.activate({ waitUntil: (promise: Promise<unknown>) => (finished = promise) });
    await finished;

    expect(worker.scope.clients.claim).toHaveBeenCalled();
    expect([...worker.stores.keys()].sort()).toEqual(["another-app-cache", CACHE]);
  });

  it("uses a cache name that changes with the version, so that old files do not stay for ever", () => {
    expect(SOURCE).toMatch(/const CACHE_NAME = "swiftrescue-v2"/);
    expect(SOURCE).toMatch(/const CACHE_PREFIX = "swiftrescue-"/);
  });
});

describe("the file", () => {
  it("never asks for, reads or stores the visitor's position", () => {
    expect(SOURCE).not.toMatch(/geolocation|getCurrentPosition|navigator\.|localStorage|sessionStorage/);
  });

  it("does not look at, keep or send a cookie, a token or an Authorization header", () => {
    expect(SOURCE).not.toMatch(/cookie|authorization|token|credentials/i);
  });

  it("does not write to the console", () => {
    expect(SOURCE).not.toMatch(/console\./);
  });
});
