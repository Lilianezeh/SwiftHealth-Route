/** Tests for getMeta in lib/api/meta.ts. Requirements: FR-03, FR-05 (the area, category and service lists).
 *
 * The lists change rarely, so they are fetched once per page session and kept in memory.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMeta, resetMetaCache } from "@/lib/api/meta";
import type { MetaResponse } from "@/types/api";

const META: MetaResponse = {
  areas: ["Independence Layout", "New Haven"],
  categories: [{ slug: "pharmacy", name: "Pharmacy", is_emergency: false }],
  services: ["Consultation", "X-ray"],
  blood_groups: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
  report_reasons: ["not_working", "wrong_number", "closed", "moved", "wrong_hours", "other"],
  service_catalogue: ["Consultation", "X-ray"],
};

beforeEach(() => {
  resetMetaCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMeta", () => {
  it("returns the five lists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(META), { status: 200 })));

    const meta = await getMeta();

    expect(Object.keys(meta).sort()).toEqual(["areas", "blood_groups", "categories", "report_reasons", "services"]);
    expect(meta.categories[0]).toEqual({ slug: "pharmacy", name: "Pharmacy", is_emergency: false });
  });

  it("is fetched once and kept in memory", async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify(META), { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);

    const [first, second] = await Promise.all([getMeta(), getMeta()]);
    const third = await getMeta();

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(third).toBe(first);
  });

  it("asks the /meta address of the API", async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify(META), { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);

    await getMeta();

    expect(new URL((fetchStub.mock.calls[0] as unknown as [string])[0]).pathname).toBe("/meta");
  });

  it("does not keep a failure: the next call tries again", async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(META), { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);

    await expect(getMeta()).rejects.toThrow();
    const meta = await getMeta();

    expect(meta.areas).toHaveLength(2);
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });
});
