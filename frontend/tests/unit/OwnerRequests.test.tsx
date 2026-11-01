// @vitest-environment jsdom
/** The owner requests screen (editor and admin): phone the facility, write who answered, approve or reject.
 * Requirements: FR-50, US-19, NFR-10. UI spec 3.10 (accounts phase 6b); api-spec 7, "Phase 6a".
 * Every name, address and number here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OwnerRequestsPage from "@/app/(dashboards)/admin/owner-requests/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { json } from "../helpers/api";

const replace = vi.fn();
const router = { replace, push: vi.fn() }; // one object: the gate's effect depends on it
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// The map is Leaflet, drawn in the browser; its own tests are in FacilityMap.test.tsx. Here it is a stand-in that says where the pin is.
vi.mock("@/components/map/FacilityMap", () => ({
  FacilityMap: ({ name, latitude, longitude }: { name: string; latitude: number; longitude: number }) => (
    <div role="region" aria-label={`Map showing where ${name} is`}>{`Pin at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</div>
  ),
}));

const PHOTO = "https://res.cloudinary.com/demo-cloud/image/upload/v1/swifthealth/owner-entrances/front.jpg";

function request(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    role: "owner",
    requested_at: "2026-10-20T10:30:00Z",
    reason: null,
    previous_change_note: null,
    person: { id: 20 + id, name: `Ada ${id}`, email: `ada${id}@example.com`, phone: "+2348030000123" },
    listing: {
      id: 100 + id,
      name: `Eze Clinic ${id}`,
      area: "Ogui",
      category: { slug: "clinic", name: "Clinic" },
      address: "4 Example Street",
      landmark: "Behind the market",
      description: "A small clinic for families.",
      email: "front-desk@clinic.example.com",
      latitude: 6.4521,
      longitude: 7.5103,
      map_pin_is_default: false,
      entrance_photo_url: PHOTO,
      is_24_hours: false,
      opening_hours: [
        { day_of_week: 0, opens_at: "08:00:00", closes_at: "17:00:00", is_closed: false },
        { day_of_week: 6, opens_at: null, closes_at: null, is_closed: true },
      ],
      services: ["Consultation", "X-ray"],
      phones: [
        { number: "+2348031234567", label: "Front desk", is_primary: true, is_whatsapp: true },
        { number: "+2348039999999", label: null, is_primary: false, is_whatsapp: false },
      ],
      ...(overrides.listing as Record<string, unknown> | undefined),
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "listing")),
  };
}

type Call = { method: string; path: string; body: Record<string, string> | undefined };

function stubApi(
  items = [request(1), request(2, { role: "manager" })],
  fail?: (call: Call) => Response | null,
  refunds: Record<number, "done" | "pending"> = {},
) {
  const calls: Call[] = [];
  let waiting = [...items];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const path = new URL(address).pathname;
      const call: Call = {
        method: init?.method ?? "GET",
        path,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const failure = fail?.(call);
      if (failure) return failure;
      if (path === "/staff/owner-requests") return json({ items: waiting, total: waiting.length });
      const decision = /^\/staff\/owner-requests\/(\d+)\/(approve|reject|request-changes)$/.exec(path);
      if (decision) {
        waiting = waiting.filter((item) => item.id !== Number(decision[1]));
        const refund = decision[2] === "reject" ? (refunds[Number(decision[1])] ?? null) : null;
        const status = { approve: "approved", reject: "removed", "request-changes": "changes_requested" }[decision[2]];
        return json({ id: Number(decision[1]), status, refund });
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, decisions: () => calls.filter((call) => call.method === "POST") };
}

function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 1, name: "Staff", email: "s@example.com", phone: null, role, is_active: true } });
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("editor");
});
afterEach(() => vi.unstubAllGlobals());

describe("the cards", () => {
  it("shows the person, the facility, the role asked for and the facility's own numbers to phone", async () => {
    const { calls } = stubApi();
    render(<OwnerRequestsPage />);

    const [first, second] = await screen.findAllByRole("listitem");

    expect(within(first).getByText("Ada 1")).toBeInTheDocument();
    expect(within(first).getByText("ada1@example.com")).toBeInTheDocument();
    expect(within(first).getByText("0803 000 0123")).toBeInTheDocument();
    expect(within(first).getByText("Eze Clinic 1")).toBeInTheDocument();
    expect(within(first).getByText(/Ogui/)).toBeInTheDocument();
    expect(within(first).getByText("Asked to be an owner")).toBeInTheDocument();
    expect(within(second).getByText("Asked to be a manager")).toBeInTheDocument();
    expect(within(first).getByText(/Asked on 20 Oct 2026/)).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ method: "GET", path: "/staff/owner-requests" });
  });

  it("shows the person's own reason when there is one, and nothing when there is none", async () => {
    stubApi([request(1, { reason: "I run the front desk." }), request(2)]);
    render(<OwnerRequestsPage />);

    const [first, second] = await screen.findAllByRole("listitem");

    expect(within(first).getByText("Their reason: I run the front desk.")).toBeInTheDocument();
    expect(within(second).queryByText(/Their reason/)).toBeNull();
  });

  it("makes the facility's numbers tel: links in the international form, shown in the local form with the label", async () => {
    stubApi();
    render(<OwnerRequestsPage />);
    const [first] = await screen.findAllByRole("listitem");

    const front = within(first).getByRole("link", { name: /0803 123 4567/ });
    const other = within(first).getByRole("link", { name: /0803 999 9999/ });

    expect(front).toHaveAttribute("href", "tel:+2348031234567");
    expect(front).toHaveTextContent("Front desk");
    expect(other).toHaveAttribute("href", "tel:+2348039999999");
    expect(front.className).toMatch(/min-h-12/);
  });

  it("says when the queue is empty", async () => {
    stubApi([]);
    render(<OwnerRequestsPage />);

    expect(await screen.findByText("Nobody is waiting for a phone call.")).toBeInTheDocument();
  });

  it("shows the error with Retry when the queue cannot be loaded", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++attempts === 1 ? json({ detail: "boom" }, 500) : json({ items: [request(1)], total: 1 }))));
    render(<OwnerRequestsPage />);

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(1);
  });
});

describe("everything in the request (part (b) of the owner form)", () => {
  async function firstCard() {
    render(<OwnerRequestsPage />);
    return (await screen.findAllByRole("listitem"))[0];
  }

  it("shows the category, address, landmark and description", async () => {
    stubApi([request(1)]);
    const card = await firstCard();

    expect(within(card).getByText("Clinic")).toBeInTheDocument();
    expect(within(card).getByText("4 Example Street")).toBeInTheDocument();
    expect(within(card).getByText("Behind the market")).toBeInTheDocument();
    expect(within(card).getByText("A small clinic for families.")).toBeInTheDocument();
  });

  it("shows the email, and says that only our team sees it", async () => {
    stubApi([request(1)]);
    const card = await firstCard();

    expect(within(card).getByText("front-desk@clinic.example.com")).toBeInTheDocument();
    expect(within(card).getByText(/Only our team sees this email/)).toBeInTheDocument();
  });

  it("shows the opening hours for each day in 12-hour time, with Closed, or 'Open 24 hours'", async () => {
    stubApi([request(1), request(2, { listing: { is_24_hours: true, opening_hours: [] } })]);
    render(<OwnerRequestsPage />);
    const [first, second] = await screen.findAllByRole("listitem");

    expect(within(first).getByText("Monday")).toBeInTheDocument();
    expect(within(first).getByText("8:00 AM – 5:00 PM")).toBeInTheDocument();
    expect(within(first).getByText("Sunday")).toBeInTheDocument();
    expect(within(first).getByText("Closed")).toBeInTheDocument();
    expect(within(second).getByText("Open 24 hours")).toBeInTheDocument();
    expect(within(second).queryByText("Monday")).toBeNull();
  });

  it("shows the services, and which phone numbers have WhatsApp", async () => {
    stubApi([request(1)]);
    const card = await firstCard();

    expect(within(card).getByText("Consultation, X-ray")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Front desk 0803 123 4567/ })).toHaveTextContent("WhatsApp");
    expect(within(card).getByRole("link", { name: "0803 999 9999" })).not.toHaveTextContent("WhatsApp");
  });

  it("shows the entrance photo, only when its address is https, with a text for screen readers", async () => {
    stubApi([request(1), request(2, { listing: { entrance_photo_url: "http://example.com/a.jpg" } }), request(3, { listing: { entrance_photo_url: null } })]);
    render(<OwnerRequestsPage />);
    const [first, second, third] = await screen.findAllByRole("listitem");

    const photo = within(first).getByRole("img", { name: "Entrance photo from the owner" });
    expect(photo).toHaveAttribute("src", PHOTO);
    expect(photo).toHaveAttribute("loading", "lazy");
    expect(within(second).queryByRole("img", { name: "Entrance photo from the owner" })).toBeNull();
    expect(within(third).getByText("No entrance photo.")).toBeInTheDocument();
  });

  it("shows the pin on a map with its coordinates", async () => {
    stubApi([request(1)]);
    const card = await firstCard();

    const map = await within(card).findByRole("region", { name: "Map showing where Eze Clinic 1 is" }); // loaded on demand
    expect(map).toHaveTextContent("Pin at 6.45210, 7.51030");
    expect(within(card).queryByText(/did not place the pin/)).toBeNull();
  });

  it("says the owner did not place the pin, and links to the listing editor to move it", async () => {
    stubApi([request(1, { listing: { map_pin_is_default: true } })]);
    const card = await firstCard();

    expect(within(card).getByText(/The owner did not place the pin/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Open the listing editor" })).toHaveAttribute("href", "/admin/listings/101");
  });

  it("shows what staff asked last time, when the request was sent back before", async () => {
    stubApi([request(1, { previous_change_note: "Please check the address." })]);
    const card = await firstCard();

    expect(within(card).getByText("Last time you asked: Please check the address.")).toBeInTheDocument();
  });

  it("shows no 'last time' line for a first request", async () => {
    stubApi([request(1)]);
    const card = await firstCard();

    expect(within(card).queryByText(/Last time you asked/)).toBeNull();
  });
});

describe("Request changes", () => {
  it("needs a note, asks first, and Cancel sends nothing", async () => {
    const { decisions } = stubApi([request(1)]);
    render(<OwnerRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes from Ada 1" }));

    const confirm = screen.getByRole("button", { name: "Yes, send it back" });
    expect(confirm).toBeDisabled();
    expect(screen.getByText("Write what the owner should change first.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(decisions()).toEqual([]);
    expect(screen.getByRole("button", { name: "Request changes from Ada 1" })).toBeInTheDocument();
  });

  it("sends the note, takes the card out of the list and says what happened", async () => {
    const { decisions } = stubApi([request(1), request(2)]);
    render(<OwnerRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes from Ada 1" }));
    await userEvent.type(screen.getByLabelText("What should Ada 1 change?"), "Please add the pharmacy number.");

    await userEvent.click(screen.getByRole("button", { name: "Yes, send it back" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Ada 1 was asked to change Eze Clinic 1. They will see your note.");
    expect(decisions()).toEqual([
      { method: "POST", path: "/staff/owner-requests/1/request-changes", body: { note: "Please add the pharmacy number." } },
    ]);
    expect(screen.queryByText("Eze Clinic 1")).toBeNull();
    expect(screen.getByText("Eze Clinic 2")).toBeInTheDocument();
  });

  it("limits the note to 300 characters", async () => {
    stubApi([request(1)]);
    render(<OwnerRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes from Ada 1" }));

    expect(screen.getByLabelText("What should Ada 1 change?")).toHaveAttribute("maxlength", "300");
  });

  it("is a different note from the one that says who was spoken to", async () => {
    stubApi([request(1)]);
    render(<OwnerRequestsPage />);
    await userEvent.type(await screen.findByLabelText(/Who did you speak to/), "Mr Eze");
    await userEvent.click(screen.getByRole("button", { name: "Request changes from Ada 1" }));

    expect(screen.getByLabelText("What should Ada 1 change?")).toHaveValue("");
  });

  it("shows the API's own sentence when it is refused, and keeps the card", async () => {
    stubApi([request(1)], (call) => (call.path.endsWith("/request-changes") ? json({ detail: "This request is not waiting." }, 409) : null));
    render(<OwnerRequestsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Request changes from Ada 1" }));
    await userEvent.type(screen.getByLabelText("What should Ada 1 change?"), "Fix the address.");

    await userEvent.click(screen.getByRole("button", { name: "Yes, send it back" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This request is not waiting.");
    expect(screen.getByText("Eze Clinic 1")).toBeInTheDocument();
  });
});

describe("approving", () => {
  it("is off until the note says who was reached, and says why", async () => {
    stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");

    expect(screen.getByRole("button", { name: "Approve Ada 1" })).toBeDisabled();
    expect(screen.getAllByText("Write who you spoke to first.").length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 1"), "Mrs Eze, the matron");

    expect(screen.getByRole("button", { name: "Approve Ada 1" })).toBeEnabled();
  });

  it("asks first, and Cancel sends nothing", async () => {
    const { decisions } = stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");
    await userEvent.type(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 1"), "Mrs Eze");

    await userEvent.click(screen.getByRole("button", { name: "Approve Ada 1" }));
    expect(screen.getByText("Approve Ada 1 as an owner of Eze Clinic 1?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(decisions()).toEqual([]);
    expect(screen.queryByText("Approve Ada 1 as an owner of Eze Clinic 1?")).not.toBeInTheDocument();
  });

  it("sends the note, takes the card out of the list and says what happened", async () => {
    const { decisions } = stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");
    await userEvent.type(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 1"), " Mrs Eze, the matron ");
    await userEvent.click(screen.getByRole("button", { name: "Approve Ada 1" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, approve" }));

    expect(await screen.findByText("Ada 1 was approved as an owner of Eze Clinic 1.")).toBeInTheDocument();
    expect(decisions()).toEqual([
      { method: "POST", path: "/staff/owner-requests/1/approve", body: { note: "Mrs Eze, the matron" } },
    ]);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("says a manager in the question and the sentence", async () => {
    stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");
    await userEvent.type(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 2"), "Mrs Eze");

    await userEvent.click(screen.getByRole("button", { name: "Approve Ada 2" }));

    expect(screen.getByText("Approve Ada 2 as a manager of Eze Clinic 2?")).toBeInTheDocument();
  });

  it("limits the note to 300 characters", async () => {
    stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");

    expect(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 1")).toHaveAttribute("maxlength", "300");
  });

  it("shows the API's own sentence when a decision is refused, and keeps the card", async () => {
    stubApi(undefined, (call) => (call.path.endsWith("/approve") ? json({ detail: "This request is not waiting." }, 409) : null));
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");
    await userEvent.type(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 1"), "Mrs Eze");
    await userEvent.click(screen.getByRole("button", { name: "Approve Ada 1" }));

    await userEvent.click(screen.getByRole("button", { name: "Yes, approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This request is not waiting.");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("rejecting", () => {
  it("asks first, sends the note when there is one, and takes the card out", async () => {
    const { decisions } = stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");
    await userEvent.type(screen.getByLabelText("Who did you speak to? (needed to approve) for Ada 1"), "Nobody there knew them");

    await userEvent.click(screen.getByRole("button", { name: "Reject Ada 1" }));
    expect(screen.getByText("Reject Ada 1 for Eze Clinic 1?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));

    expect(await screen.findByText("Ada 1 was rejected for Eze Clinic 1.")).toBeInTheDocument();
    expect(decisions()).toEqual([
      { method: "POST", path: "/staff/owner-requests/1/reject", body: { note: "Nobody there knew them" } },
    ]);
  });

  it("says the payment is being given back in full (the owner fee), or that the refund is not finished yet", async () => {
    stubApi(undefined, undefined, { 1: "done", 2: "pending" });
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Reject Ada 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));
    expect(await screen.findByText("Ada 1 was rejected for Eze Clinic 1. Their payment is being given back in full.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reject Ada 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));
    expect(
      await screen.findByText("Ada 2 was rejected for Eze Clinic 2. Their payment will be given back in full; the refund is not finished yet and will be tried again."),
    ).toBeInTheDocument();
  });

  it("works with no note, sending an empty body", async () => {
    const { decisions } = stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: "Reject Ada 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, reject" }));

    await screen.findByText("Ada 2 was rejected for Eze Clinic 2.");
    expect(decisions()[0].body).toEqual({});
  });
});

describe("layout and access", () => {
  it("makes every field and button at least 48 px", async () => {
    stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");

    for (const field of screen.getAllByRole("textbox")) expect(field.className).toMatch(/min-h-12/);
    for (const name of ["Approve Ada 1", "Reject Ada 1"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/min-h-\[50px\]/);
    }
  });

  it.each<StaffRole>(["admin", "editor"])("a %s can open it", async (role) => {
    window.sessionStorage.clear();
    loginAs(role);
    stubApi();
    render(<OwnerRequestsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Owner requests" })).toBeInTheDocument();
  });

  it.each<StaffRole>(["verifier", "provider"])("a %s is turned away and the queue is not asked for", async (role) => {
    window.sessionStorage.clear();
    loginAs(role);
    const { calls } = stubApi();
    render(<OwnerRequestsPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("sends a visitor with no session to the login", async () => {
    window.sessionStorage.clear();
    stubApi();
    render(<OwnerRequestsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });

  it("is linked from the staff bar of an editor and an admin, and not of a verifier", async () => {
    stubApi();
    render(<OwnerRequestsPage />);
    await screen.findAllByRole("listitem");

    const bar = screen.getByRole("navigation", { name: "Staff" });
    expect(within(bar).getByRole("link", { name: "Owner requests" })).toHaveAttribute("href", "/admin/owner-requests");
  });
});
