/** Reading a pasted place: plain coordinates or a long Google Maps link. Requirements: US-17, US-02, FR-23.
 * Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L2, L6). A short link cannot be read without fetching it, so the form asks
 * for the long link or for the pin to be moved. Nothing is fetched here; every place and name is fictional.
 */
import { describe, expect, it } from "vitest";

import { parseLocation } from "@/lib/map/parseLocation";

const ENUGU = { kind: "ok", latitude: 6.4521, longitude: 7.5103 };

describe("plain coordinates", () => {
  it.each([
    "6.4521, 7.5103",
    "6.4521,7.5103",
    "6.4521 7.5103",
    "  6.4521 ,  7.5103  ",
    "6.4521; 7.5103",
    "6.4521° N, 7.5103° E",
    "(6.4521, 7.5103)",
  ])("reads %j", (text) => {
    expect(parseLocation(text)).toEqual(ENUGU);
  });

  it("reads many decimals and keeps them", () => {
    expect(parseLocation("6.452123456, 7.510987654")).toEqual({ kind: "ok", latitude: 6.452123456, longitude: 7.510987654 });
  });

  it("says a place outside Nigeria is outside, for plain coordinates too", () => {
    expect(parseLocation("51.5072, -0.1276")).toEqual({ kind: "outside" });
    expect(parseLocation("0, 0")).toEqual({ kind: "outside" });
    expect(parseLocation("6.45, 15.5")).toEqual({ kind: "outside" });
  });

  it.each(["", "   ", "hello", "6.45", "6.45, abc", "six, seven", "6.45, 7.5, 8.1", "999, 999"])("does not read %j", (text) => {
    expect(parseLocation(text).kind).toMatch(/bad|outside/);
  });
});

describe("a long Google Maps link", () => {
  it.each([
    ["the pin of a place (!3d and !4d)", "https://www.google.com/maps/place/Example+Clinic/@6.4600,7.5200,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d6.4521!4d7.5103!16s"],
    ["the map centre (@lat,lng)", "https://www.google.com/maps/@6.4521,7.5103,17z"],
    ["a place link without the data part", "https://www.google.com/maps/place/Example+Clinic/@6.4521,7.5103,17z"],
    ["a q query", "https://www.google.com/maps?q=6.4521,7.5103"],
    ["a q query with an encoded comma", "https://www.google.com/maps?q=6.4521%2C7.5103"],
    ["an ll query", "https://maps.google.com/?ll=6.4521,7.5103&z=15"],
    ["a search link with query", "https://www.google.com/maps/search/?api=1&query=6.4521%2C7.5103"],
    ["a directions link with destination", "https://www.google.com/maps/dir/?api=1&destination=6.4521,7.5103"],
    ["google.com.ng", "https://www.google.com.ng/maps/@6.4521,7.5103,15z"],
  ])("reads %s", (_name, link) => {
    expect(parseLocation(link)).toEqual(ENUGU);
  });

  it("prefers the pin of the place (!3d!4d) to the map centre (@)", () => {
    const link = "https://www.google.com/maps/place/X/@6.9000,7.9000,17z/data=!3d6.4521!4d7.5103";

    expect(parseLocation(link)).toEqual(ENUGU);
  });

  it("works without https:// in front", () => {
    expect(parseLocation("www.google.com/maps/@6.4521,7.5103,17z")).toEqual(ENUGU);
  });

  it("says a link to a place outside Nigeria is outside", () => {
    expect(parseLocation("https://www.google.com/maps/@51.5072,-0.1276,12z")).toEqual({ kind: "outside" });
  });

  it("does not read a q that is a name, or a link with no place in it", () => {
    expect(parseLocation("https://www.google.com/maps?q=Example+Clinic").kind).toBe("bad");
    expect(parseLocation("https://www.google.com/maps").kind).toBe("bad");
  });

  it("does not read a link of another site, even with coordinates in it", () => {
    expect(parseLocation("https://example.com/maps/@6.4521,7.5103,17z").kind).toBe("bad");
    expect(parseLocation("https://www.google.com.evil.example/maps/@6.4521,7.5103,17z").kind).toBe("bad");
    expect(parseLocation("javascript:alert(6.4521,7.5103)").kind).toBe("bad");
  });
});

describe("a short link", () => {
  it.each([
    "https://maps.app.goo.gl/AbCdEf123",
    "http://maps.app.goo.gl/AbCdEf123",
    "maps.app.goo.gl/AbCdEf123",
    "https://goo.gl/maps/AbCdEf123",
  ])("is recognised as short and not read: %s", (link) => {
    expect(parseLocation(link)).toEqual({ kind: "short" });
  });
});
