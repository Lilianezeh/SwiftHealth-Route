// @vitest-environment jsdom
/** Automatic sign-out after no activity. Requirements: NFR-06 (sessions), NFR-10 (accessibility). Spec:
 * specs/2026-10-29-idle-sign-out/. An admin is signed out after 5 minutes without a click, a key or a scroll, any other account after
 * 15 (both limits come from the API: `expires_in` of the login, kept in the session as `idle_seconds`). 60 seconds before, an accessible
 * warning offers "Stay signed in"; then the session is cleared and the person goes to /log-in with a short message. Activity in any open
 * tab counts (a timestamp shared through localStorage). While the person is active the page renews its token (POST /auth/keep-alive).
 * Every name here is fictional.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdleSignOut } from "@/components/layout/IdleSignOut";
import { LAST_ACTIVITY_KEY } from "@/config/idle";
import { readStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

type KeepAliveCall = { token: string | null };

function stubApi(answer: () => Response = () => json({ access_token: "tok-2", token_type: "bearer", expires_in: 300 })) {
  const calls: KeepAliveCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      if (new URL(address).pathname !== "/auth/keep-alive") return json({ detail: "Not found" }, 404);
      calls.push({ token: new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? null });
      return answer();
    }),
  );
  return calls;
}

function loginAs(role: StaffRole, idleSeconds?: number) {
  saveStaffSession({
    token: "tok",
    user: { id: 5, name: "Ada Eze", email: "ada@example.com", phone: null, role, is_active: true },
    ...(idleSeconds === undefined ? {} : { idle_seconds: idleSeconds }),
  });
}

/** Moves the clock by whole seconds, one tick at a time, so the page's own once-a-second check runs each time. */
async function pass(seconds: number) {
  for (let second = 0; second < seconds; second += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

const warning = () => screen.queryByRole("alertdialog");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
  window.sessionStorage.clear();
  window.localStorage.clear();
  replace.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("who is watched", () => {
  it("draws nothing, listens to nothing and calls nothing when nobody is logged in", async () => {
    const calls = stubApi();
    const { container } = render(<IdleSignOut />);

    fireEvent.click(document.body);
    await pass(2000);

    expect(container).toBeEmptyDOMElement();
    expect(calls).toEqual([]);
    expect(replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
  });

  it("uses the limit the API gave at login: 300 seconds for an admin, 900 for an editor", async () => {
    stubApi();
    loginAs("admin", 300);
    const { unmount } = render(<IdleSignOut />);
    await pass(239);
    expect(warning()).toBeNull();
    await pass(1);
    expect(warning()).toBeInTheDocument(); // 60 seconds before 300
    unmount();

    window.localStorage.clear();
    loginAs("editor", 900);
    render(<IdleSignOut />);
    await pass(300);
    expect(warning()).toBeNull(); // the admin's limit means nothing to an editor
    await pass(540);
    expect(warning()).toBeInTheDocument(); // 840 s = 900 - 60
  });

  it.each([
    ["admin", 5 * 60],
    ["editor", 15 * 60],
    ["verifier", 15 * 60],
    ["provider", 15 * 60],
  ] as const)("falls back to the default limit of a %s when the saved session has none (a login from before)", async (role, seconds) => {
    stubApi();
    loginAs(role);
    render(<IdleSignOut />);

    await pass(seconds - 61);
    expect(warning()).toBeNull();
    await pass(1);
    expect(warning()).toBeInTheDocument();
  });
});

describe("the warning", () => {
  it("is an alert dialog that says 'You'll be signed out in 60 seconds', counts down and has a Stay signed in button", async () => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);

    await pass(240);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Are you still there?");
    expect(dialog).toHaveAccessibleDescription("You'll be signed out in 60 seconds");
    expect(screen.getByText("You'll be signed out in 60 seconds")).toBeInTheDocument();
    await pass(1);
    expect(screen.getByText("You'll be signed out in 59 seconds")).toBeInTheDocument();
    await pass(58);
    expect(screen.getByText("You'll be signed out in 1 second")).toBeInTheDocument();
  });

  it("moves the focus to the Stay signed in button, a large target, and the countdown is not read out every second", async () => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);

    await pass(240);

    const button = screen.getByRole("button", { name: "Stay signed in" });
    expect(button).toHaveFocus();
    expect(button.className).toMatch(/min-h-\[50px\]|min-h-12/);
    expect(screen.getByText(/You'll be signed out in/)).toHaveAttribute("aria-live", "off");
  });

  it("Stay signed in closes it, asks for a fresh token at once and starts the whole limit again", async () => {
    const calls = stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);
    await pass(240);

    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    await pass(1);

    expect(warning()).toBeNull();
    expect(calls).toEqual([{ token: "tok" }]);
    expect(readStaffSession()?.token).toBe("tok-2");
    await pass(100); // past the old deadline (300 s): still signed in
    expect(replace).not.toHaveBeenCalled();
    await pass(138);
    expect(warning()).toBeNull(); // 239 s after the click
    await pass(1);
    expect(warning()).toBeInTheDocument(); // 240 s after the click
  });

  it("is not closed by a click, a key or a scroll elsewhere (only the button is a decision)", async () => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);
    await pass(250);

    fireEvent.click(document.body);
    fireEvent.keyDown(document.body, { key: "a" });
    fireEvent.scroll(window);
    await pass(1);

    expect(warning()).toBeInTheDocument();
  });
});

