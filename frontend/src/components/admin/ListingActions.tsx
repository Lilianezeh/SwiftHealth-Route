"use client";

/** The action bar of the listing editor: Save, Cancel, the status buttons and the link to the verification log.
 * Requirements: FR-31, FR-32, FR-42, NFR-10. UI spec 3.4 and "Phase 10 details". Which buttons show depends on the listing's status
 * and the user's role; the API checks the same rules again, so a button that shows by mistake is refused there.
 */
import Link from "next/link";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import type { ListingMove } from "@/lib/api/staff";
import type { ListingStatus, StaffRole } from "@/types/staff";

type ListingActionsProps = {
  listingId: number | null; // null while the listing is new
  status: ListingStatus | null;
  role: StaffRole;
  canEdit: boolean; // may this user change the listing's fields (decision C3)
  dirty: boolean;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onMove: (move: ListingMove) => void;
  onHide: (reason: string) => void;
};

export function ListingActions({ listingId, status, role, canEdit, dirty, busy, onSave, onCancel, onMove, onHide }: ListingActionsProps) {
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonProblem, setReasonProblem] = useState<string | null>(null);

  const isEditorOrAdmin = role === "editor" || role === "admin";
  const exists = listingId !== null && status !== null;
  const canSubmit = exists && status === "draft" && canEdit;
  const canPublish = exists && isEditorOrAdmin && (status === "pending_review" || status === "recheck_due");
  const canHide = exists && isEditorOrAdmin && status !== "hidden";
  const canReopen = exists && isEditorOrAdmin && status === "hidden";
  const movesAreOff = dirty || busy;

  function hide() {
    if (reason.trim() === "") {
      setReasonProblem("Write the reason first.");
      return;
    }
    setReasonProblem(null);
    onHide(reason.trim());
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      {exists && (canSubmit || canPublish || canHide) && dirty && (
        <p className="text-base text-ink-soft">Save your changes before you submit, publish or hide.</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {canEdit && (
          <button
            type="button"
            onClick={onSave}
            disabled={busy || (exists && !dirty)}
            className={`${buttonClasses("primary")} disabled:opacity-60`}
          >
            {busy ? "Working…" : "Save"}
          </button>
        )}
        {canSubmit && (
          <button type="button" onClick={() => onMove("submit")} disabled={movesAreOff} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            Submit for review
          </button>
        )}
        {canPublish && (
          <button type="button" onClick={() => onMove("publish")} disabled={movesAreOff} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            Publish
          </button>
        )}
        {canReopen && (
          <button type="button" onClick={() => onMove("reopen")} disabled={movesAreOff} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            Reopen
          </button>
        )}
        {canHide && !hiding && (
          <button type="button" onClick={() => setHiding(true)} disabled={movesAreOff} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            Hide
          </button>
        )}
        <button type="button" onClick={onCancel} className={buttonClasses("secondary")}>
          Cancel
        </button>
        {exists && (
          <Link href={`/admin/listings/${listingId}/checks`} prefetch={false} className={buttonClasses("secondary")}>
            Verification log
          </Link>
        )}
      </div>

      {canHide && hiding && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <label htmlFor="hide-reason" className="text-base font-semibold text-ink">
            Why is it hidden?
          </label>
          <input
            id="hide-reason"
            value={reason}
            maxLength={200}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink"
          />
          {reasonProblem && (
            <p role="alert" className="text-base font-semibold text-amber-ink">
              {reasonProblem}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={hide} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
              Hide this listing
            </button>
            <button type="button" onClick={() => setHiding(false)} className={buttonClasses("secondary")}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
