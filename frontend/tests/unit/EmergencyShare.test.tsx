// @vitest-environment jsdom
/** Share emergency list and Share my location. Requirements: US-09, FR-18, US-14, FR-24, NFR-07, NFR-10.
 * UI spec 2.5, points 3 and 4. Decisions A7 and A8 in specs/2026-10-17-swiftrescue/requirements.md.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";
import { ShareEmergencyList } from "@/components/emergency/ShareEmergencyList";
import { ShareMyLocation } from "@/components/emergency/ShareMyLocation";

import { emergencyResponse, stubApi, stubGeolocation } from "../helpers/api";
import { readSource } from "../helpers/source";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Share emergency list", () => {
  it("has a WhatsApp link and an SMS link, each at least 48 px high, with a plain-text list inside", () => {
    render(<ShareEmergencyList response={emergencyResponse()} />);

    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    const sms = screen.getByRole("link", { name: /SMS/ });
    expect(whatsapp.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(sms.getAttribute("href")).toMatch(/^sms:\?&body=/);
    const text = decodeURIComponent(whatsapp.getAttribute("href")?.split("text=")[1] ?? "");
    expect(text).toContain("National emergency number: 112");
    expect(text).toContain("Demo Ambulance One: 0000 000 0101");
    expect(decodeURIComponent(sms.getAttribute("href")?.split("body=")[1] ?? "")).toBe(text);
    expect(whatsapp.className).toMatch(/min-h-\[50px\]/);
    expect(sms.className).toMatch(/min-h-\[50px\]/);
  });

  it("opens WhatsApp in a new tab safely", () => {
    render(<ShareEmergencyList response={emergencyResponse()} />);

    const whatsapp = screen.getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("works before the list has loaded: it shares 112 only", () => {
    render(<ShareEmergencyList response={null} />);

    const text = decodeURIComponent(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")?.split("text=")[1] ?? "");
    expect(text).toContain("National emergency number: 112");
    expect(text).toContain("In danger, call 112.");
  });

  it("puts the page address at the end of the text", async () => {
    render(<ShareEmergencyList response={null} />);

    await waitFor(() => {
      const text = decodeURIComponent(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")?.split("text=")[1] ?? "");
      expect(text.trimEnd().endsWith(`${window.location.origin}/emergency`)).toBe(true);
    });
  });
});

describe("Share my location", () => {
  it("asks the browser only after a tap", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452123, longitude: 7.510987 });
    render(<ShareMyLocation />);
    expect(getCurrentPosition).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("asks for the exact position, not an old one", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.45, longitude: 7.51 });
    render(<ShareMyLocation />);

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));

    const options = (getCurrentPosition.mock.calls[0] as unknown[])[2] as PositionOptions;
    expect(options.enableHighAccuracy).toBe(true);
    expect(options.maximumAge).toBe(0);
  });

  it("then offers WhatsApp and SMS links holding a Google Maps link of the exact position", async () => {
    stubGeolocation({ latitude: 6.452123, longitude: 7.510987 });
    render(<ShareMyLocation />);

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));

    const whatsapp = await screen.findByRole("link", { name: "Send on WhatsApp" });
    const sms = screen.getByRole("link", { name: "Send by SMS" });
    const message = "I need help. My location: https://www.google.com/maps?q=6.452123,7.510987";
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toBe(`https://wa.me/?text=${message}`);
    expect(decodeURIComponent(sms.getAttribute("href") ?? "")).toBe(`sms:?&body=${message}`);
    expect(whatsapp.className).toMatch(/min-h-\[50px\]/);
  });

  it("keeps the position in memory only: nothing in either storage, nothing sent to the API, nothing in the address", async () => {
    const { fetchStub } = stubApi({});
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    stubGeolocation({ latitude: 6.452123, longitude: 7.510987 });
    render(<ShareMyLocation />);

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));
    await screen.findByRole("link", { name: "Send on WhatsApp" });

    expect(setItem).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(window.location.href).not.toMatch(/6\.45/);
  });

  it("forgets the position when the visitor taps Done", async () => {
    stubGeolocation({ latitude: 6.452123, longitude: 7.510987 });
    render(<ShareMyLocation />);
    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));
    await screen.findByRole("link", { name: "Send on WhatsApp" });

    await userEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("link", { name: "Send on WhatsApp" })).toBeNull();
    expect(screen.getByRole("button", { name: "Share my location" })).toBeInTheDocument();
  });

  it.each([
    [1, "permission refused"],
    [2, "position unavailable"],
    [3, "timeout"],
  ])("when the position cannot be had (%i, %s), says to call 112 and say where you are", async (errorCode) => {
    stubGeolocation({ errorCode });
    render(<ShareMyLocation />);

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));

    expect(await screen.findByText("We could not get your location. Call 112 and say where you are.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Send/ })).toBeNull();
  });

  it("says the same when the browser has no location at all", async () => {
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    render(<ShareMyLocation />);

    await userEvent.click(screen.getByRole("button", { name: "Share my location" }));

    expect(await screen.findByText("We could not get your location. Call 112 and say where you are.")).toBeInTheDocument();
  });

  it("never touches the visitor's stored position or the location store", () => {
    const source = readSource("components/emergency/ShareMyLocation.tsx");

    expect(source).not.toMatch(/locationStore|sessionStorage|localStorage|savePosition|useLocation|lib\/api/);
    expect(source).not.toMatch(/console\./);
  });
});

describe("on the page", () => {
  it("both come after the 112 card and before the contacts", async () => {
    stubApi({});
    stubGeolocation({ latitude: 6.45, longitude: 7.51 });
    const { container } = render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    const text = container.textContent ?? "";
    expect(text.indexOf("Call 112")).toBeLessThan(text.indexOf("Share my location"));
    expect(text.indexOf("Share my location")).toBeLessThan(text.indexOf("Share emergency list"));
    expect(text.indexOf("Share emergency list")).toBeLessThan(text.indexOf("Ambulance"));
  });
});
