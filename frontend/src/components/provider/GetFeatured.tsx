"use client";

/** The "Get featured" screen: what it means, the price, and the button that starts a Paystack payment (test mode only).
 * Requirements: FR-44, FR-45, NFR-06, NFR-10. UI spec 4.3 and "Phase 12 details"; decision I10 in
 * specs/2026-10-20-providers-payments/requirements.md.
 *
 * The browser never talks to Paystack and never holds a key: it asks the API to start the payment and then goes to the address the
 * API sends, which must be an https address. Nothing about the payment is kept in the browser.
 */
import { useState } from "react";

import { QueueStatus } from "@/components/admin/QueueStatus";
import { useStaff } from "@/components/admin/StaffGate";
import { NoLinkedFacility } from "@/components/provider/NoLinkedFacility";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useProviderListing } from "@/hooks/useProviderListing";
import { formatNaira } from "@/lib/formatters/fees";
import { startFeaturedPayment } from "@/lib/api/provider";
import { ApiError } from "@/lib/api/request";
import { whyNotFeatured } from "@/lib/staff/featured";

const COULD_NOT_START = "Could not start the payment. Try again.";
// The statuses whose sentence the API wrote for the provider (api-spec, POST /payments/featured). Any other failure gets the plain one.
const API_SENTENCE_STATUSES = [400, 502, 503];

export function GetFeatured() {
  const { call } = useStaff();
  const { status, listing, retry } = useProviderListing();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function pay() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const started = await call((token) => startFeaturedPayment(token));
      if (!started.authorization_url.startsWith("https://")) {
        setProblem(COULD_NOT_START); // never go to a javascript: or http: address
        setBusy(false);
        return;
      }
      window.location.assign(started.authorization_url); // the page is left; the button stays off until it is gone
    } catch (error) {
      const detail = error instanceof ApiError && API_SENTENCE_STATUSES.includes(error.status) ? error.detail : null;
      setProblem(detail ?? COULD_NOT_START);
      setBusy(false);
    }
  }

  const price = listing ? (formatNaira(listing.featured_price_naira) ?? listing.featured_price_naira) : null;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Get featured</h1>

      <QueueStatus status={status === "none" ? "ready" : status} onRetry={retry} />
      {status === "none" && <NoLinkedFacility />}

      {listing && (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <p className="text-base text-ink">
            Featured listings appear first in matching searches with a Sponsored label for 30 days. They are never shown in
            SwiftRescue.
          </p>
          <p className="text-lg font-bold text-forest">{`Price: ${price} for 30 days`}</p>
          <p className="text-base text-ink-soft">
            You pay on Paystack&apos;s own page, in test mode for now. No card detail passes through SwiftHealth.
          </p>

          {whyNotFeatured(listing) === null ? (
            <button type="button" onClick={() => void pay()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
              Pay with Paystack
            </button>
          ) : (
            <p className="text-base font-semibold text-ink">{whyNotFeatured(listing)}</p>
          )}
          {problem && (
            <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
              {problem}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
