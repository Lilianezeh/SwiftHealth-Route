// @vitest-environment jsdom
/** The "Install app" button and the iPhone instructions. Requirements: NFR-03 ("installable web app"), NFR-04, NFR-10, NFR-01.
 * Spec: specs/2026-11-02-installable-pwa/; UI spec 2.1 and "Layout". Chrome and Edge on Android, and Chrome on a computer, send the page a
 * `beforeinstallprompt` event; the page keeps it and shows "Install app" (in the Menu, and once, dismissible, on the home page). iPhone
 * Safari has no such event, so it shows "Tap Share, then Add to Home Screen" instead. Nothing is shown when the app is already installed
 * (display-mode: standalone), and nothing in other browsers. The choice to dismiss is kept in localStorage, in a try/catch.
 */
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InstallBanner } from "@/components/pwa/InstallBanner";
import { InstallPromptListener } from "@/components/pwa/InstallPromptListener";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { siteConfig } from "@/config/site";
import {
  isIosSafari,
  isStandalone,
  listenForInstallPrompt,
  promptInstall,
  resetInstallPromptForTests,
} from "@/lib/pwa/installPrompt";
import { BANNER_DISMISSED_KEY } from "@/lib/pwa/installDismissed";

import { readSource } from "../helpers/source";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1";
const IPHONE_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
const IPAD_SAFARI_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC_SAFARI = IPAD_SAFARI_AS_MAC; // the same words; an iPad has a touch screen and a Mac has none
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const DESKTOP_FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0";

const SHARE_WORDS = "Tap Share, then Add to Home Screen";

/** A browser: its words, its touch points, and whether the page is opened as an installed app. */
function useBrowser(options: { userAgent: string; touchPoints?: number; standalone?: boolean; iosStandalone?: boolean }) {
  Object.defineProperty(navigator, "userAgent", { value: options.userAgent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: options.touchPoints ?? 0, configurable: true });
  Object.defineProperty(navigator, "standalone", { value: options.iosStandalone, configurable: true });
  const changeListeners = new Set<() => void>();
  let matches = options.standalone ?? false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("standalone") ? matches : false,
      media: query,
      addEventListener: (_type: string, listener: () => void) => changeListeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => changeListeners.delete(listener),
    })),
  );
  return {
    becomeStandalone() {
      matches = true;
      for (const listener of changeListeners) listener();
    },
  };
}

type FakeInstallEvent = Event & { prompt: ReturnType<typeof vi.fn>; userChoice: Promise<{ outcome: string }> };

