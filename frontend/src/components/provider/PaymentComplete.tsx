"use client";

/** Where Paystack sends the provider back. It asks the API whether the signed webhook has been applied yet, at once and then every
 * 3 seconds for up to 30 seconds. Requirements: FR-44, FR-46, NFR-10. UI spec 4.4 and "Phase 12 details"; decision I13 in
 * specs/2026-10-20-providers-payments/requirements.md.
 *
 * The page never decides that a payment worked: only the API's `success` (which comes from the verified webhook) does. A network
 * failure is not the end: it asks again until the 30 seconds are over.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { verifyPayment } from "@/lib/api/provider";
import { ApiError } from "@/lib/api/request";
import { formatNoticeDate } from "@/lib/formatters/dates";

const POLL_MS = 3_000;
const GIVE_UP_MS = 30_000;
const LINK_CLASSES = "inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4";

type Outcome = { kind: "waiting" } | { kind: "success"; until: string | null } | { kind: "still-confirming" } | { kind: "not-found" };

type PaymentCompleteProps = { reference: string | null };

export function PaymentComplete({ reference }: PaymentCompleteProps) {
  const { call } = useStaff();
  const [outcome, setOutcome] = useState<Outcome>(reference ? { kind: "waiting" } : { kind: "not-found" });

  useEffect(() => {
    if (!reference) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    async function ask() {
      try {
        const answer = await call((token) => verifyPayment(token, reference as string));
        if (stopped) return;
        if (answer.status === "success") {
          setOutcome({ kind: "success", until: answer.featured_until });
          return;
        }
      } catch (error) {
        if (stopped) return;
        if (error instanceof ApiError && error.status === 404) {
          setOutcome({ kind: "not-found" });
          return;
        }
        // Any other failure (a network error, a sleeping server): ask again until the time is over.
      }
      if (Date.now() - startedAt >= GIVE_UP_MS) {
        setOutcome({ kind: "still-confirming" });
        return;
      }
      timer = setTimeout(() => void ask(), POLL_MS);
    }

    void ask();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [call, reference]);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Payment</h1>

      {outcome.kind === "waiting" && (
        <p role="status" className="text-base text-ink">
          Confirming your payment…
        </p>
      )}
      {outcome.kind === "success" && (
        <>
          <p role="status" className="rounded-2xl border border-line bg-open-bg p-4 text-base font-semibold text-open">
            {outcome.until ? `Payment confirmed. Featured until ${formatNoticeDate(outcome.until)}.` : "Payment confirmed."}
          </p>
          <Link href="/provider" prefetch={false} className={LINK_CLASSES}>
            Back to my facility
          </Link>
        </>
      )}
      {outcome.kind === "still-confirming" && (
        <>
          <p role="status" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
            Still confirming. You can leave this page; we will update your listing.
          </p>
          <Link href="/provider" prefetch={false} className={LINK_CLASSES}>
            Back to my facility
          </Link>
        </>
      )}
      {outcome.kind === "not-found" && (
        <>
          <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
            We could not find your payment. Go back to Get featured.
          </p>
          <Link href="/provider/featured" prefetch={false} className={LINK_CLASSES}>
            Get featured
          </Link>
        </>
      )}
    </section>
  );
}
