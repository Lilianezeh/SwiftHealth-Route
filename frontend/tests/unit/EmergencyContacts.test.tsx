// @vitest-environment jsdom
/** The staff screen for the SwiftRescue contacts `/admin/emergency-contacts`. Requirements: FR-15, FR-19, FR-31, FR-32, NFR-10.
 * UI spec 3.13; api-spec section 5, "SwiftRescue contacts for staff". Add and Edit go to the listing editor; Remove is hiding.
 * Every name and number here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmergencyContactsPage from "@/app/(dashboards)/admin/emergency-contacts/page";
import type { EmergencyContactGroups } from "@/types/staff";

import { json } from "../helpers/api";
import { makeListing } from "../helpers/listing";
import { loginAs } from "../helpers/queue";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() }; // one object: the gate's effect depends on it
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const GROUP_NAMES: [string, string][] = [
  ["ambulance", "Ambulance"],
  ["fire", "Fire service"],
  ["police", "Police"],
  ["emergency-unit", "Hospital emergency (24 hours)"],
  ["roadside-assistance", "Road accidents"],
  ["security", "Security"],
  ["disaster-flooding", "Disaster and flooding"],
  ["gbv-support", "Sexual and gender-based violence support"],
  ["mental-health-crisis", "Mental health crisis support"],
];

function contact(id: number, name: string, status: "published" | "draft" | "hidden" = "published") {
  return {
    ...makeListing({ id, name, slug: `unit-${id}`, primary_phone: "+2348030001234" }),
    status,
    next_check_due: null,
    created_by: null,
  };
}

function groups(contacts: Record<string, ReturnType<typeof contact>[]> = {}): EmergencyContactGroups {
  return {
    groups: GROUP_NAMES.map(([slug, name]) => ({
      category: { slug, name },
      contacts: contacts[slug] ?? [],
      total: (contacts[slug] ?? []).length,
    })),
  };
}

type Call = { method: string; path: string; token: string | null; body: Record<string, unknown> | undefined };

function stubApi(answer: EmergencyContactGroups | "fails", hide?: (call: Call) => Response) {
  const calls: Call[] = [];
  let current = answer;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const headers = new Headers(init?.headers);
      const call: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        token: headers.get("Authorization")?.replace("Bearer ", "") ?? null,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      };
      calls.push(call);
      if (url.pathname === "/staff/emergency-contacts") {
        return current === "fails" ? json({ detail: "x" }, 500) : json(current);
      }
      if (/^\/listings\/\d+\/hide$/.test(url.pathname) && call.method === "POST") {
        const id = Number(url.pathname.split("/")[2]);
        if (hide) return hide(call);
        if (current !== "fails") {
          current = {
            groups: current.groups.map((group) => ({
              ...group,
              contacts: group.contacts.map((item) => (item.id === id ? { ...item, status: "hidden" as const } : item)),
            })),
          };
        }
        return json({ id, status: "hidden" });
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, writes: () => calls.filter((call) => call.method !== "GET") };
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("editor");
});
afterEach(() => vi.unstubAllGlobals());

describe("who may open it", () => {
  it("sends a visitor with no session to the login and asks for nothing", async () => {
    window.sessionStorage.clear();
    const { calls } = stubApi(groups());
    render(<EmergencyContactsPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    expect(calls).toEqual([]);
  });

  it.each(["verifier", "provider"] as const)("tells a %s the role cannot open it and asks for nothing", async (role) => {
    loginAs(role);
    const { calls } = stubApi(groups());
    render(<EmergencyContactsPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it.each(["editor", "admin"] as const)("lets an %s in and asks with the token", async (role) => {
    loginAs(role);
    const { calls } = stubApi(groups());
    render(<EmergencyContactsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "SwiftRescue contacts" })).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ method: "GET", path: "/staff/emergency-contacts", token: "tok" });
  });
});

describe("the groups", () => {
  it("explains the screen, says 112 is not listed, and has one h2 per group in the order given", async () => {
    stubApi(groups({ ambulance: [contact(1, "Alpha Ambulance")], fire: [contact(2, "Beta Fire")] }));
    render(<EmergencyContactsPage />);

    await screen.findByRole("heading", { level: 1, name: "SwiftRescue contacts" });
    expect(screen.getByText(/112 is always first and is not listed here/)).toBeInTheDocument();
    expect(screen.getByText(/appears in SwiftRescue after our team has verified and published it/)).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Ambulance (1)", "Fire service (1)", "Police (0)", "Hospital emergency (24 hours) (0)", "Road accidents (0)",
      "Security (0)", "Disaster and flooding (0)", "Sexual and gender-based violence support (0)",
      "Mental health crisis support (0)",
    ]);
  });

  it("gives every group an 'Add a contact' link to the new-listing editor with that category", async () => {
    stubApi(groups());
    render(<EmergencyContactsPage />);

    const police = await screen.findByRole("link", { name: "Add a contact to Police" });

    expect(police).toHaveAttribute("href", "/admin/listings/new?category=police");
    expect(screen.getAllByRole("link", { name: /^Add a contact to / })).toHaveLength(9);
    expect(police.className).toMatch(/min-h-12|min-h-\[50px\]/);
  });

  it("says an empty group is empty", async () => {
    stubApi(groups({ ambulance: [contact(1, "Alpha Ambulance")] }));
    render(<EmergencyContactsPage />);

    await screen.findByText("Alpha Ambulance");

    expect(screen.getAllByText("No contacts in this group yet.")).toHaveLength(8);
  });

  it("shows a contact with its area, status in words, main phone in reading form, and an Edit link", async () => {
    stubApi(groups({ ambulance: [contact(1, "Alpha Ambulance"), contact(2, "Beta Ambulance", "draft")] }));
    render(<EmergencyContactsPage />);

    const cards = await screen.findAllByRole("article");
    const [alpha, beta] = cards;

    expect(within(alpha).getByText("Alpha Ambulance")).toBeInTheDocument();
    expect(within(alpha).getByText("Published")).toBeInTheDocument();
    expect(within(alpha).getByText("0803 000 1234")).toBeInTheDocument();
    expect(within(alpha).getByRole("link", { name: "Edit Alpha Ambulance" })).toHaveAttribute("href", "/admin/listings/1");
    expect(within(beta).getByText("Draft")).toBeInTheDocument();
  });

  it("shows the error with Retry when the list cannot be loaded", async () => {
    stubApi("fails");
    render(<EmergencyContactsPage />);

    expect(await screen.findByText(/couldn't load this/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("removing a contact (hiding it, never deleting)", () => {
  async function open() {
    const api = stubApi(groups({ ambulance: [contact(1, "Alpha Ambulance"), contact(2, "Old Ambulance", "hidden")] }));
    render(<EmergencyContactsPage />);
    const [alpha] = await screen.findAllByRole("article");
    return { ...api, alpha };
  }

  it("asks for a reason, then asks to confirm, and sends nothing before the answer", async () => {
    const { writes, alpha } = await open();

    await userEvent.click(within(alpha).getByRole("button", { name: "Remove Alpha Ambulance" }));
    const remove = within(alpha).getByRole("button", { name: "Remove from SwiftRescue" });
    expect(remove).toBeDisabled();
    expect(within(alpha).getByText("Write why first.")).toBeInTheDocument();
    await userEvent.type(within(alpha).getByLabelText("Why is it removed?"), "No longer runs");
    await userEvent.click(remove);

    expect(within(alpha).getByText("Remove Alpha Ambulance from SwiftRescue? It will be hidden, not deleted.")).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it("Cancel sends nothing", async () => {
    const { writes, alpha } = await open();
    await userEvent.click(within(alpha).getByRole("button", { name: "Remove Alpha Ambulance" }));
    await userEvent.type(within(alpha).getByLabelText("Why is it removed?"), "No longer runs");
    await userEvent.click(within(alpha).getByRole("button", { name: "Remove from SwiftRescue" }));

    await userEvent.click(within(alpha).getByRole("button", { name: "Cancel" }));

    expect(writes()).toEqual([]);
  });

  it("hides the contact with the reason and the token, then shows it as Hidden without a Remove button", async () => {
    const { writes, alpha } = await open();
    await userEvent.click(within(alpha).getByRole("button", { name: "Remove Alpha Ambulance" }));
    await userEvent.type(within(alpha).getByLabelText("Why is it removed?"), "  No longer runs  ");
    await userEvent.click(within(alpha).getByRole("button", { name: "Remove from SwiftRescue" }));

    await userEvent.click(within(alpha).getByRole("button", { name: "Yes, remove" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ method: "POST", path: "/listings/1/hide", token: "tok", body: { reason: "No longer runs" } });
    expect(await screen.findByRole("status")).toHaveTextContent("Alpha Ambulance was removed from SwiftRescue. It is hidden, not deleted.");
    const [updated] = screen.getAllByRole("article");
    expect(within(updated).getByText("Hidden")).toBeInTheDocument();
    expect(within(updated).queryByRole("button", { name: /^Remove / })).toBeNull();
    expect(within(updated).getByRole("link", { name: "Edit Alpha Ambulance" })).toBeInTheDocument();
  });

  it("offers no Remove button for a contact that is already hidden", async () => {
    await open();
    const cards = screen.getAllByRole("article");

    expect(within(cards[1]).getByText("Hidden")).toBeInTheDocument();
    expect(within(cards[1]).queryByRole("button", { name: /^Remove / })).toBeNull();
  });

  it("shows the API's sentence when the removal is refused, and keeps the card as it was", async () => {
    const api = stubApi(groups({ ambulance: [contact(1, "Alpha Ambulance")] }), () => json({ detail: "This listing is already hidden." }, 400));
    render(<EmergencyContactsPage />);
    const [alpha] = await screen.findAllByRole("article");
    await userEvent.click(within(alpha).getByRole("button", { name: "Remove Alpha Ambulance" }));
    await userEvent.type(within(alpha).getByLabelText("Why is it removed?"), "No longer runs");
    await userEvent.click(within(alpha).getByRole("button", { name: "Remove from SwiftRescue" }));

    await userEvent.click(within(alpha).getByRole("button", { name: "Yes, remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This listing is already hidden.");
    expect(within(alpha).getByText("Published")).toBeInTheDocument();
    expect(api.writes()).toHaveLength(1);
  });
});

describe("the staff bar and the files", () => {
  it.each(["editor", "admin"] as const)("gives an %s the link SwiftRescue contacts", async (role) => {
    loginAs(role);
    stubApi(groups());
    render(<EmergencyContactsPage />);

    const bar = await screen.findByRole("navigation", { name: "Staff" });

    expect(within(bar).getByRole("link", { name: "SwiftRescue contacts" })).toHaveAttribute("href", "/admin/emergency-contacts");
  });

  it("keeps the calls in lib/api, never deletes, and stores nothing", () => {
    const source = readSource("components/admin/EmergencyContacts.tsx");
    expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|document\.cookie|DELETE/);
  });
});
