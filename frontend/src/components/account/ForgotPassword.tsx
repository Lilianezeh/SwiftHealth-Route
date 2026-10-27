"use client";

/** The forgotten password page: the email, then the code and the new password. Requirements: FR-54, FR-56, NFR-06, NFR-10.
 * UI spec 3.1d (accounts phase 5); api-spec 4d. The answer to the first step is the same for every email, and so are the words
 * under it: "If that email has an account, a code is on its way to …" and the second step is shown either way, so nobody can find
 * out who has an account. Nothing is kept in a storage: the token and the typed values live in this page's state only. The
 * password is the shared field. Setting the new password does not log the person in.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { CODE_LENGTH, cleanSixDigits, FIELD, FIELD_LABEL, LINK_BUTTON, PROBLEM } from "@/components/account/accountStyles";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { forgotPassword, resetPassword } from "@/lib/api/account";
import { sentenceFor } from "@/lib/staff/accountText";

type Step = { token: string; hint: string } | null;

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function ask(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await forgotPassword(email.trim());
      setStep({ token: answer.reset_token, hint: answer.sent_to });
      setCode("");
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function setNewPassword(event: FormEvent) {
    event.preventDefault();
    if (busy || step === null) return;
    if (code.length !== CODE_LENGTH) {
      setProblem(`Enter the ${CODE_LENGTH} digits of the code.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await resetPassword(step.token, code, password);
      setPassword("");
      setCode("");
      setDone(true);
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    setStep(null);
    setCode("");
    setPassword("");
    setProblem(null);
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Forgot your password?</h1>

      {done && (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-base text-ink">Your password was changed. Log in with it.</p>
          <Link href="/log-in" className={buttonClasses("primary")}>Log in</Link>
        </div>
      )}

      {!done && step === null && (
        <form onSubmit={ask} className="flex flex-col gap-4">
          <p className="text-base text-ink">Type the email of your account. We will send you a code.</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="forgot-email" className={FIELD_LABEL}>Email</label>
            <input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={FIELD} />
          </div>
          {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Sending…" : "Send me a code"}
          </button>
        </form>
      )}

      {!done && step !== null && (
        <form onSubmit={setNewPassword} className="flex flex-col gap-4">
          <p className="text-base text-ink">{`If that email has an account, a code is on its way to ${step.hint}.`}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="forgot-code" className={FIELD_LABEL}>6-digit code</label>
            <input
              id="forgot-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(cleanSixDigits(event.target.value))}
              className={`${FIELD} tracking-widest`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="forgot-new-password" className={FIELD_LABEL}>New password</label>
            <PasswordField id="forgot-new-password" autoComplete="new-password" required value={password} onChange={setPassword} />
            <p className="text-base text-ink-soft">At least 8 characters for an owner, 10 for staff. Not a very common password.</p>
          </div>
          {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Saving…" : "Set the new password"}
          </button>
          <button type="button" onClick={startAgain} className={LINK_BUTTON}>Start again</button>
        </form>
      )}
    </section>
  );
}
