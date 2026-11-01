// @vitest-environment jsdom
/** "My facilities" on the provider's page: every link with its state in words, and edit links only for approved ones.
 * Requirements: FR-50, US-19, NFR-10. UI spec 4.2b (accounts phase 6b); api-spec 7, "Phase 6a".
 * Every name, address and number here is fictional.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProviderPage from "@/app/(dashboards)/provider/page";
import { saveStaffSession } from "@/lib/staff/session";

import { json } from "../helpers/api";

const router = { replace: vi.fn(), push: vi.fn() }; // one object: the gate's effect depends on it
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// The owner fee fields (specs/2026-10-29-owner-fee/): an approved link is paid for a month, a pending one is paid and waits for staff.
const FEE_STATE: Record<string, string> = {
  approved: "paid", pending: "waiting_for_staff", removed: "removed", draft: "draft",
  awaiting_payment: "awaiting_payment", changes_requested: "changes_requested",
};

function link(id: number, name: string, role: string, status: string, listingStatus = "published", changeNote: string | null = null) {
  const unpaid = status === "removed" || status === "draft" || status === "awaiting_payment";
  return {
    link_id: id, listing_id: 100 + id, name, area: "Ogui", category: { slug: "clinic", name: "Clinic" },
    role, status, listing_status: listingStatus, change_note: changeNote, requested_at: "2026-10-20T10:30:00Z",
    paid_until: unpaid ? null : "2026-11-29T09:00:00Z", fee_state: FEE_STATE[status],
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
      if (path === "/provider/listings") return links === "fails" ? json({ detail: "boom" }, 500) : json({ fee_naira: "10000.00", grace_days: 7, items: links });
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
    expect(within(cards[0]).getByText("Approved. Paid until 29 Nov 2026.")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Clinic · Ogui · Manager")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Paid. Waiting for staff to phone the facility.")).toBeInTheDocument();
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
    expect(within(cards[1]).queryByRole("link", { name: "Edit this facility" })).not.toBeInTheDocument();
    expect(within(cards[2]).queryByRole("link", { name: "Edit this facility" })).not.toBeInTheDocument();
  });

  it("shows the status of each request in the owner's five words", async () => {
    stubApi([
      link(1, "Draft Clinic", "owner", "draft", "draft"),
      link(2, "Unpaid Clinic", "owner", "awaiting_payment", "draft"),
      link(3, "Review Clinic", "owner", "pending", "draft"),
      link(4, "Changes Clinic", "owner", "changes_requested", "draft"),
      link(5, "Live Clinic", "owner", "approved", "published"),
    ]);
    render(<ProviderPage />);

    const cards = within(await screen.findByRole("region", { name: "My facilities" })).getAllByRole("listitem");

    expect(cards.map((card) => within(card).getByText(/^Status: /).textContent)).toEqual([
      "Status: Draft",
      "Status: Waiting for payment",
      "Status: Waiting for review",
      "Status: Changes requested",
      "Status: Published",
    ]);
  });

  it("explains a draft and gives 'Edit and send' to its form, with no payment button and a way to delete it", async () => {
    stubApi([link(1, "Draft Clinic", "owner", "draft", "draft")]);
    render(<ProviderPage />);
    const card = within(await screen.findByRole("region", { name: "My facilities" })).getAllByRole("listitem")[0];

    expect(within(card).getByText(/Saved, not sent\. Nothing is public and our team cannot see it/)).toBeInTheDocument();
    const edit = within(card).getByRole("link", { name: "Edit and send" });
    expect(edit).toHaveAttribute("href", "/provider/request?link=1");
    expect(edit.className).toMatch(/min-h-\[50px\]/);
    expect(within(card).queryByRole("button", { name: /^Pay / })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: "Delete this draft" }));
    expect(within(card).getByText("Delete your draft for Draft Clinic? Nothing has been paid.")).toBeInTheDocument();
  });

  it("tells the owner that changes were requested, links to the form, and offers to withdraw with a refund", async () => {
    stubApi([link(4, "Changes Clinic", "owner", "changes_requested", "draft")]);
    render(<ProviderPage />);
    const card = within(await screen.findByRole("region", { name: "My facilities" })).getAllByRole("listitem")[0];

    expect(within(card).getByText("Our team asked for changes. Edit your request and send it again.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Edit and send" })).toHaveAttribute("href", "/provider/request?link=4");
    expect(within(card).queryByRole("link", { name: "Edit this facility" })).toBeNull();
    await userEvent.click(within(card).getByRole("button", { name: "Withdraw my request" }));
    expect(within(card).getByText(/payment will be given back in full/)).toBeInTheDocument();
  });

  it("shows what staff asked to change, in their words, on a request that needs changes", async () => {
    stubApi([link(4, "Changes Clinic", "owner", "changes_requested", "draft", "Please check the address.")]);
    render(<ProviderPage />);
    const card = within(await screen.findByRole("region", { name: "My facilities" })).getAllByRole("listitem")[0];

    expect(within(card).getByText("Our team asked: Please check the address.")).toBeInTheDocument();
  });

  it("shows no 'Our team asked' line when there is no note", async () => {
    stubApi([link(4, "Changes Clinic", "owner", "changes_requested", "draft"), link(1, "Draft Clinic", "owner", "draft", "draft")]);
    render(<ProviderPage />);
    const cards = within(await screen.findByRole("region", { name: "My facilities" })).getAllByRole("listitem");

    for (const card of cards) expect(within(card).queryByText(/^Our team asked:/)).toBeNull();
  });

  it("has no 'Edit and send' on a request that waits for payment or for staff", async () => {
    stubApi([link(2, "Unpaid Clinic", "owner", "awaiting_payment", "draft"), link(3, "Review Clinic", "owner", "pending", "draft")]);
    render(<ProviderPage />);
    const cards = within(await screen.findByRole("region", { name: "My facilities" })).getAllByRole("listitem");

    for (const card of cards) expect(within(card).queryByRole("link", { name: "Edit and send" })).toBeNull();
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
