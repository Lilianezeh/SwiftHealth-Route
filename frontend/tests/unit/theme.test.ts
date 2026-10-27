// @vitest-environment jsdom
/** The theme choice (Light, Dark, System) and the few lines of script that apply it before the first paint.
 * Requirements: NFR-10, NFR-07 (the choice is the only thing kept, and only in the browser). Spec: ui-spec "Dark mode".
 */
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_CHOICES, THEME_KEY, applyTheme, nextChoice, readChoice, resolveTheme, saveChoice } from "@/lib/theme/theme";
import { THEME_SCRIPT } from "@/lib/theme/themeScript";

type Listener = () => void;

const windows = () => [window, document.defaultView as Window];

/** A fake `matchMedia` that says whether the system is dark and lets a test change its mind. */
function fakeSystem(startsDark: boolean) {
  let dark = startsDark;
  const listeners = new Set<Listener>();
  // Set on the jsdom window itself (`document.defaultView`): the inline script runs inside it and would not see a stub that is only on
  // Node's global, which is what the code of the app (`lib/theme/theme.ts`) reads. Both get the same fake.
  const value = vi.fn(() => ({
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }));
  for (const target of windows()) Object.defineProperty(target, "matchMedia", { configurable: true, writable: true, value });
  return {
    change(nowDark: boolean) {
      dark = nowDark;
      listeners.forEach((listener) => listener());
    },
  };
}

const theme = () => document.documentElement.getAttribute("data-theme");

/** Runs the script in a sandbox that has only the `window` and `document` that the page gives it (the page's storage, the fake system
 * setting, the real html element). A script that throws would make this throw. */
function runScript(): void {
  const sandbox = {
    window: { matchMedia: (window as unknown as { matchMedia?: unknown }).matchMedia, localStorage: window.localStorage },
    document: { documentElement: document.documentElement },
  };
  runInNewContext(THEME_SCRIPT, sandbox);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});
afterEach(() => {
  for (const target of windows()) Reflect.deleteProperty(target, "matchMedia");
  vi.unstubAllGlobals();
});

describe("the choice", () => {
  it("goes Light, Dark, System, and back to Light", () => {
    expect(THEME_CHOICES).toEqual(["light", "dark", "system"]);
    expect(nextChoice("light")).toBe("dark");
    expect(nextChoice("dark")).toBe("system");
    expect(nextChoice("system")).toBe("light");
  });

  it("is Light when nothing is kept (the default for everyone, whatever the device says), and what is kept otherwise", () => {
    expect(readChoice()).toBe("light");
    window.localStorage.setItem(THEME_KEY, "dark");
    expect(readChoice()).toBe("dark");
    window.localStorage.setItem(THEME_KEY, "system");
    expect(readChoice()).toBe("system");
    window.localStorage.setItem(THEME_KEY, "light");
    expect(readChoice()).toBe("light");
  });

  it("is Light when what is kept is anything else", () => {
    for (const value of ["", "blue", "System", "DARK", "1", "{}"]) {
      window.localStorage.setItem(THEME_KEY, value);
      expect(readChoice(), value).toBe("light");
    }
  });

  it("keeps each of the three choices under one key (System too, or it could not be told from never having chosen)", () => {
    for (const choice of THEME_CHOICES) {
      saveChoice(choice);
      expect(window.localStorage.getItem(THEME_KEY), choice).toBe(choice);
      expect(window.localStorage.length).toBe(1);
    }
    expect(THEME_KEY).toBe("swifthealth.theme");
  });

  it("copes with a browser whose storage throws (private mode): it reads Light and keeps nothing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readChoice()).toBe("light");
    expect(() => saveChoice("dark")).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("the theme the page gets", () => {
  it("is the choice, or the system's when the choice is System", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("is put on the html element by applyTheme, and follows the system for System", () => {
    fakeSystem(true);
    applyTheme("system");
    expect(theme()).toBe("dark");
    applyTheme("light");
    expect(theme()).toBe("light");
    applyTheme("dark");
    expect(theme()).toBe("dark");
  });
});

describe("the script in the head (no flash)", () => {
  it("is short, plain and has no outside address", () => {
    expect(THEME_SCRIPT.length).toBeLessThan(700);
    expect(THEME_SCRIPT).not.toMatch(/https?:|fetch|XMLHttpRequest|document\.cookie|eval\(|import\(/);
    expect(THEME_SCRIPT).toContain(THEME_KEY);
  });

  it("is Light on a dark device when nothing is chosen: the site starts in Light until the owner approves the dark mode", () => {
    fakeSystem(true);
    runScript();
    expect(theme()).toBe("light");
  });

  it("is Light on a light device when nothing is chosen", () => {
    fakeSystem(false);
    runScript();
    expect(theme()).toBe("light");
  });

  it("follows the device only when System was chosen", () => {
    window.localStorage.setItem(THEME_KEY, "system");
    fakeSystem(true);
    runScript();
    expect(theme()).toBe("dark");

    fakeSystem(false);
    runScript();
    expect(theme()).toBe("light");
  });

  it("uses the kept choice over the device", () => {
    fakeSystem(true);
    window.localStorage.setItem(THEME_KEY, "light");
    runScript();
    expect(theme()).toBe("light");

    fakeSystem(false);
    window.localStorage.setItem(THEME_KEY, "dark");
    runScript();
    expect(theme()).toBe("dark");
  });

  it("ignores a kept value that is not light, dark or system: Light, even on a dark device", () => {
    fakeSystem(true);
    window.localStorage.setItem(THEME_KEY, "purple");
    runScript();
    expect(theme()).toBe("light");
  });

  it("follows the system while the choice is System, and stops following when Light or Dark is chosen", () => {
    const system = fakeSystem(false);
    window.localStorage.setItem(THEME_KEY, "system");
    runScript();
    expect(theme()).toBe("light");

    system.change(true);
    expect(theme()).toBe("dark");

    window.localStorage.setItem(THEME_KEY, "light");
    system.change(false);
    system.change(true);
    expect(theme()).toBe("light");
  });

  it("sets the same theme as applyTheme for every choice and every system", () => {
    for (const choice of THEME_CHOICES) {
      for (const systemDark of [true, false]) {
        window.localStorage.clear();
        window.localStorage.setItem(THEME_KEY, choice);
        fakeSystem(systemDark);
        runScript();
        const fromScript = theme();
        applyTheme(choice);
        expect(theme(), `${choice} / system dark: ${systemDark}`).toBe(fromScript);
      }
    }
  });

  it("does not throw when storage or matchMedia is missing", () => {
    for (const target of windows()) Reflect.deleteProperty(target, "matchMedia");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(runScript).not.toThrow();
    vi.restoreAllMocks();
  });
});
