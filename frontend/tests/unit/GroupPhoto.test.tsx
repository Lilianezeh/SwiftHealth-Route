// @vitest-environment jsdom
/** The two small photos of SwiftRescue: ambulance under Ambulance and fire under Fire service. Requirements: FR-14, FR-15, FR-17, NFR-01, NFR-03,
 * NFR-10, NFR-13, US-04. Spec: specs/2026-10-22-home-photos/requirements.md part 6 and ui-spec 2.5 (Photos).
 * 112 and Call 112 never wait for them: they are lazy, below the 112 card in the page, and a photo that cannot load leaves a quiet panel of the
 * same size (no broken-image icon, no jump). The saved offline copy holds no picture data; the service worker keeps the two files.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";
import { EMERGENCY_PHOTOS } from "@/config/sitePhotos";
import { OFFLINE_COPY_KEY } from "@/lib/emergency/offlineCopy";

import { emergencyResponse, json, stubApi } from "../helpers/api";
import { readSource } from "../helpers/source";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function sectionOf(heading: string): Promise<HTMLElement> {
  return (await screen.findByRole("heading", { level: 2, name: heading })).closest("section") as HTMLElement;
}

describe("where the photos are", () => {
  it("has the ambulance photo in the Ambulance group and the fire photo in the Fire service group, and no other photo on the page", async () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const ambulance = await sectionOf("Ambulance");
    const fire = await sectionOf("Fire service");

    expect(ambulance.querySelectorAll("img")).toHaveLength(1);
    expect(ambulance.querySelector("img")).toHaveAttribute("src", EMERGENCY_PHOTOS.ambulance.src);
    expect(fire.querySelectorAll("img")).toHaveLength(1);
    expect(fire.querySelector("img")).toHaveAttribute("src", EMERGENCY_PHOTOS.fire.src);
    expect(container.querySelectorAll("img")).toHaveLength(2);
    for (const heading of ["Police", "Hospital emergency (24 hours)", "Road accidents"]) {
      expect((await sectionOf(heading)).querySelectorAll("img")).toHaveLength(0);
    }
  });

  it("shows the photo of an always-shown group even when it has no contact", async () => {
    const response = emergencyResponse();
    response.groups.forEach((group) => {
      group.contacts = [];
    });
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    const ambulance = await sectionOf("Ambulance");

    expect(ambulance.querySelector("img")).not.toBeNull();
    expect(within(ambulance).getByText("No contacts added yet. In danger, call 112.")).toBeInTheDocument();
  });

  it("puts the photo under the heading and above the contacts", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const ambulance = await sectionOf("Ambulance");
    const heading = within(ambulance).getByRole("heading", { level: 2 });
    const image = ambulance.querySelector("img") as HTMLElement;
    const card = within(ambulance).getAllByRole("article")[0];

    expect(heading.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(image.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("each photo", () => {
  it("is lazy, fixed in size (640 x 240, an 8:3 box), with honest alt text, and not wider than its box", async () => {
    stubApi({});
    render(<EmergencyPage />);
    const ambulance = (await sectionOf("Ambulance")).querySelector("img") as HTMLImageElement;
    const fire = (await sectionOf("Fire service")).querySelector("img") as HTMLImageElement;

    for (const [image, photo] of [[ambulance, EMERGENCY_PHOTOS.ambulance], [fire, EMERGENCY_PHOTOS.fire]] as const) {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
      expect(image).toHaveAttribute("width", "640");
      expect(image).toHaveAttribute("height", "240");
      expect(image).toHaveAttribute("alt", photo.alt);
      expect(image.className).toMatch(/\baspect-\[8\/3\]/);
      expect(image.className).toMatch(/\bw-full\b/);
      expect(image.className).toMatch(/\bobject-cover\b/);
      expect(image.getAttribute("fetchpriority")).not.toBe("high");
    }
  });

  it("is at most 160 px high: the box has a maximum width that keeps the 8:3 shape under it", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const image = (await sectionOf("Ambulance")).querySelector("img") as HTMLImageElement;

    expect(image.className).toMatch(/\bmax-w-\[427px\]|\bmax-w-md\b/); // 160 px high at 8:3 is 427 px wide
  });

  it("has no 'Designed by Magnific' credit under it: the one credit of the site is in the footer (owner, 2026-10-28)", async () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    for (const heading of ["Ambulance", "Fire service"]) {
      const section = await sectionOf(heading);

      expect(section.querySelector("img")).not.toBeNull();
      expect(within(section).queryAllByRole("link", { name: /magnific/i })).toHaveLength(0);
      expect(section.textContent).not.toMatch(/Magnific/);
    }
    expect(screen.queryAllByRole("link", { name: /magnific/i })).toHaveLength(0);
    expect(container.textContent).not.toMatch(/Magnific/);
    expect(readSource("components/emergency/GroupPhoto.tsx")).not.toMatch(/Magnific|MAGNIFIC_CREDIT|target="_blank"/);
  });
});

describe("112 and Call 112 never wait for a photo", () => {
  it("are in the page's own HTML before any group: the 112 card and the first link come before the first photo", async () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);
    await sectionOf("Ambulance");

    const call = screen.getByRole("link", { name: "Call 112" });
    const firstImage = container.querySelector("img") as HTMLElement;

    expect(screen.getAllByRole("link")[0]).toBe(call);
    expect(call.compareDocumentPosition(firstImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(readSource("components/emergency/GroupPhoto.tsx")).not.toMatch(/fetchPriority|priority/);
  });

  it("show the 112 card and the sentence while the contacts have not arrived: no photo is drawn before the groups", () => {
    stubApi({ emergency: () => new Promise<Response>(() => {}) });
    const { container } = render(<EmergencyPage />);

    expect(screen.getByRole("link", { name: "Call 112" })).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("a photo that cannot load (offline on the first visit, or a failed request)", () => {
  it("leaves a quiet panel of the same shape: no img, no broken icon, and no credit for a photo that is not shown", async () => {
    stubApi({});
    render(<EmergencyPage />);
    const ambulance = await sectionOf("Ambulance");

    fireEvent.error(ambulance.querySelector("img") as HTMLElement);

    expect(ambulance.querySelector("img")).toBeNull();
    const panel = ambulance.querySelector("[data-photo-missing]") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toMatch(/\baspect-\[8\/3\]/); // the same box, so nothing jumps
    expect(panel.textContent).toBe(""); // quiet: nothing to read, nothing for a screen reader
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(within(ambulance).queryByRole("link", { name: /magnific/i })).toBeNull();
    expect(within(ambulance).getAllByRole("article")).toHaveLength(1); // the contacts are still there
    const fire = await sectionOf("Fire service");
    expect(fire.querySelector("img")).not.toBeNull(); // the other photo is not affected
  });
});

describe("the saved copy for offline use", () => {
  it("holds no picture data and no picture address: the worker keeps the two files, the page saves only contacts", async () => {
    stubApi({});
    render(<EmergencyPage />);
    await sectionOf("Ambulance");

    const stored = window.localStorage.getItem(OFFLINE_COPY_KEY) ?? "";

    expect(stored.length).toBeGreaterThan(0);
    expect(stored).not.toMatch(/\.webp|\/images\/|data:image|base64/);
  });
});
