/** The fee line of a service on the listing page. Requirements: FR-09, FR-11, US-06. Spec: specs/2026-10-13-listing-page/requirements.md D6
 * (owner decision 5 in specs/2026-10-11-listing-detail-api/requirements.md). Money arrives as a string with 2 decimals ("1500.00"); it is
 * formatted as text and never becomes a float.
 */
import { describe, expect, it } from "vitest";

import { describeFee, formatCollected, formatNaira } from "@/lib/formatters/fees";
import type { ServiceRead } from "@/types/api";

const service = (min: string | null, max: string | null, collected: string | null = null): ServiceRead => ({
  name: "Consultation",
  fee_min_naira: min,
  fee_max_naira: max,
  fee_collected_at: collected,
});

describe("formatNaira", () => {
  it.each([
    ["1500.00", "₦1,500"],
    ["500.00", "₦500"],
    ["1234567.00", "₦1,234,567"],
    ["0.00", "₦0"],
    ["1500.50", "₦1,500.50"],
    ["1500.5", "₦1,500.50"],
    ["1500", "₦1,500"],
    ["00300.00", "₦300"],
  ])("writes %s as %s", (amount, expected) => {
    expect(formatNaira(amount)).toBe(expected);
  });

  it.each(["", "free", "-5.00", "1,500.00", "15e2", "1500.001"])("gives nothing for %j", (amount) => {
    expect(formatNaira(amount)).toBeNull();
  });
});

describe("formatCollected", () => {
  it("writes the date as 28 Sep 2026, without a time zone shift", () => {
    expect(formatCollected("2026-09-28")).toBe("28 Sep 2026");
    expect(formatCollected("2026-01-01")).toBe("1 Jan 2026");
    expect(formatCollected("2026-12-31")).toBe("31 Dec 2026");
  });

  it("gives nothing for no date or for text that is not a date", () => {
    expect(formatCollected(null)).toBeNull();
    expect(formatCollected("last week")).toBeNull();
    expect(formatCollected("2026-13-40")).toBeNull();
  });
});

describe("describeFee: the five cases of the owner's decision 5", () => {
  it("a range: both limits, joined by a dash", () => {
    expect(describeFee(service("1500.00", "3000.00"))).toEqual({ amount: "₦1,500 – ₦3,000", collected: null });
  });

  it("equal limits: one amount", () => {
    expect(describeFee(service("1500.00", "1500.00"))).toEqual({ amount: "₦1,500", collected: null });
  });

  it("only a minimum: From ...", () => {
    expect(describeFee(service("1500.00", null))).toEqual({ amount: "From ₦1,500", collected: null });
  });

  it("only a maximum: Up to ...", () => {
    expect(describeFee(service(null, "3000.00"))).toEqual({ amount: "Up to ₦3,000", collected: null });
  });

  it("no fee: no amount and no date (the page then says 'Ask for price')", () => {
    expect(describeFee(service(null, null))).toEqual({ amount: null, collected: null });
    expect(describeFee(service(null, null, "2026-09-28"))).toEqual({ amount: null, collected: null });
  });

  it("with a date: 'collected 28 Sep 2026'; without a date the date is hidden", () => {
    expect(describeFee(service("1500.00", "3000.00", "2026-09-28"))).toEqual({
      amount: "₦1,500 – ₦3,000",
      collected: "collected 28 Sep 2026",
    });
    expect(describeFee(service("1500.00", "3000.00", null)).collected).toBeNull();
  });

  it("does not turn money into a floating point number: a long amount keeps every digit", () => {
    expect(describeFee(service("12345678901234567.00", "12345678901234568.00")).amount).toBe(
      "₦12,345,678,901,234,567 – ₦12,345,678,901,234,568",
    );
  });
});
