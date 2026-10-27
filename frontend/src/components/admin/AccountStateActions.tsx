"use client";

/** Suspend and Reactivate on an account card. Requirements: FR-55, US-18, NFR-10. UI spec 3.8 (accounts phase 4b).
 * Suspend needs a reason and asks first; Reactivate asks first. Not offered on your own account, nor on an account that is waiting
 * for approval or was not approved (those are decided in the Waiting tab, and a rejected account never comes back). The API
 * checks all of it again, including the last active admin, and its own sentence is shown when it refuses. Nothing deletes an account.
 */
import { useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { reactivateAdminUser, suspendAdminUser } from "@/lib/api/staff";
import { sentenceFor } from "@/lib/staff/accountText";
import type { AdminUserRow } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
const REASON_MAX_LENGTH = 500;
const SECONDARY = `${buttonClasses("secondary")} disabled:opacity-60 sm:w-auto sm:px-6`;
const PRIMARY = `${buttonClasses("primary")} disabled:opacity-60 sm:w-auto sm:px-6`;

type Props = { user: AdminUserRow; isMe: boolean; onChanged: (user: AdminUserRow, message: string) => void };

export function AccountStateActions({ user, isMe, onChanged }: Props) {
  const { call } = useStaff();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const approved = (user.approval_status ?? "approved") === "approved"; // an older API sends no approval state
  if (isMe || !approved) return null;

  async function decide(action: () => Promise<AdminUserRow>, message: string) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const saved = await action();
      setAsking(false);
      setReason("");
      onChanged(saved, message);
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  function suspend() {
    if (reason.trim() === "") {
      setProblem("Say why you are suspending this account.");
      return;
    }
    void decide(() => call((token) => suspendAdminUser(token, user.id, reason.trim())), `${user.name} was suspended.`);
  }

  const reactivate = () => decide(() => call((token) => reactivateAdminUser(token, user.id)), `${user.name} was reactivated.`);

  return (
    <div className="flex flex-col gap-2">
      {!asking && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          aria-label={`${user.is_active ? "Suspend" : "Reactivate"} ${user.name}`}
          className={`${SECONDARY} sm:self-start`}
        >
          {user.is_active ? "Suspend" : "Reactivate"}
        </button>
      )}
      {asking && user.is_active && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <label htmlFor={`suspend-reason-${user.id}`} className="text-base font-semibold text-ink">{`Reason for suspending ${user.name}`}</label>
          <textarea
            id={`suspend-reason-${user.id}`}
            rows={2}
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${FIELD} py-2`}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={suspend} disabled={busy} className={PRIMARY}>
              {busy ? "Suspending…" : "Yes, suspend"}
            </button>
            <button type="button" onClick={() => { setAsking(false); setProblem(null); }} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {asking && !user.is_active && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-base font-semibold text-ink">{`Reactivate ${user.name}?`}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void reactivate()} disabled={busy} className={PRIMARY}>
              {busy ? "Reactivating…" : "Yes, reactivate"}
            </button>
            <button type="button" onClick={() => { setAsking(false); setProblem(null); }} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
    </div>
  );
}
