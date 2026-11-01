// @vitest-environment jsdom
/** "List your facility": a visitor is sent to sign up or log in, a provider registers a facility or claims one, and a staff
 * account gets a link to the new-listing form (not the dashboard). Requirements: FR-50, FR-51, FR-23, NFR-06, NFR-07, NFR-10. UI spec 2.9; api-spec 7, "Phase 7";
 * decisions D14 and D15 in specs/2026-10-23-accounts-and-facility-ownership/requirements.md. Every name and number here is fictional.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ListYourFacilityPage from "@/app/(public)/list-your-facility/page";
import { resetMetaCache } from "@/lib/api/meta";
import { addressAfterLogin } from "@/lib/staff/roles";
import { readStaffSession, saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { META, json } from "../helpers/api";
import { readSource } from "../helpers/source";

// The pin picker is Leaflet; it has its own tests (PinPicker.test.tsx, OwnerLocationPhoto.test.tsx). Here it is a stand-in.
vi.mock("@/components/map/PinPicker", () => ({ PinPicker: () => <div role="region" aria-label="Map to place the pin of your facility" /> }));

type Call = { method: string; path: string; search: string; token: string | null; body: Record<string, unknown> | undefined };

type Handlers = {
  register?: (call: Call) => Response;
  save?: (call: Call) => Response;
  claim?: (call: Call) => Response;
  claimable?: (call: Call) => Response;
  listings?: (call: Call) => Response;
  signupOpen?: boolean;
};

const FOUND = [{ id: 41, name: "Grace Clinic", area: "Ogui", category: { slug: "clinic", name: "Clinic" } }];

function stubApi(handlers: Handlers = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const headers = new Headers(init?.headers);
      const call: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        search: url.search,
        token: headers.get("Authorization")?.replace("Bearer ", "") ?? null,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      };
      calls.push(call);
      if (url.pathname === "/meta") return json({ ...META, signup_open: handlers.signupOpen ?? false });
      if (url.pathname === "/provider/facilities") {
        return (handlers.register ?? (() => json({ message: "Thanks.", listing_id: 7, link_id: 8, status: "awaiting_payment", fee_naira: "10000.00" }, 201)))(call);
      }
      if (url.pathname === "/provider/listings") {
        return (handlers.listings ?? (() => json({ fee_naira: "10000.00", grace_days: 7, items: [] })))(call);
      }
      if (url.pathname.startsWith("/provider/requests/")) {
        return (handlers.save ?? (() => json({ message: "Saved.", listing_id: 7, link_id: 8, status: "draft", fee_naira: "10000.00" })))(call);
      }
      if (url.pathname === "/provider/claimable") return (handlers.claimable ?? (() => json({ items: FOUND })))(call);
      if (url.pathname === "/provider/claims") {
        return (handlers.claim ?? (() => json({ message: "Thanks. Pay the first month and our team will phone the facility to check.", link_id: 9, status: "awaiting_payment", fee_naira: "10000.00" }, 201)))(call);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  // The calls the person's actions made. The form's own read of the monthly fee (GET /provider/listings) is not one of them.
  const isFeeRead = (call: Call) => call.method === "GET" && call.path === "/provider/listings";
  return { calls, apiCalls: () => calls.filter((call) => call.path.startsWith("/provider") && !isFeeRead(call)) };
}

function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 5, name: "Ada Eze", email: "ada@example.com", phone: null, role, is_active: true } });
}

async function fillValidForm() {
  await screen.findByRole("option", { name: "Clinic" });
  await userEvent.type(screen.getByLabelText("Facility name"), "Example Clinic");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "clinic");
  await userEvent.selectOptions(screen.getByLabelText("Area"), "Ogui");
  await userEvent.type(screen.getByLabelText("Address"), "4 Example Street");
  await userEvent.type(screen.getByLabelText("Phone number of the facility"), "0803 000 0000");
}

beforeEach(() => {
  resetMetaCache();
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("a visitor (no account)", () => {
  it("is asked to sign up or log in, with one h1, and nothing is sent to the provider routes", async () => {
    const { apiCalls } = stubApi({ signupOpen: true });
    render(<ListYourFacilityPage />);

    expect(await screen.findByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/log-in?next=/list-your-facility");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText("Log in or sign up to list your facility.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Facility name")).toBeNull();
    expect(apiCalls()).toEqual([]);
  });

  it("sees no Sign up link while sign-up is closed, and is told so", async () => {
    stubApi({ signupOpen: false });
    render(<ListYourFacilityPage />);

    expect(await screen.findByText("Sign-up is not open yet.")).toBeInTheDocument();
    expect(screen.getByText("Log in to list your facility.")).toBeInTheDocument();
    expect(screen.queryByText(/sign up to list/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign up" })).toBeNull();
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  });

  it("has large buttons (at least 48 px)", async () => {
    stubApi({ signupOpen: true });
    render(<ListYourFacilityPage />);

    for (const name of ["Sign up", "Log in"]) {
      expect((await screen.findByRole("link", { name })).className).toMatch(/min-h-\[50px\]|min-h-12/);
    }
  });
});

describe("a staff account", () => {
  it.each(["verifier", "editor", "admin"] as const)(
    "%s gets a link straight to the new-listing form (not the dashboard), the owners' form explained, and no form",
    async (role) => {
      loginAs(role);
      const { apiCalls } = stubApi();
      render(<ListYourFacilityPage />);

      expect(await screen.findByText(/Facility owners list a facility with this form/)).toBeInTheDocument();
      expect(screen.getByText(/Our team verifies it before it is listed/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Add a facility" })).toHaveAttribute("href", "/admin/listings/new");
      for (const link of screen.getAllByRole("link")) expect(link).not.toHaveAttribute("href", "/admin");
      expect(screen.queryByRole("link", { name: "Go to the admin screens" })).toBeNull();
      expect(screen.queryByLabelText("Facility name")).toBeNull();
      expect(apiCalls()).toEqual([]);
    },
  );

  it("the link is a large button (at least 48 px)", async () => {
    loginAs("admin");
    stubApi();
    render(<ListYourFacilityPage />);

    expect((await screen.findByRole("link", { name: "Add a facility" })).className).toMatch(/min-h-\[50px\]|min-h-12/);
  });
});

describe("a provider registering a facility", () => {
  beforeEach(() => loginAs("provider"));

  it("sees both parts, and the form asks no contact name or email (they come from the account)", async () => {
    stubApi();
    render(<ListYourFacilityPage />);

    expect(await screen.findByRole("heading", { level: 2, name: "Register a new facility" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Find and claim your facility" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).toBeNull();
    expect(screen.queryByLabelText("Your email")).toBeNull();
    // The form no longer says "Listing is free during our launch": it states the monthly fee instead (owner, 2026-11-01).
    expect(screen.queryByText(/Listing is free during our launch/)).toBeNull();
  });

  it("offers only the everyday categories and the areas of the API, and a role with 'I own it' chosen", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    const category = screen.getByLabelText("Category");
    expect(Array.from(category.querySelectorAll("option")).map((option) => option.value)).toEqual(
      ["", ...META.categories.filter((item) => !item.is_emergency).map((item) => item.slug)],
    );
    expect(screen.getByRole("radio", { name: "I own it" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "I manage it" })).not.toBeChecked();
  });

  it("sends the typed values and the token to POST /provider/facilities, then thanks and clears the form", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole("radio", { name: "I manage it" }));
    await userEvent.type(screen.getByLabelText("Notes (optional)"), "Open 24 hours");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Thanks. Your request is saved. Pay the first month (₦10,000) and we'll verify your facility before it's listed.",
    );
    expect(await screen.findByRole("button", { name: "Pay ₦10,000 to send your request" })).toBeInTheDocument();
    expect(apiCalls()).toHaveLength(1);
    expect(apiCalls()[0]).toMatchObject({
      method: "POST",
      path: "/provider/facilities",
      token: "tok",
      body: {
        facility_name: "Example Clinic", category: "clinic", area: "Ogui", address: "4 Example Street",
        phone: "0803 000 0000", role: "manager", notes: "Open 24 hours",
      },
    });
    expect(Object.keys(apiCalls()[0].body ?? {})).not.toContain("contact_name");
    expect(Object.keys(apiCalls()[0].body ?? {})).not.toContain("contact_email");
    expect(screen.getByRole("link", { name: "Go to My facilities" })).toHaveAttribute("href", "/provider");
  });

  it("sends the newest token of the session when the idle sign-out renewed it after the page was drawn", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    saveStaffSession({
      token: "tok-renewed",
      user: { id: 5, name: "Ada Eze", email: "ada@example.com", phone: null, role: "provider", is_active: true },
      idle_seconds: 900,
    });
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByRole("status");
    expect(apiCalls()[0].token).toBe("tok-renewed");
  });

  it("leaves the notes out when empty", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByRole("status");
    expect(Object.keys(apiCalls()[0].body ?? {})).not.toContain("notes");
  });

  it("limits the notes to 300 characters and counts from 250", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    const notes = await screen.findByLabelText("Notes (optional)");

    expect(notes).toHaveAttribute("maxlength", "300");
    fireEvent.change(notes, { target: { value: "x".repeat(260) } });
    expect(screen.getByText("40 characters left")).toBeInTheDocument();
  });

  it("says what is missing or wrong, all at once, and sends nothing", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    fireEvent.submit(screen.getByRole("button", { name: "Send" }).closest("form") as HTMLFormElement);

    const alert = await screen.findByRole("alert");
    for (const sentence of ["Enter the facility name.", "Choose a category.", "Choose an area.", "Enter the address."]) {
      expect(alert).toHaveTextContent(sentence);
    }
    expect(alert).toHaveTextContent("Check the phone number. It should look like 0803 123 4567.");
    expect(apiCalls()).toEqual([]);
  });

  it("on 409 with a listing id shows the API's sentence and a button that opens the claim form for it", async () => {
    stubApi({
      register: () =>
        json({ detail: { message: "A facility like this is already listed. You can ask to manage it instead.", listing_id: 41 } }, 409),
    });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A facility like this is already listed. You can ask to manage it instead.");
    await userEvent.click(screen.getByRole("button", { name: "Ask to manage it" }));
    expect(await screen.findByLabelText("How are you connected to this facility?")).toBeInTheDocument();
    expect(screen.getByText("Example Clinic", { selector: "p" })).toBeInTheDocument();
  });

  it("on 409 without an id shows only the generic sentence and no claim button", async () => {
    stubApi({ register: () => json({ detail: { message: "This facility is already registered. Please contact us.", listing_id: null } }, 409) });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This facility is already registered. Please contact us.");
    expect(screen.queryByRole("button", { name: "Ask to manage it" })).toBeNull();
  });

  it("says on 429 that too many were sent today, and keeps the form", async () => {
    stubApi({ register: () => json({ detail: "x" }, 429) });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You've sent several submissions. Please try again tomorrow.");
    expect(screen.getByLabelText("Facility name")).toHaveValue("Example Clinic");
  });

  it("on 422 asks to check the form, and on a network failure to check the connection, keeping what was typed", async () => {
    stubApi({ register: () => json({ detail: "x" }, 422) });
    render(<ListYourFacilityPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check the form");

    vi.stubGlobal("fetch", vi.fn(async (address: string) => {
      if (new URL(address).pathname === "/meta") return json(META);
      throw new TypeError("offline");
    }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We couldn't send the form. Check your connection and try again."));
    expect(screen.getByLabelText("Address")).toHaveValue("4 Example Street");
  });

  it("goes back to the visitor part and clears the session when the API says 401", async () => {
    stubApi({ register: () => json({ detail: "Not authenticated" }, 401) });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/to list your facility\./)).toBeInTheDocument();
    expect(readStaffSession()).toBeNull();
  });

  it("has a Send button at least 50 px high and fields at least 48 px high", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    expect(screen.getByRole("button", { name: "Send" }).className).toMatch(/min-h-\[50px\]/);
    expect(screen.getByLabelText("Facility name").className).toMatch(/min-h-12/);
  });
});

describe("the fee words at the top of the form (owner, 2026-11-01)", () => {
  beforeEach(() => loginAs("provider"));

  const FEE_WORDS =
    "Managing your facility on SwiftHealth Route costs ₦10,000 a month. You pay after submitting; if our team can't approve it, you get a full refund.";

  it("states the monthly fee, from the API's amount, before the first field of the form", async () => {
    stubApi();
    render(<ListYourFacilityPage />);

    const words = await screen.findByText(FEE_WORDS);

    const firstField = screen.getByLabelText("Facility name");
    expect(words.compareDocumentPosition(firstField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Listing is free during our launch/)).toBeNull();
  });

  it("follows the amount of the API (another fee, another words)", async () => {
    stubApi({ listings: () => json({ fee_naira: "7500.00", grace_days: 7, items: [] }) });
    render(<ListYourFacilityPage />);

    expect(await screen.findByText(/costs ₦7,500 a month/)).toBeInTheDocument();
  });

  it("still says there is a monthly fee, without an amount, when the amount cannot be loaded", async () => {
    stubApi({ listings: () => json({ detail: "boom" }, 500) });
    render(<ListYourFacilityPage />);
    await screen.findByLabelText("Facility name");

    expect(await screen.findByText(/costs a monthly fee/)).toBeInTheDocument();
    expect(screen.getByText(/you get a full refund/)).toBeInTheDocument();
  });
});

describe("the fields of the full owner form", () => {
  beforeEach(() => loginAs("provider"));

  it("asks for a short description, a landmark and an email, all optional, and says the email is for our team only", async () => {
    stubApi();
    render(<ListYourFacilityPage />);

    expect(await screen.findByLabelText("Short description (optional)")).toHaveAttribute("maxlength", "200");
    expect(screen.getByLabelText("Landmark (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Email of the facility (optional)")).toHaveAttribute("type", "email");
    expect(screen.getByText("Only our team sees this email. It is never shown to the public.")).toBeInTheDocument();
  });

  it("counts the description from 150 characters", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    const description = await screen.findByLabelText("Short description (optional)");

    fireEvent.change(description, { target: { value: "x".repeat(170) } });

    expect(screen.getByText("30 characters left")).toBeInTheDocument();
  });

  it("has 'This number has WhatsApp' for the main number and a way to add up to four more numbers, each with its own", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByLabelText("Facility name");

    expect(screen.getByRole("checkbox", { name: "This number has WhatsApp" })).not.toBeChecked();
    for (let added = 1; added <= 4; added += 1) {
      await userEvent.click(screen.getByRole("button", { name: "Add another phone number" }));
      const group = screen.getByRole("group", { name: `Phone number ${added + 1}` });
      expect(within(group).getByLabelText("Number")).toBeInTheDocument();
      expect(within(group).getByLabelText("Label (optional)")).toBeInTheDocument();
      expect(within(group).getByRole("checkbox", { name: "This number has WhatsApp" })).toBeInTheDocument();
    }

    expect(screen.queryByRole("button", { name: "Add another phone number" })).toBeNull(); // five numbers is the limit
    await userEvent.click(within(screen.getByRole("group", { name: "Phone number 3" })).getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("button", { name: "Add another phone number" })).toBeInTheDocument();
  });

  it("offers opening hours for each day with 'Closed', and 'Open 24 hours' hides the days", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByLabelText("Facility name");

    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]) {
      const group = screen.getByRole("group", { name: day });
      expect(within(group).getByLabelText("Opens")).toHaveAttribute("type", "time");
      expect(within(group).getByLabelText("Closes")).toHaveAttribute("type", "time");
      expect(within(group).getByRole("checkbox", { name: "Closed" })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("checkbox", { name: "Open 24 hours" }));

    expect(screen.queryByRole("group", { name: "Monday" })).toBeNull();
  });

  it("closing a day empties and locks its times", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByLabelText("Facility name");
    const monday = screen.getByRole("group", { name: "Monday" });
    await userEvent.type(within(monday).getByLabelText("Opens"), "08:00");

    await userEvent.click(within(monday).getByRole("checkbox", { name: "Closed" }));

    expect(within(monday).getByLabelText("Opens")).toBeDisabled();
    expect(within(monday).getByLabelText("Opens")).toHaveValue("");
  });

  it("lists the services of the API's catalogue as boxes to tick", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByLabelText("Facility name");

    const group = await screen.findByRole("group", { name: "Services (optional)" });

    expect(within(group).getAllByRole("checkbox").map((box) => (box as HTMLInputElement).name)).toEqual(META.service_catalogue);
    expect(within(group).getByRole("checkbox", { name: "Malaria test" })).not.toBeChecked();
  });

  it("sends every field to POST /provider/facilities when the person sends the request", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await fillValidForm();
    await userEvent.type(screen.getByLabelText("Short description (optional)"), "A small clinic.");
    await userEvent.type(screen.getByLabelText("Landmark (optional)"), "Behind the market");
    await userEvent.type(screen.getByLabelText("Email of the facility (optional)"), "front-desk@clinic.example.com");
    await userEvent.click(screen.getByRole("checkbox", { name: "This number has WhatsApp" }));
    await userEvent.click(screen.getByRole("button", { name: "Add another phone number" }));
    const second = screen.getByRole("group", { name: "Phone number 2" });
    await userEvent.type(within(second).getByLabelText("Number"), "0803 000 0001");
    await userEvent.type(within(second).getByLabelText("Label (optional)"), "Pharmacy desk");
    const monday = screen.getByRole("group", { name: "Monday" });
    await userEvent.type(within(monday).getByLabelText("Opens"), "08:00");
    await userEvent.type(within(monday).getByLabelText("Closes"), "17:00");
    await userEvent.click(within(screen.getByRole("group", { name: "Sunday" })).getByRole("checkbox", { name: "Closed" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Malaria test" }));

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByRole("status");
    expect(apiCalls().at(-1)).toMatchObject({
      method: "POST",
      path: "/provider/facilities",
      body: {
        facility_name: "Example Clinic", category: "clinic", area: "Ogui", address: "4 Example Street",
        description: "A small clinic.", landmark: "Behind the market", email: "front-desk@clinic.example.com",
        phone: "0803 000 0000", phone_has_whatsapp: true,
        other_phones: [{ number: "0803 000 0001", label: "Pharmacy desk", is_whatsapp: false }],
        is_24_hours: false,
        opening_hours: [
          { day_of_week: 0, opens_at: "08:00", closes_at: "17:00", is_closed: false },
          { day_of_week: 6, is_closed: true },
        ],
        services: ["Malaria test"],
        role: "owner",
        save_as_draft: false,
      },
    });
  });

  it("checks the new fields in words before sending anything", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await fillValidForm();
    await userEvent.type(screen.getByLabelText("Email of the facility (optional)"), "front desk");
    await userEvent.type(within(screen.getByRole("group", { name: "Monday" })).getByLabelText("Opens"), "08:00");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Check the email address.");
    expect(alert).toHaveTextContent("Monday: enter the opening and the closing time, or choose Closed.");
    expect(apiCalls().filter((call) => call.path === "/provider/facilities")).toEqual([]);
  });
});

describe("Save as draft", () => {
  beforeEach(() => loginAs("provider"));

  it("has a Save as draft button beside Send, at least 48 px high", async () => {
    stubApi();
    render(<ListYourFacilityPage />);

    const draft = await screen.findByRole("button", { name: "Save as draft" });

    expect(draft.className).toMatch(/min-h-12|min-h-\[50px\]/);
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("saves with save_as_draft true, says nothing is sent or public, asks for no payment and keeps the form", async () => {
    const draftAnswer = {
      message: "Your draft is saved. Nothing is sent to our team and nothing is public until you send it.",
      listing_id: 7, link_id: 8, status: "draft", fee_naira: "10000.00",
    };
    const { apiCalls } = stubApi({ register: () => json(draftAnswer, 201) });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(await screen.findByRole("status")).toHaveTextContent(draftAnswer.message);
    expect(apiCalls().at(-1)).toMatchObject({ method: "POST", path: "/provider/facilities", body: { save_as_draft: true } });
    expect(screen.queryByRole("button", { name: /^Pay / })).toBeNull();
    expect(screen.getByLabelText("Facility name")).toHaveValue("Example Clinic"); // still there to go on with
  });

  it("the next save of the same draft is a PUT to its request, and Send then sends it", async () => {
    const draftAnswer = { message: "Saved.", listing_id: 7, link_id: 8, status: "draft", fee_naira: "10000.00" };
    const sentAnswer = { message: "Thanks.", listing_id: 7, link_id: 8, status: "awaiting_payment", fee_naira: "10000.00" };
    const { apiCalls } = stubApi({ register: () => json(draftAnswer, 201), save: (call) => json(call.body?.save_as_draft ? draftAnswer : sentAnswer) });
    render(<ListYourFacilityPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByRole("status");

    await userEvent.type(screen.getByLabelText("Landmark (optional)"), "Behind the market");
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(apiCalls().filter((call) => call.method === "PUT")).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("button", { name: "Pay ₦10,000 to send your request" })).toBeInTheDocument();
    const puts = apiCalls().filter((call) => call.method === "PUT");
    expect(puts.map((call) => call.path)).toEqual(["/provider/requests/8", "/provider/requests/8"]);
    expect(puts.map((call) => call.body?.save_as_draft)).toEqual([true, false]);
    expect(apiCalls().filter((call) => call.method === "POST" && call.path === "/provider/facilities")).toHaveLength(1);
  });

  it("checks the required fields before saving a draft too", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Enter the facility name.");
    expect(apiCalls().filter((call) => call.path === "/provider/facilities")).toEqual([]);
  });
});

describe("a provider claiming a facility", () => {
  beforeEach(() => loginAs("provider"));

  it("searches after a short pause, sends the search text with the token, and lists name, category and area only", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);

    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Grace");

    expect(await screen.findByText("Grace Clinic")).toBeInTheDocument();
    expect(screen.getByText("Clinic, Ogui")).toBeInTheDocument();
    const searches = apiCalls().filter((call) => call.path === "/provider/claimable");
    expect(searches).toHaveLength(1); // one call after the pause, not one per letter
    expect(searches[0]).toMatchObject({ search: "?q=Grace", token: "tok" });
  });

  it("does not search for fewer than two letters", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);

    await userEvent.type(await screen.findByLabelText("Facility name or area"), "G");
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(apiCalls().filter((call) => call.path === "/provider/claimable")).toEqual([]);
  });

  it("says when nothing was found and points to registering", async () => {
    stubApi({ claimable: () => json({ items: [] }) });
    render(<ListYourFacilityPage />);

    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Nowhere");

    expect(await screen.findByText(/No facility found/)).toBeInTheDocument();
  });

  it("says on 429 to try again later", async () => {
    stubApi({ claimable: () => json({ detail: "x" }, 429) });
    render(<ListYourFacilityPage />);

    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Grace");

    expect(await screen.findByRole("alert")).toHaveTextContent("You've searched many times. Please try again later.");
  });

  it("sends the claim with the role and the reason, then shows the API's thanks", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Grace");
    await userEvent.click(await screen.findByRole("button", { name: "Claim Grace Clinic" }));
    const claimPart = screen.getByRole("region", { name: "Find and claim your facility" });
    await userEvent.click(within(claimPart).getByRole("radio", { name: "I manage it" }));
    await userEvent.type(screen.getByLabelText("How are you connected to this facility?"), "  I run the front desk.  ");

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Thanks. Pay the first month (₦10,000) and our team will phone the facility to check.",
    );
    expect(await screen.findByRole("button", { name: "Pay ₦10,000 to send your request" })).toBeInTheDocument();
    const claims = apiCalls().filter((call) => call.path === "/provider/claims");
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({
      method: "POST", token: "tok", body: { listing_id: 41, role: "manager", reason: "I run the front desk." },
    });
  });

  it("asks for a reason first and sends nothing without one", async () => {
    const { apiCalls } = stubApi();
    render(<ListYourFacilityPage />);
    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Grace");
    await userEvent.click(await screen.findByRole("button", { name: "Claim Grace Clinic" }));

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Write a few words about how you are connected to this facility.");
    expect(apiCalls().filter((call) => call.path === "/provider/claims")).toEqual([]);
  });

  it.each([
    [409, { detail: "You already manage this facility." }, "You already manage this facility."],
    [409, { detail: "Your request for this facility is waiting for our team." }, "Your request for this facility is waiting for our team."],
    [404, { detail: "Facility not found" }, "Facility not found"],
    [429, { detail: "x" }, "You've sent several requests. Please try again tomorrow."],
  ])("on %s shows a sentence and keeps the form", async (status, body, sentence) => {
    stubApi({ claim: () => json(body, status) });
    render(<ListYourFacilityPage />);
    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Grace");
    await userEvent.click(await screen.findByRole("button", { name: "Claim Grace Clinic" }));
    await userEvent.type(screen.getByLabelText("How are you connected to this facility?"), "I run the front desk.");

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(screen.getByLabelText("How are you connected to this facility?")).toHaveValue("I run the front desk.");
  });

  it("can go back to choose another facility", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await userEvent.type(await screen.findByLabelText("Facility name or area"), "Grace");
    await userEvent.click(await screen.findByRole("button", { name: "Claim Grace Clinic" }));

    await userEvent.click(screen.getByRole("button", { name: "Choose another facility" }));

    expect(await screen.findByLabelText("Facility name or area")).toBeInTheDocument();
  });
});

describe("the return address after login", () => {
  it("sends a provider who came from this page back to it", () => {
    expect(addressAfterLogin("provider", "?next=/list-your-facility")).toBe("/list-your-facility");
  });

  it.each(["", "?next=/admin", "?next=https://evil.example", "?next=//evil.example", "?next=/list-your-facility/../admin"])(
    "ignores any other next (%s)",
    (search) => {
      expect(addressAfterLogin("provider", search)).toBe("/provider");
    },
  );

  it("never uses next for staff", () => {
    expect(addressAfterLogin("editor", "?next=/list-your-facility")).toBe("/admin");
    expect(addressAfterLogin("verifier", "?next=/list-your-facility")).toBe("/admin/listings?mine=true");
  });
});

describe("the files", () => {
  it("keep the API calls in lib/api and keep nothing in the browser", () => {
    for (const file of ["components/facility/ListYourFacility.tsx", "components/facility/RegisterFacility.tsx", "components/facility/ClaimFacility.tsx"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/fetch\(/);
      expect(source).not.toMatch(/localStorage|document\.cookie|geolocation/);
    }
  });
});
