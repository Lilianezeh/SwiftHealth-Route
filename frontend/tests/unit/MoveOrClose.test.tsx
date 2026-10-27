// @vitest-environment jsdom
/** Moving and closing a facility, and its address history. Requirements: FR-53, US-20, NFR-10. UI spec 3.11; api-spec 7, "Phase 8a".
 * Every name and address here is fictional.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MoveOrClose } from "@/components/facility/MoveOrClose";
import { resetMetaCache } from "@/lib/api/meta";
import type { AddressHistoryItem } from "@/lib/api/listingChanges";

import { META, json } from "../helpers/api";
import { readSource } from "../helpers/source";

type Call = { method: string; path: string; token: string | null; body: Record<string, unknown> | undefined };

type Handlers = {
  move?: (call: Call) => Response;
  close?: (call: Call) => Response;
  history?: () => AddressHistoryItem[];
};

const CURRENT = { address: "1 Example Road", area: "Ogui", landmark: null };
const call = async <T,>(operation: (token: string) => Promise<T>) => operation("tok");

function stubApi(handlers: Handlers = {}) {
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
      if (url.pathname.endsWith("/move")) {
        return (
          handlers.move ??
          (() => json({ listing_id: 7, status: "recheck_due", changed: ["address"], pin_needs_setting: false, message: "Moved. The listing is hidden until our team re-checks it." }))
        )(made);
      }
      if (url.pathname.endsWith("/close")) {
        return (handlers.close ?? (() => json({ listing_id: 7, status: "hidden", closed_at: "2026-10-27T09:00:00Z" })))(made);
      }
      if (url.pathname.endsWith("/address-history")) return json({ items: handlers.history ? handlers.history() : [] });
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, writes: () => calls.filter((made) => made.method === "POST") };
}

function show(props: Partial<React.ComponentProps<typeof MoveOrClose>> = {}) {
  return render(
    <MoveOrClose
      listingId={7}
      listingName="Eze Clinic"
      current={CURRENT}
      closedReason={null}
      isClosed={false}
      isStaff
      call={call}
      {...props}
    />,
  );
}

beforeEach(() => resetMetaCache());
afterEach(() => vi.unstubAllGlobals());

describe("moving", () => {
  it("shows the current address and keeps the button off until something differs", async () => {
    stubApi();
    show();

    expect(await screen.findByLabelText("New address")).toHaveValue("1 Example Road");
    expect(screen.getByLabelText("New area")).toHaveValue("Ogui");
    expect(screen.getByRole("button", { name: "Save the new address" })).toBeDisabled();
    expect(screen.getByText("Change the address, area or landmark first.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("New address"), " B");

    expect(screen.getByRole("button", { name: "Save the new address" })).toBeEnabled();
  });

  it("asks first, sends nothing before the answer, and Cancel sends nothing at all", async () => {
    const { writes } = stubApi();
    show();
    await userEvent.clear(await screen.findByLabelText("New address"));
    await userEvent.type(screen.getByLabelText("New address"), "9 New Road");

    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));

    expect(screen.getByText("Move Eze Clinic? It will be hidden from the public until our team re-checks it.")).toBeInTheDocument();
    expect(writes()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(writes()).toEqual([]);
    expect(screen.getByRole("button", { name: "Save the new address" })).toBeInTheDocument();
  });

  it("sends the new address, area and landmark with the token and shows the API's message", async () => {
    const { writes } = stubApi();
    show();
    await userEvent.clear(await screen.findByLabelText("New address"));
    await userEvent.type(screen.getByLabelText("New address"), "9 New Road");
    await userEvent.selectOptions(screen.getByLabelText("New area"), "GRA");
    await userEvent.type(screen.getByLabelText("Landmark (optional)"), "Beside the market");

    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Moved. The listing is hidden until our team re-checks it.");
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({
      path: "/listings/7/move",
      token: "tok",
      body: { address: "9 New Road", area: "GRA", landmark: "Beside the market" },
    });
    expect(screen.getByRole("button", { name: "Save the new address" })).toBeDisabled(); // the same move is not offered again
  });

  it("tells staff to set the pin and a provider that the team will, when the API says the pin needs setting", async () => {
    const answer = () => json({ listing_id: 7, status: "recheck_due", changed: ["address"], pin_needs_setting: true, message: "Moved." });
    stubApi({ move: answer });
    const staff = show({ isStaff: true });
    await userEvent.type(await screen.findByLabelText("New address"), " B");
    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Moved. Set the map pin in the form above.");
    staff.unmount();

    stubApi({ move: answer });
    show({ isStaff: false });
    await userEvent.type(await screen.findByLabelText("New address"), " B");
    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Moved. Our team will set the map pin when they re-check it.");
  });

  it("sends a blank landmark as null and asks for no pin", async () => {
    const { writes } = stubApi();
    show({ current: { ...CURRENT, landmark: "Beside the market" } });
    await userEvent.clear(await screen.findByLabelText("Landmark (optional)"));

    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0].body).toEqual({ address: "1 Example Road", area: "Ogui", landmark: null });
    expect(screen.queryByLabelText(/latitude|longitude/i)).toBeNull();
  });

  it("shows the API's sentence when the move is refused", async () => {
    stubApi({ move: () => json({ detail: "A closed listing cannot be moved. Reopen it first." }, 400) });
    show();
    await userEvent.type(await screen.findByLabelText("New address"), " B");
    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A closed listing cannot be moved. Reopen it first.");
  });

  it("says the person cannot move it on a 403", async () => {
    stubApi({ move: () => json({ detail: "x" }, 403) });
    show({ isStaff: false });
    await userEvent.type(await screen.findByLabelText("New address"), " B");
    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot move this facility.");
  });

  it("tells the parent after a successful move", async () => {
    stubApi();
    const onChanged = vi.fn();
    show({ onChanged });
    await userEvent.type(await screen.findByLabelText("New address"), " B");
    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });
});

describe("closing", () => {
  it("needs a reason first, then asks, then sends it", async () => {
    const { writes } = stubApi();
    show();
    const button = await screen.findByRole("button", { name: "Close this facility" });
    expect(button).toBeDisabled();
    expect(screen.getByText("Write why it is closing first.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Why is it closing?"), "Closed down in October");
    await userEvent.click(button);

    expect(screen.getByText("Close Eze Clinic for good? It will be hidden from the public. Nothing is deleted, and our team can reopen it.")).toBeInTheDocument();
    expect(writes()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Yes, close it" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Eze Clinic is closed. It is hidden from the public, and nothing was deleted.");
    expect(writes()[0]).toMatchObject({ path: "/listings/7/close", token: "tok", body: { reason: "Closed down in October" } });
    expect(screen.getByRole("heading", { level: 2, name: "This facility is closed." })).toBeInTheDocument();
    expect(screen.queryByLabelText("New address")).toBeNull();
  });

  it("says that only an owner can close it on a 403", async () => {
    stubApi({ close: () => json({ detail: "You do not have permission for this." }, 403) });
    show({ isStaff: false });
    await userEvent.type(await screen.findByLabelText("Why is it closing?"), "Closed down");
    await userEvent.click(screen.getByRole("button", { name: "Close this facility" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, close it" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Only the owner of a facility can close it.");
    expect(screen.getByLabelText("New address")).toBeInTheDocument(); // not closed
  });

  it("cancels without sending", async () => {
    const { writes } = stubApi();
    show();
    await userEvent.type(await screen.findByLabelText("Why is it closing?"), "Closed down");
    await userEvent.click(screen.getByRole("button", { name: "Close this facility" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(writes()).toEqual([]);
  });

  it("shows only the closed sentence for a closed facility, with the reason for staff and without it for a provider", async () => {
    stubApi();
    const staff = show({ isClosed: true, closedReason: "Closed down in October" });
    expect(await screen.findByRole("heading", { level: 2, name: "This facility is closed." })).toBeInTheDocument();
    expect(screen.getByText("Reason: Closed down in October")).toBeInTheDocument();
    expect(screen.getByText(/can reopen it with the Reopen button/)).toBeInTheDocument();
    expect(screen.queryByLabelText("New address")).toBeNull();
    expect(screen.queryByLabelText("Why is it closing?")).toBeNull();
    staff.unmount();

    stubApi();
    show({ isClosed: true, closedReason: "Closed down in October", isStaff: false });
    expect(await screen.findByRole("heading", { level: 2, name: "This facility is closed." })).toBeInTheDocument();
    expect(screen.queryByText(/Reason:/)).toBeNull();
  });
});

describe("the address history", () => {
  const ITEMS: AddressHistoryItem[] = [
    { changed_at: "2026-10-27T09:00:00Z", field: "address", old_value: "1 Example Road", new_value: "9 New Road", kind: "move", by: "Ada Editor" },
    { changed_at: "2026-07-01T09:00:00Z", field: "landmark", old_value: null, new_value: "Beside the market", kind: "edit", by: null },
  ];

  it("lists the changes in words, with the name of who made them for staff", async () => {
    const { calls } = stubApi({ history: () => ITEMS });
    show();

    expect(await screen.findByText(/Address 1 Example Road to 9 New Road \(by Ada Editor\)/)).toBeInTheDocument();
    expect(screen.getByText(/Landmark none to Beside the market$/)).toBeInTheDocument();
    expect(calls.find((made) => made.path === "/listings/7/address-history")?.token).toBe("tok");
  });

  it("shows no names to a provider, even if one arrived", async () => {
    stubApi({ history: () => ITEMS });
    show({ isStaff: false });

    expect(await screen.findByText(/Address 1 Example Road to 9 New Road$/)).toBeInTheDocument();
    expect(screen.queryByText(/Ada Editor/)).toBeNull();
  });

  it("says when there are no changes yet", async () => {
    stubApi();
    show();
    expect(await screen.findByText("No changes yet.")).toBeInTheDocument();
  });

  it("is loaded again after a move", async () => {
    let items: AddressHistoryItem[] = [];
    const { calls } = stubApi({ history: () => items });
    show();
    await screen.findByText("No changes yet.");
    items = [ITEMS[0]];

    await userEvent.type(screen.getByLabelText("New address"), " B");
    await userEvent.click(screen.getByRole("button", { name: "Save the new address" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, move it" }));

    expect(await screen.findByText(/Address 1 Example Road to 9 New Road/)).toBeInTheDocument();
    expect(calls.filter((made) => made.path === "/listings/7/address-history")).toHaveLength(2);
  });
});

describe("the layout", () => {
  it("has the three parts with their headings, the anchors #move and #close, and big fields and buttons", async () => {
    stubApi();
    const { container } = show();
    await screen.findByLabelText("New address");

    expect(screen.getByRole("heading", { level: 2, name: "Moved to a new address?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Closed for good?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Address history" })).toBeInTheDocument();
    expect(container.querySelector("#move")).not.toBeNull();
    expect(container.querySelector("#close")).not.toBeNull();
    expect(screen.getByLabelText("New address").className).toMatch(/min-h-12/);
    expect(screen.getByRole("button", { name: "Close this facility" }).className).toMatch(/min-h-\[50px\]/);
  });

  it("keeps its API calls in lib/api and keeps nothing in the browser", () => {
    const source = readSource("components/facility/MoveOrClose.tsx");
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|geolocation/);
  });
});
