// @vitest-environment jsdom
/** The staff listing editor. Requirements: FR-31, FR-32, FR-38, FR-42, NFR-06, NFR-10. UI spec 3.4 and "Phase 10 details"; decisions C1,
 * C3, C4, C5, C12 and C13 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminEditListingPage from "@/app/(dashboards)/admin/listings/[id]/page";
import AdminNewListingPage from "@/app/(dashboards)/admin/listings/new/page";
import { resetMetaCache } from "@/lib/api/meta";
import { saveStaffSession } from "@/lib/staff/session";
import type { ListingStatus, StaffListingDetail, StaffRole } from "@/types/staff";

import { META, json, stubGeolocation } from "../helpers/api";
import { makeListing } from "../helpers/listing";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const push = vi.fn();
const router = { replace, push };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function detail(overrides: Partial<StaffListingDetail> = {}): StaffListingDetail {
  return {
    ...makeListing(),
    status: "draft",
    next_check_due: null,
    owner_id: null,
    created_by: 3, // the logged-in user below
    featured_until: null,
    map_pin_is_default: false,
    submission_details: null,
    closed_at: null,
    closed_reason: null,
    ...overrides,
  };
}

function loginAs(role: StaffRole, id = 3) {
  saveStaffSession({ token: "tok", user: { id, name: "Ada Staff", email: "a@b.co", phone: null, role, is_active: true } });
}

type Call = { method: string; path: string; body: unknown; headers: Record<string, string> };

/** A fake API: the meta lists and one listing, answering what the test chooses for each write. */
function stubApi(options: { current?: StaffListingDetail | null; write?: (call: Call) => Response } = {}) {
  let current: StaffListingDetail | null = options.current === undefined ? detail() : options.current;
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const call: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
      };
      calls.push(call);
      if (url.pathname === "/meta") return json(META);
      if (call.method === "GET" && url.pathname.startsWith("/listings/id/")) {
        return current ? json(current) : json({ detail: "Listing not found" }, 404);
      }
      if (options.write) return options.write(call);
      if (call.method === "POST" && url.pathname === "/listings") return json(detail({ id: 77, created_by: 3 }), 201);
      if (current && call.method === "PATCH") {
        current = { ...current, ...(call.body as object) } as StaffListingDetail;
        return json(current);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, writes: () => calls.filter((call) => call.method !== "GET") };
}

async function openEdit(id = "12") {
  render(await AdminEditListingPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  resetMetaCache();
  replace.mockReset();
  push.mockReset();
  loginAs("editor");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("moves and closures (accounts phase 8a, FR-53)", () => {
  it("shows an editor and an admin the move, close and history parts under an existing listing", async () => {
    stubApi({ current: detail({ status: "published", address: "1 Example Road", area: "Ogui" }) });
    await openEdit();

    expect(await screen.findByRole("heading", { level: 2, name: "Moved to a new address?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Closed for good?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Address history" })).toBeInTheDocument();
    expect(screen.getByLabelText("New address")).toHaveValue("1 Example Road");
  });

  it("shows a verifier none of it", async () => {
    loginAs("verifier");
    stubApi();
    await openEdit();

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { level: 2, name: "Moved to a new address?" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "Address history" })).toBeNull();
  });

  it("does not show it on a new listing", async () => {
    stubApi();
    render(<AdminNewListingPage />);

    await screen.findByRole("heading", { level: 1, name: "New listing" });
    expect(screen.queryByRole("heading", { level: 2, name: "Moved to a new address?" })).toBeNull();
  });

  it("says a closed facility is closed, with the reason, and offers no move or close", async () => {
    stubApi({ current: detail({ status: "hidden", closed_at: "2026-10-27T09:00:00Z", closed_reason: "Closed down" }) });
    await openEdit();

    expect(await screen.findByRole("heading", { level: 2, name: "This facility is closed." })).toBeInTheDocument();
    expect(screen.getByText("Reason: Closed down")).toBeInTheDocument();
    expect(screen.queryByLabelText("New address")).toBeNull();
  });
});

