"use client";

/** The monthly owner fee, as the API states it (OWNER_FEE_NAIRA), for the words at the top of the owner form. Requirements: US-17, FR-50.
 * Spec: specs/2026-11-01-owner-form-fields/. It reads `fee_naira` of `GET /provider/listings`, so the amount is never written in the page.
 * `undefined` while it loads, `null` when it cannot be loaded (the form then says "a monthly fee" without an amount), else "₦10,000".
 */
import { useEffect, useState } from "react";

import { listMyFacilities } from "@/lib/api/provider";
import { formatNaira } from "@/lib/formatters/fees";

type Call = <T>(operation: (token: string) => Promise<T>) => Promise<T>;

export function useOwnerFee(call: Call): string | null | undefined {
  const [fee, setFee] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let isCurrent = true;
    call((token) => listMyFacilities(token))
      .then((list) => {
        if (isCurrent) setFee(formatNaira(list.fee_naira));
      })
      .catch(() => {
        if (isCurrent) setFee(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [call]);

  return fee;
}
