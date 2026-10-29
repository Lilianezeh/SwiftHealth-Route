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

type Call = { method: string; path: string; search: string; token: string | null; body: Record<string, unknown> | undefined };

type Handlers = {
  register?: (call: Call) => Response;
  claim?: (call: Call) => Response;
  claimable?: (call: Call) => Response;
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
        return (handlers.register ?? (() => json({ message: "Thanks.", listing_id: 7, link_id: 8 }, 201)))(call);
      }
      if (url.pathname === "/provider/claimable") return (handlers.claimable ?? (() => json({ items: FOUND })))(call);
      if (url.pathname === "/provider/claims") {
        return (handlers.claim ?? (() => json({ message: "Thanks. Our team will phone the facility to check.", link_id: 9 }, 201)))(call);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, apiCalls: () => calls.filter((call) => call.path.startsWith("/provider")) };
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
    expect(screen.getByText("Listing is free during our launch. Our team checks every listing before it goes live.")).toBeInTheDocument();
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

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks. We'll verify your facility before it's listed.");
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

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks. Our team will phone the facility to check.");
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
