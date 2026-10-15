/** The WhatsApp and share links of the listing page. Requirements: FR-47, FR-12, NFR-07. Spec: specs/2026-10-13-listing-page/requirements.md D2 and D4.
 *
 * The format of a click-to-chat link, from WhatsApp's help page "How to use click to chat" (https://whatsapp.com/faq/en/general/26000030),
 * as the owner supplied it (the page cannot be fetched by a script):
 *   "Use https://wa.me/<number> where the <number> is a full phone number in international format. Omit any zeroes, brackets, or dashes
 *    when adding the phone number in international format."
 *   "Use https://wa.me/whatsappphonenumber?text=urlencodedtext where whatsappphonenumber is a full phone number in international format
 *    and urlencodedtext is the URL-encoded pre-filled message."
 *   The general format page also says to remove any leading 0s.
 */
import { describe, expect, it } from "vitest";

import {
  WHATSAPP_MESSAGE,
  shareLink,
  toWhatsAppNumber,
  whatsAppContactUrl,
  whatsAppShareUrl,
} from "@/lib/formatters/whatsapp";

describe("toWhatsAppNumber: the number as wa.me wants it (international, digits only, no leading zero)", () => {
  it.each([
    ["+2348030000000", "2348030000000"], // the stored form
    ["08030000000", "2348030000000"], // the local form: the leading 0 is dropped, 234 is added
    ["2348030000000", "2348030000000"], // already without the plus
    ["+234 803 000 0000", "2348030000000"], // spaces
    ["0803-000-0000", "2348030000000"], // dashes
    ["(0803) 000 0000", "2348030000000"], // brackets
    ["+2340000000012", "2340000000012"], // the impossible fixture form of the seed: ten digits after 234
  ])("turns %s into %s", (raw, expected) => {
    expect(toWhatsAppNumber(raw)).toBe(expected);
  });

  it.each([
    "", // nothing
    "0803000000", // too short (9 digits after the 0)
    "080300000000", // too long
    "+23480300000", // too short after 234
    "+234080300000000", // 234, then a leading 0, then ten digits: the zero must not be kept
    "+14155550123", // not a Nigerian number
    "call me", // not a number at all
  ])("gives no number for %j, so no button", (raw) => {
    expect(toWhatsAppNumber(raw)).toBeNull();
  });

  it("never gives a result with a plus, a zero straight after 234, or anything but digits", () => {
    for (const raw of ["+2348030000000", "08030000000", "2348030000000"]) {
      expect(toWhatsAppNumber(raw)).toMatch(/^234[1-9]\d{9}$/);
    }
  });
});

describe("whatsAppContactUrl: https://wa.me/<number>?text=<urlencodedtext>", () => {
  it("has the number and the fixed message, URL-encoded", () => {
    expect(WHATSAPP_MESSAGE).toBe("Hello, I found you on SwiftHealth Route.");
    expect(whatsAppContactUrl("2348030000000")).toBe(
      "https://wa.me/2348030000000?text=Hello%2C%20I%20found%20you%20on%20SwiftHealth%20Route.",
    );
  });

  it("holds nothing but the number and the message: no slug, no name, no position", () => {
    const url = new URL(whatsAppContactUrl("2348030000000"));

    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/2348030000000");
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.searchParams.get("text")).toBe(WHATSAPP_MESSAGE);
    expect(url.hash).toBe("");
  });
});

describe("the share link and the share message", () => {
  it("is only the site address and /listing/<slug>, whatever address the page was opened with", () => {
    expect(shareLink("night-pharmacy-a", "https://swifthealth-ng.netlify.app")).toBe(
      "https://swifthealth-ng.netlify.app/listing/night-pharmacy-a",
    );
    // An origin never carries a path, a query or a hash, but a caller could pass the whole address by mistake: only the origin is kept.
    expect(shareLink("night-pharmacy-a", "https://swifthealth-ng.netlify.app/find?lat=6.45&lng=7.5#x")).toBe(
      "https://swifthealth-ng.netlify.app/listing/night-pharmacy-a",
    );
  });

  it("encodes a slug so it cannot add a query, a hash or another path", () => {
    expect(shareLink("a/b?lat=6.45#x", "https://example.com")).toBe("https://example.com/listing/a%2Fb%3Flat%3D6.45%23x");
  });

  it("opens WhatsApp with no number (WhatsApp asks who to send it to) and the message: <name> on SwiftHealth Route: <link>", () => {
    const link = "https://swifthealth-ng.netlify.app/listing/night-pharmacy-a";
    const url = whatsAppShareUrl("Night Pharmacy A", link);

    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(new URL(url).searchParams.get("text")).toBe(`Night Pharmacy A on SwiftHealth Route: ${link}`);
  });

  it("keeps a name with special characters from adding parameters", () => {
    const url = new URL(whatsAppShareUrl("A&B ?x=1 #c", "https://example.com/listing/x"));

    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.searchParams.get("text")).toBe("A&B ?x=1 #c on SwiftHealth Route: https://example.com/listing/x");
  });
});
