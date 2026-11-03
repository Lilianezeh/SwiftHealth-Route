// @vitest-environment jsdom
/** The one verification line on a SwiftRescue contact card. Requirements: FR-08, FR-16 (the last-verified date), US-07, NFR-10, NFR-08.
 * Spec: specs/2026-11-03-emergency-page-tidy/requirements.md (owner, 2026-11-03: one line instead of the amber badge "Verification due" plus a
 * second line with the date). The listing cards and the listing page keep the VerifiedDate they have; this line is for the emergency card only.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";
import { VerificationLine } from "@/components/emergency/VerificationLine";

import { emergencyResponse, json, listing, stubApi } from "../helpers/api";
import { readSource } from "../helpers/source";

const NOW = new Date("2026-11-03T12:00:00Z");
const DAYS_AGO = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("VerificationLine", () => {
  it("shows one line, 'Verified 27 days ago · check due', amber, when the check is due", () => {
    const { container } = render(<VerificationLine lastVerifiedAt={DAYS_AGO(27)} verificationDue now={NOW} />);

    expect(container.textContent).toBe("Verified 27 days ago · check due");
    const line = screen.getByText("Verified 27 days ago · check due");
    expect(line.className).toMatch(/\bbg-amber-wash\b/);
    expect(line.className).toMatch(/\btext-amber-ink\b/);
    expect(container.querySelectorAll("span, p")).toHaveLength(1); // one line: not a badge and a second line
  });

  it("shows 'Verified 3 days ago' in the calm green when the check is not due, with no 'check due'", () => {
    const { container } = render(<VerificationLine lastVerifiedAt={DAYS_AGO(3)} verificationDue={false} now={NOW} />);

    expect(container.textContent).toBe("Verified 3 days ago");
    const line = screen.getByText("Verified 3 days ago");
    expect(line.className).toMatch(/\bbg-pine-100\b/);
    expect(line.className).toMatch(/\btext-forest\b/);
    expect(line.className).not.toMatch(/amber/);
  });

  it("says 'Verified today' and 'Verified 1 day ago' as the date formatter does", () => {
    const today = render(<VerificationLine lastVerifiedAt={NOW.toISOString()} verificationDue={false} now={NOW} />);
    expect(today.container.textContent).toBe("Verified today");
    today.unmount();
    const yesterday = render(<VerificationLine lastVerifiedAt={DAYS_AGO(1)} verificationDue={false} now={NOW} />);
    expect(yesterday.container.textContent).toBe("Verified 1 day ago");
  });

  it("says 'Not yet verified · check due' for a contact that was never verified", () => {
    const { container } = render(<VerificationLine lastVerifiedAt={null} verificationDue now={NOW} />);

    expect(container.textContent).toBe("Not yet verified · check due");
  });

  it("never says 'Verification due' any more (the words are the label of the other cards, not of this line)", () => {
    const { container } = render(<VerificationLine lastVerifiedAt={DAYS_AGO(27)} verificationDue now={NOW} />);

    expect(container.textContent).not.toMatch(/Verification due/);
  });

  it("has a small icon (a clock when due, a shield when not) hidden from screen readers, and text of 16 px or more", () => {
    const due = render(<VerificationLine lastVerifiedAt={DAYS_AGO(27)} verificationDue now={NOW} />);
    expect(due.container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(due.container.querySelector("svg")?.getAttribute("class")).toMatch(/lucide-clock/);
    expect(screen.getByText("Verified 27 days ago · check due").className).toMatch(/\btext-base\b/);
    due.unmount();
    const ok = render(<VerificationLine lastVerifiedAt={DAYS_AGO(3)} verificationDue={false} now={NOW} />);
    expect(ok.container.querySelector("svg")?.getAttribute("class")).toMatch(/lucide-shield-check/);
  });

  it("uses theme tokens only, so Light and Dark both work (no literal colour)", () => {
    const source = readSource("components/emergency/VerificationLine.tsx");

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|bg-white|text-black|text-red|bg-red/);
    expect(source).not.toMatch(/\bcross\b|Cross|Plus/i);
  });
});

describe("on the SwiftRescue page", () => {
  it("has one verification line on each card: the date and 'check due' together, no second line and no separate badge", async () => {
    const response = emergencyResponse();
    // The page uses the real clock, so these dates are counted from now (an extra hour keeps the day count steady).
    const daysAgoFromNow = (days: number) => new Date(Date.now() - days * 86_400_000 - 3_600_000).toISOString();
    response.groups[0].contacts = [
      listing({ id: 9001, slug: "due", name: "Due Ambulance", last_verified_at: daysAgoFromNow(27), verification_due: true }),
      listing({ id: 9002, slug: "ok", name: "Fine Ambulance", last_verified_at: daysAgoFromNow(3), verification_due: false }),
    ];
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    const cards = await screen.findAllByRole("article");
    const due = cards.find((card) => card.textContent?.includes("Due Ambulance")) as HTMLElement;
    const fine = cards.find((card) => card.textContent?.includes("Fine Ambulance")) as HTMLElement;

    expect(due.textContent).toMatch(/Verified \d+ days? ago · check due/);
    expect(due.textContent).not.toMatch(/Verification due/);
    expect(due.textContent?.match(/Verified/g)).toHaveLength(1); // the date is written once
    expect(fine.textContent).toMatch(/Verified 3 days ago/);
    expect(fine.textContent).not.toMatch(/check due|Verification due/);
  });
});
