// @vitest-environment jsdom
/** Registering the service worker on every public page, and the "new version" message. Requirements: FR-17, NFR-03, NFR-04, NFR-10.
 * Decision A6 in specs/2026-10-17-swiftrescue/requirements.md; specs/2026-11-02-installable-pwa/.
 * Only in a production build (a development server's file names change all the time). The worker is told which files this visit loaded
 * when the page is SwiftRescue or Find blood (the pages it keeps). When a new version of the worker is waiting, the page shows
 * "A new version is available — Refresh" instead of keeping old files for ever; Refresh makes the new worker take over and reloads.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterServiceWorker } from "@/components/offline/RegisterServiceWorker";

import { readSource } from "../helpers/source";

const route = { pathname: "/emergency" };
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
const reloadPage = vi.fn();
vi.mock("@/lib/pwa/reloadPage", () => ({ reloadPage: () => reloadPage() }));

const NOTICE = "A new version is available — Refresh";

beforeEach(() => {
  route.pathname = "/emergency";
  reloadPage.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
});

type Listener = () => void;

/** A browser's service worker container, with the registration it gives back. `waiting` is a worker of a new version that is waiting;
 * `controlled` says whether this page is already under the control of a worker (false on the very first visit). */
function stubServiceWorker(options: { registerFails?: boolean; waiting?: boolean; controlled?: boolean } = {}) {
  const postMessage = vi.fn();
  const waitingPostMessage = vi.fn();
  const containerListeners = new Map<string, Listener[]>();
  const registrationListeners = new Map<string, Listener[]>();
  const installingListeners = new Map<string, Listener[]>();
  const installing = {
    state: "installing",
    postMessage: vi.fn(),
    addEventListener: (type: string, listener: Listener) => installingListeners.set(type, [...(installingListeners.get(type) ?? []), listener]),
  };
  const registration = {
    active: { postMessage },
    waiting: options.waiting ? { postMessage: waitingPostMessage } : null,
    installing: null as typeof installing | null,
    update: vi.fn(async () => undefined),
    addEventListener: (type: string, listener: Listener) => registrationListeners.set(type, [...(registrationListeners.get(type) ?? []), listener]),
  };
  const register = vi.fn(async () => {
    if (options.registerFails) throw new Error("not allowed");
    return registration;
  });
  const container = {
    register,
    ready: Promise.resolve(registration),
    controller: options.controlled === false ? null : {},
    addEventListener: (type: string, listener: Listener) => containerListeners.set(type, [...(containerListeners.get(type) ?? []), listener]),
    removeEventListener: (type: string, listener: Listener) =>
      containerListeners.set(type, (containerListeners.get(type) ?? []).filter((candidate) => candidate !== listener)),
  };
  Object.defineProperty(navigator, "serviceWorker", { value: container, configurable: true });
  return {
    register,
    postMessage,
    waitingPostMessage,
    registration,
    /** The browser found a new worker file and starts installing it; later it says "installed" (and it waits). */
    foundNewWorker() {
      registration.installing = installing;
      act(() => {
        for (const listener of registrationListeners.get("updatefound") ?? []) listener();
      });
    },
    finishInstallingNewWorker() {
      installing.state = "installed";
      act(() => {
        for (const listener of installingListeners.get("statechange") ?? []) listener();
      });
    },
    takeOver() {
      act(() => {
        for (const listener of containerListeners.get("controllerchange") ?? []) listener();
      });
    },
  };
}

