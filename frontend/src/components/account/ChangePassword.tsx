"use client";

/** Change the password, on the account screen. Requirements: FR-54, FR-56, NFR-06, NFR-10. UI spec 3.1d; api-spec 4d.
 * The current and the new password are typed once and dropped as soon as the answer comes; they are never kept in a storage. The
 * API ends every older login token, so its answer carries a fresh one, which replaces the old in the tab's session and the person
 * stays logged in. Both fields are the shared password field. The least length (8 for a provider, 10 for staff) is checked here
 * for a quick answer and by the API again, which also refuses very common passwords.
 */
import { useState, type FormEvent } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { FIELD_LABEL, PROBLEM, SECTION } from "@/components/account/accountStyles";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { changePassword } from "@/lib/api/account";
import { sentenceFor } from "@/lib/staff/accountText";
import { minPasswordLength } from "@/lib/staff/roles";

export function ChangePassword() {
  const { session, call, replaceToken } = useStaff();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const leastLength = minPasswordLength(session.user.role);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (next.length < leastLength) {
      setProblem(`The password needs at least ${leastLength} characters.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const answer = await call((token) => changePassword(token, current, next));
      replaceToken(answer.access_token);
      setCurrent("");
      setNext("");
      setMessage("Your password was changed.");
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="change-password-heading" className={SECTION}>
      <h2 id="change-password-heading" className="text-xl font-bold text-forest">Change your password</h2>
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="current-password" className={FIELD_LABEL}>Current password</label>
          <PasswordField id="current-password" autoComplete="current-password" required value={current} onChange={setCurrent} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-password" className={FIELD_LABEL}>New password</label>
          <PasswordField id="new-password" autoComplete="new-password" required value={next} onChange={setNext} />
          <p className="text-base text-ink-soft">{`At least ${leastLength} characters. Not a very common password.`}</p>
        </div>
        {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
        <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}
