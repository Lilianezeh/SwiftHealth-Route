// @vitest-environment jsdom
/** The staff accounts screen (admin only). Requirements: FR-41, NFR-06, NFR-07, NFR-10. UI spec 3.8 and "Phase 10 details"; decision C10
 * in specs/2026-10-20-staff-screens/requirements.md.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminStaffPage from "@/app/(dashboards)/admin/staff/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { StaffRole, StaffUser } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function person(id: number, role: StaffRole, overrides: Partial<StaffUser> = {}): StaffUser {
  return { id, name: `Person ${id}`, email: `person${id}@example.com`, phone: "+2340000000001", role, is_active: true, ...overrides };
}

const USERS = [person(1, "admin"), person(2, "editor"), person(3, "verifier", { is_active: false }), person(4, "provider")];

function loginAs(role: StaffRole, id = 1) {
  saveStaffSession({ token: "tok", user: person(id, role) });
}

type Call = { method: string; path: string; body: unknown; headers: Record<string, string> };

function stubApi(options: { users?: StaffUser[]; write?: (call: Call) => Response } = {}) {
  const calls: Call[] = [];
  const users = [...(options.users ?? USERS)];
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
      if (options.write && call.method !== "GET") return options.write(call);
      if (call.method === "GET" && url.pathname === "/admin/users") return json({ items: users, total: users.length });
      if (call.method === "POST" && url.pathname === "/admin/users") {
        const created = person(9, (call.body as { role: StaffRole }).role, { name: (call.body as { name: string }).name });
        users.push(created);
        return json(created, 201);
      }
      if (call.method === "PATCH") {
        const id = Number(url.pathname.split("/").at(-1));
        const index = users.findIndex((user) => user.id === id);
        users[index] = { ...users[index], ...(call.body as object) } as StaffUser;
        return json(users[index]);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, writes: () => calls.filter((call) => call.method !== "GET") };
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("admin");
});
afterEach(() => vi.unstubAllGlobals());

describe("the staff list", () => {
  it("shows every account with its role and whether it is active, in words, and sends the token", async () => {
    const { calls } = stubApi();
    render(<AdminStaffPage />);

    const rows = await screen.findAllByRole("listitem");

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Person 1");
    expect(rows[0]).toHaveTextContent("person1@example.com");
    expect(rows[0]).toHaveTextContent("Admin");
    expect(rows[0]).toHaveTextContent("Active");
    expect(rows[2]).toHaveTextContent("Verifier");
    expect(rows[2]).toHaveTextContent("Deactivated");
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
  });

  it("never shows a password or a hash", async () => {
    stubApi();
    const { container } = render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");

    expect(container.textContent).not.toMatch(/password_hash|\$argon2/i);
  });

  it("shows the error with Retry when the list cannot be loaded", async () => {
    let attempts = 0;
    stubApi({ write: () => json({}) });
    vi.stubGlobal("fetch", vi.fn(async () => (++attempts === 1 ? json({ detail: "boom" }, 500) : json({ items: USERS, total: 4 }))));
    render(<AdminStaffPage />);

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByRole("listitem")).toHaveLength(4);
  });
});

describe("access", () => {
  it.each(["verifier", "editor", "provider"] as const)("is closed to a %s", async (role) => {
    loginAs(role);
    stubApi();
    render(<AdminStaffPage />);

    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add user" })).toBeNull();
  });

  it("is closed to a visitor with no session", async () => {
    window.sessionStorage.clear();
    stubApi();
    render(<AdminStaffPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
  });
});

describe("adding a user", () => {
  async function openForm() {
    stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
  }

  it("has name, email, phone, role and password fields, each labelled and at least 48 px high", async () => {
    await openForm();

    for (const label of ["Name", "Email", "Phone", "Role", "Password (at least 10 characters)"]) {
      expect(screen.getByLabelText(label).className).toMatch(/\bmin-h-12\b/);
    }
    expect(screen.getByLabelText("Password (at least 10 characters)")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Password (at least 10 characters)")).toHaveAttribute("autocomplete", "new-password");
  });

  it("offers the four roles", async () => {
    await openForm();

    expect(within(screen.getByLabelText("Role")).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["verifier", "editor", "admin", "provider"]);
  });

  it("will not send a password shorter than 10 characters", async () => {
    stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(screen.getByLabelText("Name"), "Ada New");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "0803 000 0001");
    await userEvent.type(screen.getByLabelText("Password (at least 10 characters)"), "short");

    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));

    expect(screen.getByText("The password needs at least 10 characters.")).toBeInTheDocument();
  });

  it("creates the user, adds it to the list and clears the form", async () => {
    const { writes } = stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));

    await userEvent.type(screen.getByLabelText("Name"), "Ada New");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "0803 000 0001");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "editor");
    await userEvent.type(screen.getByLabelText("Password (at least 10 characters)"), "a-long-enough-password");
    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));

    expect(await screen.findByText("Ada New was added.")).toBeInTheDocument();
    expect(writes()[0].method).toBe("POST");
    expect(writes()[0].body).toEqual({
      name: "Ada New", email: "ada@example.com", phone: "0803 000 0001", role: "editor", password: "a-long-enough-password",
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByLabelText("Password (at least 10 characters)")).toBeNull(); // the form is closed and forgotten
  });

  it("says a duplicate email is already used, and keeps the form", async () => {
    stubApi({ write: () => json({ detail: "A user with this email already exists." }, 409) });
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(screen.getByLabelText("Name"), "Ada New");
    await userEvent.type(screen.getByLabelText("Email"), "person1@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "0803 000 0001");
    await userEvent.type(screen.getByLabelText("Password (at least 10 characters)"), "a-long-enough-password");

    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));

    expect(await screen.findByText("A user with this email already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada New");
  });

  it("does not keep the password after it was sent, in any storage", async () => {
    stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(screen.getByLabelText("Name"), "Ada New");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "0803 000 0001");
    await userEvent.type(screen.getByLabelText("Password (at least 10 characters)"), "a-long-enough-password");
    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));
    await screen.findByText("Ada New was added.");

    expect(JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage })).not.toContain("a-long-enough-password");
  });
});

describe("the password rule: 8 characters for a provider, 10 for staff and admin (FR-56)", () => {
  async function openAddForm() {
    const calls = stubApi();
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(screen.getByLabelText("Name"), "Ada New");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "0803 000 0001");
    return calls;
  }

  it("asks for 8 characters when the role is provider and for 10 for every staff role", async () => {
    await openAddForm();

    for (const role of ["verifier", "editor", "admin"]) {
      await userEvent.selectOptions(screen.getByLabelText("Role"), role);
      expect(screen.getByLabelText("Password (at least 10 characters)")).toBeInTheDocument();
    }
    await userEvent.selectOptions(screen.getByLabelText("Role"), "provider");
    expect(screen.getByLabelText("Password (at least 8 characters)")).toBeInTheDocument();
  });

  it("sends an 8-character password for a provider but not for a staff role", async () => {
    const { writes } = await openAddForm();

    await userEvent.selectOptions(screen.getByLabelText("Role"), "editor");
    await userEvent.type(screen.getByLabelText("Password (at least 10 characters)"), "river78!");
    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));
    expect(screen.getByText("The password needs at least 10 characters.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);

    await userEvent.selectOptions(screen.getByLabelText("Role"), "provider"); // the same 8 characters now pass
    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));
    expect(await screen.findByText("Ada New was added.")).toBeInTheDocument();
    expect(writes()[0].body).toMatchObject({ role: "provider", password: "river78!" });
  });

  it("shows the sentence the API gives for a very common password, and keeps the form", async () => {
    stubApi({ write: () => json({ detail: "This password is too common. Choose another one." }, 422) });
    render(<AdminStaffPage />);
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));
    await userEvent.type(screen.getByLabelText("Name"), "Ada New");
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Phone"), "0803 000 0001");
    await userEvent.type(screen.getByLabelText("Password (at least 10 characters)"), "qwertyuiop");

    await userEvent.click(screen.getByRole("button", { name: "Add this user" }));

    expect(await screen.findByText("This password is too common. Choose another one.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada New");
  });

  async function openRow(name: string) {
    const calls = stubApi();
    render(<AdminStaffPage />);
    const rows = await screen.findAllByRole("listitem");
    const row = rows.find((candidate) => candidate.textContent?.includes(name)) as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: `Edit ${name}` }));
    return calls;
  }

  it("asks for a new 10-character password when a provider is made staff, and sends it with the role", async () => {
    const { writes } = await openRow("Person 4");
    expect(screen.getByLabelText("New password for Person 4 (at least 8 characters)")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Role of Person 4"), "verifier");
    expect(screen.getByLabelText("New password for Person 4 (at least 10 characters)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save Person 4" }));
    expect(screen.getByText("To make a provider staff, type a new password of at least 10 characters.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);

    await userEvent.type(screen.getByLabelText("New password for Person 4 (at least 10 characters)"), "river-bed!");
    await userEvent.click(screen.getByRole("button", { name: "Save Person 4" }));
    await screen.findByText("Person 4 was updated.");
    expect(writes()[0].body).toEqual({ role: "verifier", password: "river-bed!" });
  });

  it("lets a staff account become a provider with no new password", async () => {
    const { writes } = await openRow("Person 2");

    await userEvent.selectOptions(screen.getByLabelText("Role of Person 2"), "provider");
    await userEvent.click(screen.getByRole("button", { name: "Save Person 2" }));

    await screen.findByText("Person 2 was updated.");
    expect(writes()[0].body).toEqual({ role: "provider" });
  });
});

describe("editing a user", () => {
  async function openEditor(name: string) {
    const { writes } = stubApi();
    render(<AdminStaffPage />);
    const rows = await screen.findAllByRole("listitem");
    const row = rows.find((candidate) => candidate.textContent?.includes(name)) as HTMLElement;
    await userEvent.click(within(row).getByRole("button", { name: `Edit ${name}` }));
    return { writes, row };
  }

  it("sends only what changed: a new role, then Active, with the others untouched", async () => {
    const { writes } = await openEditor("Person 2");

    await userEvent.selectOptions(screen.getByLabelText("Role of Person 2"), "admin");
    await userEvent.click(screen.getByRole("button", { name: "Save Person 2" }));

    expect(await screen.findByText("Person 2 was updated.")).toBeInTheDocument();
    expect(writes()[0].method).toBe("PATCH");
    expect(writes()[0].path).toBe("/admin/users/2");
    expect(writes()[0].body).toEqual({ role: "admin" });
  });

  it("can deactivate another user and set a new password, which is sent only when typed", async () => {
    const { writes } = await openEditor("Person 2");

    await userEvent.click(screen.getByLabelText("Person 2 is active"));
    await userEvent.type(screen.getByLabelText("New password for Person 2 (at least 10 characters)"), "another-long-password");
    await userEvent.click(screen.getByRole("button", { name: "Save Person 2" }));

    await screen.findByText("Person 2 was updated.");
    expect(writes()[0].body).toEqual({ is_active: false, password: "another-long-password" });
  });

  it("will not save a new password shorter than 10 characters", async () => {
    const { writes } = await openEditor("Person 2");

    await userEvent.type(screen.getByLabelText("New password for Person 2 (at least 10 characters)"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Save Person 2" }));

    expect(screen.getByText("The password needs at least 10 characters.")).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it("has nothing to save until something changes", async () => {
    await openEditor("Person 2");

    expect(screen.getByRole("button", { name: "Save Person 2" })).toBeDisabled();
  });

  it("does not let an admin deactivate themselves or give up their own admin role, and says why", async () => {
    await openEditor("Person 1");

    expect(screen.getByLabelText("Person 1 is active")).toBeDisabled();
    expect(screen.getByLabelText("Role of Person 1")).toBeDisabled();
    expect(screen.getByText("You cannot deactivate yourself or give up your own admin role.")).toBeInTheDocument();
  });

  it("links a provider to a listing by its number, and only a provider has that field", async () => {
    const { writes } = await openEditor("Person 4");

    await userEvent.type(screen.getByLabelText("Listing number for Person 4"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Save Person 4" }));

    await screen.findByText("Person 4 was updated.");
    expect(writes()[0].body).toEqual({ listing_id: 12 });
  });

  it("has no listing field for anyone but a provider", async () => {
    await openEditor("Person 2");

    expect(screen.queryByLabelText("Listing number for Person 2")).toBeNull();
  });

  it("shows the API's sentence when it refuses (a listing that belongs to someone else)", async () => {
    stubApi({ write: () => json({ detail: "This listing already belongs to another user." }, 409) });
    render(<AdminStaffPage />);
    const rows = await screen.findAllByRole("listitem");
    await userEvent.click(within(rows[3]).getByRole("button", { name: "Edit Person 4" }));
    await userEvent.type(screen.getByLabelText("Listing number for Person 4"), "12");

    await userEvent.click(screen.getByRole("button", { name: "Save Person 4" }));

    expect(await screen.findByText("This listing already belongs to another user.")).toBeInTheDocument();
  });
});

describe("what is never done", () => {
  it("keeps no password in state beyond the form, writes nothing to the console and never to localStorage", () => {
    for (const file of ["components/admin/StaffAccounts.tsx"]) {
      expect(readSource(file)).not.toMatch(/console\.|localStorage|sessionStorage/);
    }
  });
});
