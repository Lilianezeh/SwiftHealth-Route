"use client";

/** Where Paystack sends the provider back after the owner fee. It asks the API whether the signed webhook has been applied yet, at once
 * and then every 3 seconds for up to 30 seconds. Requirements: FR-44, FR-46, NFR-10. UI spec 4.4b; specs/2026-10-29-owner-fee/.
 *
 * The page never decides that a payment worked: only the API's `success` (which comes from the verified webhook) does. A network
 * failure is not the end: it asks again until the 30 seconds are over.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { verifyOwnerFeePayment } from "@/lib/api/provider";
import { ApiError } from "@/lib/api/request";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { OwnerFeeVerified } from "@/types/staff";

const POLL_MS = 3_000;
const GIVE_UP_MS = 30_000;
const LINK_CLASSES = "inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4";

type Outcome = { kind: "waiting" } | { kind: "success"; answer: OwnerFeeVerified } | { kind: "still-confirming" } | { kind: "not-found" };

function confirmedSentence(answer: OwnerFeeVerified): string {
  const until = answer.paid_until ? formatNoticeDate(answer.paid_until) : null;
  if (answer.link_status === "pending") {
    return `Payment confirmed. Our team will now phone the facility to check your request.${until ? ` Paid until ${until}.` : ""}`;
  }
  if (answer.link_status === "approved" && until) return `Payment confirmed. You can edit until ${until}.`;
  return "Payment confirmed.";
}

export function FeeComplete({ reference }: { reference: string | null }) {
  const { call } = useStaff();
  const [outcome, setOutcome] = useState<Outcome>(reference ? { kind: "waiting" } : { kind: "not-found" });

  useEffect(() => {
    if (!reference) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    async function ask() {
      try {
        const answer = await call((token) => verifyOwnerFeePayment(token, reference as string));
        if (stopped) return;
        if (answer.status === "success") {
          setOutcome({ kind: "success", answer });
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
        <p role="status" className="rounded-2xl border border-line bg-open-bg p-4 text-base font-semibold text-open">
          {confirmedSentence(outcome.answer)}
        </p>
      )}
      {outcome.kind === "still-confirming" && (
        <p role="status" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
          Still confirming. You can leave this page; we will update your request.
        </p>
      )}
      {outcome.kind === "not-found" && (
        <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
          We could not find your payment. Go back to My facilities.
        </p>
      )}
      {outcome.kind !== "waiting" && (
        <Link href="/provider" prefetch={false} className={LINK_CLASSES}>
          Back to my facilities
        </Link>
      )}
    </section>
  );
}
