// @vitest-environment jsdom
/** The owner fee on the provider's screens: paying the first month, "My facilities" with the fee and the paid date, stopping,
 * the receipts and the page Paystack sends the provider back to. Requirements: FR-44, FR-46, FR-50, NFR-06, NFR-10.
 * Spec: specs/2026-10-29-owner-fee/. The browser never talks to Paystack: it asks the API to start the payment and goes to the
 * https address the API returns. The amount is always the API's (OWNER_FEE_NAIRA). Every name and number here is fictional.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StaffGate, useStaff } from "@/components/admin/StaffGate";
import { FeeComplete } from "@/components/provider/FeeComplete";
import { PayOwnerFee } from "@/components/provider/PayOwnerFee";
import ProviderPage from "@/app/(dashboards)/provider/page";
import { saveStaffSession } from "@/lib/staff/session";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Call = { method: string; path: string; token: string | null; body: Record<string, unknown> | undefined };

type Link = {
  link_id: number; name: string; role?: string; status: string; fee_state: string; paid_until: string | null;
};

function linkRow(link: Link) {
  return {
    listing_id: 100 + link.link_id, area: "Ogui", category: { slug: "clinic", name: "Clinic" },
    requested_at: "2026-10-20T10:30:00Z", role: "owner", ...link,
  };
}

const MINE = {
  id: 101, slug: "paid-clinic", name: "Paid Clinic", category: { slug: "clinic", name: "Clinic" }, area: "Ogui",
  status: "published", last_verified_at: null, featured_until: null, featured_price_naira: "5000.00",
};

type Handlers = {
  links?: Link[];
  payments?: unknown[];
  start?: () => Response;
  verify?: () => Response;
  cancel?: () => Response;
};

function stubApi(handlers: Handlers = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      calls.push({
        method: init?.method ?? "GET",
        path: url.pathname,
        token: new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? null,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      });
      if (url.pathname === "/provider/listings") {
        return json({ fee_naira: "10000.00", grace_days: 7, items: (handlers.links ?? []).map(linkRow) });
      }
      if (url.pathname === "/provider/listing") return json(MINE);
      if (url.pathname === "/provider/payments") return json({ items: handlers.payments ?? [] });
      if (url.pathname === "/payments/owner-fee") {
        return (handlers.start ?? (() => json({ authorization_url: "https://checkout.paystack.com/fictional", reference: "SO-1-1", amount_naira: "10000.00" })))();
      }
      if (url.pathname.startsWith("/payments/owner-fee/")) {
        return (handlers.verify ?? (() => json({ status: "pending", link_status: "awaiting_payment", paid_until: null })))();
      }
      if (url.pathname.endsWith("/cancel")) {
        return (handlers.cancel ?? (() => json({ link_id: 1, status: "ending", access_until: "2026-11-10T09:00:00Z", refund: null })))();
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, owner: () => calls.filter((call) => call.path.startsWith("/payments/owner-fee")) };
}

const assign = vi.fn();

beforeEach(() => {
  window.sessionStorage.clear();
  assign.mockReset();
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true, configurable: true });
  saveStaffSession({ token: "tok", user: { id: 5, name: "Ada", email: "a@example.com", phone: null, role: "provider", is_active: true } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function PayInGate({ label }: { label: string }) {
  const { call } = useStaff();
  return <PayOwnerFee call={call} linkId={7} label={label} />;
}

function renderPay(label = "Pay ₦10,000 to send your request") {
  return render(<StaffGate area="provider"><PayInGate label={label} /></StaffGate>);
}

describe("the Pay button", () => {
  it("asks the API to start the fee of that link (no amount from the browser) and goes to the https address it returns", async () => {
    const { owner } = stubApi();
    renderPay();

    await userEvent.click(await screen.findByRole("button", { name: "Pay ₦10,000 to send your request" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/fictional"));
    expect(owner()).toEqual([{ method: "POST", path: "/payments/owner-fee", token: "tok", body: { link_id: 7 } }]);
  });

  it("never goes to an address that is not https", async () => {
    stubApi({ start: () => json({ authorization_url: "javascript:alert(1)", reference: "SO-7-1", amount_naira: "10000.00" }) });
    renderPay();

    await userEvent.click(await screen.findByRole("button", { name: /Pay/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start the payment. Try again.");
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    [503, "Payments are not set up yet.", "Payments are not set up yet."],
    [409, "There is nothing to pay for this request now.", "There is nothing to pay for this request now."],
    [502, "Could not start the payment. Try again.", "Could not start the payment. Try again."],
    [500, "boom", "Could not start the payment. Try again."],
  ])("on %i says the API's sentence only when it wrote one for the provider", async (status, detail, shown) => {
    stubApi({ start: () => json({ detail }, status) });
    renderPay();

    await userEvent.click(await screen.findByRole("button", { name: /Pay/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(shown);
    expect(screen.getByRole("button", { name: /Pay/ })).toBeEnabled();
  });

  it("is a large button and cannot be pressed twice while it works", async () => {
    stubApi();
    renderPay();
    const button = await screen.findByRole("button", { name: /Pay/ });

    expect(button.className).toMatch(/min-h-\[50px\]|min-h-12/);
    await userEvent.dblClick(button);

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  });
});

async function facilityCard(name: string) {
  const region = await screen.findByRole("region", { name: "My facilities" });
  return within(region).getByText(name).closest("li") as HTMLElement;
}

describe("My facilities and the owner fee", () => {
  it("says what each state means in words, and shows only the actions that fit it", async () => {
    stubApi({
      links: [
        { link_id: 1, name: "Unpaid Clinic", status: "awaiting_payment", fee_state: "awaiting_payment", paid_until: null },
        { link_id: 2, name: "Waiting Clinic", status: "pending", fee_state: "waiting_for_staff", paid_until: "2026-11-29T09:00:00Z" },
        { link_id: 3, name: "Paid Clinic", status: "approved", fee_state: "paid", paid_until: "2026-11-29T09:00:00Z" },
        { link_id: 4, name: "Grace Clinic", status: "approved", fee_state: "grace", paid_until: "2026-10-27T09:00:00Z" },
        { link_id: 5, name: "Lapsed Clinic", status: "lapsed", fee_state: "lapsed", paid_until: "2026-09-27T09:00:00Z" },
        { link_id: 6, name: "Ending Clinic", status: "ending", fee_state: "ending", paid_until: "2026-11-10T09:00:00Z" },
        { link_id: 7, name: "Gone Clinic", status: "removed", fee_state: "removed", paid_until: null },
      ],
    });
    render(<ProviderPage />);

    const unpaid = await facilityCard("Unpaid Clinic");
    expect(within(unpaid).getByText(/Not sent to our team yet/)).toBeInTheDocument();
    expect(within(unpaid).getByRole("button", { name: "Pay ₦10,000 to send your request" })).toBeInTheDocument();
    expect(within(unpaid).queryByRole("link", { name: "Edit this facility" })).toBeNull();

    const waiting = await facilityCard("Waiting Clinic");
    expect(within(waiting).getByText("Paid. Waiting for staff to phone the facility.")).toBeInTheDocument();
    expect(within(waiting).queryByRole("button", { name: /^Pay/ })).toBeNull();
    expect(within(waiting).getByRole("button", { name: "Withdraw my request" })).toBeInTheDocument();

    const paid = await facilityCard("Paid Clinic");
    expect(within(paid).getByText("Approved. Paid until 29 Nov 2026.")).toBeInTheDocument();
    expect(within(paid).getByRole("link", { name: "Edit this facility" })).toHaveAttribute("href", "/provider/edit?listing=103");
    expect(within(paid).getByRole("button", { name: "Pay ₦10,000 for next month" })).toBeInTheDocument();
    expect(within(paid).getByRole("button", { name: "Stop managing" })).toBeInTheDocument();

    const grace = await facilityCard("Grace Clinic");
    expect(within(grace).getByText(/The paid month ended on 27 Oct 2026\. You can edit until 3 Nov 2026/)).toBeInTheDocument();
    expect(within(grace).getByRole("link", { name: "Edit this facility" })).toBeInTheDocument();
    expect(within(grace).getByRole("button", { name: "Pay ₦10,000 for next month" })).toBeInTheDocument();

    const lapsed = await facilityCard("Lapsed Clinic");
    expect(within(lapsed).getByText(/Editing is paused because the month was not paid\. Your listing is still public and free\./)).toBeInTheDocument();
    expect(within(lapsed).queryByRole("link", { name: "Edit this facility" })).toBeNull();
    expect(within(lapsed).getByRole("button", { name: "Pay ₦10,000 to edit again" })).toBeInTheDocument();

    const ending = await facilityCard("Ending Clinic");
    expect(within(ending).getByText("You stopped managing this facility. You can edit until 10 Nov 2026.")).toBeInTheDocument();
    expect(within(ending).getByRole("link", { name: "Edit this facility" })).toBeInTheDocument();
    expect(within(ending).getByRole("button", { name: "Pay ₦10,000 to keep managing" })).toBeInTheDocument();

    const gone = await facilityCard("Gone Clinic");
    expect(within(gone).getByText("Removed.")).toBeInTheDocument();
    expect(within(gone).queryByRole("button")).toBeNull();
    expect(within(gone).queryByRole("link")).toBeNull();
  });

  it("shows the monthly fee as the API gave it, never a number of its own", () => {
    for (const file of ["components/provider/MyFacilities.tsx", "components/provider/PayOwnerFee.tsx", "components/provider/FeeComplete.tsx"]) {
      expect(readSource(file)).not.toMatch(/10[ ,]?000/);
    }
  });

  it("asks before it stops managing, then says until when the person can still edit and that nothing is refunded", async () => {
    const { calls } = stubApi({
      links: [{ link_id: 3, name: "Paid Clinic", status: "approved", fee_state: "paid", paid_until: "2026-11-10T09:00:00Z" }],
      cancel: () => json({ link_id: 3, status: "ending", access_until: "2026-11-10T09:00:00Z", refund: null }),
    });
    render(<ProviderPage />);
    const card = await facilityCard("Paid Clinic");

    await userEvent.click(within(card).getByRole("button", { name: "Stop managing" }));
    expect(within(card).getByText(/Stop managing Paid Clinic\?/)).toBeInTheDocument();
    expect(within(card).getByText(/You can still edit until 10 Nov 2026\. The month you paid is not refunded\. Your listing stays public and free\./)).toBeInTheDocument();
    expect(calls.some((call) => call.path.endsWith("/cancel"))).toBe(false); // nothing is sent before the second click

    await userEvent.click(within(card).getByRole("button", { name: "Yes, stop managing" }));

    expect(await within(card).findByRole("status")).toHaveTextContent("You stopped managing this facility. You can edit until 10 Nov 2026.");
    expect(calls.find((call) => call.path.endsWith("/cancel"))).toMatchObject({ method: "POST", path: "/provider/links/3/cancel", token: "tok" });
  });

  it("can change its mind: Keep managing sends nothing", async () => {
    const { calls } = stubApi({
      links: [{ link_id: 3, name: "Paid Clinic", status: "approved", fee_state: "paid", paid_until: "2026-11-10T09:00:00Z" }],
    });
    render(<ProviderPage />);
    const card = await facilityCard("Paid Clinic");

    await userEvent.click(within(card).getByRole("button", { name: "Stop managing" }));
    await userEvent.click(within(card).getByRole("button", { name: "Keep managing" }));

    expect(within(card).getByRole("button", { name: "Stop managing" })).toBeInTheDocument();
    expect(calls.some((call) => call.path.endsWith("/cancel"))).toBe(false);
  });

  it("withdrawing a paid request says the payment is given back, and shows the result of the refund", async () => {
    stubApi({
      links: [{ link_id: 2, name: "Waiting Clinic", status: "pending", fee_state: "waiting_for_staff", paid_until: "2026-11-29T09:00:00Z" }],
      cancel: () => json({ link_id: 2, status: "removed", access_until: null, refund: "done" }),
    });
    render(<ProviderPage />);
    const card = await facilityCard("Waiting Clinic");

    await userEvent.click(within(card).getByRole("button", { name: "Withdraw my request" }));
    expect(within(card).getByText(/Your payment will be given back in full\./)).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: "Yes, withdraw" }));

    expect(await within(card).findByRole("status")).toHaveTextContent("Your request was withdrawn. Your payment is being given back in full.");
  });

  it("lists the receipts: facility, date paid and the date the month covers", async () => {
    stubApi({
      links: [{ link_id: 3, name: "Paid Clinic", status: "approved", fee_state: "paid", paid_until: "2026-11-29T09:00:00Z" }],
      payments: [{
        reference: "SO-3-1730000000", kind: "owner_fee", listing_id: 103, listing_name: "Paid Clinic",
        paid_at: "2026-10-29T09:00:00Z", paid_until: "2026-11-29T09:00:00Z",
      }],
    });
    render(<ProviderPage />);

    const region = await screen.findByRole("region", { name: "My payments" });
    const row = within(region).getByRole("listitem");
    expect(row).toHaveTextContent("Paid Clinic");
    expect(row).toHaveTextContent("Paid on 29 Oct 2026");
    expect(row).toHaveTextContent("covers until 29 Nov 2026");
    expect(row).toHaveTextContent("SO-3-1730000000");
  });

  it("draws no payments section when there are none", async () => {
    stubApi({ links: [{ link_id: 3, name: "Paid Clinic", status: "approved", fee_state: "paid", paid_until: "2026-11-29T09:00:00Z" }] });
    render(<ProviderPage />);
    await facilityCard("Paid Clinic");

    expect(screen.queryByRole("region", { name: "My payments" })).toBeNull();
  });
});

describe("the page Paystack sends the provider back to", () => {
  function renderComplete(reference: string | null) {
    return render(<StaffGate area="provider"><FeeComplete reference={reference} /></StaffGate>);
  }

  it("says confirmed only when the API says the signed webhook was applied, with the paid date, for a request that now waits for staff", async () => {
    stubApi({ verify: () => json({ status: "success", link_status: "pending", paid_until: "2026-11-29T09:00:00Z" }) });
    renderComplete("SO-3-1730000000");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Payment confirmed. Our team will now phone the facility to check your request. Paid until 29 Nov 2026.",
      ),
    );
    expect(screen.getByRole("link", { name: "Back to my facilities" })).toHaveAttribute("href", "/provider");
  });

  it("says the owner can edit after a renewal", async () => {
    stubApi({ verify: () => json({ status: "success", link_status: "approved", paid_until: "2026-12-29T09:00:00Z" }) });
    renderComplete("SO-3-1730000000");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Payment confirmed. You can edit until 29 Dec 2026."),
    );
  });

  it("keeps asking every 3 seconds while pending, then says it is still confirming after 30 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { owner } = stubApi();
    renderComplete("SO-3-1730000000");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Confirming your payment…");
    for (let second = 0; second < 40; second += 3) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
    }

    expect(screen.getByRole("status")).toHaveTextContent("Still confirming. You can leave this page; we will update your request.");
    const asked = owner().length;
    expect(asked).toBeGreaterThanOrEqual(10);
    expect(asked).toBeLessThanOrEqual(11);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(owner()).toHaveLength(asked); // it stopped asking
  });

  it("says it cannot find the payment for a reference that is not the person's, or no reference", async () => {
    stubApi({ verify: () => json({ detail: "Payment not found" }, 404) });
    const { unmount } = renderComplete("SO-9-1");
    expect(await screen.findByText(/We could not find your payment/)).toBeInTheDocument();
    unmount();

    renderComplete(null);
    expect(await screen.findByText(/We could not find your payment/)).toBeInTheDocument();
  });
});

describe("where it lives", () => {
  it("has its own page at /provider/fee-complete, for the provider role only, that only reads the reference", () => {
    const page = readSource("app/(dashboards)/provider/fee-complete/page.tsx");
    expect(page).toContain('area="provider"');
    expect(page).toContain("FeeComplete");
    expect(page).toMatch(/reference|trxref/);
  });
});
