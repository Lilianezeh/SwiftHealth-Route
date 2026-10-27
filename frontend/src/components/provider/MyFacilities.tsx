"use client";

/** "My facilities" on the provider's page: every link with its role and its state in words. Requirements: FR-50, US-19, NFR-10.
 * UI spec 4.2b (accounts phase 6b); api-spec 7, "Phase 6a". Only an approved link has the edit link (to the chosen facility);
 * a pending or removed one has none. Nothing about a facility the person has no link to is read or shown. If the list cannot be
 * loaded, or there is none, this draws nothing and the page works as before.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { listMyFacilities } from "@/lib/api/provider";
import type { MyFacility } from "@/types/staff";

const STATE_WORDS: Record<MyFacility["status"], string> = {
  pending: "Waiting for staff to phone the facility.",
  approved: "Approved",
  removed: "Removed.",
};
const ROLE_WORDS: Record<MyFacility["role"], string> = { owner: "Owner", manager: "Manager" };

export function MyFacilities() {
  const { call } = useStaff();
  const [facilities, setFacilities] = useState<MyFacility[]>([]);

  useEffect(() => {
    let isCurrent = true;
    call((token) => listMyFacilities(token))
      .then((answer) => {
        if (isCurrent) setFacilities(answer.items);
      })
      .catch(() => undefined); // the section is an extra: without it the page still works
    return () => {
      isCurrent = false;
    };
  }, [call]);

  if (facilities.length === 0) return null;

  return (
    <section aria-labelledby="my-facilities-heading" className="flex flex-col gap-3">
      <h2 id="my-facilities-heading" className="text-xl font-bold text-forest">My facilities</h2>
      <ul className="flex flex-col gap-3">
        {facilities.map((facility) => (
          <li key={facility.link_id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <p className="text-lg font-bold text-forest">{facility.name}</p>
            <p className="text-base text-ink-soft">{`${facility.category.name} · ${facility.area} · ${ROLE_WORDS[facility.role]}`}</p>
            <p className="text-base font-semibold text-ink">{STATE_WORDS[facility.status]}</p>
            {facility.status === "approved" && (
              <Link href={`/provider/edit?listing=${facility.listing_id}`} prefetch={false} className={`${buttonClasses("secondary")} sm:w-auto sm:self-start sm:px-6`}>
                Edit this facility
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
