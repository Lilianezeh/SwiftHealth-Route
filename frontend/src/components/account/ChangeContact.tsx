"use client";

/** A new email or a new phone number, on the account screen. Requirements: FR-54, NFR-06, NFR-10. UI spec 3.1d; api-spec 4d.
 * Two steps: the new value, then the code that was sent to the NEW address or number. The old one keeps working until the code
 * is confirmed. With Termii off a new phone needs no code (nobody can send one): the API stores it unconfirmed and says so, and an
 * admin phones to confirm it (decision D20). The API's own sentence is shown for a refusal.
 */
import { useState, type FormEvent } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { CODE_LENGTH, cleanSixDigits, FIELD, PROBLEM, SECTION } from "@/components/account/accountStyles";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { confirmEmailChange, confirmPhoneChange, getAccount, startEmailChange, startPhoneChange } from "@/lib/api/account";
import { formatPhoneHint } from "@/lib/formatters/phone";
import { sentenceFor } from "@/lib/staff/accountText";
import type { AccountDetails } from "@/types/account";

type Kind = "email" | "phone";
type Props = { kind: Kind; onChanged: (account: AccountDetails) => void };

const WORDS = {
  email: {
    heading: "Change your email",
    field: "New email",
    start: "Send a code to the new email",
    codeLabel: "6-digit code for the new email",
    confirm: "Confirm the new email",
    done: "Your email was changed.",
  },
  phone: {
    heading: "Change your phone number",
    field: "New phone number",
    start: "Change my phone number",
    codeLabel: "6-digit code for the new number",
    confirm: "Confirm the new number",
    done: "Your phone number was changed.",
  },
} as const;

export function ChangeContact({ kind, onChanged }: Props) {
  const { call } = useStaff();
  const words = WORDS[kind];
  const [value, setValue] = useState("");
  const [step, setStep] = useState<{ token: string; hint: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (value.trim() === "") {
      setProblem(kind === "email" ? "Type the new email first." : "Type the new phone number first.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const answer = await call((token) =>
        kind === "email" ? startEmailChange(token, value.trim()) : startPhoneChange(token, value.trim()),
      );
      if (answer.confirm_token === null) {
        // No code was needed (a new phone while Termii is off): the number is already stored, not confirmed.
        const account = await call((token) => getAccount(token));
        onChanged(account);
        setValue("");
        setMessage("Your number was changed. An admin will phone you to confirm it.");
      } else {
        const hint = kind === "email" ? (answer.sent_to ?? "") : formatPhoneHint(answer.sent_to ?? "");
        setStep({ token: answer.confirm_token, hint });
        setCode("");
      }
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (busy || step === null) return;
    if (code.length !== CODE_LENGTH) {
      setProblem(`Enter the ${CODE_LENGTH} digits of the code.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const account = await call((token) =>
        kind === "email" ? confirmEmailChange(token, step.token, code) : confirmPhoneChange(token, step.token, code),
      );
      onChanged(account);
      setStep(null);
      setValue("");
      setCode("");
      setMessage(words.done);
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  const headingId = `change-${kind}-heading`;
  return (
    <section aria-labelledby={headingId} className={SECTION}>
      <h2 id={headingId} className="text-xl font-bold text-forest">{words.heading}</h2>
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      {step === null ? (
        <form onSubmit={start} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`new-${kind}`} className="text-base font-semibold text-ink">{words.field}</label>
            <input
              id={`new-${kind}`}
              type={kind === "email" ? "email" : "tel"}
              autoComplete={kind === "email" ? "email" : "tel"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className={FIELD}
            />
          </div>
          {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
          <button type="submit" disabled={busy} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            {busy ? "Sending…" : words.start}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} className="flex flex-col gap-3">
          <p className="text-base text-ink">
            {kind === "email"
              ? `Code sent to ${step.hint}. Your old email keeps working until you confirm.`
              : `Code sent to ${step.hint}.`}
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`code-${kind}`} className="text-base font-semibold text-ink">{words.codeLabel}</label>
            <input
              id={`code-${kind}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(cleanSixDigits(event.target.value))}
              className={`${FIELD} tracking-widest`}
            />
          </div>
          {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Checking…" : words.confirm}
          </button>
        </form>
      )}
    </section>
  );
}
