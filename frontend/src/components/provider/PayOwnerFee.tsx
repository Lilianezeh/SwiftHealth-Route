"use client";

/** The button that pays the owner fee of one link on Paystack (test mode only). Requirements: FR-44, FR-50, NFR-06, NFR-10.
 * UI spec 4.2c; api-spec 8, "Owner fee"; specs/2026-10-29-owner-fee/.
 *
 * The browser never talks to Paystack and never holds a key. It asks the API to start the fee of this link (the amount is the API's
 * setting; the browser sends only the link) and then goes to the address the API sends, which must be an https address. The label
 * says the amount, taken from the API's own answer by the parent. Nothing about the payment is kept in the browser.
 */
import { useRef, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { startOwnerFeePayment } from "@/lib/api/provider";
import { ApiError } from "@/lib/api/request";

const COULD_NOT_START = "Could not start the payment. Try again.";
// The statuses whose sentence the API wrote for the provider (api-spec, POST /payments/owner-fee). Any other failure gets the plain one.
const API_SENTENCE_STATUSES = [409, 502, 503];

type PayOwnerFeeProps = {
  /** Runs a call with the provider's token; a 401 ends the session (the parent does that). */
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  linkId: number;
  label: string;
  variant?: "primary" | "secondary";
};

export function PayOwnerFee({ call, linkId, label, variant = "primary" }: PayOwnerFeeProps) {
  const working = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function pay() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const started = await call((token) => startOwnerFeePayment(token, linkId));
      if (!started.authorization_url.startsWith("https://")) {
        setProblem(COULD_NOT_START); // never go to a javascript: or http: address
      } else {
        window.location.assign(started.authorization_url); // the page is left; the button stays off until it is gone
        return;
      }
    } catch (error) {
      const detail = error instanceof ApiError && API_SENTENCE_STATUSES.includes(error.status) ? error.detail : null;
      setProblem(detail ?? COULD_NOT_START);
    }
    working.current = false;
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => void pay()} disabled={busy} className={`${buttonClasses(variant)} disabled:opacity-60`}>
        {label}
      </button>
      {problem && (
        <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
          {problem}
        </p>
      )}
    </div>
  );
}
