// @vitest-environment jsdom
/** The report form and postReport. Requirements: US-08, FR-20, FR-21, NFR-07, NFR-10. UI spec 2.8; decisions B1, B2, B3, B8 in
 * specs/2026-10-20-reports/requirements.md.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReportPage from "@/app/(public)/report/[slug]/page";
import { REPORT_REASONS } from "@/config/reports";
import { ApiError } from "@/lib/api/request";
import { postReport } from "@/lib/api/reports";

import { META, json } from "../helpers/api";
import { makeListing } from "../helpers/listing";
import { readSource } from "../helpers/source";

afterEach(() => vi.unstubAllGlobals());

type Handler = (body: Record<string, unknown>) => Response | Promise<Response>;

/** A fake API: the listing page answer, and POST /reports answered by the test. */
function stubReports(options: { listing?: Response | null; post?: Handler } = {}) {
  const posts: Record<string, unknown>[] = [];
  const requests: { url: URL; method: string }[] = [];
  const fetchStub = vi.fn(async (address: string, init?: RequestInit) => {
    const url = new URL(address);
    requests.push({ url, method: init?.method ?? "GET" });
    if (url.pathname.startsWith("/listings/")) {
      return options.listing === undefined ? json(makeListing()) : (options.listing ?? json({ detail: "x" }, 404));
    }
    if (url.pathname === "/reports" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      posts.push(body);
      return (options.post ?? (() => json({ id: 1, message: "Thank you. We will check this listing." }, 201)))(body);
    }
    return json({ detail: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchStub);
  return { posts, requests, fetchStub };
}

async function openPage(slug = "night-pharmacy-a") {
  render(await ReportPage({ params: Promise.resolve({ slug }) }));
}

describe("the reasons", () => {
  it("are the six of the API, in its order, with the wording of the UI spec", () => {
    expect(REPORT_REASONS.map((reason) => reason.value)).toEqual(META.report_reasons);
    expect(REPORT_REASONS.map((reason) => reason.label)).toEqual([
      "Number not working", "Wrong number", "Facility closed", "Facility moved", "Wrong opening hours", "Something else",
    ]);
  });
});

describe("postReport", () => {
  it("posts JSON to /reports and returns the answer", async () => {
    const { requests, posts } = stubReports();

    const answer = await postReport({ listing_id: 12, reason: "closed", comment: "", reporter_phone: "" });

    expect(requests[0].method).toBe("POST");
    expect(requests[0].url.pathname).toBe("/reports");
    expect(requests[0].url.search).toBe("");
    expect(posts[0]).toEqual({ listing_id: 12, reason: "closed" }); // empty optional fields are left out
    expect(answer.message).toBe("Thank you. We will check this listing.");
  });

  it("sends the comment and the phone when they have text", async () => {
    const { posts } = stubReports();

    await postReport({ listing_id: 12, reason: "wrong_number", comment: " Rang twice ", reporter_phone: "0803 000 0000" });

    expect(posts[0]).toEqual({ listing_id: 12, reason: "wrong_number", comment: "Rang twice", reporter_phone: "0803 000 0000" });
  });

  it("throws an ApiError carrying the status for 422 and 429", async () => {
    stubReports({ post: () => json({ detail: "x" }, 429) });

    await expect(postReport({ listing_id: 12, reason: "closed", comment: "", reporter_phone: "" })).rejects.toMatchObject({
      status: 429,
    });
    expect(ApiError).toBeDefined();
  });
});

describe("the report page", () => {
  it("is called with the slug, not the id, and reads the listing by slug", async () => {
    const { requests } = stubReports();
    await openPage("night-pharmacy-a");

    await screen.findByRole("heading", { level: 1, name: "Report a problem with Night Pharmacy A" });

    expect(requests[0].url.pathname).toBe("/listings/night-pharmacy-a");
    expect(requests[0].url.search).toBe("");
  });

  it("shows the six reasons as radio buttons, none chosen, each at least 48 px high, and the Send button off", async () => {
    stubReports();
    await openPage();

    await screen.findByRole("heading", { level: 1 });
    const radios = screen.getAllByRole("radio");

    expect(radios).toHaveLength(6);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    for (const radio of radios) expect(radio.closest("label")?.className).toMatch(/\bmin-h-12\b/);
    expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
  });

  it("sends in two taps: a reason, then Send", async () => {
    const { posts } = stubReports();
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("radio", { name: "Facility closed" }));
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("Thank you. We'll check this listing.")).toBeInTheDocument();
    expect(posts).toEqual([{ listing_id: 12, reason: "closed" }]);
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/listing/night-pharmacy-a");
  });

  it("sends the optional comment and phone, with the privacy sentence next to the phone field", async () => {
    const { posts } = stubReports();
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByRole("radio", { name: "Wrong number" }));
    await userEvent.type(screen.getByLabelText(/Comment/), "It rang twice");
    await userEvent.type(screen.getByLabelText(/Your phone number/), "0803 000 0000");
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    await screen.findByText("Thank you. We'll check this listing.");
    expect(posts[0]).toEqual({
      listing_id: 12, reason: "wrong_number", comment: "It rang twice", reporter_phone: "0803 000 0000",
    });
    expect(document.body.textContent).not.toMatch(/Only if you want us to follow up/); // the form is gone after success
  });

  it("says why the phone is asked for, and that it is deleted", async () => {
    stubReports();
    await openPage();

    expect(await screen.findByText("Only if you want us to follow up. We delete it when the report is closed.")).toBeInTheDocument();
  });

  it("limits the comment to 500 characters and counts from 400", async () => {
    stubReports();
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    const comment = screen.getByLabelText(/Comment/);

    expect(comment).toHaveAttribute("maxlength", "500");
    expect(screen.queryByText(/characters left/)).toBeNull();
    fireEvent.change(comment, { target: { value: "x".repeat(401) } }); // typing 401 letters one by one is slow
    expect(screen.getByText("99 characters left")).toBeInTheDocument();
  });

  it("while sending the button says Sending… and cannot be tapped again", async () => {
    let finish: (response: Response) => void = () => undefined;
    const { posts } = stubReports({ post: () => new Promise<Response>((resolve) => (finish = resolve)) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("radio", { name: "Facility closed" }));

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    const sending = await screen.findByRole("button", { name: "Sending…" });
    await userEvent.click(sending);

    expect(sending).toBeDisabled();
    expect(posts).toHaveLength(1);
    finish(json({ id: 1, message: "ok" }, 201));
    await screen.findByText("Thank you. We'll check this listing.");
  });

  it("on 429 says so and keeps the form", async () => {
    stubReports({ post: () => json({ detail: "x" }, 429) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("radio", { name: "Facility closed" }));

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("You've sent several reports. Please try again later.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Facility closed" })).toBeChecked();
  });

  it("on 422 asks to check the phone number and keeps what was typed", async () => {
    stubReports({ post: () => json({ detail: [] }, 422) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("radio", { name: "Facility closed" }));
    await userEvent.type(screen.getByLabelText(/Your phone number/), "123");

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    expect(await screen.findByText("Check the phone number. It should look like 0803 123 4567.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Your phone number/)).toHaveValue("123");
  });

  it("on any other failure says it could not send, keeps the form and lets the visitor try again", async () => {
    let attempts = 0;
    const { posts } = stubReports({ post: () => (++attempts === 1 ? json({ detail: "boom" }, 500) : json({ id: 2, message: "ok" }, 201)) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByRole("radio", { name: "Facility closed" }));

    await userEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(await screen.findByText("We couldn't send your report. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send report" }));

    await screen.findByText("Thank you. We'll check this listing.");
    expect(posts).toHaveLength(2);
  });

  it("shows the Listing not found page for an unknown or unpublished slug", async () => {
    stubReports({ listing: null });
    await openPage("nothing-here");

    expect(await screen.findByRole("heading", { name: "Listing not found" })).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows the error with Retry when the listing cannot be loaded", async () => {
    stubReports({ listing: json({ detail: "boom" }, 500) });
    await openPage();

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("never reads or sends the visitor's position, and has no console output", async () => {
    stubReports();
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    for (const file of ["components/report/ReportView.tsx", "components/report/ReportForm.tsx", "lib/api/reports.ts"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/useLocation|locationStore|geolocation|sessionStorage|localStorage|console\./);
    }
    await waitFor(() => expect(screen.getAllByRole("radio")).toHaveLength(6));
  });
});
