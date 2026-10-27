// @vitest-environment jsdom
/** Branches of a facility: the provider's list and form, and the staff editor's "Branch of a bigger facility?".
 * Requirements: FR-52, US-20, NFR-10. UI spec 3.12; api-spec 7, "Phase 8b". Every name and number here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BranchOf } from "@/components/admin/BranchOf";
import { Branches } from "@/components/facility/Branches";
import { resetMetaCache } from "@/lib/api/meta";

import { META, json } from "../helpers/api";
import { readSource } from "../helpers/source";

type Call = { method: string; path: string; token: string | null; body: Record<string, unknown> | undefined };

const call = async <T,>(operation: (token: string) => Promise<T>) => operation("tok");

function stubApi(options: { branches?: unknown[]; add?: (call: Call) => Response; patch?: (call: Call) => Response } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const headers = new Headers(init?.headers);
      const made: Call = {
        method: init?.method ?? "GET",
        path: url.pathname,
        token: headers.get("Authorization")?.replace("Bearer ", "") ?? null,
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      };
      calls.push(made);
      if (url.pathname === "/meta") return json(META);
      if (url.pathname === "/provider/facilities/7/branches" && made.method === "GET") return json({ items: options.branches ?? [] });
      if (url.pathname === "/provider/facilities/7/branches" && made.method === "POST") {
        return (options.add ?? (() => json({ message: "Thanks. Our team will verify the branch before it is listed.", listing_id: 31 }, 201)))(made);
      }
      if (url.pathname === "/listings/12" && made.method === "PATCH") {
        return (options.patch ?? (() => json({ parent_id: 7, parent_name: "Eze Clinic" })))(made);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, writes: () => calls.filter((made) => made.method !== "GET") };
}

beforeEach(() => resetMetaCache());
afterEach(() => vi.unstubAllGlobals());

async function fillBranch() {
  await screen.findByRole("option", { name: "Ogui" });
  await userEvent.type(screen.getByLabelText("Branch name"), "Eze Clinic Ogui");
  await userEvent.selectOptions(screen.getByLabelText("Branch area"), "Ogui");
  await userEvent.type(screen.getByLabelText("Branch address"), "7 Branch Road");
  await userEvent.type(screen.getByLabelText("Branch phone number"), "0803 000 9999");
}

describe("the provider's Branches part", () => {
  it("lists the branches with their status in words and an Edit link to each", async () => {
    stubApi({ branches: [
      { id: 21, name: "Annex", area: "GRA", status: "published" },
      { id: 22, name: "Second", area: "Ogui", status: "draft" },
    ] });
    render(<Branches mainId={7} call={call} />);

    const items = await screen.findAllByRole("listitem");

    expect(within(items[0]).getByText("GRA · Listed")).toBeInTheDocument();
    expect(within(items[1]).getByText("Ogui · Waiting for our team to verify it")).toBeInTheDocument();
    expect(within(items[0]).getByRole("link", { name: "Edit Annex" })).toHaveAttribute("href", "/provider/edit?listing=21");
    expect(screen.getByRole("heading", { level: 2, name: "Branches" })).toBeInTheDocument();
  });

  it("says there are none yet, and offers the form", async () => {
    stubApi();
    render(<Branches mainId={7} call={call} />);

    expect(await screen.findByText("No branches yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Add a branch" })).toBeInTheDocument();
  });

  it("sends the branch with the token and no category, thanks, clears the form and lists again", async () => {
    const { writes, calls } = stubApi();
    render(<Branches mainId={7} call={call} />);
    await fillBranch();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks. Our team will verify the branch before it is listed.");
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({
      path: "/provider/facilities/7/branches",
      token: "tok",
      body: { facility_name: "Eze Clinic Ogui", area: "Ogui", address: "7 Branch Road", phone: "0803 000 9999" },
    });
    expect(Object.keys(writes()[0].body ?? {})).not.toContain("category");
    expect(screen.getByLabelText("Branch name")).toHaveValue("");
    expect(calls.filter((made) => made.method === "GET" && made.path.endsWith("/branches"))).toHaveLength(2);
  });

  it("says what is missing, all at once, and sends nothing", async () => {
    const { writes } = stubApi();
    render(<Branches mainId={7} call={call} />);
    await screen.findByRole("option", { name: "Ogui" });

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    const alert = await screen.findByRole("alert");
    for (const sentence of ["Enter the branch name.", "Choose an area.", "Enter the address."]) expect(alert).toHaveTextContent(sentence);
    expect(alert).toHaveTextContent("Check the phone number. It should look like 0803 123 4567.");
    expect(writes()).toEqual([]);
  });

  it.each([
    [409, "This branch is already registered. Please contact us."],
    [422, "A branch cannot have its own branches."],
  ])("shows the API's sentence on %s and keeps what was typed", async (status, sentence) => {
    stubApi({ add: () => json({ detail: sentence }, status) });
    render(<Branches mainId={7} call={call} />);
    await fillBranch();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(screen.getByLabelText("Branch address")).toHaveValue("7 Branch Road");
  });

  it("says on 429 to try again tomorrow", async () => {
    stubApi({ add: () => json({ detail: "x" }, 429) });
    render(<Branches mainId={7} call={call} />);
    await fillBranch();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You've added several branches. Please try again tomorrow.");
  });

  it("keeps its API calls in lib/api and keeps nothing in the browser", () => {
    for (const file of ["components/facility/Branches.tsx", "components/admin/BranchOf.tsx"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/fetch\(/);
      expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|geolocation/);
    }
  });
});

describe("the staff editor's Branch of a bigger facility? part", () => {
  function show(props: Partial<React.ComponentProps<typeof BranchOf>> = {}) {
    const onChanged = vi.fn();
    render(<BranchOf listingId={12} parentId={null} parentName={null} call={call} onChanged={onChanged} {...props} />);
    return onChanged;
  }

  it("says a main facility is a main facility, and a branch names its main facility with a link to its editor", () => {
    stubApi();
    const first = render(<BranchOf listingId={12} parentId={null} parentName={null} call={call} onChanged={vi.fn()} />);
    expect(screen.getByText("This is a main facility.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make it a main facility" })).toBeDisabled();
    first.unmount();

    show({ parentId: 7, parentName: "Eze Clinic" });
    expect(screen.getByRole("link", { name: "Eze Clinic" })).toHaveAttribute("href", "/admin/listings/7");
    expect(screen.getByRole("button", { name: "Make it a main facility" })).toBeEnabled();
  });

  it("needs a number before it can make a branch, and sends the number with the token", async () => {
    const { writes } = stubApi();
    const onChanged = show();
    const button = screen.getByRole("button", { name: "Make it a branch" });
    expect(button).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Main facility number"), "7");
    await userEvent.click(button);

    expect(await screen.findByRole("status")).toHaveTextContent("This is now a branch of Eze Clinic.");
    expect(writes()[0]).toMatchObject({ path: "/listings/12", method: "PATCH", token: "tok", body: { parent_id: 7 } });
    expect(onChanged).toHaveBeenCalledWith({ parent_id: 7, parent_name: "Eze Clinic" });
  });

  it("clears the main facility with null", async () => {
    const { writes } = stubApi({ patch: () => json({ parent_id: null, parent_name: null }) });
    show({ parentId: 7, parentName: "Eze Clinic" });

    await userEvent.click(screen.getByRole("button", { name: "Make it a main facility" }));

    expect(await screen.findByRole("status")).toHaveTextContent("This is now a main facility.");
    expect(writes()[0].body).toEqual({ parent_id: null });
  });

  it("shows the API's sentence when a rule refuses, and a plain one on 403", async () => {
    stubApi({ patch: () => json({ detail: "A closed facility cannot have branches." }, 422) });
    show();
    await userEvent.type(screen.getByLabelText("Main facility number"), "7");
    await userEvent.click(screen.getByRole("button", { name: "Make it a branch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A closed facility cannot have branches.");

    stubApi({ patch: () => json({ detail: "x" }, 403) });
    await userEvent.click(screen.getByRole("button", { name: "Make it a branch" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Only an editor or admin can do this."));
  });
});
