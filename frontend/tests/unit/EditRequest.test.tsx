// @vitest-environment jsdom
/** Editing a saved request: a draft, or a request that staff asked to change. Requirements: US-17, FR-50, FR-23, NFR-06, NFR-10.
 * Spec: specs/2026-11-01-owner-form-fields/; UI spec 2.9 ("The full owner form"). Every name and number here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StaffGate } from "@/components/admin/StaffGate";
import { EditRequest } from "@/components/facility/EditRequest";
import { resetMetaCache } from "@/lib/api/meta";
import { saveStaffSession } from "@/lib/staff/session";

import { META, json } from "../helpers/api";
import { readSource } from "../helpers/source";

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

type Call = { method: string; path: string; token: string | null; body: Record<string, unknown> | undefined };

const SAVED = {
  link_id: 8,
  listing_id: 7,
  status: "draft",
  role: "manager",
  notes: "Ask for Ada",
  facility_name: "Example Clinic",
  category: "clinic",
  area: "Ogui",
  address: "4 Example Street",
  landmark: "Behind the market",
  description: "A small clinic.",
  email: "front-desk@clinic.example.com",
  phone: "+2348030000000",
  phone_has_whatsapp: true,
  other_phones: [{ number: "+2348030000001", label: "Pharmacy desk", is_whatsapp: false }],
  is_24_hours: false,
  opening_hours: [{ day_of_week: 0, opens_at: "08:00:00", closes_at: "17:00:00", is_closed: false }],
  services: ["Consultation"],
};

function stubApi(request: Response | Record<string, unknown> = SAVED, save?: (call: Call) => Response) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const call: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        token: new Headers(init?.headers).get("Authorization")?.replace("Bearer ", "") ?? null,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      };
      calls.push(call);
      if (url.pathname === "/meta") return json(META);
      if (url.pathname === "/provider/listings") return json({ fee_naira: "10000.00", grace_days: 7, items: [] });
      if (url.pathname === "/provider/requests/8" && call.method === "GET") {
        return request instanceof Response ? request : json(request);
      }
      if (url.pathname === "/provider/requests/8" && call.method === "PUT") {
        return (save ?? (() => json({ message: "Saved.", listing_id: 7, link_id: 8, status: "draft", fee_naira: "10000.00" })))(call);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, puts: () => calls.filter((call) => call.method === "PUT") };
}

function open() {
  render(
    <StaffGate area="provider">
      <EditRequest linkId={8} />
    </StaffGate>,
  );
}

beforeEach(() => {
  resetMetaCache();
  window.sessionStorage.clear();
  saveStaffSession({ token: "tok", user: { id: 5, name: "Ada", email: "ada@example.com", phone: null, role: "provider", is_active: true } });
});
afterEach(() => vi.unstubAllGlobals());

describe("a draft", () => {
  it("fills the form with what was saved, in the reading format for numbers, and shows the status", async () => {
    stubApi();
    open();

    expect(await screen.findByLabelText("Facility name")).toHaveValue("Example Clinic");
    expect(screen.getByText("Status: Draft")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone number of the facility")).toHaveValue("0803 000 0000");
    expect(screen.getAllByRole("checkbox", { name: "This number has WhatsApp" })[0]).toBeChecked(); // the main number's
    expect(within(screen.getByRole("group", { name: "Phone number 2" })).getByLabelText("Number")).toHaveValue("0803 000 0001");
    expect(within(screen.getByRole("group", { name: "Monday" })).getByLabelText("Opens")).toHaveValue("08:00");
    expect(await screen.findByRole("checkbox", { name: "Consultation" })).toBeChecked(); // the list comes with GET /meta
    expect(screen.getByLabelText("Category")).toHaveValue("clinic");
    expect(screen.getByLabelText("Area")).toHaveValue("Ogui");
    expect(screen.getByLabelText("Short description (optional)")).toHaveValue("A small clinic.");
    expect(screen.getByLabelText("Email of the facility (optional)")).toHaveValue("front-desk@clinic.example.com");
    expect(screen.getByRole("radio", { name: "I manage it" })).toBeChecked();
  });

  it("saves as a draft with a PUT to its own request, with the token", async () => {
    const { puts } = stubApi();
    open();
    await userEvent.type(await screen.findByLabelText("Landmark (optional)"), " gate");

    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
    expect(puts()).toHaveLength(1);
    expect(puts()[0]).toMatchObject({ path: "/provider/requests/8", token: "tok", body: { landmark: "Behind the market gate", save_as_draft: true } });
  });

  it("sends it, and then asks for the first month", async () => {
    const { puts } = stubApi(SAVED, () => json({ message: "Thanks.", listing_id: 7, link_id: 8, status: "awaiting_payment", fee_naira: "10000.00" }));
    open();
    await screen.findByLabelText("Facility name");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Pay ₦10,000 to send your request" })).toBeInTheDocument();
    expect(puts()[0].body).toMatchObject({ save_as_draft: false });
  });

  it("says in words what is wrong and sends nothing", async () => {
    const { puts } = stubApi();
    open();
    const name = await screen.findByLabelText("Facility name");
    await userEvent.clear(name);

    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the facility name.");
    expect(puts()).toEqual([]);
  });
});

describe("a request that needs changes", () => {
  const NEEDS_CHANGES = { ...SAVED, status: "changes_requested" };

  it("shows the status and sending puts it back in front of our team without asking for payment again", async () => {
    const { puts } = stubApi(NEEDS_CHANGES, () => json({ message: "Thanks. Your changes are sent to our team.", listing_id: 7, link_id: 8, status: "pending", fee_naira: "10000.00" }));
    open();
    expect(await screen.findByText("Status: Changes requested")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks. Your changes are sent to our team.");
    expect(screen.queryByRole("button", { name: /^Pay / })).toBeNull();
    expect(puts()).toHaveLength(1);
  });
});

describe("a request that cannot be edited", () => {
  it.each(["awaiting_payment", "pending", "approved"])("with status %s shows no form, only where it stands", async (status) => {
    stubApi({ ...SAVED, status });
    open();

    expect(await screen.findByText(/This request cannot be changed now/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Facility name")).toBeNull();
    expect(screen.getByRole("link", { name: "Go to My facilities" })).toHaveAttribute("href", "/provider");
  });

  it("says it could not be found when the API says 404, and shows no form", async () => {
    stubApi(json({ detail: "Request not found" }, 404));
    open();

    expect(await screen.findByText("We could not find this request.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Facility name")).toBeNull();
  });

  it("says it could not be loaded, with a Retry that loads it again, when the connection fails", async () => {
    stubApi(json({ detail: "boom" }, 500));
    open();
    await screen.findByText("We could not load this request. Check your connection and try again.");

    stubApi();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByLabelText("Facility name")).toBeInTheDocument());
  });
});

describe("the files", () => {
  it("keep the API calls in lib/api", () => {
    expect(readSource("components/facility/EditRequest.tsx")).not.toMatch(/fetch\(/);
    expect(readSource("app/(dashboards)/provider/request/page.tsx")).toContain("EditRequest");
  });
});
