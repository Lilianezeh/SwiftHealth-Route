/** The service worker of SwiftRescue (public/sw.js). Requirements: FR-17, NFR-03, NFR-07, NFR-05.
 * Decision A6 in specs/2026-10-17-swiftrescue/requirements.md. The file is plain JavaScript that runs in the browser's worker;
 * these tests run its source against a fake worker scope, a fake cache and a fake fetch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
const ORIGIN = "https://swifthealth-ng.netlify.app";

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

function loadWorker(initial?: { cachedUrls?: Record<string, string>; networkWorks?: boolean }) {
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
    if (!stores.has("swiftrescue-v1")) stores.set("swiftrescue-v1", new Map());
    stores.get("swiftrescue-v1")?.set(address, new Response(body));
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
  const exported = runInNewContext(`${SOURCE}\n({ isKeepableUrl })`, sandbox) as {
    isKeepableUrl: (address: string) => boolean;
  };
  return { handlers, stores, caches, scope, fetchCalls, isKeepableUrl: exported.isKeepableUrl };
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
  ])("keeps %s", (address) => {
    expect(isKeepableUrl(address)).toBe(true);
  });

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
    ["not an address", "text that is not an address"],
  ])("never keeps %s (%s)", (address) => {
    expect(isKeepableUrl(address)).toBe(false);
  });
});

describe("the fetch handler", () => {
  it("leaves requests it may not keep to the browser: other pages, the API, and every non-GET", async () => {
    const worker = loadWorker();

    expect(await sendRequest(worker, `${ORIGIN}/search?category=pharmacy`)).toBeNull();
    expect(await sendRequest(worker, "https://swifthealth-api.onrender.com/emergency?lat=6.4&lng=7.5")).toBeNull();
    expect(await sendRequest(worker, `${ORIGIN}/emergency`, { method: "POST" })).toBeNull();
    expect(worker.fetchCalls).toEqual([]);
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it("serves the emergency page from the network and keeps a copy", async () => {
    const worker = loadWorker();

    const response = await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(await response?.text()).toBe(`network:${ORIGIN}/emergency`);
    expect(worker.stores.get("swiftrescue-v1")?.has(`${ORIGIN}/emergency`)).toBe(true);
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
    expect(online.stores.get("swiftrescue-v1")?.has(`${ORIGIN}/blood`)).toBe(true);

    const offline = loadWorker({ cachedUrls: { [`${ORIGIN}/blood`]: "saved blood page" }, networkWorks: false });
    const second = await sendRequest(offline, `${ORIGIN}/blood`, { mode: "navigate" });
    expect(await second?.text()).toBe("saved blood page");
  });

  it("leaves Donate blood and a Find blood address with a query to the browser", async () => {
    const worker = loadWorker();

    expect(await sendRequest(worker, `${ORIGIN}/blood/donate`, { mode: "navigate" })).toBeNull();
    expect(await sendRequest(worker, `${ORIGIN}/blood?lat=6.45&lng=7.5`, { mode: "navigate" })).toBeNull();
    expect(worker.fetchCalls).toEqual([]);
  });

  it("with no network and nothing kept, lets the failure through", async () => {
    const worker = loadWorker({ networkWorks: false });

    await expect(sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" })).rejects.toThrow();
  });

  it("does not keep a failed answer of the page", async () => {
    const worker = loadWorker();
    fakeFetch = async () => new Response("down", { status: 503 });

    await sendRequest(worker, `${ORIGIN}/emergency`, { mode: "navigate" });

    expect(worker.stores.get("swiftrescue-v1")?.has(`${ORIGIN}/emergency`) ?? false).toBe(false);
  });

  it("serves a static file from the kept copy first, without going to the network", async () => {
    const address = `${ORIGIN}/_next/static/chunks/main-abc123.js`;
    const worker = loadWorker({ cachedUrls: { [address]: "kept script" } });

    const response = await sendRequest(worker, address);

    expect(await response?.text()).toBe("kept script");
    expect(worker.fetchCalls).toEqual([]);
  });

  it("fetches a static file it does not have yet, and keeps it", async () => {
    const address = `${ORIGIN}/_next/static/chunks/new-def456.js`;
    const worker = loadWorker();

    const response = await sendRequest(worker, address);

    expect(await response?.text()).toBe(`network:${address}`);
    expect(worker.stores.get("swiftrescue-v1")?.has(address)).toBe(true);
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
          "https://swifthealth-api.onrender.com/emergency?lat=6.4&lng=7.5",
          `${ORIGIN}/search?lat=6.4&lng=7.5`,
          42,
        ],
      },
      waitUntil: (promise: Promise<unknown>) => (finished = promise),
    });
    await finished;

    expect([...(worker.stores.get("swiftrescue-v1")?.keys() ?? [])].sort()).toEqual([
      `${ORIGIN}/_next/static/chunks/main-abc123.js`,
      `${ORIGIN}/blood`,
      `${ORIGIN}/emergency`,
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
  });
});

describe("install and activate", () => {
  it("takes over at once, and removes older copies of its own cache only", async () => {
    const worker = loadWorker();
    worker.stores.set("swiftrescue-v0", new Map());
    worker.stores.set("swiftrescue-v1", new Map());
    worker.stores.set("another-app-cache", new Map());
    let finished: Promise<unknown> = Promise.resolve();

    worker.handlers.install({ waitUntil: () => undefined });
    worker.handlers.activate({ waitUntil: (promise: Promise<unknown>) => (finished = promise) });
    await finished;

    expect(worker.scope.skipWaiting).toHaveBeenCalled();
    expect(worker.scope.clients.claim).toHaveBeenCalled();
    expect([...worker.stores.keys()].sort()).toEqual(["another-app-cache", "swiftrescue-v1"]);
  });
});

describe("the file", () => {
  it("never asks for, reads or stores the visitor's position", () => {
    expect(SOURCE).not.toMatch(/geolocation|getCurrentPosition|navigator\.|localStorage|sessionStorage/);
  });

  it("does not write to the console", () => {
    expect(SOURCE).not.toMatch(/console\./);
  });
});
