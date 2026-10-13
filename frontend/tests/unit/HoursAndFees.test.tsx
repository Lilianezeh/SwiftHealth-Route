// @vitest-environment jsdom
/** The hours table and the services with fees of the listing page. Requirements: FR-09, FR-11, US-06, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D6. The formatting rules themselves are tested in hours.test.ts and fees.test.ts.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HoursTable } from "@/components/listing/HoursTable";
import { ServicesFees } from "@/components/listing/ServicesFees";

import { SERVICES, WEEK } from "../helpers/listing";

const MONDAY_IN_LAGOS = new Date("2026-10-12T10:00:00Z");

describe("HoursTable", () => {
  it("has the heading Opening hours and a row for each of the seven days, Monday first, in 12-hour time", () => {
    render(<HoursTable openingHours={WEEK} is24Hours={false} now={MONDAY_IN_LAGOS} />);

    expect(screen.getByRole("heading", { level: 2, name: "Opening hours" })).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(rows.map((row) => within(row).getByRole("rowheader").textContent?.replace(/Today/, "").trim())).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(within(rows[0]).getByRole("cell")).toHaveTextContent("8:00 AM – 5:00 PM");
    expect(within(rows[4]).getByRole("cell")).toHaveTextContent("8:00 PM – 2:00 AM (next day)");
    expect(within(rows[5]).getByRole("cell")).toHaveTextContent("9:00 AM – 1:00 PM");
    expect(within(rows[6]).getByRole("cell")).toHaveTextContent("Closed");
  });

  it("marks today with the word Today (not colour alone) and aria-current, by Lagos time, on one row only", () => {
    render(<HoursTable openingHours={WEEK} is24Hours={false} now={MONDAY_IN_LAGOS} />);

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[0]).toHaveAttribute("aria-current", "date");
    expect(within(rows[0]).getByText("Today")).toBeInTheDocument();
    expect(rows.filter((row) => row.getAttribute("aria-current") === "date")).toHaveLength(1);
    expect(screen.getAllByText("Today")).toHaveLength(1);
    expect(rows[0].className).toMatch(/\bfont-bold\b/);
  });

  it("follows Lagos time, not the device's: Sunday 23:30 UTC is already Monday in Lagos", () => {
    render(<HoursTable openingHours={WEEK} is24Hours={false} now={new Date("2026-10-11T23:30:00Z")} />);

    const todayRow = within(screen.getByRole("table")).getAllByRole("row").find((row) => row.getAttribute("aria-current") === "date");
    expect(within(todayRow as HTMLElement).getByRole("rowheader")).toHaveTextContent("Monday");
  });

  it("says 'Open 24 hours, every day' instead of the table for a 24-hour listing", () => {
    render(<HoursTable openingHours={WEEK} is24Hours={true} now={MONDAY_IN_LAGOS} />);

    expect(screen.getByText("Open 24 hours, every day")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("keeps its text at 16 px or more", () => {
    const { container } = render(<HoursTable openingHours={WEEK} is24Hours={false} now={MONDAY_IN_LAGOS} />);

    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm)\b/);
  });
});

describe("ServicesFees", () => {
  it("has the heading Services and fees and the words 'Estimate — confirm with the facility' once", () => {
    render(<ServicesFees services={SERVICES} />);

    expect(screen.getByRole("heading", { level: 2, name: "Services and fees" })).toBeInTheDocument();
    expect(screen.getAllByText("Estimate — confirm with the facility")).toHaveLength(1);
  });

  it("writes each fee the owner's way: a range, one amount, From..., and 'Ask for price' for no fee", () => {
    render(<ServicesFees services={SERVICES} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Consultation");
    expect(items[0]).toHaveTextContent("₦1,500 – ₦3,000");
    expect(items[0]).toHaveTextContent("collected 28 Sep 2026");
    expect(items[1]).toHaveTextContent("Blood pressure check");
    expect(items[1]).toHaveTextContent("₦500");
    expect(items[1]).not.toHaveTextContent("–");
    expect(items[1]).not.toHaveTextContent("collected"); // no date: the date is hidden
    expect(items[2]).toHaveTextContent("From ₦1,000");
    expect(items[3]).toHaveTextContent("Home visit");
    expect(items[3]).toHaveTextContent("Ask for price"); // no fee: plain words, not a price
    expect(items[3]).not.toHaveTextContent("₦");
    expect(items[3]).not.toHaveTextContent("collected");
    expect(items[0]).not.toHaveTextContent("Ask for price");
  });

  it("shows nothing at all when the listing has no services", () => {
    const { container } = render(<ServicesFees services={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps its text at 16 px or more", () => {
    const { container } = render(<ServicesFees services={SERVICES} />);

    expect(container.innerHTML).not.toMatch(/\btext-(xs|sm)\b/);
  });
});
