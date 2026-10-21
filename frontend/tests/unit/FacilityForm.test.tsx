// @vitest-environment jsdom
/** The "List your facility" form. Requirements: FR-37 (submissions arrive as drafts), FR-23, NFR-06, NFR-07, NFR-10. UI spec 2.9 and
 * "Phase 10 details"; decisions C6 and C7 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ListYourFacilityPage from "@/app/(public)/list-your-facility/page";
import { resetMetaCache } from "@/lib/api/meta";

import { META, json } from "../helpers/api";
import { readSource } from "../helpers/source";

type Post = { body: Record<string, unknown>; url: URL };

function stubApi(options: { post?: () => Response } = {}) {
  const posts: Post[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      if (url.pathname === "/meta") return json(META);
      if (url.pathname === "/facility-submissions" && init?.method === "POST") {
        posts.push({ body: JSON.parse(String(init.body)) as Record<string, unknown>, url });
        return (options.post ?? (() => json({ message: "Thanks. Our team will verify your facility before it is listed." }, 201)))();
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { posts };
}

async function fillValidForm() {
  await screen.findByRole("option", { name: "Clinic" });
  await userEvent.type(screen.getByLabelText("Facility name"), "Example Clinic");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "clinic");
  await userEvent.selectOptions(screen.getByLabelText("Area"), "Ogui");
  await userEvent.type(screen.getByLabelText("Address"), "4 Example Street");
  await userEvent.type(screen.getByLabelText("Phone number"), "0803 000 0000");
  await userEvent.type(screen.getByLabelText("Your name"), "Dr. Example");
  await userEvent.type(screen.getByLabelText("Your email"), "owner@example.com");
}

beforeEach(() => resetMetaCache());
afterEach(() => vi.unstubAllGlobals());

describe("the page", () => {
  it("has one h1 and says that listing is free in the launch and that every listing is checked", async () => {
    stubApi();
    render(<ListYourFacilityPage />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("List your facility");
    expect(screen.getByText("Listing is free during our launch. Our team checks every listing before it goes live.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Coming soon/);
  });

  it("has the eight fields, labelled, the first seven required and at least 48 px high", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    for (const label of ["Facility name", "Category", "Area", "Address", "Phone number", "Your name", "Your email"]) {
      const field = screen.getByLabelText(label);
      expect(field).toBeRequired();
      expect(field.className).toMatch(/\bmin-h-12\b/);
    }
    expect(screen.getByLabelText("Notes (optional)")).not.toBeRequired();
    expect(screen.getByLabelText("Your email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Phone number")).toHaveAttribute("inputmode", "tel");
  });

  it("offers only the everyday categories (not the emergency ones) and the areas of the API", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    const categories = within(screen.getByLabelText("Category")).getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(categories).toEqual(["", "clinic", "pharmacy", "laboratory", "hospital", "maternity"]);
    expect(within(screen.getByLabelText("Area")).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["", "GRA", "New Haven", "Ogui"]);
  });

  it("never asks for the visitor's position", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    expect(readSource("components/facility/FacilityForm.tsx")).not.toMatch(/geolocation|useLocation|locationStore|localStorage|sessionStorage|console\./);
  });
});

describe("sending", () => {
  it("sends the typed values to POST /facility-submissions, then thanks the owner and clears the form", async () => {
    const { posts } = stubApi();
    render(<ListYourFacilityPage />);
    await fillValidForm();
    await userEvent.type(screen.getByLabelText("Notes (optional)"), "Open 24 hours");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Thanks. We'll verify your facility before it's listed.")).toBeInTheDocument();
    expect(posts[0].body).toEqual({
      facility_name: "Example Clinic", category: "clinic", area: "Ogui", address: "4 Example Street", phone: "0803 000 0000",
      contact_name: "Dr. Example", contact_email: "owner@example.com", notes: "Open 24 hours",
    });
    expect(posts[0].url.search).toBe(""); // nothing in the address
    expect(screen.queryByLabelText("Facility name")).toBeNull(); // the form and its personal data are gone
  });

  it("leaves the notes out when empty", async () => {
    const { posts } = stubApi();
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Thanks. We'll verify your facility before it's listed.");
    expect(posts[0].body).not.toHaveProperty("notes");
  });

  it("limits the notes to 500 characters and counts from 400", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });
    const notes = screen.getByLabelText("Notes (optional)");

    expect(notes).toHaveAttribute("maxlength", "500");
    fireEvent.change(notes, { target: { value: "x".repeat(450) } });

    expect(screen.getByText("50 characters left")).toBeInTheDocument();
  });

  it("says what is missing or wrong, all at once, and sends nothing", async () => {
    const { posts } = stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });
    await userEvent.type(screen.getByLabelText("Phone number"), "12345");
    await userEvent.type(screen.getByLabelText("Your email"), "not-an-email");

    // The browser's own checks are bypassed here on purpose: the page repeats them in words.
    fireEvent.submit(screen.getByRole("button", { name: "Send" }).closest("form") as HTMLFormElement);

    const problems = await screen.findByRole("alert");
    for (const text of [
      "Enter the facility name.", "Choose a category.", "Choose an area.", "Enter the address.",
      "Check the phone number. It should look like 0803 123 4567.", "Enter your name.", "Check the email address.",
    ]) {
      expect(problems).toHaveTextContent(text);
    }
    expect(posts).toHaveLength(0);
  });

  it("says on 429 that too many were sent today, and keeps the form", async () => {
    stubApi({ post: () => json({ detail: "x" }, 429) });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("You've sent several submissions. Please try again tomorrow.")).toBeInTheDocument();
    expect(screen.getByLabelText("Facility name")).toHaveValue("Example Clinic");
  });

  it("on 422 asks to check the form, and on any other failure to check the connection, keeping what was typed", async () => {
    let status = 422;
    stubApi({ post: () => json({ detail: [] }, status) });
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Check the form: one of the answers is not accepted. Read each one again.")).toBeInTheDocument();

    status = 500;
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("We couldn't send the form. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Your email")).toHaveValue("owner@example.com");
  });

  it("cannot be sent twice while it is sending", async () => {
    let finish: (response: Response) => void = () => undefined;
    const posts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string, init?: RequestInit) => {
        const url = new URL(address);
        if (url.pathname === "/meta") return json(META);
        posts.push(1);
        return new Promise<Response>((resolve) => (finish = resolve));
      }),
    );
    render(<ListYourFacilityPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    const sending = await screen.findByRole("button", { name: "Sending…" });
    await userEvent.click(sending);

    expect(sending).toBeDisabled();
    expect(posts).toHaveLength(1);
    finish(json({ message: "ok" }, 201));
    await screen.findByText("Thanks. We'll verify your facility before it's listed.");
  });

  it("makes the Send button at least 50 px high", async () => {
    stubApi();
    render(<ListYourFacilityPage />);
    await screen.findByRole("option", { name: "Clinic" });

    expect(screen.getByRole("button", { name: "Send" }).className).toMatch(/min-h-\[50px\]/);
  });
});