describe("the sign-out", () => {
  it("clears the session and goes to /log-in with the reason when the time is up", async () => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);

    await pass(299);
    expect(replace).not.toHaveBeenCalled();
    await pass(1);

    expect(readStaffSession()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/log-in?signed-out=idle");
    expect(warning()).toBeNull();
  });

  it("signs out at once when the computer was asleep past the limit (it trusts the clock, not a count of ticks)", async () => {
    stubApi();
    loginAs("editor", 900);
    render(<IdleSignOut />);

    vi.setSystemTime(new Date("2026-10-29T12:00:00Z")); // two hours later
    await pass(1);

    expect(readStaffSession()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/log-in?signed-out=idle");
  });

  it("signs out when the API says 401 to the renewal (the server counted the session as idle)", async () => {
    stubApi(() => json({ detail: "Invalid or expired token" }, 401));
    loginAs("editor", 900);
    render(<IdleSignOut />);

    await pass(5);
    fireEvent.click(document.body);
    await pass(1);

    expect(readStaffSession()).toBeNull();
    expect(replace).toHaveBeenCalledWith("/log-in?signed-out=idle");
  });

  it("stays signed in when the renewal fails for another reason (the API asleep, no network)", async () => {
    stubApi(() => json({ detail: "Bad gateway" }, 502));
    loginAs("editor", 900);
    render(<IdleSignOut />);

    await pass(5);
    fireEvent.click(document.body);
    await pass(2);

    expect(readStaffSession()?.token).toBe("tok");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("activity", () => {
  it.each([
    ["a click", () => fireEvent.click(document.body)],
    ["a key", () => fireEvent.keyDown(document.body, { key: "a" })],
    ["a scroll", () => fireEvent.scroll(window)],
    ["a touch", () => fireEvent.touchStart(document.body)],
  ])("%s starts the whole limit again", async (_name, act_) => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);
    await pass(200);

    act_();
    await pass(239);
    expect(warning()).toBeNull(); // without it the warning would have come at 240 s
    await pass(1);
    expect(warning()).toBeInTheDocument(); // 240 s after the activity
  });

  it("counts activity in another tab: they share one timestamp in localStorage", async () => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);
    await pass(200);

    // Another tab of the same browser writes the moment of its last click.
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    await pass(239);
    expect(warning()).toBeNull();
    await pass(1);
    expect(warning()).toBeInTheDocument();
  });

  it("takes the warning away when another tab shows the person is active", async () => {
    stubApi();
    loginAs("admin", 300);
    render(<IdleSignOut />);
    await pass(250);
    expect(warning()).toBeInTheDocument();

    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    await pass(1);

    expect(warning()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("signs out a second tab too, because both read the same idle time", async () => {
    stubApi();
    loginAs("editor", 900);
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - 901_000)); // the other tab saw no one for 901 s
    render(<IdleSignOut />);

    await pass(1);

    expect(replace).toHaveBeenCalledWith("/log-in?signed-out=idle");
  });
});

describe("the renewal (keep-alive)", () => {
  it("asks for a fresh token when the person acts, at most once a minute, and not at all while idle", async () => {
    const calls = stubApi();
    loginAs("editor", 900);
    render(<IdleSignOut />);

    await pass(10);
    expect(calls).toHaveLength(0); // idle: nothing is sent

    fireEvent.click(document.body);
    await pass(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ token: "tok" });

    fireEvent.click(document.body);
    await pass(20);
    expect(calls).toHaveLength(1); // under a minute since the last one

    await pass(45);
    expect(calls).toHaveLength(2); // the click of 20 s ago is sent now, with the token it got before
    expect(calls[1]).toEqual({ token: "tok-2" });

    await pass(300);
    expect(calls).toHaveLength(2); // no new activity, no new call
  });

  it("keeps the new token and the new limit in the session, and the same person", async () => {
    stubApi(() => json({ access_token: "tok-2", token_type: "bearer", expires_in: 420 }));
    loginAs("admin", 300);
    render(<IdleSignOut />);

    await pass(5);
    fireEvent.click(document.body);
    await pass(1);

    const session = readStaffSession();
    expect(session?.token).toBe("tok-2");
    expect(session?.idle_seconds).toBe(420);
    expect(session?.user.name).toBe("Ada Eze");
  });
});

describe("where it lives", () => {
  it("is drawn once by the root layout, so every page of the site is covered", () => {
    expect(readSource("app/layout.tsx")).toMatch(/<IdleSignOut\s*\/>/);
  });

  it("reads the limits from the session and the config, not from numbers in the component", () => {
    const hook = readSource("hooks/useIdleSignOut.ts");
    expect(hook).toContain("@/config/idle");
    expect(hook).not.toMatch(/\b(300|900)\b/);
  });
});
