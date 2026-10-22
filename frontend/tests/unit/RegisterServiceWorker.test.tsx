// @vitest-environment jsdom
/** Registering the service worker on SwiftRescue. Requirements: FR-17, NFR-03. Decision A6 in specs/2026-10-17-swiftrescue/requirements.md.
 * Only in a production build (a development server's file names change all the time), only on /emergency, and the worker is told
 * which files this first visit loaded so it keeps them at once.
 */
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";
import { RegisterServiceWorker } from "@/components/offline/RegisterServiceWorker";

import { stubApi } from "../helpers/api";
import { readSource } from "../helpers/source";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
});

function stubServiceWorker(options: { registerFails?: boolean } = {}) {
  const postMessage = vi.fn();
  const register = vi.fn(async () => {
    if (options.registerFails) throw new Error("not allowed");
    return {};
  });
  const ready = Promise.resolve({ active: { postMessage } });
  Object.defineProperty(navigator, "serviceWorker", { value: { register, ready }, configurable: true });
  return { register, postMessage };
}

describe("RegisterServiceWorker", () => {
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

  it("tells the worker which files of this site the first visit loaded, and this page's own address", async () => {
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

  it("a failed registration is not an error for the visitor", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { register } = stubServiceWorker({ registerFails: true });

    expect(() => render(<RegisterServiceWorker />)).not.toThrow();
    await waitFor(() => expect(register).toHaveBeenCalled());
  });

  it("is on the SwiftRescue page", () => {
    stubApi({});

    expect(readSource("app/(public)/emergency/page.tsx")).toMatch(/RegisterServiceWorker/);
    expect(readSource("components/offline/RegisterServiceWorker.tsx")).toMatch(/["']use client["']/);
    render(<EmergencyPage />); // renders without a service worker
  });

  it("tells the worker the address of the page it is on: /blood on Find blood", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { postMessage } = stubServiceWorker();
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([] as unknown as PerformanceEntryList);

    render(<RegisterServiceWorker pagePath="/blood" />);

    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));
    const message = postMessage.mock.calls[0][0] as { urls: string[] };
    expect(message.urls).toContain(`${window.location.origin}/blood`);
    expect(message.urls).not.toContain(`${window.location.origin}/emergency`);
  });

  it("is on the Find blood page too, and only on pages that can be kept", () => {
    expect(readSource("app/(public)/blood/page.tsx")).toMatch(/<RegisterServiceWorker pagePath="\/blood" \/>/);
    expect(readSource("app/(public)/blood/donate/page.tsx")).not.toMatch(/RegisterServiceWorker/); // N1: Donate blood is not kept
  });
});

describe("the hosting settings for the worker file (netlify.toml)", () => {
  it("serves /sw.js so that the browser always checks for a new version", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const settings = readFileSync(join(process.cwd(), "..", "netlify.toml"), "utf8");

    expect(settings).toMatch(/for\s*=\s*"\/sw\.js"/);
    expect(settings).toMatch(/Cache-Control\s*=\s*"public, max-age=0, must-revalidate"/);
  });
});
