/** Tests for getHealth() in lib/api/client.ts. Requirement: NFR-05 (a sleeping API must not break the home page). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getHealth } from "../../src/lib/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fetch that never answers on its own and fails only when its abort signal fires, like a sleeping API. */
function slowFetch(_url: string, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });
}

describe("getHealth", () => {
  it("returns the answer when the API is fast", async () => {
    const fastFetch = vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fastFetch);

    expect(await getHealth()).toEqual({ status: "ok" });
  });

  it("returns null when the API answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));

    expect(await getHealth()).toBeNull();
  });

  it("returns null when the API is slow, instead of waiting for it", async () => {
    vi.stubGlobal("fetch", slowFetch);

    const startedAt = Date.now();
    expect(await getHealth(50)).toBeNull();
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it("gives up after 8 seconds by default", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 })));

    await getHealth();

    expect(timeoutSpy).toHaveBeenCalledWith(8000);
  });

  it("returns null when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));

    expect(await getHealth()).toBeNull();
  });
});
