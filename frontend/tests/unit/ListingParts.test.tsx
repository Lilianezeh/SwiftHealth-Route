// @vitest-environment jsdom
/** The smaller parts of the listing page: the reported notice, the entrance photo, share and copy, the 404 page and the skeleton.
 * Requirements: FR-09, FR-12, FR-22, NFR-07, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D4, D6, D7 and D8.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EntrancePhoto } from "@/components/listing/EntrancePhoto";
import { ListingNotFound } from "@/components/listing/ListingNotFound";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { ReportedNotice } from "@/components/listing/ReportedNotice";
import { ShareButtons } from "@/components/listing/ShareButtons";

describe("ReportedNotice (FR-22)", () => {
  it("says 'Recently reported as not working. Call before you go.' as a note, with an icon hidden from screen readers", () => {
    const { container } = render(<ReportedNotice />);

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Recently reported as not working. Call before you go.");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is amber (amber-ink on amber-wash), never red: red belongs to emergencies", () => {
    render(<ReportedNotice />);

    const className = screen.getByRole("note").className;
    expect(className).toMatch(/\bbg-amber-wash\b/);
    expect(className).toMatch(/\btext-amber-ink\b/);
    expect(className).not.toMatch(/emergency|red/);
  });
});

describe("EntrancePhoto (D7)", () => {
  it("shows an https photo as a plain img with fixed size, lazy loading, no referrer, and alt text with the name", () => {
    render(<EntrancePhoto url="https://images.example.com/a.jpg" facilityName="Night Pharmacy A" />);

    const photo = screen.getByRole("img", { name: "Entrance of Night Pharmacy A" });
    expect(photo).toHaveAttribute("src", "https://images.example.com/a.jpg");
    expect(photo).toHaveAttribute("loading", "lazy");
    expect(photo).toHaveAttribute("decoding", "async");
    expect(photo).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(Number(photo.getAttribute("width"))).toBeGreaterThan(0);
    expect(Number(photo.getAttribute("height"))).toBeGreaterThan(0);
  });

  it.each([
    "http://images.example.com/a.jpg", // not https
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//images.example.com/a.jpg",
    "/images/a.jpg",
    "",
    "  ",
  ])("shows nothing for %j", (url) => {
    const { container } = render(<EntrancePhoto url={url} facilityName="X" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when there is no photo address", () => {
    const { container } = render(<EntrancePhoto url={null} facilityName="X" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("takes its frame away when the photo fails to load, so there is no empty box", () => {
    const { container } = render(<EntrancePhoto url="https://images.example.com/a.jpg" facilityName="X" />);

    fireEvent.error(screen.getByRole("img"));

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ShareButtons (FR-12, D4)", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  beforeEach(() => {
    window.history.pushState({}, "", "/listing/night-pharmacy-a?lat=6.45&lng=7.5#x"); // opened with a position in the address
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
    vi.restoreAllMocks();
  });

  function stubClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  }

  it("shares via WhatsApp with the message '<name> on SwiftHealth Route: <link>' and no number, in a new tab", () => {
    render(<ShareButtons slug="night-pharmacy-a" facilityName="Night Pharmacy A" />);

    const link = screen.getByRole("link", { name: "Share via WhatsApp (opens in a new tab)" });
    const shared = `${window.location.origin}/listing/night-pharmacy-a`;
    expect(link.getAttribute("href")).toBe(`https://wa.me/?text=${encodeURIComponent(`Night Pharmacy A on SwiftHealth Route: ${shared}`)}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("shares only /listing/<slug>, even though the page was opened with ?lat=...&lng=... and a hash: no position, no query, no hash", () => {
    render(<ShareButtons slug="night-pharmacy-a" facilityName="Night Pharmacy A" />);

    const href = screen.getByRole("link", { name: /Share via WhatsApp/ }).getAttribute("href") ?? "";
    const message = new URL(href).searchParams.get("text") ?? "";
    expect(message).toBe(`Night Pharmacy A on SwiftHealth Route: ${window.location.origin}/listing/night-pharmacy-a`);
    expect(message).not.toMatch(/lat|lng|6\.45|7\.5|#x|\?/);
  });

  it("copies the same link, and says 'Link copied' in a live region", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    render(<ShareButtons slug="night-pharmacy-a" facilityName="Night Pharmacy A" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/listing/night-pharmacy-a`);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Link copied"));
  });

  it("has an empty live region at first, so a screen reader announces the sentence when it is filled in", () => {
    render(<ShareButtons slug="night-pharmacy-a" facilityName="X" />);

    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows the link in a read-only field to copy by hand when the browser refuses to copy", async () => {
    stubClipboard(async () => Promise.reject(new Error("denied")));
    render(<ShareButtons slug="night-pharmacy-a" facilityName="X" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    const field = await screen.findByRole("textbox", { name: "Link to copy" });
    expect(field).toHaveAttribute("readonly");
    expect(field).toHaveValue(`${window.location.origin}/listing/night-pharmacy-a`);
    expect(screen.getByRole("status")).not.toHaveTextContent("Link copied");
  });

  it("shows the field too when there is no clipboard at all", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    render(<ShareButtons slug="night-pharmacy-a" facilityName="X" />);

    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByRole("textbox", { name: "Link to copy" })).toBeInTheDocument();
  });

  it("has 48 px buttons with 16 px text, and icons that screen readers skip", () => {
    const { container } = render(<ShareButtons slug="night-pharmacy-a" facilityName="X" />);

    for (const target of [screen.getByRole("link", { name: /Share via WhatsApp/ }), screen.getByRole("button", { name: "Copy link" })]) {
      expect(target.className).toMatch(/min-h-\[50px\]/);
      expect(target.className).toMatch(/\btext-base\b/);
    }
    for (const icon of container.querySelectorAll("svg")) expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('img[src*="whatsapp"]')).toBeNull(); // WhatsApp's glyph is used once, on the contact button
  });
});

describe("ListingNotFound (D8)", () => {
  it("is a friendly page: the heading, the sentence, a Search for care button and a link to the home page", () => {
    render(<ListingNotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "Listing not found" })).toBeInTheDocument();
    expect(screen.getByText("This listing isn't available. It may be under re-verification.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search for care" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  });

  it("uses no red (a missing listing is not an emergency) and no text under 16 px", () => {
    const { container } = render(<ListingNotFound />);

    expect(container.innerHTML).not.toMatch(/emergency|\btext-(xs|sm)\b/);
  });
});

describe("ListingSkeleton", () => {
  it("is grey blocks that screen readers skip, and the animation stops for people who ask for less motion", () => {
    const { container } = render(<ListingSkeleton />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.innerHTML).toMatch(/motion-reduce:animate-none/);
  });
});
