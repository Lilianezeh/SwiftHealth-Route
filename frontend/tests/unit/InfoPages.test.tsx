// @vitest-environment jsdom
/** The five information pages. Requirements: FR-23, FR-13, FR-26, FR-11, NFR-07, NFR-13, NFR-10, NFR-12. UI spec 2.10; decisions D1 to D4
 * in specs/2026-10-20-info-pages/requirements.md. They are statements of what the product does, with no legal claim, no made-up
 * contact address and no phone number.
 */
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AboutPage, { metadata as aboutMetadata } from "@/app/(public)/about/page";
import ContactPage, { metadata as contactMetadata } from "@/app/(public)/contact/page";
import HowWeVerifyPage, { metadata as verifyMetadata } from "@/app/(public)/how-we-verify/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(public)/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/(public)/terms/page";
import { siteConfig } from "@/config/site";

import { readSource } from "../helpers/source";

const PAGES = [
  { name: "About", file: "about", Page: AboutPage, metadata: aboutMetadata, h1: "About" },
  { name: "How we verify", file: "how-we-verify", Page: HowWeVerifyPage, metadata: verifyMetadata, h1: "How we verify" },
  { name: "Privacy", file: "privacy", Page: PrivacyPage, metadata: privacyMetadata, h1: "Privacy policy" },
  { name: "Terms", file: "terms", Page: TermsPage, metadata: termsMetadata, h1: "Terms of use" },
  { name: "Contact", file: "contact", Page: ContactPage, metadata: contactMetadata, h1: "Contact us" },
] as const;

const NOTICE = "This page describes how SwiftHealth Route works today. It has not yet been reviewed by a lawyer.";

afterEach(() => vi.unstubAllEnvs());