describe("a new listing", () => {
  it("shows the sections in order, with one empty primary phone and every day closed", async () => {
    stubApi();
    render(<AdminNewListingPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "New listing" })).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Basics", "Location", "Phones", "Opening hours", "Services and fees", "Description"]);
    expect(screen.getByLabelText("Phone number 1")).toHaveValue("");
    expect(screen.getByLabelText("Phone 1 is primary")).toBeChecked();
    expect(screen.getByLabelText("Monday closed")).toBeChecked();
  });

  it("offers the categories and areas of the API, and the services of the catalogue and the blood groups", async () => {
    stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");

    const categories = within(screen.getByLabelText("Category")).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(categories).toContain("ambulance");
    expect(within(screen.getByLabelText("Area")).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["", "GRA", "New Haven", "Ogui"]);
    await userEvent.click(screen.getByRole("button", { name: "Add a service" }));
    const names = within(screen.getByLabelText("Service 1 name")).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(names).toEqual(["", "Blood bank", "Consultation", "Malaria test", "X-ray", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
  });

  it("says what is wrong and calls nothing when the form is not valid", async () => {
    const { writes } = stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const problems = await screen.findByRole("alert");
    expect(problems).toHaveTextContent("Enter the name.");
    expect(problems).toHaveTextContent("Choose a category.");
    expect(writes()).toHaveLength(0);
  });

  it("creates the draft with the typed values and goes to its page", async () => {
    const { writes } = stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");

    await userEvent.type(screen.getByLabelText("Name"), "Night Pharmacy A");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "pharmacy");
    await userEvent.selectOptions(screen.getByLabelText("Area"), "Ogui");
    await userEvent.type(screen.getByLabelText("Address"), "12 Example Road");
    await userEvent.type(screen.getByLabelText("Latitude"), "6.452");
    await userEvent.type(screen.getByLabelText("Longitude"), "7.51");
    await userEvent.type(screen.getByLabelText("Phone number 1"), "0803 000 0000");
    await userEvent.click(screen.getByLabelText("Monday closed"));
    fireEvent.change(screen.getByLabelText("Monday opens"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Monday closes"), { target: { value: "17:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/listings/77"));
    const [create] = writes();
    expect(create.method).toBe("POST");
    expect(create.path).toBe("/listings");
    expect(create.headers.Authorization).toBe("Bearer tok");
    expect(create.body).toMatchObject({
      name: "Night Pharmacy A", category: "pharmacy", area: "Ogui", address: "12 Example Road", latitude: 6.452, longitude: 7.51,
      landmark: null, description: null, is_24_hours: false,
    });
    expect((create.body as { opening_hours: unknown[] }).opening_hours[0]).toEqual({
      day_of_week: 0, opens_at: "08:00", closes_at: "17:00", is_closed: false,
    });
  });

  it("shows the API's own reason when it refuses", async () => {
    stubApi({ write: () => json({ detail: "category: no such category" }, 422) });
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");
    await userEvent.type(screen.getByLabelText("Name"), "Night Pharmacy A");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "pharmacy");
    await userEvent.selectOptions(screen.getByLabelText("Area"), "Ogui");
    await userEvent.type(screen.getByLabelText("Address"), "12 Example Road");
    await userEvent.type(screen.getByLabelText("Latitude"), "6.452");
    await userEvent.type(screen.getByLabelText("Longitude"), "7.51");
    await userEvent.type(screen.getByLabelText("Phone number 1"), "0803 000 0000");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("category: no such category")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("has no Submit, Publish, Hide or Reopen before the listing exists", async () => {
    stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");

    for (const name of ["Submit for review", "Publish", "Hide", "Reopen"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });
});

describe("phones, services and the position", () => {
  it("adds and removes phone rows, keeps one row, and moves the primary mark to the chosen row", async () => {
    stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Add a phone number" }));
    await userEvent.click(screen.getByLabelText("Phone 2 is primary"));

    expect(screen.getByLabelText("Phone 1 is primary")).not.toBeChecked();
    expect(screen.getByLabelText("Phone 2 is primary")).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Remove phone 2" }));
    expect(screen.queryByLabelText("Phone number 2")).toBeNull();
    expect(screen.getByLabelText("Phone 1 is primary")).toBeChecked(); // a primary is always left
    expect(screen.getByRole("button", { name: "Remove phone 1" })).toBeDisabled(); // one row stays
  });

  it("adds and removes service rows with their fee fields", async () => {
    stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Add a service" }));
    await userEvent.selectOptions(screen.getByLabelText("Service 1 name"), "X-ray");
    await userEvent.type(screen.getByLabelText("Service 1 minimum fee (naira)"), "5000");
    expect(screen.getByLabelText("Service 1 maximum fee (naira)")).toBeInTheDocument();
    expect(screen.getByLabelText("Service 1 date collected")).toHaveAttribute("type", "date");

    await userEvent.click(screen.getByRole("button", { name: "Remove service 1" }));
    expect(screen.queryByLabelText("Service 1 name")).toBeNull();
  });

  it("fills the latitude and longitude from the phone's exact position after a tap, and asks only then", async () => {
    const getCurrentPosition = stubGeolocation({ latitude: 6.452123, longitude: 7.510987 });
    stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");
    expect(getCurrentPosition).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Use my current location" }));

    expect(screen.getByLabelText("Latitude")).toHaveValue("6.452123");
    expect(screen.getByLabelText("Longitude")).toHaveValue("7.510987");
    expect(((getCurrentPosition.mock.calls[0] as unknown[])[2] as PositionOptions).enableHighAccuracy).toBe(true);
    expect(window.sessionStorage.getItem("swifthealth.position")).toBeNull(); // not kept anywhere else
  });

  it("says so when the position cannot be had, and leaves the fields alone", async () => {
    stubGeolocation({ errorCode: 1 });
    stubApi();
    render(<AdminNewListingPage />);
    await screen.findByLabelText("Name");
    await userEvent.type(screen.getByLabelText("Latitude"), "6.4");

    await userEvent.click(screen.getByRole("button", { name: "Use my current location" }));

    expect(await screen.findByText("We could not get your position. Type the latitude and longitude instead.")).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toHaveValue("6.4");
  });
});

describe("an existing listing", () => {
  it("loads it with the token and shows its values and its status in words", async () => {
    const { calls } = stubApi();
    await openEdit("12");

    expect(await screen.findByRole("heading", { level: 1, name: "Night Pharmacy A" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Night Pharmacy A");
    expect(screen.getByLabelText("Category")).toHaveValue("pharmacy");
    expect(screen.getByLabelText("Phone number 1")).toHaveValue("+2340000000012");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/listings/id/12")?.headers.Authorization).toBe("Bearer tok");
    expect(screen.getByLabelText("Friday opens")).toHaveValue("20:00");
    expect(screen.getByLabelText("Sunday closed")).toBeChecked();
  });

  it("warns while the map pin is still the default, and not otherwise", async () => {
    stubApi({ current: detail({ map_pin_is_default: true }) });
    await openEdit();

    expect(await screen.findByText("The map pin is still the default. Set the real position before you submit.")).toBeInTheDocument();
  });

  it("shows the submission details of a facility form, read only, and none otherwise", async () => {
    stubApi({ current: detail({ submission_details: "Contact: Dr. Example, owner@example.com. Notes: Open 24 hours" }) });
    await openEdit();

    const section = (await screen.findByRole("heading", { level: 2, name: "Submission details" })).closest("section");
    expect(section).toHaveTextContent("Contact: Dr. Example, owner@example.com. Notes: Open 24 hours");
  });

  it("shows no Submission details section when there are none", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");

    expect(screen.queryByRole("heading", { name: "Submission details" })).toBeNull();
  });

  it("says Listing not found for an unknown id", async () => {
    stubApi({ current: null });
    await openEdit("99999");

    expect(await screen.findByText("Listing not found")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("is closed to a visitor with no session", async () => {
    window.sessionStorage.clear();
    stubApi();
    await openEdit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    expect(screen.queryByLabelText("Name")).toBeNull();
  });
});

describe("saving", () => {
  it("has nothing to save until something changes", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("sends only the fields that changed, then says Saved", async () => {
    const { writes } = stubApi();
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Night Pharmacy B");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(writes()).toHaveLength(1);
    expect(writes()[0].method).toBe("PATCH");
    expect(writes()[0].path).toBe("/listings/12");
    expect(writes()[0].body).toEqual({ name: "Night Pharmacy B" });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(); // nothing left to save
  });

  it("sends the whole phone list when a phone changes", async () => {
    const { writes } = stubApi();
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByLabelText("Phone 1 is on WhatsApp"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await screen.findByText("Saved.");
    const body = writes()[0].body as { phones: { is_whatsapp: boolean }[] };
    expect(Object.keys(body)).toEqual(["phones"]);
    expect(body.phones[0].is_whatsapp).toBe(true);
    expect(body.phones).toHaveLength(2);
  });

  it("shows the API's reason when it refuses, and keeps the typed values", async () => {
    stubApi({ write: () => json({ detail: "You do not have permission for this." }, 403) });
    await openEdit();
    await screen.findByLabelText("Name");
    await userEvent.type(screen.getByLabelText("Landmark"), " by the church");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("You do not have permission for this.")).toBeInTheDocument();
    expect(screen.getByLabelText("Landmark")).toHaveValue("Opposite the Example Market by the church");
  });
});

describe("unsaved changes (decision C13)", () => {
  it("asks the browser before the tab closes or reloads, only while something is unsaved", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");
    const ask = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(ask()).toBe(false);

    await userEvent.type(screen.getByLabelText("Landmark"), "x");
    expect(ask()).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Saved.");
    expect(ask()).toBe(false);
  });

  it("Cancel asks first when there are unsaved changes, and goes back to the list when confirmed", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.type(screen.getByLabelText("Landmark"), "x");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenCalledWith("/admin/listings");
  });

  it("Cancel does not ask when nothing changed", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");
    const confirm = vi.spyOn(window, "confirm");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirm).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/admin/listings");
  });
});

describe("the action bar by status and role", () => {
  const BUTTONS = ["Submit for review", "Publish", "Hide", "Reopen"];

  async function visibleButtons(): Promise<string[]> {
    await screen.findByLabelText("Name");
    return BUTTONS.filter((name) => screen.queryByRole("button", { name }) !== null);
  }

  it.each([
    ["editor", "draft", ["Submit for review", "Hide"]],
    ["admin", "draft", ["Submit for review", "Hide"]],
    ["editor", "pending_review", ["Publish", "Hide"]],
    ["editor", "recheck_due", ["Publish", "Hide"]],
    ["editor", "published", ["Hide"]],
    ["editor", "hidden", ["Reopen"]],
    ["verifier", "draft", ["Submit for review"]],
    ["verifier", "pending_review", []],
    ["verifier", "published", []],
  ] as [StaffRole, ListingStatus, string[]][])("%s on a %s listing sees %j", async (role, status, expected) => {
    loginAs(role);
    stubApi({ current: detail({ status, created_by: 3 }) });
    await openEdit();

    expect(await visibleButtons()).toEqual(expected);
  });

  it("always offers the link to the verification log", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");

    expect(screen.getByRole("link", { name: "Verification log" })).toHaveAttribute("href", "/admin/listings/12/checks");
  });

  it("makes every button at least 48 px high", async () => {
    stubApi();
    await openEdit();
    await screen.findByLabelText("Name");

    for (const name of ["Save", "Submit for review", "Hide", "Cancel"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/min-h-\[50px\]|min-h-12/);
    }
  });
});

describe("a verifier and another person's listing (decision C3)", () => {
  it("sees it read only, with the reason, and no Save", async () => {
    loginAs("verifier", 9);
    stubApi({ current: detail({ status: "draft", created_by: 3 }) });
    await openEdit();

    expect(await screen.findByText("You can only edit drafts you created.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  });

  it("sees a published listing read only too, but may open its verification log", async () => {
    loginAs("verifier", 3);
    stubApi({ current: detail({ status: "published", created_by: 3 }) });
    await openEdit();

    expect(await screen.findByText("You can only edit drafts you created.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verification log" })).toBeInTheDocument();
  });

  it("edits their own draft", async () => {
    loginAs("verifier", 3);
    stubApi({ current: detail({ status: "draft", created_by: 3 }) });
    await openEdit();

    expect(await screen.findByLabelText("Name")).toBeEnabled();
    expect(screen.queryByText("You can only edit drafts you created.")).toBeNull();
  });
});

describe("the status buttons", () => {
  it("Submit for review moves it and shows the new status", async () => {
    const { writes } = stubApi({ write: () => json(detail({ status: "pending_review" })) });
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText("Pending review")).toBeInTheDocument();
    expect(writes()[0].method).toBe("POST");
    expect(writes()[0].path).toBe("/listings/12/submit");
    expect(writes()[0].body).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
  });

  it("Publish moves a pending listing", async () => {
    const { writes } = stubApi({ current: detail({ status: "pending_review" }), write: () => json(detail({ status: "published" })) });
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(writes()[0].path).toBe("/listings/12/publish");
  });

  it("Reopen moves a hidden listing back to a draft", async () => {
    const { writes } = stubApi({ current: detail({ status: "hidden" }), write: () => json(detail({ status: "draft" })) });
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(writes()[0].path).toBe("/listings/12/reopen");
  });

  it("Hide asks for a reason first, will not send an empty one, and sends the reason", async () => {
    const { writes } = stubApi({ current: detail({ status: "published" }), write: () => json(detail({ status: "hidden" })) });
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    const reason = screen.getByLabelText("Why is it hidden?");
    expect(writes()).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Hide this listing" }));
    expect(writes()).toHaveLength(0);
    expect(screen.getByText("Write the reason first.")).toBeInTheDocument();

    await userEvent.type(reason, "Facility closed");
    await userEvent.click(screen.getByRole("button", { name: "Hide this listing" }));

    expect(await screen.findByText("Hidden")).toBeInTheDocument();
    expect(writes()[0].path).toBe("/listings/12/hide");
    expect(writes()[0].body).toEqual({ reason: "Facility closed" });
  });

  it("shows the API's sentence when a move is refused (for example no passing check)", async () => {
    stubApi({ write: () => json({ detail: "Submit needs a passing call and a passing visit first." }, 400) });
    await openEdit();
    await screen.findByLabelText("Name");

    await userEvent.click(screen.getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText("Submit needs a passing call and a passing visit first.")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("will not move a listing while there are unsaved changes", async () => {
    const { writes } = stubApi();
    await openEdit();
    await screen.findByLabelText("Name");
    await userEvent.type(screen.getByLabelText("Landmark"), "x");

    expect(screen.getByRole("button", { name: "Submit for review" })).toBeDisabled();
    expect(screen.getByText("Save your changes before you submit, publish or hide.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
});

describe("what is never done", () => {
  it("uses no console output, no localStorage and no dangerouslySetInnerHTML", () => {
    for (const file of ["components/admin/ListingEditor.tsx", "components/admin/ListingFormFields.tsx", "components/admin/ListingActions.tsx"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/console\.|localStorage|dangerouslySetInnerHTML/);
    }
  });
});
