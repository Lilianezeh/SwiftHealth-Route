"use client";

/** The sign-up page: first the choice (Staff or Facility owner), then one form. Requirements: FR-48, FR-49, FR-56, NFR-06, NFR-10.
 * UI spec 3.1c; decisions D6 and D20 in specs/2026-10-23-accounts-and-facility-ownership/.
 *
 * The API makes the account and emails the first code (`POST /auth/signup`). The page then keeps only the code token, where the
 * code went (masked), the account type and the moment a new code may be asked for, in `sessionStorage` (lib/account/signupStep.ts),
 * and goes to `/sign-up/confirm`. The password is dropped as soon as the code has been sent and is never kept anywhere. The
 * messages are the API's own sentences for the cases it explains (a refused password, too many attempts, sign-up not open yet).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { signUp } from "@/lib/api/account";
import { ApiError } from "@/lib/api/request";
import { saveSignUpStep } from "@/lib/account/signupStep";
import { minPasswordLength } from "@/lib/staff/roles";
import type { AccountType } from "@/types/account";

const WAIT_FOR_NEW_CODE_SECONDS = 60;
const NOTE_MAX_LENGTH = 500;
const FIELD_CLASSES = "min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink";
const CHOICE_CLASSES =
  "flex min-h-12 w-full flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left text-base text-ink hover:border-forest";
const LINK_CLASSES = "inline-flex min-h-12 items-center font-semibold text-forest underline";

const KIND_NAMES: Record<AccountType, string> = { staff: "Staff", provider: "Facility owner" };

/** The API's sentence when it sent one for a case it explains, else plain words. */
function messageForSignUp(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) return error.detail ?? "Check your name, email and phone number.";
    if ((error.status === 429 || error.status === 502 || error.status === 503) && error.detail) return error.detail;
  }
  return "We couldn't sign you up. Check your connection and try again.";
}

export function SignUpForm() {
  const router = useRouter();
  const [kind, setKind] = useState<AccountType | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || kind === null) return;
    setBusy(true);
    setProblem(null);
    const trimmedNote = note.trim();
    try {
      const started = await signUp({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        account_type: kind,
        ...(kind === "staff" && trimmedNote !== "" ? { note: trimmedNote } : {}),
      });
      setPassword(""); // not needed any more, and never kept
      saveSignUpStep({
        step: "email",
        token: started.confirm_token,
        sentTo: started.sent_to,
        kind,
        readyAt: Date.now() + WAIT_FOR_NEW_CODE_SECONDS * 1000,
      });
      router.push("/sign-up/confirm");
    } catch (error) {
      setProblem(messageForSignUp(error));
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Sign up</h1>

      {kind === null ? (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink">What do you want to sign up as?</p>
          <button type="button" onClick={() => setKind("staff")} className={CHOICE_CLASSES}>
            <span className="font-semibold">Staff</span>
            <span className="text-ink-soft">I verify or edit listings. An admin will check my request.</span>
          </button>
          <button type="button" onClick={() => setKind("provider")} className={CHOICE_CLASSES}>
            <span className="font-semibold">Facility owner</span>
            <span className="text-ink-soft">
              I run a hospital, clinic, pharmacy or blood bank and want to keep its details right.
            </span>
          </button>
        </div>
      ) : (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-semibold text-ink">Signing up as: {KIND_NAMES[kind]}</p>
            <button type="button" onClick={() => setKind(null)} className={buttonClasses("secondary")}>
              Change
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-name" className="text-base font-semibold text-ink">
              Name
            </label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-email" className="text-base font-semibold text-ink">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-phone" className="text-base font-semibold text-ink">
              Phone number
            </label>
            <input
              id="signup-phone"
              type="tel"
              autoComplete="tel"
              required
              aria-describedby="signup-phone-hint"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={FIELD_CLASSES}
            />
            <p id="signup-phone-hint" className="text-base text-ink-soft">
              A Nigerian number, for example 0803 123 4567. We may phone you to check it.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-password" className="text-base font-semibold text-ink">
              Password
            </label>
            <PasswordField id="signup-password" autoComplete="new-password" required value={password} onChange={setPassword} />
            <p className="text-base text-ink-soft">
              {`At least ${minPasswordLength(kind === "provider" ? "provider" : "verifier")} characters. Not a very common password.`}
            </p>
          </div>
          {kind === "staff" && (
            <div className="flex flex-col gap-1">
              <label htmlFor="signup-note" className="text-base font-semibold text-ink">
                Who are you, and who can say so?
              </label>
              <textarea
                id="signup-note"
                rows={3}
                maxLength={NOTE_MAX_LENGTH}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={`${FIELD_CLASSES} py-2`}
              />
            </div>
          )}
          {problem && (
            <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Sending…" : "Send me a code"}
          </button>
        </form>
      )}

      <p className="text-base text-ink">
        Already have an account?{" "}
        <Link href="/log-in" className={LINK_CLASSES}>
          Log in
        </Link>
      </p>
    </section>
  );
}
