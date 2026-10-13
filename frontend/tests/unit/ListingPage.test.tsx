// @vitest-environment jsdom
/** The whole listing page, loaded in the browser. Requirements: US-02, US-03, US-06, US-07, FR-09 to FR-13, FR-22, FR-47, NFR-01, NFR-07, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D1 to D10; UI spec 2.4. The parts have their own tests; this one checks them together.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ListingPage from "@/app/(public)/listing/[slug]/page";
import { ListingDetailView } from "@/components/listing/ListingDetailView";

import { makeListing, OTHER_PHONE, PRIMARY_PHONE } from "../helpers/listing";

// next/link stands in for itself, so that the test can read the `prefetch` prop that the real component keeps to itself.
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean | null; children?: React.ReactNode }) =>
      createElement("a", { href, "data-prefetch": String(prefetch), ...rest }, children),
  };
});

let requestedUrls: URL[];

function answerWith(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requestedUrls.push(new URL(url));
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => {
  requestedUrls = [];
  window.sessionStorage.clear();
  document.title = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the page while it loads", () => {
  it("shows a skeleton at once, an empty live region, and then 'The service is waking up' after 5 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const { container } = render(<ListingDetailView slug="night-pharmacy-a" />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("The service is waking up. This can take up to a minute.");
  });

  it("offers Retry after the time limit, and Retry asks again", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        calls += 1;
        if (calls > 1) return Promise.resolve(new Response(JSON.stringify(makeListing())));
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      }),
    );
    render(<ListingDetailView slug="night-pharmacy-a" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(screen.getByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    vi.useRealTimers();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

describe("a listing that is there", () => {
  it("asks the API for /listings/<slug> with no query string, and shows one h1 with the name", async () => {
    answerWith(200, makeListing());
    render(<ListingDetailView slug="night-pharmacy-a" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(requestedUrls.map((url) => url.pathname + url.search)).toEqual(["/listings/night-pharmacy-a"]);
  });

  it("shows everything of FR-09: category, area, open badge, hours note, verified date, address, landmark, phones, hours, services, photo", async () => {
    answerWith(200, makeListing());
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText(/Pharmacy · New Haven/)).toBeInTheDocument();
    expect(screen.getByText("Open now")).toBeInTheDocument();
    expect(screen.getByText("Closes 5:00 PM")).toBeInTheDocument();
    expect(screen.getByText(/Verified/)).toBeInTheDocument();
    expect(screen.getByText("12 Example Road, New Haven")).toBeInTheDocument();
    expect(screen.getByText(/Opposite the Example Market/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Night Pharmacy A" })).toHaveAttribute("href", `tel:${PRIMARY_PHONE.number}`);
    expect(screen.getByRole("link", { name: "Call Night Pharmacy A (Emergency)" })).toHaveAttribute("href", `tel:${OTHER_PHONE.number}`);
    expect(screen.getByRole("link", { name: /^Directions to Night Pharmacy A/ })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument(); // the hours
    expect(screen.getByRole("heading", { level: 2, name: "Services and fees" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Entrance of Night Pharmacy A" })).toBeInTheDocument();
  });

  it("shows the disclaimer of the API, the report link to /report/<id>, and the share buttons", async () => {
    const listing = makeListing();
    answerWith(200, listing);
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText(listing.disclaimer)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Report a problem with this listing" })).toHaveAttribute("href", "/report/12");
    expect(screen.getByRole("link", { name: /Share via WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("shows 'Verification due' when the API says so, and a 24-hour listing says Open 24 hours, every day", async () => {
    answerWith(200, makeListing({ verification_due: true, is_24_hours: true }));
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.getByText("Verification due")).toBeInTheDocument();
    expect(screen.getByText("Open 24 hours, every day")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("warns at the top when the listing was recently reported as not working, and not when it was not", async () => {
    answerWith(200, makeListing({ recently_reported_not_working: true }));
    const { unmount } = render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Recently reported as not working. Call before you go.");
    expect(screen.getByRole("link", { name: "Call Night Pharmacy A" })).toBeInTheDocument(); // the Call button stays
    unmount();

    answerWith(200, makeListing({ recently_reported_not_working: false }));
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("shows the WhatsApp button only for a number marked as WhatsApp, in the contact buttons and in the other numbers", async () => {
    answerWith(200, makeListing());
    const { unmount } = render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("link", { name: /^WhatsApp/ })).not.toBeInTheDocument();
    unmount();

    answerWith(200, makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }, { ...OTHER_PHONE, is_whatsapp: true }] }));
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByRole("link", { name: /^WhatsApp/ })).toHaveLength(2);
  });

  it("makes Call the biggest button: 56 px, the filled one", async () => {
    answerWith(200, makeListing());
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    const buttons = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];
    const large = buttons.filter((button) => /\bmin-h-14\b/.test(button.className));
    expect(large.map((button) => button.getAttribute("aria-label"))).toEqual(["Call Night Pharmacy A"]);
  });

  it("sets the tab title to the name and the brand", async () => {
    answerWith(200, makeListing());
    render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    expect(document.title).toBe("Night Pharmacy A | SwiftHealth Route");
  });
});

describe("a listing that is not there, and a failure", () => {
  it("shows the friendly 'Listing not found' page for a 404, with the search button and the title", async () => {
    answerWith(404, { detail: "Listing not found" });
    render(<ListingDetailView slug="no-such-place" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Listing not found" })).toBeInTheDocument();
    expect(screen.getByText("This listing isn't available. It may be under re-verification.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search for care" })).toHaveAttribute("href", "/search");
    expect(document.title).toBe("Listing not found | SwiftHealth Route");
  });

  it("shows the error message with Retry for a server error, not the not-found page", async () => {
    answerWith(500, {});
    render(<ListingDetailView slug="night-pharmacy-a" />);

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByText("Listing not found")).not.toBeInTheDocument();
  });
});

describe("privacy and size (NFR-07, NFR-01)", () => {
  it("never reads the visitor's position: a stored position appears in no link, no message and no request", async () => {
    window.sessionStorage.setItem("swifthealth.position", JSON.stringify({ latitude: 6.123, longitude: 7.456 }));
    answerWith(200, makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }] }));
    const { container } = render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    expect(requestedUrls.map((url) => url.href).join(" ")).not.toMatch(/6\.123|7\.456|lat=|lng=/);
    const links = [...container.querySelectorAll("a")].map((link) => decodeURIComponent(link.getAttribute("href") ?? ""));
    expect(links.join(" ")).not.toMatch(/6\.123|7\.456|lat=|lng=/);
    expect(container.textContent).not.toMatch(/6\.123|7\.456/);
  });

  it("has prefetch off on every link of the page, so no other page's code is downloaded before it is asked for", async () => {
    answerWith(200, makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }] }));
    const { container } = render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    const internal = [...container.querySelectorAll("a[data-prefetch]")];
    expect(internal.length).toBeGreaterThan(0); // the report link
    for (const link of internal) expect(link.getAttribute("data-prefetch"), link.textContent ?? "").toBe("false");
  });

  it("loads no map, no chart and no next/image: none of its files imports them", () => {
    const folder = join(process.cwd(), "src", "components", "listing");
    const files = readdirSync(folder).map((name) => join(folder, name));
    files.push(
      join(process.cwd(), "src", "hooks", "useListing.ts"),
      join(process.cwd(), "src", "app", "(public)", "listing", "[slug]", "page.tsx"),
      join(process.cwd(), "src", "lib", "api", "listing.ts"),
    );

    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/leaflet|recharts|from "next\/image"|ResultsMap|MapPopup/i);
    }
  });

  it("has every control at 48 px or more and no text under 16 px", async () => {
    answerWith(200, makeListing({ phones: [{ ...PRIMARY_PHONE, number: "+2348030000000", is_whatsapp: true }] }));
    const { container } = render(<ListingDetailView slug="night-pharmacy-a" />);
    await screen.findByRole("heading", { level: 1 });

    for (const control of [...container.querySelectorAll("a"), ...container.querySelectorAll("button")]) {
      expect(control.className, control.textContent ?? "").toMatch(/min-h-(12|14|\[50px\])(\s|$)/);
    }
    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm)\b/);
  });
});

describe("the route (app/(public)/listing/[slug]/page.tsx)", () => {
  it("is a small server page that takes the slug of the address and hands it to the browser-loaded view", async () => {
    answerWith(200, makeListing({ slug: "night-pharmacy-a" }));
    const element = await ListingPage({ params: Promise.resolve({ slug: "night-pharmacy-a" }) });
    render(element);

    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Night Pharmacy A" })).toBeInTheDocument());
    expect(within(document.body).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const source = readFileSync(join(process.cwd(), "src", "app", "(public)", "listing", "[slug]", "page.tsx"), "utf8");
    expect(source).not.toMatch(/"use client"|fetch\(|getListing/); // the page itself does not load anything
  });
});
