/** Tests for getListing in lib/api/listing.ts. Requirements: FR-09, US-06, NFR-07. Spec: specs/2026-10-13-listing-page/requirements.md D8 and D9.
 * The contract is specs/backend/api-spec.md, "GET /listings/{slug}": 200 with the listing, 404 for an unknown or unpublished slug.
 * The request holds no query string at all: the visitor's position is never sent, so `distance_km` stays null.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getListing } from "@/lib/api/listing";
import { ApiError, ApiNetworkError } from "@/lib/api/request";

import { makeListing } from "../helpers/listing";

let requestedUrls: URL[];

function answerWith(status: number, body: unknown = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requestedUrls.push(new URL(url));
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => {
  requestedUrls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getListing", () => {
  it("asks for /listings/<slug> and returns the listing", async () => {
    const listing = makeListing();
    answerWith(200, listing);

    await expect(getListing("night-pharmacy-a")).resolves.toEqual(listing);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0].pathname).toBe("/listings/night-pharmacy-a");
  });

  it("sends no query string at all: no lat, no lng, no limit", async () => {
    answerWith(200, makeListing());

    await getListing("night-pharmacy-a");

    expect(requestedUrls[0].search).toBe("");
    expect(requestedUrls[0].hash).toBe("");
  });

  it("encodes the slug, so it cannot add a query or another path", async () => {
    answerWith(200, makeListing());

    await getListing("a/b?lat=6.45&lng=7.5#x");

    expect(requestedUrls[0].pathname).toBe("/listings/a%2Fb%3Flat%3D6.45%26lng%3D7.5%23x");
    expect(requestedUrls[0].search).toBe("");
  });

  it("gives null for a 404: an unknown slug, or a listing that is not published (the page then says 'Listing not found')", async () => {
    answerWith(404, { detail: "Listing not found" });

    await expect(getListing("no-such-place")).resolves.toBeNull();
  });

  it("throws the usual errors for anything else, so the page can offer Retry", async () => {
    answerWith(500);
    await expect(getListing("night-pharmacy-a")).rejects.toMatchObject({ name: "ApiError", status: 500 });
    await expect(getListing("night-pharmacy-a")).rejects.toBeInstanceOf(ApiError);

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(getListing("night-pharmacy-a")).rejects.toBeInstanceOf(ApiNetworkError);
  });

  it("tells the caller when the answer is slow (the 'waking up' notice), like the search does", async () => {
    vi.useFakeTimers();
    const onSlow = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(makeListing()))), 8_000))),
    );

    const pending = getListing("night-pharmacy-a", { onSlow });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onSlow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(pending).resolves.toMatchObject({ slug: "night-pharmacy-a" });
    vi.useRealTimers();
  });
});
