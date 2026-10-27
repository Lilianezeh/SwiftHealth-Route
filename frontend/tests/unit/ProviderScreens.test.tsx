// @vitest-environment jsdom
/** The provider screens: my facility, edit, get featured, payment complete. Requirements: FR-43, FR-44, FR-46, NFR-06, NFR-10.
 * UI spec 4.1 to 4.4 and "Phase 12 details"; decisions I1, I2 and I10 to I13 in specs/2026-10-20-providers-payments/requirements.md.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProviderEditPage from "@/app/(dashboards)/provider/edit/page";
import ProviderFeaturedPage from "@/app/(dashboards)/provider/featured/page";
import PaymentCompletePage from "@/app/(dashboards)/provider/payment-complete/page";
import ProviderPage from "@/app/(dashboards)/provider/page";
import { resetMetaCache } from "@/lib/api/meta";
import type { ProviderListing } from "@/types/staff";

import { META, json, neverAnswers } from "../helpers/api";
import { headerOf, loginAs, stubStaffApi } from "../helpers/queue";
import { providerListing } from "../helpers/provider";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const mine = (overrides: Partial<ProviderListing> = {}) => () => json(providerListing(overrides));
const withMeta = (handlers: Parameters<typeof stubStaffApi>[0]) => stubStaffApi({ "/meta": () => json(META), ...handlers });

beforeEach(() => {
  window.sessionStorage.clear();
  resetMetaCache();
  replace.mockReset();
  loginAs("provider");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mainSection() {
  return screen.getByRole("heading", { level: 1 }).closest("section") as HTMLElement;
}

describe("who may open the provider screens", () => {
  it("sends a visitor with no session to the login and asks for nothing", async () => {
    window.sessionStorage.clear();
    const { requests } = withMeta({});
    render(<ProviderPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    expect(requests).toHaveLength(0);
  });

  it.each(["verifier", "editor", "admin"] as const)("tells a %s that the role cannot open it, with the way to their start page", async (role) => {
    loginAs(role);
    const { requests } = withMeta({});
    render(<ProviderPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(requests).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Go to your start page" })).toBeInTheDocument();
  });

  it("gives a provider the staff bar with Dashboard, Edit my facility, Get featured and Log out, and nothing of the staff area", async () => {
    withMeta({ "/provider/listing": mine() });
    render(<ProviderPage />);

    const bar = await screen.findByRole("navigation", { name: "Staff" });

    expect(within(bar).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Dashboard", "/provider"],
      ["Edit my facility", "/provider/edit"],
      ["Get featured", "/provider/featured"],
      ["Security", "/admin/security"], // the authenticator app (FR-58): every role has it
      ["Account", "/account"], // my account (FR-54): every role has it
    ]);
    expect(within(bar).getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});

describe("my facility (/provider)", () => {
  it("asks for my listing with the token in the header and nothing in the address", async () => {
    const { on } = withMeta({ "/provider/listing": mine() });
    render(<ProviderPage />);

    await screen.findByRole("heading", { level: 1, name: "My facility" });

    const [request] = on("/provider/listing");
    expect(headerOf(request.init, "Authorization")).toBe("Bearer tok");
    expect(request.url.search).toBe("");
  });

  it("shows the name, the place, the status in words, the last verified date and 'Not featured'", async () => {
    withMeta({ "/provider/listing": mine() });
    render(<ProviderPage />);
    await screen.findByRole("heading", { level: 1, name: "My facility" });

    const section = mainSection();
    expect(section).toHaveTextContent("Night Pharmacy A");
    expect(section).toHaveTextContent("Pharmacy · New Haven");
    expect(section).toHaveTextContent("Published");
    expect(section).toHaveTextContent("Last verified 1 Oct 2026");
    expect(section).toHaveTextContent("Not featured");
  });

  it("shows when the featured period ends", async () => {
    withMeta({ "/provider/listing": mine({ featured_until: "2026-11-06T09:00:00Z" }) });
    render(<ProviderPage />);
    await screen.findByRole("heading", { level: 1, name: "My facility" });

    expect(mainSection()).toHaveTextContent("Featured until 6 Nov 2026");
  });

  it("says 'Not yet verified' when there is no date", async () => {
    withMeta({ "/provider/listing": mine({ last_verified_at: null }) });
    render(<ProviderPage />);
    await screen.findByRole("heading", { level: 1, name: "My facility" });

    expect(mainSection()).toHaveTextContent("Not yet verified");
  });

  it("has the two buttons, each at least 48 px high", async () => {
    withMeta({ "/provider/listing": mine() });
    render(<ProviderPage />);
    await screen.findByRole("heading", { level: 1, name: "My facility" });

    const edit = within(mainSection()).getByRole("link", { name: "Edit my facility" });
    const featured = within(mainSection()).getByRole("link", { name: "Get featured" });
    expect(edit).toHaveAttribute("href", "/provider/edit");
    expect(featured).toHaveAttribute("href", "/provider/featured");
    for (const link of [edit, featured]) expect(link.className).toMatch(/min-h-12|min-h-\[50px\]/);
  });

  it("offers no Get featured button for a listing that is not published, and says why", async () => {
    withMeta({ "/provider/listing": mine({ status: "hidden" }) });
    render(<ProviderPage />);
    await screen.findByRole("heading", { level: 1, name: "My facility" });

    expect(mainSection()).toHaveTextContent("Only a published listing can be featured.");
    expect(within(mainSection()).queryByRole("link", { name: "Get featured" })).toBeNull();
    expect(within(mainSection()).getByRole("link", { name: "Edit my facility" })).toBeInTheDocument();
  });

  it("says no facility is linked on an answer 404, and offers nothing else", async () => {
    withMeta({ "/provider/listing": () => json({ detail: "No listing is linked to your account." }, 404) });
    render(<ProviderPage />);

    expect(await screen.findByText("No facility is linked to your account yet. Ask the SwiftHealth team to link it.")).toBeInTheDocument();
    expect(within(mainSection()).queryAllByRole("link")).toHaveLength(0); // the staff bar has the links, the page none
  });

  it("shows the skeleton, then 'waking up' after 5 seconds, then the error with Retry after 45", async () => {
    vi.useFakeTimers();
    withMeta({ "/provider/listing": (_url, init) => neverAnswers(undefined, init?.signal ?? undefined) });
    render(<ProviderPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("queue-status")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByText("The service is waking up. This can take up to a minute.")).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(40_000);
    });

    expect(screen.getByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
  });

  it("Retry asks again after an error", async () => {
    let attempts = 0;
    withMeta({ "/provider/listing": () => (++attempts === 1 ? json({ detail: "x" }, 500) : json(providerListing())) });
    render(<ProviderPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { level: 1, name: "My facility" })).toBeInTheDocument();
  });

  it("goes to the login on an answer 401", async () => {
    withMeta({ "/provider/listing": () => json({ detail: "Invalid or expired token" }, 401) });
    render(<ProviderPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });
});

describe("edit my facility (/provider/edit)", () => {
  async function openEdit(overrides: Partial<ProviderListing> = {}) {
    const stub = withMeta({
      "/provider/listing": (_url, init) =>
        init?.method === "PATCH" ? json(providerListing({ ...overrides, ...(JSON.parse(String(init.body)) as object) })) : json(providerListing(overrides)),
    });
    render(<ProviderEditPage />);
    await screen.findByRole("heading", { level: 1, name: "Edit my facility" });
    await screen.findByLabelText("Description (shown to the public)");
    return stub;
  }

  it("shows the four sections a provider may change and nothing else", async () => {
    await openEdit();

    for (const name of ["Phones", "Opening hours", "Services and fees", "Description"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    for (const name of ["Basics", "Location", "Submission details"]) {
      expect(screen.queryByRole("heading", { level: 2, name })).toBeNull();
    }
    for (const label of ["Name", "Category", "Area", "Address", "Landmark", "Latitude", "Longitude"]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
    expect(screen.getByText("Changes to phone numbers or hours are re-verified by our team. Your listing stays visible until then.")).toBeInTheDocument();
  });

  it("starts with the listing's own values", async () => {
    await openEdit();

    expect(screen.getByLabelText("Description (shown to the public)")).toHaveValue("Demo data (fictional): not a real facility.");
    expect(screen.getByLabelText("Phone number 1")).toHaveValue("+2340000000012");
  });

  it("does nothing on Save when nothing changed", async () => {
    const { on } = await openEdit();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(on("/provider/listing", "PATCH")).toHaveLength(0);
  });

  it("sends only the description when only the description changed, with the token, and says Saved", async () => {
    const { on } = await openEdit();
    const box = screen.getByLabelText("Description (shown to the public)");
    await userEvent.clear(box);
    await userEvent.type(box, "Open every weekday.");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    const [patch] = on("/provider/listing", "PATCH");
    expect(JSON.parse(String(patch.init?.body))).toEqual({ description: "Open every weekday." });
    expect(headerOf(patch.init, "Authorization")).toBe("Bearer tok");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(on("/provider/listing", "PATCH")).toHaveLength(1); // saved: nothing left to send
  });

  it("sends only the phones when a phone number changed", async () => {
    const { on } = await openEdit();
    const number = screen.getByLabelText("Phone number 1");
    await userEvent.clear(number);
    await userEvent.type(number, "08031112222");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");
    const body = JSON.parse(String(on("/provider/listing", "PATCH")[0].init?.body)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["phones"]);
  });

  it("names a problem in words and does not call when a phone number is blank", async () => {
    const { on } = await openEdit();
    await userEvent.clear(screen.getByLabelText("Phone number 1"));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Enter every phone number.")).toBeInTheDocument();
    expect(on("/provider/listing", "PATCH")).toHaveLength(0);
  });

  it("shows the API's sentence when the save is refused", async () => {
    withMeta({
      "/provider/listing": (_url, init) =>
        init?.method === "PATCH" ? json({ detail: "phones: number must be a Nigerian phone number" }, 422) : json(providerListing()),
    });
    render(<ProviderEditPage />);
    await screen.findByLabelText("Description (shown to the public)");
    await userEvent.type(screen.getByLabelText("Description (shown to the public)"), " More.");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("phones: number must be a Nigerian phone number");
  });

  it("asks the browser before leaving with unsaved changes, and not otherwise", async () => {
    await openEdit();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(screen.getByLabelText("Description (shown to the public)"), { target: { value: "Changed" } });

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("says no facility is linked on an answer 404", async () => {
    withMeta({ "/provider/listing": () => json({ detail: "No listing is linked to your account." }, 404) });
    render(<ProviderEditPage />);

    expect(await screen.findByText("No facility is linked to your account yet. Ask the SwiftHealth team to link it.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});

describe("get featured (/provider/featured)", () => {
  const assign = vi.fn();

  beforeEach(() => {
    assign.mockReset();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true, configurable: true });
  });

  async function openFeatured(overrides: Partial<ProviderListing> = {}, started: () => Response | Promise<Response> = () => json({ authorization_url: "https://checkout.paystack.com/fictional", reference: "SH-12-1", amount_naira: "5000.00" })) {
    const stub = withMeta({ "/provider/listing": mine(overrides), "/payments/featured": started });
    render(<ProviderFeaturedPage />);
    await screen.findByRole("heading", { level: 1, name: "Get featured" });
    return stub;
  }

  it("explains what featured means, never in SwiftRescue, and shows the price from the API", async () => {
    await openFeatured({ featured_price_naira: "7500.00" });

    expect(await screen.findByText("Price: ₦7,500 for 30 days")).toBeInTheDocument();
    expect(screen.getByText(/appear first in matching searches with a Sponsored label for 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/never shown in SwiftRescue/)).toBeInTheDocument();
    expect(screen.getByText(/test mode/)).toBeInTheDocument();
  });

  it("starts the payment with one call that carries the token and the monthly plan, then goes to Paystack's page", async () => {
    const { on } = await openFeatured();
    const pay = await screen.findByRole("button", { name: "Pay with Paystack" });
    expect(pay.className).toMatch(/min-h-\[50px\]/);

    await userEvent.click(pay);

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.paystack.com/fictional"));
    const [start] = on("/payments/featured", "POST");
    expect(JSON.parse(String(start.init?.body))).toEqual({ plan: "monthly" });
    expect(headerOf(start.init, "Authorization")).toBe("Bearer tok");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem("swifthealth.staff-session")).not.toContain("paystack");
  });

  it("is off while it waits, so a double tap makes one payment", async () => {
    let calls = 0;
    await openFeatured({}, (): Promise<Response> => {
      calls += 1;
      return new Promise(() => {});
    });
    const pay = await screen.findByRole("button", { name: "Pay with Paystack" });

    await userEvent.click(pay);
    await userEvent.click(pay);

    expect(calls).toBe(1);
    expect(pay).toBeDisabled();
  });

  it("refuses to go anywhere that is not an https address", async () => {
    await openFeatured({}, () => json({ authorization_url: "javascript:alert(1)", reference: "SH-12-1", amount_naira: "5000.00" }));

    await userEvent.click(await screen.findByRole("button", { name: "Pay with Paystack" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start the payment. Try again.");
    expect(assign).not.toHaveBeenCalled();
  });

  it.each([
    [503, "Payments are not set up yet."],
    [503, "Live payments are switched off."],
    [502, "Could not start the payment. Try again."],
    [400, "Only a published listing can be featured."],
  ])("shows the API's sentence for an answer %s: %s", async (status, detail) => {
    await openFeatured({}, () => json({ detail }, status));

    await userEvent.click(await screen.findByRole("button", { name: "Pay with Paystack" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(detail);
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pay with Paystack" })).toBeEnabled();
  });

  it("shows a plain sentence, not the server's text, for any other failure", async () => {
    await openFeatured({}, () => json({ detail: "Traceback: secret internals" }, 500));

    await userEvent.click(await screen.findByRole("button", { name: "Pay with Paystack" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not start the payment. Try again.");
    expect(document.body.textContent).not.toContain("Traceback");
  });

  it("offers no payment for a listing that is not published, and calls nothing", async () => {
    const { on } = await openFeatured({ status: "draft" });

    expect(await screen.findByText("Only a published listing can be featured.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay with Paystack" })).toBeNull();
    expect(on("/payments/featured", "POST")).toHaveLength(0);
  });
});

describe("payment complete (/provider/payment-complete)", () => {
  async function openComplete(search: { reference?: string; trxref?: string }) {
    render(await PaymentCompletePage({ searchParams: Promise.resolve(search) }));
  }

  const success = () => json({ status: "success", featured_until: "2026-11-06T09:00:00Z" });
  const pending = () => json({ status: "pending", featured_until: null });

  it("confirms the payment when the first answer is success", async () => {
    const { on } = withMeta({ "/payments/verify/SH-12-1": success });
    await openComplete({ reference: "SH-12-1" });

    expect(await screen.findByText("Payment confirmed. Featured until 6 Nov 2026.")).toBeInTheDocument();
    expect(on("/payments/verify/SH-12-1")).toHaveLength(1);
    expect(headerOf(on("/payments/verify/SH-12-1")[0].init, "Authorization")).toBe("Bearer tok");
    expect(screen.getByRole("link", { name: "Back to my facility" })).toHaveAttribute("href", "/provider");
  });

  it("also reads the reference from trxref", async () => {
    const { on } = withMeta({ "/payments/verify/SH-12-2": success });
    await openComplete({ trxref: "SH-12-2" });

    await screen.findByText(/Payment confirmed/);
    expect(on("/payments/verify/SH-12-2")).toHaveLength(1);
  });

  it("asks every 3 seconds while pending, stops when it succeeds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let answers = 0;
    const { on } = withMeta({ "/payments/verify/SH-12-1": () => (++answers < 3 ? pending() : success()) });
    await openComplete({ reference: "SH-12-1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Confirming your payment");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(screen.getByText("Payment confirmed. Featured until 6 Nov 2026.")).toBeInTheDocument();
    expect(on("/payments/verify/SH-12-1")).toHaveLength(3);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(on("/payments/verify/SH-12-1")).toHaveLength(3); // no more asking
  });

  it("says it is still confirming after 30 seconds of pending, and stops asking", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { on } = withMeta({ "/payments/verify/SH-12-1": pending });
    await openComplete({ reference: "SH-12-1" });

    for (let second = 0; second < 40; second += 3) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
    }

    expect(screen.getByRole("status")).toHaveTextContent("Still confirming. You can leave this page; we will update your listing.");
    const asked = on("/payments/verify/SH-12-1").length;
    expect(asked).toBeGreaterThanOrEqual(10);
    expect(asked).toBeLessThanOrEqual(11);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(on("/payments/verify/SH-12-1")).toHaveLength(asked);
  });

  it("keeps asking after a network failure", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let answers = 0;
    withMeta({
      "/payments/verify/SH-12-1": () => {
        if (++answers === 1) throw new TypeError("Failed to fetch");
        return success();
      },
    });
    await openComplete({ reference: "SH-12-1" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });

    expect(screen.getByText("Payment confirmed. Featured until 6 Nov 2026.")).toBeInTheDocument();
  });

  it.each([
    ["no reference in the address", {}],
    ["a blank reference", { reference: "  " }],
  ])("says it could not find the payment with %s, and asks for nothing", async (_name, search) => {
    const { requests } = withMeta({});
    await openComplete(search);

    expect(await screen.findByText("We could not find your payment. Go back to Get featured.")).toBeInTheDocument();
    expect(within(mainSection()).getByRole("link", { name: "Get featured" })).toHaveAttribute("href", "/provider/featured");
    expect(requests.filter((request) => request.url.pathname.startsWith("/payments"))).toHaveLength(0);
  });

  it("says the same on an answer 404 (a reference of someone else's listing)", async () => {
    withMeta({ "/payments/verify/SH-99-1": () => json({ detail: "Payment not found" }, 404) });
    await openComplete({ reference: "SH-99-1" });

    expect(await screen.findByText("We could not find your payment. Go back to Get featured.")).toBeInTheDocument();
  });

  it("encodes a strange reference so it cannot change the path", async () => {
    const { requests } = withMeta({});
    await openComplete({ reference: "../../admin/users" });

    await waitFor(() => expect(requests.some((request) => request.url.pathname.startsWith("/payments/verify/"))).toBe(true));
    expect(requests.every((request) => !request.url.pathname.startsWith("/admin"))).toBe(true);
    expect(requests.find((request) => request.url.pathname.startsWith("/payments/verify/"))?.url.href).toContain("..%2F..%2Fadmin%2Fusers");
  });

  it("is closed to a role that is not a provider", async () => {
    loginAs("editor");
    const { requests } = withMeta({});
    await openComplete({ reference: "SH-12-1" });

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(requests.filter((request) => request.url.pathname.startsWith("/payments"))).toHaveLength(0);
  });
});

describe("what is never done", () => {
  it("keeps nothing in local storage, calls Paystack from nowhere in the browser, and writes nothing to the console", () => {
    for (const file of [
      "components/provider/ProviderHome.tsx",
      "components/provider/ProviderEdit.tsx",
      "components/provider/GetFeatured.tsx",
      "components/provider/PaymentComplete.tsx",
      "hooks/useProviderListing.ts",
      "lib/api/provider.ts",
    ]) {
      const source = readSource(file);
      expect(source, file).not.toMatch(/localStorage|console\./);
      expect(source, file).not.toMatch(/paystack\.co|sk_(test|live)_|pk_(test|live)_/);
    }
  });
});
