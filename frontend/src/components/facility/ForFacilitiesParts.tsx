"use client";

/** The two small client parts of the "For facilities" page. Requirements: FR-44, FR-48, NFR-01. UI spec 2.9b.
 * Both read GET /meta, which `getMeta` keeps, so the page costs one request: the price of 30 days as featured
 * (`featured_price_naira`, a string, formatted as text and never turned into a number) and whether sign-up is open.
 * The price is left out until the answer is in and when it fails; Sign up is a link only while sign-up is open (a link to a page
 * that cannot work is worse than none, as in the header). Nothing is stored in the browser.
 */
import Link from "next/link";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import { formatNaira } from "@/lib/formatters/fees";

export function FeaturedPrice() {
  const { meta } = useMeta();
  const price = meta ? formatNaira(meta.featured_price_naira) : null;
  if (price === null) return null;
  return <p className="text-lg font-bold text-forest">{`Price: ${price} for 30 days`}</p>;
}

export function ForFacilitiesButtons() {
  const { meta } = useMeta();
  const signupOpen = meta?.signup_open === true;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {signupOpen ? (
        <Link href="/sign-up" prefetch={false} className={buttonClasses("primary")}>
          Sign up
        </Link>
      ) : (
        <p className="flex min-h-[50px] items-center text-base text-ink">Sign-up is not open yet.</p>
      )}
      <Link href="/list-your-facility" prefetch={false} className={buttonClasses("secondary")}>
        List your facility
      </Link>
    </div>
  );
}