describe("registering", () => {
  it("registers /sw.js with the scope / in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { register } = stubServiceWorker();

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }));
  });

  it("does nothing in development and in tests", () => {
    const { register } = stubServiceWorker();

    render(<RegisterServiceWorker />);

    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing when the browser has no service workers", () => {
    vi.stubEnv("NODE_ENV", "production");
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });

    expect(() => render(<RegisterServiceWorker />)).not.toThrow();
  });

  it("registers on every public page, whatever its address (not only SwiftRescue)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const pathname of ["/", "/find", "/search", "/listing/night-pharmacy", "/for-facilities", "/blood/donate"]) {
      route.pathname = pathname;
      const { register } = stubServiceWorker();
      const { unmount } = render(<RegisterServiceWorker />);

      await waitFor(() => expect(register, pathname).toHaveBeenCalledTimes(1));
      unmount();
    }
  });

  it("a failed registration is not an error for the visitor", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { register } = stubServiceWorker({ registerFails: true });

    expect(() => render(<RegisterServiceWorker />)).not.toThrow();
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("telling the worker what to keep (SwiftRescue and Find blood only)", () => {
  it("sends the files of this site that the visit loaded, and the page's own address, on SwiftRescue", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { postMessage } = stubServiceWorker();
    const origin = window.location.origin;
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { name: `${origin}/_next/static/chunks/main-abc.js` },
      { name: "https://swifthealth-api.onrender.com/emergency" },
    ] as unknown as PerformanceEntryList);

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const message = postMessage.mock.calls[0][0] as { type: string; urls: string[] };
    expect(message.type).toBe("keep-urls");
    expect(message.urls).toContain(`${origin}/_next/static/chunks/main-abc.js`);
    expect(message.urls).toContain(`${origin}/emergency`);
    expect(message.urls.some((address) => address.includes("onrender.com"))).toBe(false); // another site's address is never sent
  });

  it("on SwiftRescue also asks the worker to keep the two small photos, which are lazy and may not have loaded yet", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { postMessage } = stubServiceWorker();
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([] as unknown as PerformanceEntryList);

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const message = postMessage.mock.calls[0][0] as { urls: string[] };
    const origin = window.location.origin;
    expect(message.urls).toContain(`${origin}/images/emergency/ambulance.webp`);
    expect(message.urls).toContain(`${origin}/images/emergency/fire.webp`);
  });

  it("on Find blood sends /blood, and no photos", async () => {
    vi.stubEnv("NODE_ENV", "production");
    route.pathname = "/blood";
    const { postMessage } = stubServiceWorker();
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([] as unknown as PerformanceEntryList);

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const message = postMessage.mock.calls[0][0] as { urls: string[] };
    expect(message.urls).toContain(`${window.location.origin}/blood`);
    expect(message.urls).not.toContain(`${window.location.origin}/emergency`);
    expect(message.urls.some((address) => address.includes("/images/"))).toBe(false);
  });

  it.each(["/", "/find", "/search", "/for-facilities", "/blood/donate", "/listing/night-pharmacy"])(
    "sends nothing on %s: the worker keeps only the two pages and their files",
    async (pathname) => {
      vi.stubEnv("NODE_ENV", "production");
      route.pathname = pathname;
      const { register, postMessage } = stubServiceWorker();

      render(<RegisterServiceWorker />);

      await waitFor(() => expect(register).toHaveBeenCalled());
      await Promise.resolve();
      expect(postMessage).not.toHaveBeenCalled();
    },
  );
});