/** What Chrome sends: an event with `prompt()` and `userChoice`. */
function sendInstallEvent(outcome: "accepted" | "dismissed" = "accepted"): FakeInstallEvent {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as FakeInstallEvent;
  event.prompt = vi.fn(async () => undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

let stopListening = () => {};

beforeEach(() => {
  resetInstallPromptForTests();
  window.localStorage.clear();
  useBrowser({ userAgent: DESKTOP_FIREFOX });
  stopListening = listenForInstallPrompt();
});
afterEach(() => {
  stopListening();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("who is on an iPhone or iPad in Safari", () => {
  it.each([
    [IPHONE_SAFARI, 5, true],
    [IPAD_SAFARI_AS_MAC, 5, true], // iPadOS 13 and later says it is a Mac, but it has a touch screen
    [MAC_SAFARI, 0, false],
    [IPHONE_CHROME, 5, false], // other browsers on an iPhone: not offered the instructions (the Share menu differs)
    [IPHONE_FIREFOX, 5, false],
    [ANDROID_CHROME, 5, false],
    [DESKTOP_CHROME, 0, false],
    [DESKTOP_FIREFOX, 0, false],
  ])("reads %s with %i touch points as iPhone or iPad Safari: %s", (userAgent, touchPoints, expected) => {
    expect(isIosSafari(userAgent, touchPoints)).toBe(expected);
  });
});

describe("is the app already installed?", () => {
  it("is not, in an ordinary browser window", () => {
    expect(isStandalone()).toBe(false);
  });

  it("is, when the page is opened as an installed app (display-mode: standalone)", () => {
    useBrowser({ userAgent: ANDROID_CHROME, standalone: true });

    expect(isStandalone()).toBe(true);
  });

  it("is, on an iPhone, when the page was opened from the Home Screen (navigator.standalone)", () => {
    useBrowser({ userAgent: IPHONE_SAFARI, touchPoints: 5, iosStandalone: true });

    expect(isStandalone()).toBe(true);
  });

  it("does not fail in a browser that has no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);

    expect(isStandalone()).toBe(false);
  });
});

function MenuOnPhone() {
  return <MobileMenu links={siteConfig.menuLinks} />;
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Menu" }));
  return screen.getByRole("navigation", { name: "Menu links" });
}

describe("in the Menu", () => {
  it("shows nothing in a browser that offers no install, and no iPhone words either", async () => {
    render(<MenuOnPhone />);

    const menu = await openMenu();

    expect(within(menu).queryByRole("button", { name: "Install app" })).toBeNull();
    expect(within(menu).queryByText(new RegExp(SHARE_WORDS))).toBeNull();
  });

  it("shows the button 'Install app' when the browser has sent beforeinstallprompt, and keeps the event so the browser does not show its own bar", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    const event = sendInstallEvent();

    const menu = await openMenu();

    expect(event.defaultPrevented).toBe(true);
    const button = within(menu).getByRole("button", { name: "Install app" });
    expect(button.className).toMatch(/min-h-12/); // 48 px
    expect(button.className).not.toMatch(/text-sm|text-xs/); // 16 px
  });

  it("asks the browser to install when the button is tapped, and closes the Menu", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    const event = sendInstallEvent("accepted");
    const menu = await openMenu();

    await userEvent.click(within(menu).getByRole("button", { name: "Install app" }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("navigation", { name: "Menu links" })).toBeNull();
  });

  it("does not offer it a second time after the browser has used the event (it can be used only once)", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    sendInstallEvent("dismissed");
    const first = await openMenu();
    await userEvent.click(within(first).getByRole("button", { name: "Install app" }));

    const second = await openMenu();

    expect(within(second).queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("shows the iPhone words instead of a button on iPhone Safari: Tap Share, then Add to Home Screen", async () => {
    useBrowser({ userAgent: IPHONE_SAFARI, touchPoints: 5 });
    render(<MenuOnPhone />);

    const menu = await openMenu();

    expect(within(menu).queryByRole("button", { name: "Install app" })).toBeNull();
    expect(within(menu).getByText(new RegExp(SHARE_WORDS))).toBeInTheDocument();
    expect(within(menu).getByText(new RegExp(SHARE_WORDS)).className).not.toMatch(/text-sm|text-xs/);
  });

  it.each([IPHONE_CHROME, IPHONE_FIREFOX])("shows nothing on iPhone in another browser (%s)", async (userAgent) => {
    useBrowser({ userAgent, touchPoints: 5 });
    render(<MenuOnPhone />);

    const menu = await openMenu();

    expect(within(menu).queryByText(new RegExp(SHARE_WORDS))).toBeNull();
  });

  it("hides everything when the app is already installed, even if the browser sent the event", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5, standalone: true });
    render(<MenuOnPhone />);
    sendInstallEvent();

    const menu = await openMenu();

    expect(within(menu).queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("hides the iPhone words when the page was opened from the Home Screen", async () => {
    useBrowser({ userAgent: IPHONE_SAFARI, touchPoints: 5, iosStandalone: true });
    render(<MenuOnPhone />);

    const menu = await openMenu();

    expect(within(menu).queryByText(new RegExp(SHARE_WORDS))).toBeNull();
  });

  it("hides the button at once when the app gets installed while the page is open (appinstalled)", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    sendInstallEvent();
    const menu = await openMenu();
    expect(within(menu).getByRole("button", { name: "Install app" })).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(within(menu).queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("hides the button when the window becomes an installed app (the display mode changes)", async () => {
    const browser = useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    sendInstallEvent();
    const menu = await openMenu();

    act(() => browser.becomeStandalone());

    expect(within(menu).queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("comes after the page links and before the Theme row, and keeps the other rows of the Menu", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    sendInstallEvent();

    const menu = await openMenu();

    const rows = [...menu.querySelectorAll("li")].map((row) => row.textContent ?? "");
    expect(rows[0]).toBe("Find care");
    expect(rows[1]).toBe("For facilities");
    // Whatever else the Menu lists (Log in and so on, which other branches change), the install row is right before the Theme row.
    expect(rows[rows.length - 2]).toContain("Install app");
    expect(rows[rows.length - 1]).toMatch(/Theme|Light|Dark|System/);
  });

  it("is not subject to the home page's dismissal: the Menu offers it even after 'Not now'", async () => {
    window.localStorage.setItem(BANNER_DISMISSED_KEY, "1");
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<MenuOnPhone />);
    sendInstallEvent();

    const menu = await openMenu();

    expect(within(menu).getByRole("button", { name: "Install app" })).toBeInTheDocument();
  });
});

describe("on the home page (the banner)", () => {
  it("shows nothing before the browser says the app can be installed", () => {
    const { container } = render(<InstallBanner />);

    expect(container.textContent).toBe("");
  });

  it("shows a short card with 'Install app' and 'Not now' when it can be installed", () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<InstallBanner />);
    sendInstallEvent();

    const card = screen.getByRole("region", { name: "Install the app" });
    expect(within(card).getByRole("button", { name: "Install app" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Not now" })).toBeInTheDocument();
    for (const button of within(card).getAllByRole("button")) expect(button.className).toMatch(/min-h-\[50px\]/); // 48 px or more
    expect(card.textContent).toContain("SwiftHealth Route");
  });

  it("is in the flow of the page: it does not float over anything (no fixed, sticky or absolute position)", () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<InstallBanner />);
    sendInstallEvent();

    const html = screen.getByRole("region", { name: "Install the app" }).outerHTML;

    expect(html).not.toMatch(/\b(fixed|sticky|absolute)\b/);
  });

  it("is tidy at 320 px: the buttons are in one column, full width, and the text is 16 px or more", () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<InstallBanner />);
    sendInstallEvent();

    const card = screen.getByRole("region", { name: "Install the app" });
    expect(card.innerHTML).toMatch(/\bgrid-cols-1\b/);
    expect(card.innerHTML).not.toMatch(/text-sm|text-xs/);
    expect(card.innerHTML).toMatch(/bg-surface/); // a theme token: Light and Dark both work
    expect(card.innerHTML).not.toMatch(/bg-white|text-black|#[0-9a-f]{3,6}/i);
  });

  it("asks the browser to install when 'Install app' is tapped, then goes away", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<InstallBanner />);
    const event = sendInstallEvent("accepted");

    await userEvent.click(screen.getByRole("button", { name: "Install app" }));

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
  });

  it("goes away on 'Not now' and remembers it in localStorage, so it is not shown again on the next visit", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    const first = render(<InstallBanner />);
    sendInstallEvent();

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
    expect(window.localStorage.getItem(BANNER_DISMISSED_KEY)).toBe("1");
    first.unmount();

    render(<InstallBanner />);
    sendInstallEvent();
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
  });

  it("stores nothing but the one word, and nothing about the visitor", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    render(<InstallBanner />);
    sendInstallEvent();

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(Object.keys(window.localStorage)).toEqual([BANNER_DISMISSED_KEY]);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("still works when localStorage cannot be read or written (a private window, blocked site data)", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5 });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(<InstallBanner />);
    sendInstallEvent();
    expect(screen.getByRole("region", { name: "Install the app" })).toBeInTheDocument(); // not remembered, but shown

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull(); // gone for this visit
  });

  it("shows the iPhone words and 'Not now' on iPhone Safari, with no Install button", async () => {
    useBrowser({ userAgent: IPHONE_SAFARI, touchPoints: 5 });
    render(<InstallBanner />);

    const card = await screen.findByRole("region", { name: "Install the app" });

    expect(within(card).getByText(new RegExp(SHARE_WORDS))).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Install app" })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("region", { name: "Install the app" })).toBeNull();
    expect(window.localStorage.getItem(BANNER_DISMISSED_KEY)).toBe("1");
  });

  it("is hidden when the app is already installed, in every browser", async () => {
    useBrowser({ userAgent: ANDROID_CHROME, touchPoints: 5, standalone: true });
    const { container } = render(<InstallBanner />);
    sendInstallEvent();

    expect(container.textContent).toBe("");
  });

  it("is hidden in a browser that cannot install", () => {
    useBrowser({ userAgent: DESKTOP_FIREFOX });
    const { container } = render(<InstallBanner />);

    expect(container.textContent).toBe("");
  });
});

