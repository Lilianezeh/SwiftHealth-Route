"use client";

/** "Branch of a bigger facility?" in the staff editor (editor and admin). Requirements: FR-52, US-20, NFR-10. UI spec 3.12;
 * api-spec 7, "Phase 8b". Shows the main facility (a link to its editor) or "This is a main facility.", a field for the main
 * facility's number and two buttons. The API checks the rules (one level, same kind, not closed...) and its sentence is shown when it
 * refuses. The new state is reported to the page through `onChanged`, so the header and the form can follow.
 */
import Link from "next/link";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { setMainFacility } from "@/lib/api/listingChanges";
import { ApiError } from "@/lib/api/request";
import type { StaffListingDetail } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";

type Props = {
  listingId: number;
  parentId: number | null;
  parentName: string | null;
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  onChanged: (detail: StaffListingDetail) => void;
};

export function BranchOf({ listingId, parentId, parentName, call, onChanged }: Props) {
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(newParent: number | null) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const detail = await call((token) => setMainFacility(token, listingId, newParent));
      setNotice(newParent === null ? "This is now a main facility." : `This is now a branch of ${detail.parent_name ?? "the main facility"}.`);
      setNumber("");
      onChanged(detail);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setProblem("Only an editor or admin can do this.");
      else if (error instanceof ApiError && error.detail) setProblem(error.detail);
      else setProblem("We couldn't do that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const wanted = Number(number);
  const numberOk = /^[0-9]+$/.test(number.trim()) && wanted > 0;

  return (
    <section aria-labelledby="branch-of-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="branch-of-heading" className="text-xl font-bold text-forest">Branch of a bigger facility?</h2>
      {parentId !== null ? (
        <p className="text-base text-ink">
          {"This is a branch of "}
          <Link href={`/admin/listings/${parentId}`} className="inline-flex min-h-12 items-center font-semibold underline">
            {parentName ?? `listing ${parentId}`}
          </Link>
          .
        </p>
      ) : (
        <p className="text-base text-ink">This is a main facility.</p>
      )}
      {notice && <p role="status" className="text-base font-semibold text-ink">{notice}</p>}
      {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="main-facility-number" className="text-base font-semibold text-ink">Main facility number</label>
        <input
          id="main-facility-number"
          inputMode="numeric"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          className={FIELD}
        />
        <p className="text-base text-ink-soft">The number at the end of the main facility&apos;s editor address.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => void run(wanted)} disabled={busy || !numberOk} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          Make it a branch
        </button>
        <button type="button" onClick={() => void run(null)} disabled={busy || parentId === null} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
          Make it a main facility
        </button>
      </div>
    </section>
  );
}
