/** What the site may offer for installing it. Requirements: NFR-03 ("installable web app"), NFR-04, NFR-10. Spec: specs/2026-11-02-installable-pwa/.
 * Chrome and Edge (Android and computers) send the page a `beforeinstallprompt` event when the site can be installed; the page keeps it
 * (and stops the browser's own bar, so there is one clear button) and calls `prompt()` when the visitor taps "Install app". The event can
 * be used once. iPhone and iPad Safari send nothing and have no such call: the visitor is told how, in words ("Tap Share, then Add to
 * Home Screen"). When the app is already installed (opened in display-mode standalone, or from the Home Screen on iPhone) nothing is
 * offered. Other browsers get nothing. One store for the whole page, so the Menu and the home page agree. Nothing is stored in the
 * browser and nothing is sent anywhere.
 */
import { useSyncExternalStore } from "react";

export type InstallOffer = "prompt" | "ios" | "none";
export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/** The event of Chrome and Edge. It is not in TypeScript's own list of events. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const STANDALONE_QUERY = "(display-mode: standalone)";

let deferred: InstallEvent | null = null;
let installed = false;
const subscribers = new Set<() => void>();

function notify() {
  for (const subscriber of subscribers) subscriber();
}

/** iPhone, iPad (which says it is a Mac since iPadOS 13, but has a touch screen) and iPod, in Safari: not in another browser on it,
 * where the Share menu is not the same. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const isAppleTouchDevice = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
  return isAppleTouchDevice && !isOtherBrowser && /Safari/.test(userAgent);
}

/** True when the page is open as an installed app: in a window of its own (display-mode: standalone), or from the iPhone Home Screen. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return typeof window.matchMedia === "function" && window.matchMedia(STANDALONE_QUERY).matches;
}

function currentOffer(): InstallOffer {
  if (installed || isStandalone()) return "none";
  if (deferred) return "prompt";
  if (isIosSafari(window.navigator.userAgent, window.navigator.maxTouchPoints ?? 0)) return "ios";
  return "none";
}

/** Starts listening for the browser's install event, and for "the app was installed". Returns the function that stops it. Called once
 * per page by a small client part (components/pwa/InstallPromptListener.tsx). */
export function listenForInstallPrompt(): () => void {
  const onPrompt = (event: Event) => {
    event.preventDefault(); // no second, browser-made bar: the page's own button is the one way
    deferred = event as InstallEvent;
    notify();
  };
  const onInstalled = () => {
    installed = true;
    deferred = null;
    notify();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

/** Shows the browser's install dialog. The event is used up by this: the offer goes away at once. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "dismissed";
  }
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  // The window can become an installed app while the page is open (the visitor installs it from the browser's own menu).
  const media = typeof window.matchMedia === "function" ? window.matchMedia(STANDALONE_QUERY) : null;
  media?.addEventListener?.("change", callback);
  return () => {
    subscribers.delete(callback);
    media?.removeEventListener?.("change", callback);
  };
}

/** What to offer right now: "prompt" (a button), "ios" (the instructions) or "none". The server and the first draw say "none". */
export function useInstallOffer(): InstallOffer {
  return useSyncExternalStore(subscribe, currentOffer, () => "none");
}

/** For tests: forget the event and the installed state. */
export function resetInstallPromptForTests(): void {
  deferred = null;
  installed = false;
  subscribers.clear();
}