describe("the listener", () => {
  it("is started by a small client part that draws nothing", () => {
    const { container } = render(<InstallPromptListener />);

    expect(container.textContent).toBe("");
    expect(readSource("components/pwa/InstallPromptListener.tsx")).toMatch(/^"use client";/);
  });

  it("removes its listeners when it stops, so a stopped page cannot keep the event", async () => {
    stopListening();
    stopListening = () => {};

    sendInstallEvent();

    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("says 'unavailable' when there is nothing to ask the browser", async () => {
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("returns what the person chose: accepted or dismissed", async () => {
    sendInstallEvent("dismissed");

    await expect(promptInstall()).resolves.toBe("dismissed");
  });
});

describe("the files", () => {
  it("never read, store or send anything about the visitor: no position, no cookie, no network call", () => {
    for (const file of [
      "lib/pwa/installPrompt.ts",
      "lib/pwa/installDismissed.ts",
      "components/pwa/InstallBanner.tsx",
      "components/pwa/InstallMenuItem.tsx",
      "components/pwa/InstallPromptListener.tsx",
    ]) {
      expect(readSource(file), file).not.toMatch(/geolocation|document\.cookie|sessionStorage|fetch\(|console\.|analytics/i);
    }
  });

  it("only touches localStorage in the one file that remembers the dismissal, and always in a try/catch", () => {
    const dismissal = readSource("lib/pwa/installDismissed.ts");

    expect(dismissal).toMatch(/localStorage/);
    expect(dismissal.match(/try\s*\{/g)?.length ?? 0).toBeGreaterThanOrEqual(2); // one for reading, one for writing
    for (const file of ["lib/pwa/installPrompt.ts", "components/pwa/InstallBanner.tsx", "components/pwa/InstallMenuItem.tsx"]) {
      expect(readSource(file), file).not.toMatch(/localStorage/);
    }
  });
});
