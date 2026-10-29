"use client";

/** "My payments": the receipts of the owner fee, newest first. Requirements: FR-46, NFR-10. UI spec 4.2c; specs/2026-10-29-owner-fee/.
 * The facility, the day paid, the day the paid month covers and our reference. Nothing else: no card detail ever reaches us. It draws
 * nothing when there are none or the list cannot be loaded.
 */
import { useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { listMyPayments } from "@/lib/api/provider";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { OwnerFeePayment } from "@/types/staff";

export function MyPayments() {
  const { call } = useStaff();
  const [payments, setPayments] = useState<OwnerFeePayment[]>([]);

  useEffect(() => {
    let isCurrent = true;
    call((token) => listMyPayments(token))
      .then((answer) => {
        if (isCurrent) setPayments(answer.items);
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [call]);

  if (payments.length === 0) return null;

  return (
    <section aria-labelledby="my-payments-heading" className="flex flex-col gap-3">
      <h2 id="my-payments-heading" className="text-xl font-bold text-forest">My payments</h2>
      <ul className="flex flex-col gap-3">
        {payments.map((payment) => (
          <li key={payment.reference} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
            <p className="text-base font-bold text-forest">{payment.listing_name}</p>
            <p className="text-base text-ink">
              {`Paid on ${formatNoticeDate(payment.paid_at)}${payment.paid_until ? `, covers until ${formatNoticeDate(payment.paid_until)}` : ""}`}
            </p>
            <p className="break-all text-base text-ink-soft">{`Reference ${payment.reference}`}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
