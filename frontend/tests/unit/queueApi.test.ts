/** The report queue, dashboard and re-check calls: the right address, method, body and token. Requirements: US-11, US-12,
 * FR-34, FR-35, NFR-06. Contract: specs/backend/api-spec.md, sections 5, 6 and 10 ("Phase 11 rules").
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

describe("GET /reports", () => {
  it("asks for one status and one page, with the token in the header only", async () => {
    const calls = stubFetch();

    await staff.listReports("tok", "resolved", { limit: 20, offset: 40 });

    expect(calls[0].url.pathname).toBe("/reports");
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ status: "resolved", limit: "20", offset: "40" });
    expect(headerOf(calls[0].init, "Authorization")).toBe("Bearer tok");
    expect(calls[0].url.href).not.toContain("tok");
  });
});

describe("PATCH /reports/{id}", () => {
  it.each(["resolved", "dismissed"] as const)("sends %s as a PATCH with the token", async (status) => {
    const calls = stubFetch();

    await staff.closeReport("tok", 88, status);

    expect(calls[0].url.pathname).toBe("/reports/88");
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].init.body).toBe(JSON.stringify({ status }));
    expect(headerOf(calls[0].init, "Authorization")).toBe("Bearer tok");
  });
});

describe("GET /dashboard/stats", () => {
  it("is one call with the token and no query", async () => {
    const calls = stubFetch();

    await staff.getDashboardStats("tok");

    expect(calls[0].url.pathname).toBe("/dashboard/stats");
    expect(calls[0].url.search).toBe("");
    expect(headerOf(calls[0].init, "Authorization")).toBe("Bearer tok");
  });
});

describe("GET /listings?due=", () => {
  it("sends the due filter with the other filters", async () => {
    const calls = stubFetch();

    await staff.listStaffListings("tok", { due: "this_week" });
    await staff.listStaffListings("tok", { due: "overdue", offset: 20 });

    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({ due: "this_week", limit: "20", offset: "0" });
    expect(Object.fromEntries(calls[1].url.searchParams)).toEqual({ due: "overdue", limit: "20", offset: "20" });
  });
});
