"use client";

/** Close the account, on the account screen. Requirements: FR-54, NFR-06, NFR-07, NFR-10. UI spec 3.1d; api-spec 4d.
 * It says plainly what is removed (name, email, phone, the sign-up note) and what stays (the row and the audit log, so the history
 * of listings stays right). It needs the password and the typed word CLOSE, then asks once more. On success the session is cleared
 * and the person goes to the home page. The API refuses the last active admin, and its own sentence is shown.
 */
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { FIELD, FIELD_LABEL, LINK_BUTTON, PROBLEM, SECTION } from "@/components/account/accountStyles";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { closeAccount } from "@/lib/api/account";
import { sentenceFor } from "@/lib/staff/accountText";
import { clearStaffSession } from "@/lib/staff/session";

export function CloseAccount() {
  const router = useRouter();
  const { call } = useStaff();
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function ask(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (typed.trim() !== "CLOSE") {
      setProblem("Type the word CLOSE to confirm.");
      return;
    }
    setProblem(null);
    setAsking(true);
  }

  async function close() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await call((token) => closeAccount(token, password));
      setPassword("");
      clearStaffSession();
      router.replace("/");
    } catch (error) {
      setProblem(sentenceFor(error));
      setAsking(false);
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="close-account-heading" className={SECTION}>
      <h2 id="close-account-heading" className="text-xl font-bold text-forest">Close your account</h2>
      <p className="text-base text-ink">
        Your name, email and phone are removed and you can no longer log in. The audit log stays, so the history of the
        listings stays right. This cannot be undone.
      </p>
      <form onSubmit={ask} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="close-password" className={FIELD_LABEL}>Your password, to close the account</label>
          <PasswordField id="close-password" autoComplete="current-password" required value={password} onChange={setPassword} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="close-word" className={FIELD_LABEL}>Type CLOSE to confirm</label>
          <input id="close-word" autoComplete="off" autoCapitalize="characters" value={typed} onChange={(event) => setTyped(event.target.value)} className={FIELD} />
        </div>
        {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
        {!asking && (
          <button type="submit" className={buttonClasses("secondary")}>
            Close my account
          </button>
        )}
      </form>
      {asking && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <p className="text-base font-semibold text-ink">Close your account for good?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void close()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
              {busy ? "Closing…" : "Yes, close it"}
            </button>
            <button type="button" onClick={() => setAsking(false)} className={LINK_BUTTON}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
