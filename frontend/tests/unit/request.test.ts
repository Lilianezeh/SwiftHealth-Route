/** Tests for requestJson in lib/api/request.ts. Requirements: US-01, FR-04 (search keeps working while a sleeping API wakes).
 *
 * Decisions 1 and 2 in specs/2026-10-09-search-frontend/requirements.md. Every timing test uses fake timers: nothing here
 * waits for real time. After 5 seconds without an answer the caller is told ("waking up"); after 45 seconds the request
 * stops with a timeout error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_API_URL } from "@/lib/api/client";
import {
  ApiError,
  ApiNetworkError,
  ApiTimeoutError,
  RequestCancelledError,
  requestJson,
} from "@/lib/api/request";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A fetch that answers after `delayMs` (on the fake clock) and fails with an abort error if its signal fires first. */
function fetchAnsweringAfter(delayMs: number, body: unknown = { ok: true }, status = 200) {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(JSON.stringify(body), { status })), delayMs);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  });
}

/** Watches a promise so a rejection is never "unhandled" while the fake clock moves. */
function track<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown } = { settled: false };
  promise.then(
    (value) => {
      state.settled = true;
      state.value = value;
    },
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    },
  );
  return state;
}

describe("requestJson", () => {
  it("returns the parsed answer for a fast API", async () => {
    const fetchStub = fetchAnsweringAfter(0, { items: [], total: 0 });
    vi.stubGlobal("fetch", fetchStub);

    const request = track(requestJson<{ total: number }>("/search?limit=20"));
    await vi.advanceTimersByTimeAsync(0);

    expect(request.value).toEqual({ items: [], total: 0 });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub.mock.calls[0][0]).toBe(`${PUBLIC_API_URL}/search?limit=20`);
  });

  it("asks for JSON and sends no cookies or credentials", async () => {
    const fetchStub = fetchAnsweringAfter(0);
    vi.stubGlobal("fetch", fetchStub);

    track(requestJson("/meta"));
    await vi.advanceTimersByTimeAsync(0);

    const init = fetchStub.mock.calls[0][1] as RequestInit;
    expect(init.headers).toMatchObject({ Accept: "application/json" });
    expect(init.credentials).toBe("omit");
  });

  it("calls onSlow once after 5 seconds and still returns the answer that comes later", async () => {
    const onSlow = vi.fn();
    vi.stubGlobal("fetch", fetchAnsweringAfter(20_000, { total: 3 }));

    const request = track(requestJson<{ total: number }>("/search", { onSlow }));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(onSlow).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(request.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(15_000);
    expect(request.value).toEqual({ total: 3 });
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it("does not call onSlow when the answer comes before 5 seconds", async () => {
    const onSlow = vi.fn();
    vi.stubGlobal("fetch", fetchAnsweringAfter(3_000));

    const request = track(requestJson("/search", { onSlow }));
    await vi.advanceTimersByTimeAsync(3_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(request.settled).toBe(true);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it("gives up after 45 seconds with an ApiTimeoutError and aborts the request", async () => {
    const fetchStub = fetchAnsweringAfter(120_000);
    vi.stubGlobal("fetch", fetchStub);

    const request = track(requestJson("/search"));
    await vi.advanceTimersByTimeAsync(44_999);
    expect(request.settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(request.settled).toBe(true);
    expect(request.error).toBeInstanceOf(ApiTimeoutError);
    const init = fetchStub.mock.calls[0][1] as RequestInit;
    expect(init.signal?.aborted).toBe(true);
  });

  it("honours other limits when the caller sets them", async () => {
    const onSlow = vi.fn();
    vi.stubGlobal("fetch", fetchAnsweringAfter(60_000));

    const request = track(requestJson("/meta", { onSlow, slowAfterMs: 1_000, timeoutMs: 2_000 }));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onSlow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(request.error).toBeInstanceOf(ApiTimeoutError);
  });

  it.each([404, 422, 500, 503])("throws ApiError with the status %i for an error answer", async (status) => {
    vi.stubGlobal("fetch", fetchAnsweringAfter(0, { detail: "no" }, status));

    const request = track(requestJson("/search"));
    await vi.advanceTimersByTimeAsync(0);

    expect(request.error).toBeInstanceOf(ApiError);
    expect((request.error as ApiError).status).toBe(status);
  });

  it("throws ApiNetworkError when fetch itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    const request = track(requestJson("/search"));
    await vi.advanceTimersByTimeAsync(0);

    expect(request.error).toBeInstanceOf(ApiNetworkError);
  });

  it("throws ApiNetworkError when a 200 answer is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>oops</html>", { status: 200 })));

    const request = track(requestJson("/search"));
    await vi.advanceTimersByTimeAsync(0);

    expect(request.error).toBeInstanceOf(ApiNetworkError);
  });

  it("stops waiting when the caller cancels, so a new search can replace the old one", async () => {
    const onSlow = vi.fn();
    const fetchStub = fetchAnsweringAfter(60_000);
    vi.stubGlobal("fetch", fetchStub);
    const controller = new AbortController();

    const request = track(requestJson("/search", { onSlow, signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(2_000);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(request.error).toBeInstanceOf(RequestCancelledError);
    expect((fetchStub.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onSlow).not.toHaveBeenCalled(); // no "waking up" message for a request nobody waits for
  });

  it("does not even start when the caller's signal is already cancelled", async () => {
    const fetchStub = fetchAnsweringAfter(0);
    vi.stubGlobal("fetch", fetchStub);
    const controller = new AbortController();
    controller.abort();

    const request = track(requestJson("/search", { signal: controller.signal }));
    await vi.advanceTimersByTimeAsync(0);

    expect(request.error).toBeInstanceOf(RequestCancelledError);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("leaves no timer running after an answer, an error, a timeout or a cancel", async () => {
    vi.stubGlobal("fetch", fetchAnsweringAfter(0));
    track(requestJson("/a"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);

    vi.stubGlobal("fetch", fetchAnsweringAfter(0, {}, 500));
    track(requestJson("/b"));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);

    vi.stubGlobal("fetch", fetchAnsweringAfter(999_999));
    track(requestJson("/c"));
    await vi.advanceTimersByTimeAsync(45_000);
    expect(vi.getTimerCount()).toBe(0);

    const controller = new AbortController();
    track(requestJson("/d", { signal: controller.signal }));
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never puts a secret or a position into an error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));

    const request = track(requestJson("/search?lat=6.451&lng=7.51"));
    await vi.advanceTimersByTimeAsync(0);

    expect(String((request.error as Error).message)).not.toMatch(/6\.451|7\.51|lat=|lng=/);
  });
});