describe.each(PAGES)("the $name page", ({ file, Page, metadata, h1 }) => {
  it("has exactly one h1, the title of the footer link, and no 'Coming soon'", () => {
    const { container } = render(<Page />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(h1);
    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it("has h2 sections in order and no heading level skipped", () => {
    const { container } = render(<Page />);

    const levels = [...container.querySelectorAll("h1, h2, h3, h4")].map((heading) => Number(heading.tagName[1]));
    expect(levels[0]).toBe(1);
    expect(levels.length).toBeGreaterThan(2);
    levels.slice(1).forEach((level, index) => expect(level - levels[index]).toBeLessThanOrEqual(1));
  });

  it("has a title and a description for the search engines", () => {
    expect(typeof metadata.title).toBe("string");
    expect(String(metadata.title).length).toBeGreaterThan(2);
    expect(String(metadata.description).length).toBeGreaterThan(30);
  });

  it("is a server page with no script, no request and no storage", () => {
    const source = readSource(`app/(public)/${file}/page.tsx`);

    expect(source).not.toMatch(/["']use client["']|fetch\(|localStorage|sessionStorage|useEffect|console\./);
  });

  it("shows no phone number and no made-up address", () => {
    const { container } = render(<Page />);

    expect(container.textContent).not.toMatch(/\+234|0[789][01]\d[ -]?\d{3}[ -]?\d{4}/);
    expect(container.textContent).not.toMatch(/@/); // an address appears only when siteConfig.contactEmail is set
  });

  it("makes every link at least 48 px high and every outside link safe", () => {
    const { container } = render(<Page />);

    for (const link of container.querySelectorAll("a")) {
      expect(link.className).toMatch(/\bmin-h-12\b/);
      if ((link.getAttribute("href") ?? "").startsWith("http")) expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});

describe("About", () => {
  it("says what it is in the words of the mission, and the first city from the settings", () => {
    render(<AboutPage />);

    expect(screen.getByText(/verified directory of health facilities and emergency contacts/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(siteConfig.launchCity))).toBeInTheDocument();
  });

  it("says SwiftRescue does not dispatch (FR-26) and the directory is not medical advice (FR-13)", () => {
    render(<AboutPage />);

    expect(screen.getByText(/does not dispatch or guarantee an emergency response/)).toBeInTheDocument();
    expect(screen.getByText(/does not give medical advice/)).toBeInTheDocument();
  });

  it("does not name the city anywhere but through the setting", () => {
    expect(readSource("app/(public)/about/page.tsx")).not.toMatch(/Enugu/);
  });
});

describe("How we verify", () => {
  it("describes the process of the requirements: a call and a visit, the dates, the cycles and the labels", () => {
    const { container } = render(<HowWeVerifyPage />);
    const text = container.textContent ?? "";

    expect(text).toMatch(/call and a visit/);
    expect(text).toMatch(/Verified \d+ days? ago|Verified 3 days ago/);
    expect(text).toMatch(/every 14 days/);
    expect(text).toMatch(/every 45 days/);
    expect(text).toMatch(/Verification due/);
    expect(text).toMatch(/two different people/);
    expect(text).toMatch(/Sponsored/);
    expect(text).toMatch(/never in SwiftRescue/);
    expect(text).toMatch(/does not buy the verified/);
  });

  it("makes no claim about how many listings are verified", () => {
    const { container } = render(<HowWeVerifyPage />);

    expect(container.textContent).not.toMatch(/\b\d+ (verified )?(listings|facilities|places)\b/i);
    expect(container.textContent).not.toMatch(/\ball (of our )?listings are verified\b/i);
  });
});

describe("Privacy", () => {
  it("starts with the notice that it is not yet reviewed by a lawyer", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("states what the product does with a position, a report and the emergency copy", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";

    expect(text).toMatch(/does not store your position|do not store your position|never stored/i);
    expect(text).toMatch(/left out of our logs|not in our logs/i);
    expect(text).toMatch(/phone number is optional/i);
    expect(text).toMatch(/deleted when the report is closed/i);
    expect(text).toMatch(/do not sell personal data/i);
    expect(text).toMatch(/copy of the emergency contacts/i);
  });

  it("has the sections of the accounts work (requirements section 6), each an h2 in this order", () => {
    const { container } = render(<PrivacyPage />);

    const headings = [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Your position",
      "Reports",
      "Accounts",
      "Codes and unfinished sign-ups",
      "Facilities you list or manage",
      "Moves, closures and branches",
      "The activity log",
      "Closing your account",
      "Payments",
      "Services we use",
      "What your browser keeps",
      "What we do not do",
      "Questions",
    ]);
  });

  it("names every new item of personal data of an account (requirements section 6)", () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? "";

    for (const item of [
      /name, email address and phone number/i,
      /password .* only as a scrambled code/i,
      /kind of account/i,
      /approved/i,
      /when .* email and phone were confirmed/i,
      /last (time you )?logged in|last login/i,
      /note .* (when|that) .*sign/i,
      /authenticator/i,
      /backup codes/i,
      /who approved/i,
    ]) {
      expect(text).toMatch(item);
    }
  });

  it("says what each use is for: running the account, security, checking who may change a listing", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/running the account/i);
    expect(text).toMatch(/keeping it secure/i);
    expect(text).toMatch(/who may change which listing/i);
  });

  it("says codes are not stored and unfinished sign-ups are removed after 7 days", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/codes .* are not stored/i);
    expect(text).toMatch(/7 days/);
    expect(text).toMatch(/clean-up job/i);
  });

  it("says staff may phone a facility, the contact is the account, and the reason is kept while a request waits", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/phone the facility/i);
    expect(text).toMatch(/never put in the listing|not put in the listing/i);
    expect(text).toMatch(/only staff can see/i);
    expect(text).toMatch(/reason .* while .* waits/i);
  });

  it("says the old and new address are kept, a facility is hidden and never deleted, and branches", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/old and the new address/i);
    expect(text).toMatch(/hidden, never deleted|hidden and never deleted/i);
    expect(text).toMatch(/branch/i);
  });

  it("says the activity log records staff too, shows to admins and is kept", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/every change to a listing/i);
    expect(text).toMatch(/staff are included|staff too/i);
    expect(text).toMatch(/shown to admins/i);
    expect(text).toMatch(/kept/i);
  });

  it("says what closing an account does: data replaced, password and codes removed, records stay without the name", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/close your account/i);
    expect(text).toMatch(/replaced/i);
    expect(text).toMatch(/password and codes? .* removed/i);
    expect(text).toMatch(/records stay/i);
  });

  it("names the six services we use and says some are outside Nigeria", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    for (const service of ["Netlify", "Render", "Resend", "Termii", "Cloudinary", "Paystack"]) expect(text).toContain(service);
    expect(text).toMatch(/outside Nigeria/i);
    expect(text).toMatch(/never see your card|do not see your card/i);
  });

  it("says the login stays in the tab, and that there are no cookies and no analytics or tracking scripts", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/your login .*tab/i);
    expect(text).toMatch(/gone when you close the tab/i);
    expect(text).toMatch(/no cookies/i);
    expect(text).toMatch(/no analytics or tracking scripts/i);
  });

  it("leaves speed of answers and what the law requires to a lawyer, in a sentence on the page", () => {
    const text = render(<PrivacyPage />).container.textContent ?? "";

    expect(text).toMatch(/after a lawyer has read this page/i);
  });

  it("makes no claim of compliance with a law and no promise about rights", () => {
    const { container } = render(<PrivacyPage />);

    expect(container.textContent).not.toMatch(/comply|compliant|in accordance with|GDPR|NDPA 2023 (requires|gives)|you have the right|we guarantee/i);
  });
});

