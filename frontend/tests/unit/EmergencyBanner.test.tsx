// @vitest-environment jsdom
/** The photo banner of SwiftRescue: the ambulance and the fire photo together, directly below the 112 card. Requirements: FR-14, FR-15, FR-17,
 * NFR-01, NFR-03, NFR-10, NFR-13, US-04. Spec: specs/2026-11-03-emergency-page-tidy/requirements.md (owner, 2026-11-03); before it the two photos
 * were under the headings of the Ambulance and Fire service groups (specs/2026-10-22-home-photos/ part 6), and the groups show contacts only now.
 * 112 and Call 112 never wait for the photos: they are lazy and below the 112 card. A photo that cannot load leaves a quiet panel of the same
 * size (no broken-image icon, no jump). The saved offline copy holds no picture data; the service worker keeps the two files.
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

function bannerOf(container: HTMLElement): HTMLElement {
  return container.querySelector("[data-emergency-banner]") as HTMLElement;
}

describe("where the photos are", () => {
  it("has both photos in one banner, directly below the 112 card and above the first button, and no other photo on the page", async () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);
    await sectionOf("Ambulance");

    const banner = bannerOf(container);
    expect(banner).not.toBeNull();
    const images = [...banner.querySelectorAll("img")];
    expect(images.map((image) => image.getAttribute("src"))).toEqual([EMERGENCY_PHOTOS.ambulance.src, EMERGENCY_PHOTOS.fire.src]);
    expect(container.querySelectorAll("img")).toHaveLength(2); // nothing else on the page is a picture
    const card = screen.getByRole("heading", { level: 2, name: "National emergency number — 112" }).closest("section") as HTMLElement;
    expect(card.nextElementSibling).toBe(banner); // directly below the 112 card
    expect(banner.compareDocumentPosition(screen.getAllByRole("button")[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("has no photo in any group: the Ambulance and Fire service groups show contacts only (owner, 2026-11-03)", async () => {
    stubApi({});
    render(<EmergencyPage />);

    for (const heading of ["Ambulance", "Fire service", "Police", "Hospital emergency (24 hours)", "Road accidents"]) {
      const section = await sectionOf(heading);
      expect(section.querySelectorAll("img, picture"), heading).toHaveLength(0);
      expect(section.querySelectorAll("[data-photo-missing]"), heading).toHaveLength(0);
    }
    expect(screen.getByRole("heading", { level: 2, name: "Ambulance" }).nextElementSibling?.tagName).toBe("ARTICLE"); // the contacts follow the heading
  });

  it("is in the page at once, with no data: it shows even when the contacts have not arrived", () => {
    stubApi({ emergency: () => new Promise<Response>(() => {}) });
    const { container } = render(<EmergencyPage />);

    expect(bannerOf(container).querySelectorAll("img")).toHaveLength(2);
    expect(readSource("components/emergency/EmergencyBanner.tsx")).not.toMatch(/useEmergency|lib\/api|fetch\(/);
  });

  it("shows the photos even when there is no contact at all", async () => {
    const response = emergencyResponse();
    response.groups.forEach((group) => {
      group.contacts = [];
    });
    stubApi({ emergency: () => json(response) });
    const { container } = render(<EmergencyPage />);
    await sectionOf("Ambulance");

    expect(bannerOf(container).querySelectorAll("img")).toHaveLength(2);
  });
});

describe("the size and the look: side by side, a fixed box, full brightness", () => {
  it("is two columns on every width (side by side, small on a phone), with a small gap", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const banner = bannerOf(container);
    expect(banner.className).toMatch(/\bgrid\b/);
    expect(banner.className).toMatch(/\bgrid-cols-2\b/);
    expect(banner.className).toMatch(/\bgap-2\b/);
    expect(banner.className).not.toMatch(/\b(sm|md|lg|min-\[\d+px\]):grid-cols-1\b/);
  });

  it("gives each photo a box that keeps its room before the file arrives: 5:3 on a phone (96 px high at 360 px), the whole 8:3 photo from 640 px", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const boxes = [...bannerOf(container).querySelectorAll("[data-emergency-photo]")] as HTMLElement[];
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box.className).toContain("aspect-[5/3]");
      expect(box.className).toContain("min-[640px]:aspect-[8/3]");
      expect(box.className).toMatch(/\bw-full\b/);
      expect(box.className).toMatch(/\boverflow-hidden\b/);
      expect(box.className).toMatch(/\brounded-2xl\b/);
    }
  });

  it("is lazy, async, 640 x 240 with the honest alt text, never high priority, and fills its box", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const images = [...bannerOf(container).querySelectorAll("img")] as HTMLImageElement[];
    for (const [image, photo] of [[images[0], EMERGENCY_PHOTOS.ambulance], [images[1], EMERGENCY_PHOTOS.fire]] as const) {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
      expect(image).toHaveAttribute("width", "640");
      expect(image).toHaveAttribute("height", "240");
      expect(image).toHaveAttribute("alt", photo.alt);
      expect(image.className).toMatch(/\bh-full\b/);
      expect(image.className).toMatch(/\bw-full\b/);
      expect(image.className).toMatch(/\bobject-cover\b/);
      expect(image.getAttribute("fetchpriority")).not.toBe("high");
    }
    expect(readSource("components/emergency/EmergencyBanner.tsx")).not.toMatch(/fetchPriority|priority/);
  });

  it("has honest alt text: one sentence each, what is in the photo, no medical claim", () => {
    expect(EMERGENCY_PHOTOS.ambulance.alt).toBe("A health worker in a white coat and a face mask stands in front of an ambulance with its rear doors open.");
    expect(EMERGENCY_PHOTOS.fire.alt).toBe("A firefighter in a red helmet stands by a fire engine with hoses, with smoke in the air.");
  });

  it("shows the photos as they are: full brightness, no filter, wash, tint, gradient or text over them, in both modes", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const banner = bannerOf(container);
    expect(banner.className).not.toMatch(/\b(opacity|brightness|grayscale|blur|backdrop|mix-blend|bg-gradient|bg-linear|filter)/);
    for (const element of banner.querySelectorAll("*")) {
      expect(element.className.toString(), element.tagName).not.toMatch(/\b(opacity-\d+|brightness|grayscale|blur|backdrop|mix-blend|bg-gradient|bg-linear|filter|dark:)/);
    }
    expect(banner.textContent).toBe(""); // nothing is written over the photos
    expect(banner.querySelectorAll("figcaption, p, span, a")).toHaveLength(0);
  });

  it("has no 'Designed by Magnific' credit: the one credit of the site is in the footer (owner, 2026-10-28)", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    expect(container.textContent).not.toMatch(/Magnific/);
    expect(screen.queryAllByRole("link", { name: /magnific/i })).toHaveLength(0);
    expect(readSource("components/emergency/EmergencyBanner.tsx")).not.toMatch(/Magnific|MAGNIFIC_CREDIT|target="_blank"/);
  });
});

describe("the faces stay whole in the 5:3 phone box (maths, like tests/unit/heroSlides.test.ts)", () => {
  // The photos are 640 x 240. A box of 5:3 shows 400 x 240 of it; the focus point says which part. Face boxes (left, top, right, bottom) were
  // written after looking at the photos: the health worker's head with the mask and hair; the firefighter's helmet and the visor under it.
  const FACES = { ambulance: [345, 60, 395, 130], fire: [70, 45, 262, 215] } as const;
  const WINDOW_WIDTH = (240 * 5) / 3;

  for (const name of ["ambulance", "fire"] as const) {
    it(`${name}: the whole face is inside the part that shows, at least 8 px from its edges`, () => {
      const focus = EMERGENCY_PHOTOS[name].focus;
      expect(focus, "a focus point such as '70% 50%'").toMatch(/^\d+% 50%$/);
      const horizontal = parseFloat(focus) / 100;
      const left = (640 - WINDOW_WIDTH) * horizontal;
      const [faceLeft, , faceRight] = FACES[name];

      expect(faceLeft - left).toBeGreaterThanOrEqual(8);
      expect(left + WINDOW_WIDTH - faceRight).toBeGreaterThanOrEqual(8);
    });
  }

  it("puts the focus point on the image, under 640 px only (from 640 px the whole photo shows)", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const images = [...bannerOf(container).querySelectorAll("img")] as HTMLImageElement[];
    expect(images[0].style.getPropertyValue("--focus")).toBe(EMERGENCY_PHOTOS.ambulance.focus);
    expect(images[1].style.getPropertyValue("--focus")).toBe(EMERGENCY_PHOTOS.fire.focus);
    for (const image of images) {
      expect(image.className).toContain("[object-position:var(--focus)]");
      expect(image.className).toContain("min-[640px]:[object-position:50%_50%]");
    }
  });
});

describe("112 and Call 112 never wait for a photo", () => {
  it("are in the page's own HTML before the banner: the first link is Call 112, and it comes before the first photo", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    const call = screen.getByRole("link", { name: "Call 112" });
    const firstImage = container.querySelector("img") as HTMLElement;

    expect(screen.getAllByRole("link")[0]).toBe(call);
    expect(call.compareDocumentPosition(firstImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("a photo that cannot load (offline on the first visit, or a failed request)", () => {
  it("leaves a quiet panel of the same shape in its place: no img, no broken icon, nothing to read; the other photo is not affected", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);
    const banner = bannerOf(container);

    fireEvent.error(banner.querySelector("img") as HTMLElement);

    expect(banner.querySelectorAll("img")).toHaveLength(1);
    const panel = banner.querySelector("[data-photo-missing]") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.className).toContain("aspect-[5/3]"); // the same box, so nothing jumps
    expect(panel.className).toContain("min-[640px]:aspect-[8/3]");
    expect(panel.textContent).toBe("");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(within(banner).queryAllByRole("link")).toHaveLength(0);
  });
});

describe("the saved copy for offline use (kept as before)", () => {
  it("holds no picture data and no picture address: the worker keeps the two files, the page saves only contacts", async () => {
    stubApi({});
    render(<EmergencyPage />);
    await sectionOf("Ambulance");

    const stored = window.localStorage.getItem(OFFLINE_COPY_KEY) ?? "";

    expect(stored.length).toBeGreaterThan(0);
    expect(stored).not.toMatch(/\.webp|\/images\/|data:image|base64/);
  });

  it("still lists both files for the service worker, so the banner works offline after one visit", () => {
    const worker = readSource("../public/sw.js");

    for (const file of [EMERGENCY_PHOTOS.ambulance.src, EMERGENCY_PHOTOS.fire.src]) expect(worker).toContain(file);
  });
});
