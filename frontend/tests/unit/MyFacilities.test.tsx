// @vitest-environment jsdom
/** "My facilities" on the provider's page: every link with its state in words, and edit links only for approved ones.
 * Requirements: FR-50, US-19, NFR-10. UI spec 4.2b (accounts phase 6b); api-spec 7, "Phase 6a".
 * Every name, address and number here is fictional.
 */
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProviderPage from "@/app/(dashboards)/provider/page";
import { saveStaffSession } from "@/lib/staff/session";

import { json } from "../helpers/api";

const router = { replace: vi.fn(), push: vi.fn() }; // one object: the gate's effect depends on it
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function link(id: number, name: string, role: string, status: string) {
  return {
    link_id: id, listing_id: 100 + id, name, area: "Ogui", category: { slug: "clinic", name: "Clinic" },
    role, status, requested_at: "2026-10-20T10:30:00Z",
  };
}

const MINE = {
  id: 101, slug: "approved-clinic", name: "Approved Clinic", category: { slug: "clinic", name: "Clinic" }, area: "Ogui",
  status: "published", last_verified_at: null, featured_until: null, featured_price_naira: "5000.00",
};

function stubApi(links: unknown[] | "fails") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string) => {
      const path = new URL(address).pathname;
      if (path === "/provider/listings") return links === "fails" ? json({ detail: "boom" }, 500) : json({ items: links });
      if (path === "/provider/listing") return json(MINE);
      return json({ detail: "Not found" }, 404);
    }),
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  saveStaffSession({ token: "tok", user: { id: 5, name: "Ada", email: "a@example.com", phone: null, role: "provider", is_active: true } });
});
afterEach(() => vi.unstubAllGlobals());

const LINKS = [
  link(1, "Approved Clinic", "owner", "approved"),
  link(2, "Waiting Clinic", "manager", "pending"),
  link(3, "Gone Clinic", "owner", "removed"),
];

describe("My facilities", () => {
  it("shows every link with its role and its state in words", async () => {
    stubApi(LINKS);
    render(<ProviderPage />);

    const region = await screen.findByRole("region", { name: "My facilities" });
    const cards = within(region).getAllByRole("listitem");

    expect(cards).toHaveLength(3);
    expect(within(cards[0]).getByText("Approved Clinic")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Clinic · Ogui · Owner")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Approved")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Clinic · Ogui · Manager")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Waiting for staff to phone the facility.")).toBeInTheDocument();
    expect(within(cards[2]).getByText("Removed.")).toBeInTheDocument();
  });

  it("has the edit link only on an approved link, pointing at that facility", async () => {
    stubApi(LINKS);
    render(<ProviderPage />);
    const region = await screen.findByRole("region", { name: "My facilities" });
    const cards = within(region).getAllByRole("listitem");

    const edit = within(cards[0]).getByRole("link", { name: "Edit this facility" });

    expect(edit).toHaveAttribute("href", "/provider/edit?listing=101");
    expect(edit.className).toMatch(/min-h-\[50px\]/);
    expect(within(cards[1]).queryByRole("link")).not.toBeInTheDocument();
    expect(within(cards[2]).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows nothing at all about a facility the provider has no link to", async () => {
    stubApi(LINKS);
    const { container } = render(<ProviderPage />);
    await screen.findByRole("region", { name: "My facilities" });

    expect(container.textContent).not.toMatch(/Somebody Else/);
  });

  it("says nothing, and the page works as before, when the list cannot be loaded", async () => {
    stubApi("fails");
    render(<ProviderPage />);

    expect(await screen.findByRole("heading", { level: 2, name: "Approved Clinic" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "My facilities" })).not.toBeInTheDocument();
  });

  it("is not shown to a provider with no link at all (the page says no facility is linked)", async () => {
    stubApi([]);
    render(<ProviderPage />);

    await screen.findByRole("heading", { level: 1, name: "My facility" });
    expect(screen.queryByRole("region", { name: "My facilities" })).not.toBeInTheDocument();
  });
});