describe("the message about a new version", () => {
  it("shows nothing when there is no new version, and nothing on the very first visit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorker({ controlled: false });

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(navigator.serviceWorker.register).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows 'A new version is available — Refresh' when a new worker is already waiting at the start", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorker({ waiting: true });

    render(<RegisterServiceWorker />);

    expect(await screen.findByRole("status")).toHaveTextContent(NOTICE);
  });

  it("shows it when a new worker is found while the page is open, once it has finished installing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const browser = stubServiceWorker();
    render(<RegisterServiceWorker />);
    await waitFor(() => expect(browser.register).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole("status")).toBeNull();

    browser.foundNewWorker();
    expect(screen.queryByRole("status")).toBeNull(); // still installing
    browser.finishInstallingNewWorker();

    expect(await screen.findByRole("status")).toHaveTextContent(NOTICE);
  });

  it("does not show it for the worker of the very first visit that finishes installing (nothing old to replace)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const browser = stubServiceWorker({ controlled: false });
    render(<RegisterServiceWorker />);
    await waitFor(() => expect(browser.register).toHaveBeenCalled());
    await Promise.resolve();

    browser.foundNewWorker();
    browser.finishInstallingNewWorker();

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tells the waiting worker to take over when Refresh is tapped, and reloads once it has", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const browser = stubServiceWorker({ waiting: true });
    render(<RegisterServiceWorker />);
    await screen.findByRole("status");

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(browser.waitingPostMessage).toHaveBeenCalledWith({ type: "skip-waiting" });
    expect(reloadPage).not.toHaveBeenCalled(); // not before the new worker has taken over
    browser.takeOver();
    expect(reloadPage).toHaveBeenCalledTimes(1);
    browser.takeOver();
    expect(reloadPage).toHaveBeenCalledTimes(1); // once, never in a loop
  });

  it("does not reload when the page was not asked to (another tab's Refresh must not reload this page in the middle of a form)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const browser = stubServiceWorker({ waiting: true });
    render(<RegisterServiceWorker />);
    await screen.findByRole("status");

    browser.takeOver();

    expect(reloadPage).not.toHaveBeenCalled();
  });

  it("goes away on 'Later' and comes back at the next page load, not before", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorker({ waiting: true });
    const first = render(<RegisterServiceWorker />);
    await screen.findByRole("status");

    await userEvent.click(screen.getByRole("button", { name: "Later" }));

    expect(screen.queryByRole("status")).toBeNull();
    first.unmount();
    render(<RegisterServiceWorker />);
    expect(await screen.findByRole("status")).toHaveTextContent(NOTICE);
  });

  it("is a polite status message with two buttons of 48 px or more, 16 px text, and theme colours, under the content", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorker({ waiting: true });
    render(<RegisterServiceWorker />);

    const notice = await screen.findByRole("status");

    expect(notice).toHaveAttribute("aria-live", "polite");
    for (const name of ["Refresh", "Later"]) {
      const button = screen.getByRole("button", { name });
      expect(button.className, name).toMatch(/min-h-12|min-h-\[50px\]/);
      expect(button.className, name).not.toMatch(/text-sm|text-xs/);
    }
    expect(notice.outerHTML).not.toMatch(/text-sm|text-xs/);
    expect(notice.outerHTML).toMatch(/bg-surface|bg-pine/); // theme tokens: Light and Dark follow the theme
    expect(notice.outerHTML).not.toMatch(/bg-white|text-black|#[0-9a-f]{3,6}/i);
  });

  it("is tidy at 320 px: it is as wide as the screen minus its margin, and its buttons are in one column on a phone", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorker({ waiting: true });
    render(<RegisterServiceWorker />);

    const notice = await screen.findByRole("status");

    expect(notice.className).toMatch(/\binset-x-3\b|\bleft-3\b/);
    expect(notice.className).toMatch(/\bmax-w-/);
    expect(notice.outerHTML).toMatch(/\bgrid-cols-1\b/);
  });

  it("does not cover the header or the SwiftRescue button: it sits at the bottom, below the content", async () => {
    vi.stubEnv("NODE_ENV", "production");
    stubServiceWorker({ waiting: true });
    render(<RegisterServiceWorker />);

    const notice = await screen.findByRole("status");

    expect(notice.className).toMatch(/\bbottom-3\b|\bbottom-0\b/);
    expect(notice.className).not.toMatch(/\btop-/);
    expect(notice.className).toMatch(/\bz-(10|20|30)\b/);
  });

  it("asks the browser to look for a new version when the visitor comes back to the page", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const browser = stubServiceWorker();
    render(<RegisterServiceWorker />);
    await waitFor(() => expect(browser.register).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    browser.registration.update.mockClear();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(browser.registration.update).toHaveBeenCalledTimes(1));
  });
});

describe("the files", () => {
  it("is mounted by the two layouts of the public pages and not by the dashboards", () => {
    expect(readSource("app/(home)/layout.tsx")).toMatch(/<PublicPwa \/>/);
    expect(readSource("app/(public)/layout.tsx")).toMatch(/<PublicPwa \/>/);
    expect(readSource("app/(dashboards)/layout.tsx")).not.toMatch(/PublicPwa|RegisterServiceWorker/);
    expect(readSource("components/pwa/PublicPwa.tsx")).toMatch(/RegisterServiceWorker/);
    expect(readSource("components/pwa/PublicPwa.tsx")).toMatch(/InstallPromptListener/);
  });

  it("is no longer placed by hand on SwiftRescue and Find blood: the layouts do it for every page", () => {
    expect(readSource("app/(public)/emergency/page.tsx")).not.toMatch(/RegisterServiceWorker/);
    expect(readSource("app/(public)/blood/page.tsx")).not.toMatch(/RegisterServiceWorker/);
  });

  it("is a client part that reads nothing of the visitor and calls no API", () => {
    const source = readSource("components/offline/RegisterServiceWorker.tsx");

    expect(source).toMatch(/^"use client";/);
    expect(source).not.toMatch(/geolocation|document\.cookie|localStorage|sessionStorage|fetch\(|lib\/api/);
  });
});

describe("the hosting settings (netlify.toml)", () => {
  async function settings() {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    return readFileSync(join(process.cwd(), "..", "netlify.toml"), "utf8");
  }

  it("serves /sw.js so that the browser always checks for a new version", async () => {
    expect(await settings()).toMatch(/for\s*=\s*"\/sw\.js"[\s\S]*?Cache-Control\s*=\s*"public, max-age=0, must-revalidate"/);
  });

  it("serves the offline page and the manifest the same way, so an old copy never outlives a new version", async () => {
    const text = await settings();

    expect(text).toMatch(/for\s*=\s*"\/offline\.html"[\s\S]*?Cache-Control\s*=\s*"public, max-age=0, must-revalidate"/);
    expect(text).toMatch(/for\s*=\s*"\/manifest\.webmanifest"[\s\S]*?Cache-Control\s*=\s*"public, max-age=0, must-revalidate"/);
  });
});
