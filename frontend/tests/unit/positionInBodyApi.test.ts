/** The blood and emergency calls: the visitor's position goes in the body of a POST, never in the address. Requirements: US-04, US-15,
 * US-16, FR-14, FR-27, FR-28, NFR-07. Spec: specs/2026-11-01-position-in-body-blood-emergency/; api-spec, "POST /blood/banks",
 * "POST /blood/donation-centres", "POST /emergency". Without a position each call is the plain GET it always was (the offline copy and the
 * service worker depend on that).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBloodBanks, getDonationCentres } from "@/lib/api/blood";
import { getEmergency } from "@/lib/api/emergency";

import { json } from "../helpers/api";

const POSITION = { latitude: 6.45212, longitude: 7.50987 };

function stubFetch() {
  const fetchStub = vi.fn(async () => json({ items: [], total: 0, groups: [] }));
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

function asked(fetchStub: ReturnType<typeof stubFetch>) {
  const [address, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit | undefined];
  return { url: new URL(address), method: init?.method ?? "GET", body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined };
}

afterEach(() => vi.unstubAllGlobals());

describe("without a position: the plain GET", () => {
  it("blood banks keep the group, limit and offset in the address", async () => {
    const fetchStub = stubFetch();

    await getBloodBanks("O+", null, { limit: 20, offset: 40 });

    const { url, method, body } = asked(fetchStub);
    expect(method).toBe("GET");
    expect(url.pathname).toBe("/blood/banks");
    expect(Object.fromEntries(url.searchParams)).toEqual({ blood_group: "O+", limit: "20", offset: "40" });
    expect(body).toBeUndefined();
  });

  it("donation centres keep limit and offset in the address", async () => {
    const fetchStub = stubFetch();

    await getDonationCentres(null, { limit: 20, offset: 0 });

    const { url, method } = asked(fetchStub);
    expect([method, url.pathname, url.search]).toEqual(["GET", "/blood/donation-centres", "?limit=20&offset=0"]);
  });

  it("emergency is GET /emergency with no query", async () => {
    const fetchStub = stubFetch();

    await getEmergency(null);

    const { url, method } = asked(fetchStub);
    expect([method, url.pathname, url.search]).toEqual(["GET", "/emergency", ""]);
  });
});

describe("with a position: a POST whose body holds it", () => {
  it("blood banks send lat, lng, the group, limit and offset in the body, and nothing in the address", async () => {
    const fetchStub = stubFetch();

    await getBloodBanks("A-", POSITION, { limit: 20, offset: 0 });

    const { url, method, body } = asked(fetchStub);
    expect([method, url.pathname, url.search]).toEqual(["POST", "/blood/banks", ""]);
    expect(body).toEqual({ lat: 6.45212, lng: 7.50987, blood_group: "A-", limit: 20, offset: 0 });
  });

  it("blood banks leave the group out when none was chosen", async () => {
    const fetchStub = stubFetch();

    await getBloodBanks(null, POSITION);

    expect(asked(fetchStub).body).not.toHaveProperty("blood_group");
  });

  it("donation centres send lat, lng, limit and offset in the body, and nothing in the address", async () => {
    const fetchStub = stubFetch();

    await getDonationCentres(POSITION, { limit: 20, offset: 20 });

    const { url, method, body } = asked(fetchStub);
    expect([method, url.pathname, url.search]).toEqual(["POST", "/blood/donation-centres", ""]);
    expect(body).toEqual({ lat: 6.45212, lng: 7.50987, limit: 20, offset: 20 });
  });

  it("emergency sends lat and lng in the body, and nothing in the address", async () => {
    const fetchStub = stubFetch();

    await getEmergency(POSITION);

    const { url, method, body } = asked(fetchStub);
    expect([method, url.pathname, url.search]).toEqual(["POST", "/emergency", ""]);
    expect(body).toEqual({ lat: 6.45212, lng: 7.50987 });
  });
});
