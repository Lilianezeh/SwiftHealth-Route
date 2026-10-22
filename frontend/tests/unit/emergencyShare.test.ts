/** The texts and links of Share emergency list and Share my location. Requirements: FR-18, US-09, FR-24, US-14, NFR-07.
 * UI spec 2.5 (points 3 and 4); decisions A7 and A8 in specs/2026-10-17-swiftrescue/requirements.md.
 */
import { describe, expect, it } from "vitest";

import {
  buildEmergencyListText,
  buildLocationMessage,
  smsShareLink,
  whatsappShareLink,
} from "@/lib/emergency/shareText";

import { emergencyResponse, listing } from "../helpers/api";

const PAGE_ADDRESS = "https://swifthealth-ng.netlify.app/emergency";

describe("the emergency list text (FR-18)", () => {
  it("starts with the title and 112, before any group", () => {
    const text = buildEmergencyListText(emergencyResponse(), PAGE_ADDRESS);
    const lines = text.split("\n");

    expect(lines[0]).toBe("SwiftRescue emergency numbers");
    expect(lines[1]).toBe("National emergency number: 112");
    expect(text.indexOf("112")).toBeLessThan(text.indexOf("Ambulance"));
  });

  it("lists each group with the contacts' names and numbers in the reading format (0803 123 4567)", () => {
    const text = buildEmergencyListText(emergencyResponse(), PAGE_ADDRESS);

    expect(text).toContain("Ambulance\nDemo Ambulance One: 0000 000 0101");
    expect(text).toContain("Police\nDemo Police Post: 0000 000 0102");
    expect(text).not.toContain("+234"); // reading format, not the international one
  });

  it("leaves out a group with no contact and a contact with no number", () => {
    const response = emergencyResponse();
    response.groups[0].contacts[0].primary_phone = null;
    const text = buildEmergencyListText(response, PAGE_ADDRESS);

    expect(text).not.toContain("Fire\n");
    expect(text).not.toContain("Ambulance\n");
    expect(text).not.toContain("Demo Ambulance One");
  });

  it("ends with the page address and 'In danger, call 112.'", () => {
    const lines = buildEmergencyListText(emergencyResponse(), PAGE_ADDRESS).trimEnd().split("\n");

    expect(lines.at(-1)).toBe(PAGE_ADDRESS);
    expect(lines.at(-2)).toBe("In danger, call 112.");
  });

  it("works with no list loaded yet: 112 only, still a complete message", () => {
    const text = buildEmergencyListText(null, PAGE_ADDRESS);

    expect(text).toBe(
      ["SwiftRescue emergency numbers", "National emergency number: 112", "", "In danger, call 112.", PAGE_ADDRESS].join("\n"),
    );
  });

  it("never contains a distance or any position", () => {
    const text = buildEmergencyListText(emergencyResponse(), PAGE_ADDRESS);

    expect(text).not.toMatch(/\bkm\b|lat|lng|maps/i);
  });

  it("never contains a pharmacy, even if an old API still sends the list (FR-25 removed, K6)", () => {
    const oldAnswer = { ...emergencyResponse(), pharmacies_24h: [listing({ id: 201, name: "Demo Night Pharmacy" })] };

    const text = buildEmergencyListText(oldAnswer, PAGE_ADDRESS);

    expect(text).not.toMatch(/pharmac/i);
  });
});

describe("the location message (FR-24)", () => {
  it("holds a Google Maps link of the exact position and a short call for help", () => {
    const message = buildLocationMessage({ latitude: 6.452123, longitude: 7.510987 });

    expect(message).toBe("I need help. My location: https://www.google.com/maps?q=6.452123,7.510987");
  });
});

describe("the share links", () => {
  it("the WhatsApp link is https://wa.me/ with the text encoded", () => {
    expect(whatsappShareLink("Hello & welcome\nline two")).toBe(
      "https://wa.me/?text=Hello%20%26%20welcome%0Aline%20two",
    );
  });

  it("the SMS link is sms:?&body= with the text encoded (works on Android and iPhone)", () => {
    expect(smsShareLink("Hello & welcome\nline two")).toBe("sms:?&body=Hello%20%26%20welcome%0Aline%20two");
  });
});
