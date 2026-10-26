"use client";

/** The "Waiting for approval" tab: staff sign-ups the admin has to decide on. Requirements: FR-49, FR-55, US-18, NFR-10.
 * UI spec 3.8 (accounts phase 4b); decisions D6 and D20 in specs/2026-10-23-accounts-and-facility-ownership/.
 * One card per account: what they wrote, whether the email and the phone are confirmed, and the three things an admin can do:
 * record that they phoned the person ("Phone confirmed by call"), approve as an editor or a verifier (never an admin or a
 * provider), or reject with an optional reason. Every decision asks first. Approve stays off until the email and the phone are
 * confirmed; the API refuses it too. The API's own sentence is shown when a decision is refused.
 */
import { useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { approveAdminUser, confirmPhoneByCall, rejectAdminUser } from "@/lib/api/staff";
import { formatLagosDateTime } from "@/lib/formatters/dates";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import { sentenceFor, withArticle } from "@/lib/staff/accountText";
import type { AdminUserRow } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
const REASON_MAX_LENGTH = 500;
const SECONDARY = `${buttonClasses("secondary")} disabled:opacity-60 sm:w-auto sm:px-6`;
const PRIMARY = `${buttonClasses("primary")} disabled:opacity-60 sm:w-auto sm:px-6`;

type Step = "approve" | "reject" | "call" | null;
type ApproveRole = "editor" | "verifier";

type CardProps = {
  user: AdminUserRow;
  onDecided: (user: AdminUserRow, message: string) => void;
  onUpdated: (user: AdminUserRow) => void;
};

function WaitingCard({ user, onDecided, onUpdated }: CardProps) {
  const { call } = useStaff();
  const [step, setStep] = useState<Step>(null);
  const [role, setRole] = useState<ApproveRole>("verifier");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const emailConfirmed = user.email_verified_at !== null;
  const phoneConfirmed = user.phone_verified_at !== null;
  const phoneText = user.phone ? formatPhoneForReading(user.phone) : null;
  const cannotApproveBecause = !emailConfirmed ? "Their email is not confirmed yet." : !phoneConfirmed ? "Confirm the phone first." : null;

  /** Runs one decision: no second send while it waits, the API's sentence when it is refused. */
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  const approve = () =>
    run(async () => {
      const saved = await call((token) => approveAdminUser(token, user.id, role));
      onDecided(saved, `${user.name} was approved as ${withArticle(role)}.`);
    });

  const reject = () =>
    run(async () => {
      const saved = await call((token) => rejectAdminUser(token, user.id, reason.trim() || undefined));
      onDecided(saved, `${user.name} was rejected.`);
    });

  const recordCall = () =>
    run(async () => {
      await call((token) => confirmPhoneByCall(token, user.id));
      setStep(null);
      onUpdated({ ...user, phone_verified_at: new Date().toISOString() });
    });

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
      <p className="text-lg font-bold text-forest">{user.name}</p>
      <p className="text-base text-ink-soft">{user.email}</p>
      {phoneText && <p className="text-base text-ink">{phoneText}</p>}
      <p className="text-base text-ink-soft">{`Signed up ${formatLagosDateTime(user.created_at)}`}</p>
      <p className="mt-1 text-base font-semibold text-ink">Who they are</p>
      <p className="text-base text-ink">{user.signup_note ?? "They wrote nothing."}</p>
      <p className="text-base text-ink">{emailConfirmed ? "Email confirmed" : "Email not confirmed yet"}</p>
      <p className="text-base text-ink">{phoneConfirmed ? "Phone confirmed" : "Phone not confirmed"}</p>

      {!phoneConfirmed && emailConfirmed && (
        <div className="flex flex-col gap-2 rounded-2xl bg-amber-wash p-3">
          {phoneText ? (
            <p className="text-base text-amber-ink">{`Phone them on ${phoneText}, then press the button below.`}</p>
          ) : (
            <p className="text-base text-amber-ink">They gave no phone number.</p>
          )}
          {phoneText && step !== "call" && (
            <button type="button" onClick={() => setStep("call")} aria-label={`Phone confirmed by call: ${user.name}`} className={SECONDARY}>
              Phone confirmed by call
            </button>
          )}
          {step === "call" && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-ink">{`Did you phone ${user.name} and hear them confirm this number?`}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void recordCall()} disabled={busy} className={PRIMARY}>
                  {busy ? "Saving…" : "Yes, I phoned them"}
                </button>
                <button type="button" onClick={() => setStep(null)} className={SECONDARY}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <label htmlFor={`approve-role-${user.id}`} className="text-base font-semibold text-ink">{`Role for ${user.name}`}</label>
        <select id={`approve-role-${user.id}`} value={role} onChange={(event) => setRole(event.target.value as ApproveRole)} className={FIELD}>
          <option value="verifier">Verifier</option>
          <option value="editor">Editor</option>
        </select>
        {step !== "approve" && (
          <button type="button" onClick={() => setStep("approve")} disabled={cannotApproveBecause !== null} aria-label={`Approve ${user.name}`} className={`${PRIMARY} mt-2`}>
            Approve
          </button>
        )}
        {cannotApproveBecause && <p className="text-base text-ink-soft">{cannotApproveBecause}</p>}
        {step === "approve" && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-base font-semibold text-ink">{`Approve ${user.name} as ${withArticle(role)}?`}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void approve()} disabled={busy} className={PRIMARY}>
                {busy ? "Approving…" : "Yes, approve"}
              </button>
              <button type="button" onClick={() => setStep(null)} className={SECONDARY}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <label htmlFor={`reject-reason-${user.id}`} className="text-base font-semibold text-ink">{`Reason for rejecting ${user.name} (optional)`}</label>
        <textarea
          id={`reject-reason-${user.id}`}
          rows={2}
          maxLength={REASON_MAX_LENGTH}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className={`${FIELD} py-2`}
        />
        {step !== "reject" && (
          <button type="button" onClick={() => setStep("reject")} aria-label={`Reject ${user.name}`} className={`${SECONDARY} mt-2`}>
            Reject
          </button>
        )}
        {step === "reject" && (
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-base font-semibold text-ink">{`Reject ${user.name}?`}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void reject()} disabled={busy} className={PRIMARY}>
                {busy ? "Rejecting…" : "Yes, reject"}
              </button>
              <button type="button" onClick={() => setStep(null)} className={SECONDARY}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
    </li>
  );
}

type WaitingProps = {
  users: AdminUserRow[];
  onDecided: (user: AdminUserRow, message: string) => void;
  onUpdated: (user: AdminUserRow) => void;
};

export function WaitingForApproval({ users, onDecided, onUpdated }: WaitingProps) {
  if (users.length === 0) return <p className="text-base text-ink">Nobody is waiting for approval.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {users.map((user) => (
        <WaitingCard key={user.id} user={user} onDecided={onDecided} onUpdated={onUpdated} />
      ))}
    </ul>
  );
}
