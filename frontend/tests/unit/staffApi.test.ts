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

describe("the authenticator app calls (FR-58)", () => {
  it("send the password and the codes in the body, the token in the header, and nothing secret in an address", async () => {
    const calls = stubFetch();

    await staff.getTwoFactorStatus("tok");
    await staff.startTwoFactorSetup("tok", "my-password");
    await staff.confirmTwoFactorSetup("tok", "482913");
    await staff.disableTwoFactor("tok", "my-password", "482913");
    await staff.renewBackupCodes("tok", "my-password", "ABCDE23456");
    await staff.askForSmsInstead("app.challenge.jwt");

    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", "/account/two-factor"],
      ["POST", "/account/two-factor/start"],
      ["POST", "/account/two-factor/confirm"],
      ["POST", "/account/two-factor/disable"],
      ["POST", "/account/two-factor/backup-codes"],
      ["POST", "/auth/use-sms"],
    ]);
    expect(calls[1].init.body).toBe(JSON.stringify({ password: "my-password" }));
    expect(calls[2].init.body).toBe(JSON.stringify({ code: "482913" }));
    expect(calls[3].init.body).toBe(JSON.stringify({ password: "my-password", code: "482913" }));
    expect(calls[4].init.body).toBe(JSON.stringify({ password: "my-password", code: "ABCDE23456" }));
    expect(calls[5].init.body).toBe(JSON.stringify({ challenge_token: "app.challenge.jwt" }));
    for (const call of calls.slice(0, 5)) expect(headerOf(call.init, "Authorization")).toBe("Bearer tok");
    expect(headerOf(calls[5].init, "Authorization")).toBeUndefined();
    expect(calls.every((call) => call.url.search === "")).toBe(true);
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

describe("the account list with filters (accounts phase 4a and 4b)", () => {
  it("sends only the filters that were given, with the API's own names, and the page", async () => {
    const calls = stubFetch();

    await staff.listAdminUsers("tok", { approval_status: "pending", limit: 200 });
    await staff.listAdminUsers("tok", { role: "editor", is_active: false, q: "  okafor ", limit: 50, offset: 100 });

    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ approval_status: "pending", limit: "200" });
    expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({
      role: "editor", is_active: "false", q: "okafor", limit: "50", offset: "100",
    });
    expect(calls.every((call) => headerOf(call.init, "Authorization") === "Bearer tok")).toBe(true);
  });

  it("sends no filter at all when none is given (the API's own page of 100)", async () => {
    const calls = stubFetch();

    await staff.listAdminUsers("tok");

    expect(calls[0].url.search).toBe("");
  });
});

describe("the account decisions (accounts phase 4a and 4b)", () => {
  it("post to the right address with the right body and the token, nothing secret in an address", async () => {
    const calls = stubFetch();

    await staff.approveAdminUser("tok", 7, "editor");
    await staff.rejectAdminUser("tok", 7, "Not known to us.");
    await staff.rejectAdminUser("tok", 8);
    await staff.suspendAdminUser("tok", 9, "Left the team.");
    await staff.reactivateAdminUser("tok", 9);
    await staff.confirmPhoneByCall("tok", 7);

    expect(calls.map((call) => [call.init.method, call.url.pathname])).toEqual([
      ["POST", "/admin/users/7/approve"],
      ["POST", "/admin/users/7/reject"],
      ["POST", "/admin/users/8/reject"],
      ["POST", "/admin/users/9/suspend"],
      ["POST", "/admin/users/9/reactivate"],
      ["POST", "/admin/users/7/confirm-phone-by-call"],
    ]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ role: "editor" });
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ reason: "Not known to us." });
    expect(JSON.parse(String(calls[2].init.body))).toEqual({}); // no reason: an empty body, not a missing one
    expect(JSON.parse(String(calls[3].init.body))).toEqual({ reason: "Left the team." });
    expect(calls.every((call) => call.url.search === "")).toBe(true);
    expect(calls.every((call) => headerOf(call.init, "Authorization") === "Bearer tok")).toBe(true);
  });
});

describe("the owner link calls (accounts phase 6)", () => {
  it("list the queue, then approve with the note and reject with or without one, token in the header only", async () => {
    const calls = stubFetch();

    await staff.listOwnerRequests("tok");
    await staff.approveOwnerRequest("tok", 4, "Mrs Eze, the matron");
    await staff.rejectOwnerRequest("tok", 4, "Nobody knew them");
    await staff.rejectOwnerRequest("tok", 5);

    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", "/staff/owner-requests"],
      ["POST", "/staff/owner-requests/4/approve"],
      ["POST", "/staff/owner-requests/4/reject"],
      ["POST", "/staff/owner-requests/5/reject"],
    ]);
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ note: "Mrs Eze, the matron" });
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ note: "Nobody knew them" });
    expect(JSON.parse(String(calls[3].init.body))).toEqual({});
    expect(calls.every((call) => call.url.search === "")).toBe(true);
    expect(calls.every((call) => headerOf(call.init, "Authorization") === "Bearer tok")).toBe(true);
  });

  it("list my facilities and read or change one of them by its id", async () => {
    const calls = stubFetch();
    const provider = await import("@/lib/api/provider");

    await provider.listMyFacilities("tok");
    await provider.getProviderListing("tok", {}, 12);
    await provider.updateProviderListing("tok", { description: "New." }, {}, 12);
    await provider.getProviderListing("tok");

    expect(calls.map((call) => [call.init.method ?? "GET", call.url.pathname])).toEqual([
      ["GET", "/provider/listings"],
      ["GET", "/provider/listings/12"],
      ["PATCH", "/provider/listings/12"],
      ["GET", "/provider/listing"],
    ]);
  });
});

describe("the activity log call (accounts phase 4a and 4b)", () => {
  it("sends the filters under the API's names and a page", async () => {
    const calls = stubFetch();

    await staff.listActivity("tok", { user_id: 3, action: "user_approve", from: "2026-10-01", to: "2026-10-26", limit: 50, offset: 50 });
    await staff.listActivity("tok", {});

    expect(calls[0].url.pathname).toBe("/admin/activity");
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
      user_id: "3", action: "user_approve", from: "2026-10-01", to: "2026-10-26", limit: "50", offset: "50",
    });
    expect(calls[1].url.search).toBe("");
    expect(headerOf(calls[0].init, "Authorization")).toBe("Bearer tok");
  });
});
