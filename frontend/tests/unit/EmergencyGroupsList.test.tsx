// @vitest-environment jsdom
/** The SwiftRescue groups: new headings, five always shown, four only with a contact. Requirements: FR-15, FR-16, FR-17, FR-18, FR-19, NFR-03, NFR-10.
 * Spec: specs/2026-10-22-swiftrescue-groups/requirements.md and ui-spec 2.5 point 5. The headings come from the page's own list by slug, so an
 * old API answer and an old saved copy show the new ones. No phone number is added by this feature: every contact below exists only in a test.
 */
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";
import { SWIFTRESCUE_GROUPS } from "@/lib/emergency/groups";
import { buildEmergencyListText } from "@/lib/emergency/shareText";

import { emergencyResponse, emergencyResponseWithOldHeadings, json, listing, stubApi } from "../helpers/api";
import { readSource } from "../helpers/source";

const EMPTY_TEXT = "No contacts added yet. In danger, call 112.";
const ALWAYS_SHOWN = ["Ambulance", "Fire service", "Police", "Hospital emergency (24 hours)", "Road accidents"];
const ONLY_WITH_A_CONTACT = [
  "Security", "Disaster and flooding", "Sexual and gender-based violence support", "Mental health crisis support",
];

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function allEmpty() {
  const response = emergencyResponse();
  response.groups.forEach((group) => {
    group.contacts = [];
  });
  return response;
}

function addContact(response: ReturnType<typeof emergencyResponse>, slug: string, name: string) {
  const group = response.groups.find((entry) => entry.category.slug === slug);
  group?.contacts.push(listing({ id: 900 + response.groups.length, slug: `test-${slug}`, name, category: { slug, name: group.category.name }, primary_phone: "+2340000000900" }));
}

/** The headings of the groups, from Ambulance on (the static h2s of the page come before it). */
function groupHeadings(): string[] {
  const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
  return headings.slice(headings.indexOf("Ambulance"));
}

describe("the list of groups", () => {
  it("has nine groups in the owner's order, five always shown and four only with a contact", () => {
    expect(SWIFTRESCUE_GROUPS.map((group) => group.heading)).toEqual([...ALWAYS_SHOWN, ...ONLY_WITH_A_CONTACT]);
    expect(SWIFTRESCUE_GROUPS.map((group) => group.slug)).toEqual([
      "ambulance", "fire", "police", "emergency-unit", "roadside-assistance", "security",
      "disaster-flooding", "gbv-support", "mental-health-crisis",
    ]);
    expect(SWIFTRESCUE_GROUPS.filter((group) => group.alwaysShown).map((group) => group.heading)).toEqual(ALWAYS_SHOWN);
  });
});

