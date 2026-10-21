/** The staff API calls: the right address, method, body and token for each. Requirements: FR-30 to FR-32, FR-41, NFR-06.
 * Contract: specs/backend/api-spec.md. Nothing about a visitor's position is ever sent.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import * as staff from "@/lib/api/staff";

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const calls: { url: URL; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init: RequestInit) => {
      calls.push({ url: new URL(address), init });
      return new Response("{}");
    }),
  );
  return calls;
}

const headerOf = (init: RequestInit, name: string) => (init.headers as Record<string, string>)[name];

describe("the two login steps", () => {
  it("post the email and password, then the challenge and the code, with no token", async () => {
    const calls = stubFetch();

    await staff.startLogin("ada@example.com", "a-password");
    await staff.verifyLoginCode("challenge.jwt", "482913");

    expect(calls[0].url.pathname).toBe("/auth/login");
    expect(calls[0].init.body).toBe(JSON.stringify({ email: "ada@example.com", password: "a-password" }));
    expect(calls[1].url.pathname).toBe("/auth/verify-code");
    expect(calls[1].init.body).toBe(JSON.stringify({ challenge_token: "challenge.jwt", code: "482913" }));
    expect(headerOf(calls[0].init, "Authorization")).toBeUndefined();
    expect(calls.every((call) => call.url.search === "")).toBe(true); // nothing secret in an address
  });
});

describe("the listing calls carry the token in the header and never in the address", () => {
  it("lists with only the filters that are set", async () => {
    const calls = stubFetch();

    await staff.listStaffListings("tok", { status: "draft", q: "  night ", mine: true, offset: 20 });
    await staff.listStaffListings("tok", {});

    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
      status: "draft", q: "night", mine: "true", limit: "20", offset: "20",
    });
    expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({ limit: "20", offset: "0" });
    expect(headerOf(calls[0].init, "Authorization")).toBe("Bearer tok");
    expect(calls.every((call) => !call.url.href.includes("tok"))).toBe(true);
  });

  it("reads, creates and edits a listing with the right method", async () => {
    const calls = stubFetch();
    const input = {
      name: "Night Pharmacy", category: "pharmacy", area: "GRA", address: "1 Road", landmark: null, latitude: 6.4, longitude: 7.5,
      description: null, is_24_hours: false, phones: [], opening_hours: [], services: [],
    };

    await staff.getStaffListing("tok", 12);
    await staff.createListing("tok", input);
    await staff.updateListing("tok", 12, { name: "Changed" });

    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", "/listings/id/12"],
      ["POST", "/listings"],
      ["PATCH", "/listings/12"],
    ]);
    expect(calls[2].init.body).toBe(JSON.stringify({ name: "Changed" }));
  });

  it("moves a listing with a bodiless POST and hides it with a reason", async () => {
    const calls = stubFetch();

    await staff.moveListing("tok", 12, "submit");
    await staff.moveListing("tok", 12, "publish");
    await staff.moveListing("tok", 12, "reopen");
    await staff.hideListing("tok", 12, "Facility closed");

    expect(calls.map((call) => [call.init.method, call.url.pathname])).toEqual([
      ["POST", "/listings/12/submit"],
      ["POST", "/listings/12/publish"],
      ["POST", "/listings/12/reopen"],
      ["POST", "/listings/12/hide"],
    ]);
    expect(calls[0].init.body).toBeUndefined();
    expect(calls[3].init.body).toBe(JSON.stringify({ reason: "Facility closed" }));
  });

  it("reads and logs checks and asks for an upload signature for the entrances folder", async () => {
    const calls = stubFetch();

    await staff.listChecks("tok", 12);
    await staff.logCheck("tok", 12, { method: "call", result: "pass", person_reached: null, notes: null, photo_url: null });
    await staff.signUpload("tok");

    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", "/listings/12/checks"],
      ["POST", "/listings/12/checks"],
      ["POST", "/uploads/sign"],
    ]);
    expect(calls[2].init.body).toBe(JSON.stringify({ folder: "entrances" }));
  });
});

describe("the staff account calls", () => {
  it("list, create and change with the right method", async () => {
    const calls = stubFetch();

    await staff.listAdminUsers("tok");
    await staff.createAdminUser("tok", { name: "Ada", email: "a@b.co", phone: "0803", role: "verifier", password: "long-enough-pass" });
    await staff.updateAdminUser("tok", 5, { is_active: false });

    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", "/admin/users"],
      ["POST", "/admin/users"],
      ["PATCH", "/admin/users/5"],
    ]);
  });
});