describe("Terms of use", () => {
  it("starts with the notice that it is not yet reviewed by a lawyer", () => {
    render(<TermsPage />);

    expect(screen.getByRole("note")).toHaveTextContent(NOTICE);
  });

  it("holds the sentences of the requirements: not medical advice, estimates of fees, 112, no dispatch", () => {
    const { container } = render(<TermsPage />);
    const text = container.textContent ?? "";

    expect(text).toContain("SwiftHealth Route is a directory and does not give medical advice.");
    expect(text).toMatch(/Fees are estimates; confirm with the facility\./);
    expect(text).toContain("In danger, call 112.");
    expect(text).toContain("it does not dispatch or guarantee an emergency response");
  });

  it("has the Accounts and Moves and closures sections with the rules of the requirements (section 6)", () => {
    const { container } = render(<TermsPage />);

    const headings = [...container.querySelectorAll("h2")].map((heading) => heading.textContent);
    expect(headings).toContain("Accounts");
    expect(headings).toContain("Moves and closures");
    const text = container.textContent ?? "";
    expect(text).toMatch(/one person, one account/i);
    expect(text).toMatch(/keep your password and your codes private/i);
    expect(text).toMatch(/true details/i);
    expect(text).toMatch(/not ask to manage a facility that is not yours/i);
    expect(text).toMatch(/phones the facility to check/i);
    expect(text).toMatch(/suspended or closed/i);
    expect(text).toMatch(/hidden until our team checks the new address/i);
  });

  it("makes no legal claim: no limit of liability, no governing law, no 'binding' or 'agree'", () => {
    const { container } = render(<TermsPage />);

    expect(container.textContent).not.toMatch(/liab|governing law|jurisdiction|binding|you agree|indemnif|warrant/i);
  });
});

describe("Contact", () => {
  it("without an address says it is being set up and points to what works today", () => {
    render(<ContactPage />);

    expect(screen.getByText(/contact address is being set up/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "List your facility" })).toHaveAttribute("href", "/list-your-facility");
    expect(screen.getByRole("link", { name: "SwiftRescue" })).toHaveAttribute("href", "/emergency");
    expect(screen.getByText(/Report a problem/)).toBeInTheDocument();
  });

  it("shows an email link only when the setting has an address", async () => {
    vi.resetModules();
    vi.doMock("@/config/site", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/config/site")>();
      return { ...original, siteConfig: { ...original.siteConfig, contactEmail: "hello@example.test" } };
    });
    const { default: ContactWithAddress } = await import("@/app/(public)/contact/page");

    const { container } = render(<ContactWithAddress />);

    const link = within(container).getByRole("link", { name: "hello@example.test" });
    expect(link).toHaveAttribute("href", "mailto:hello@example.test");
    expect(container.textContent).not.toMatch(/is being set up/i);
    vi.doUnmock("@/config/site");
  });
});

describe("the footer links lead to these pages", () => {
  it("About, How we verify, Privacy, Terms and Contact are all in the footer settings", () => {
    const targets = siteConfig.footerLinks.map((link) => link.href);

    for (const href of ["/about", "/how-we-verify", "/privacy", "/terms", "/contact"]) expect(targets).toContain(href);
  });
});