describe("the five groups that are always shown", () => {
  it("are drawn in order, each with 'No contacts added yet. In danger, call 112.', when nothing has a contact", async () => {
    stubApi({ emergency: () => json(allEmpty()) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(groupHeadings()).toEqual(ALWAYS_SHOWN);
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(5);
    for (const heading of ALWAYS_SHOWN) {
      const section = screen.getByRole("heading", { level: 2, name: heading }).closest("section") as HTMLElement;
      expect(within(section).getByText(EMPTY_TEXT)).toBeInTheDocument();
    }
  });

  it("keep 'We are still adding verified contacts' above the five empty groups, and 112 stays first", async () => {
    stubApi({ emergency: () => json(allEmpty()) });
    render(<EmergencyPage />);

    const note = await screen.findByText("We are still adding verified contacts. In danger, call 112.");
    const ambulance = screen.getByRole("heading", { level: 2, name: "Ambulance" });

    expect(note.compareDocumentPosition(ambulance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "tel:112");
  });

  it("show their contacts instead of the empty line when they have some", async () => {
    const response = allEmpty();
    addContact(response, "emergency-unit", "Test Trauma Unit");
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    const section = (await screen.findByRole("heading", { level: 2, name: "Hospital emergency (24 hours)" })).closest("section") as HTMLElement;

    expect(within(section).getByText("Test Trauma Unit")).toBeInTheDocument();
    expect(within(section).queryByText(EMPTY_TEXT)).toBeNull();
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(4);
  });
});

describe("the four groups that show only with a contact", () => {
  it("are hidden while empty: no heading, no empty line", async () => {
    stubApi({ emergency: () => json(allEmpty()) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    const headings = groupHeadings();
    for (const hidden of ONLY_WITH_A_CONTACT) expect(headings).not.toContain(hidden);
  });

  it("are drawn after the five, in the owner's order, once each has a contact", async () => {
    const response = allEmpty();
    addContact(response, "mental-health-crisis", "Test Crisis Line");
    addContact(response, "security", "Test Security Desk");
    addContact(response, "gbv-support", "Test Support Centre");
    addContact(response, "disaster-flooding", "Test Flood Desk");
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(groupHeadings()).toEqual([...ALWAYS_SHOWN, ...ONLY_WITH_A_CONTACT]);
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(5);
  });

  it("show a card with a Call button of 48 px or more, and never a sponsored tag", async () => {
    const response = allEmpty();
    addContact(response, "mental-health-crisis", "Test Crisis Line");
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    const section = (await screen.findByRole("heading", { level: 2, name: "Mental health crisis support" })).closest("section") as HTMLElement;

    expect(within(section).getByRole("link", { name: /Call/ }).className).toMatch(/min-h-(12|14|16|\[50px\])/);
    expect(screen.queryByText(/sponsored/i)).toBeNull();
  });

  it("has a heading that can wrap at 320 px: no nowrap, no truncate", () => {
    const source = readSource("components/emergency/EmergencyGroups.tsx");

    expect(source).not.toMatch(/whitespace-nowrap|truncate|overflow-hidden/);
  });
});

describe("an old answer, an old saved copy and a group the page does not know", () => {
  it("show the new headings for an old API answer (Fire, 24-hour emergency units, Roadside assistance), with five groups and no crash", async () => {
    stubApi({ emergency: () => json(emergencyResponseWithOldHeadings()) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(groupHeadings()).toEqual([
      "Ambulance", "Fire service", "Police", "Hospital emergency (24 hours)", "Road accidents",
    ]);
    expect(screen.queryByRole("heading", { name: "Fire" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "24-hour emergency units" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Roadside assistance" })).toBeNull();
  });

  it("show the new headings and all five groups from a saved copy made before the change, with the network off", async () => {
    stubApi({ emergency: () => json(emergencyResponseWithOldHeadings()) });
    const first = render(<EmergencyPage />);
    await screen.findByRole("heading", { level: 2, name: "Ambulance" });
    first.unmount();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    render(<EmergencyPage />);

    expect(await screen.findByText(/^Offline — showing saved contacts from/)).toBeVisible();
    expect(await screen.findByRole("heading", { level: 2, name: "Fire service" })).toBeInTheDocument();
    expect(groupHeadings()).toEqual(ALWAYS_SHOWN);
    expect(screen.getByText("Demo Trauma Unit")).toBeInTheDocument();
  });

  it("draw a group of a slug the page does not know, with its own name, after the known ones, when it has a contact", async () => {
    const response = allEmpty();
    response.groups.push({
      category: { slug: "future-group", name: "A Future Group" },
      contacts: [listing({ id: 950, slug: "test-future", name: "Test Future Contact", category: { slug: "future-group", name: "A Future Group" } })],
    });
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(groupHeadings()).toEqual([...ALWAYS_SHOWN, "A Future Group"]);
  });

  it("ignore a blood bank group of an even older answer, as before", async () => {
    const response = allEmpty();
    response.groups.push({ category: { slug: "blood-bank", name: "Blood banks" }, contacts: [listing({ id: 960, name: "Test Blood Bank" })] });
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(groupHeadings()).toEqual(ALWAYS_SHOWN);
  });
});

describe("the shared WhatsApp/SMS list", () => {
  it("uses the new headings, only for groups with a contact that has a number, in the order of the table", () => {
    const response = allEmpty();
    addContact(response, "mental-health-crisis", "Test Crisis Line");
    addContact(response, "fire", "Test Fire Station");
    addContact(response, "emergency-unit", "Test Trauma Unit");

    const lines = buildEmergencyListText(response, "https://example.test/emergency").split("\n");

    expect(lines.filter((line) => [...ALWAYS_SHOWN, ...ONLY_WITH_A_CONTACT].includes(line))).toEqual([
      "Fire service", "Hospital emergency (24 hours)", "Mental health crisis support",
    ]);
    expect(lines).toContain("Test Fire Station: 0000 000 0900");
    expect(lines).not.toContain("Ambulance");
    expect(lines.slice(0, 2)).toEqual(["SwiftRescue emergency numbers", "National emergency number: 112"]);
  });

  it("uses the new headings for an old answer too", () => {
    const text = buildEmergencyListText(emergencyResponseWithOldHeadings(), "https://example.test/emergency");

    expect(text).toContain("Hospital emergency (24 hours)\nDemo Trauma Unit: ");
    expect(text).not.toContain("24-hour emergency units");
  });
});

describe("no phone number is added by this feature", () => {
  it("has none in the list of groups", () => {
    expect(readSource("lib/emergency/groups.ts")).not.toMatch(/\+234|\b0[789]\d{9}\b|tel:/);
  });
});
