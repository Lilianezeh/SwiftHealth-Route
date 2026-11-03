"use client";

/** The two small client parts of the "For facilities" page. Requirements: FR-44, FR-48, NFR-01. UI spec 2.9b.
 * Both read GET /meta, which `getMeta` keeps, so the page costs one request: the price of 30 days as featured
 * (`featured_price_naira`, a string, formatted as text and never turned into a number) and whether sign-up is open.
 * The price is left out until the answer is in and when it fails. The buttons are "Sign up as a facility owner" (a link only while
 * sign-up is open; it opens the sign-up page with Facility owner already chosen) and "Log in", once, near the top of the page (owner,
 * 2026-11-02: Log in and Sign up are here, not in the header; 2026-11-03: not repeated at the end). Nothing is stored in the browser.
 */
import { AccountButtons } from "@/components/account/AccountButtons";
import { useMeta } from "@/hooks/useMeta";
import { formatNaira } from "@/lib/formatters/fees";

const SIGN_UP_AS_OWNER = { label: "Sign up as a facility owner", href: "/sign-up?as=owner" };

export function FeaturedPrice() {
  const { meta } = useMeta();
  const price = meta ? formatNaira(meta.featured_price_naira) : null;
  if (price === null) return null;
  return <p className="text-lg font-bold text-forest">{`Price: ${price} for 30 days`}</p>;
}

/** The buttons: Sign up as a facility owner (while sign-up is open) and Log in. Shown once, near the top of the page. */
export function ForFacilitiesButtons() {
  return <AccountButtons signUp={SIGN_UP_AS_OWNER} />;
}
