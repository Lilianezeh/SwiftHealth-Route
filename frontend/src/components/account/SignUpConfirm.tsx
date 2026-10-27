"use client";

/** The confirm page of the sign-up: the email code, then (only when Termii is live) the phone code. Requirements: FR-48, FR-49,
 * FR-57 (the same new-code rules as the login), NFR-06, NFR-10. UI spec 3.1c; decision D20 in
 * specs/2026-10-23-accounts-and-facility-ownership/.
 *
 * Where the person is comes from the step kept for the tab by the sign-up page (lib/account/signupStep.ts): the code token, where
 * the code went (masked), the account type and the moment a new code may be asked for. Without Termii the email code ends the
 * road (the phone is confirmed later by an admin's call), so the phone step is only shown when the API says a code was texted.
 * "Send a new code" waits 60 seconds (a moment on the clock, so a background tab is right), follows the API's `Retry-After`, and
 * stays off when the 5 codes an hour are used. "Start again" forgets the step. Nothing typed is kept; the code is never stored.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { confirmSignUpEmail, confirmSignUpPhone, resendSignUpCode } from "@/lib/api/account";
import { ApiError } from "@/lib/api/request";
import { clearSignUpStep, readSignUpStep, saveSignUpStep, type SignUpStep } from "@/lib/account/signupStep";
import { formatPhoneHint } from "@/lib/formatters/phone";

const WAIT_FOR_NEW_CODE_SECONDS = 60;
const CODE_LENGTH = 6;
const LINK_BUTTON_CLASSES = "inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-base font-semibold text-forest underline";
const FIELD_CLASSES = "min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink";

function messageForCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid or expired code";
    if ((error.status === 429 || error.status === 502) && error.detail) return error.detail; // the lock sentence, or "Could not send the code."
    if (error.status === 503) return "Sign-up is not open yet.";
  }
  return "We couldn't check the code. Check your connection and try again.";
}

function messageForNewCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "The code has expired. Choose Start again to get a new one.";
    if ((error.status === 429 || error.status === 502) && error.detail) return error.detail;
    if (error.status === 503) return "Sign-up is not open yet.";
  }
  return "We couldn't send a new code. Check your connection and try again.";
}

export function SignUpConfirm() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<SignUpStep | null>(null);
  const [finished, setFinished] = useState(false); // an owner's sign-up is complete: "Your account is ready."
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [codeLimitReached, setCodeLimitReached] = useState(false); // the 5 codes an hour are used: only "Start again" is left
  const secondsLeft = saved === null ? 0 : Math.max(0, Math.ceil((saved.readyAt - now) / 1000));

  useEffect(() => {
    setSaved(readSignUpStep());
    setNow(Date.now());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (saved === null || secondsLeft <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [saved, secondsLeft]);

  function keep(next: SignUpStep) {
    saveSignUpStep(next);
    setSaved(next);
    setNow(Date.now());
  }

  /** The sign-up is over: an owner can log in, staff wait for an admin. */
  function finish(status: "active" | "waiting_for_approval") {
    clearSignUpStep();
    if (status === "waiting_for_approval") {
      router.push("/sign-up/waiting");
      return;
    }
    setSaved(null);
    setFinished(true);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved === null) return;
    if (code.length !== CODE_LENGTH) {
      setProblem(`Enter the ${CODE_LENGTH} digits of the code.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      if (saved.step === "email") {
        const answer = await confirmSignUpEmail(saved.token, code);
        if (answer.status === "phone_code_sent" && answer.confirm_token && answer.sent_to) {
          keep({
            step: "phone",
            token: answer.confirm_token,
            sentTo: answer.sent_to,
            kind: saved.kind,
            readyAt: Date.now() + WAIT_FOR_NEW_CODE_SECONDS * 1000,
          });
          setCode("");
          setCodeLimitReached(false);
        } else if (answer.status === "active" || answer.status === "waiting_for_approval") {
          finish(answer.status);
        }
      } else {
        finish((await confirmSignUpPhone(saved.token, code)).status);
      }
    } catch (error) {
      setProblem(messageForCode(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendNewCode() {
    if (busy || saved === null || secondsLeft > 0 || codeLimitReached) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const started = await resendSignUpCode(saved.token);
      keep({ ...saved, token: started.confirm_token, sentTo: started.sent_to, readyAt: Date.now() + WAIT_FOR_NEW_CODE_SECONDS * 1000 });
      setCode("");
      setNotice("A new code was sent.");
    } catch (error) {
      setProblem(messageForNewCode(error));
      if (error instanceof ApiError && error.status === 429) {
        const wait = error.retryAfterSeconds ?? WAIT_FOR_NEW_CODE_SECONDS;
        if (wait > WAIT_FOR_NEW_CODE_SECONDS) setCodeLimitReached(true);
        else keep({ ...saved, readyAt: Date.now() + wait * 1000 });
      }
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    clearSignUpStep();
    router.push("/sign-up");
  }

  if (!loaded) return null;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Confirm your sign-up</h1>

      {finished && (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink">Your account is ready.</p>
          <p className="text-base text-ink">Log in with your email and password.</p>
          <Link href="/log-in" className={buttonClasses("primary")}>
            Log in
          </Link>
        </div>
      )}

      {!finished && saved === null && (
        <div className="flex flex-col gap-4">
          <p className="text-base text-ink">There is no sign-up to finish.</p>
          <Link href="/sign-up" className={buttonClasses("primary")}>
            Sign up
          </Link>
        </div>
      )}

      {!finished && saved !== null && (
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <p className="text-base text-ink">
            Code sent to {saved.step === "phone" ? formatPhoneHint(saved.sentTo) : saved.sentTo}
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="signup-code" className="text-base font-semibold text-ink">
              6-digit code
            </label>
            <input
              id="signup-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              className={`${FIELD_CLASSES} tracking-widest`}
            />
          </div>
          {notice && (
            <p role="status" className="text-base text-ink">
              {notice}
            </p>
          )}
          {problem && (
            <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Checking…" : saved.step === "email" ? "Confirm email" : "Confirm phone"}
          </button>
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            {secondsLeft > 0 && (
              <p id="new-code-hint" className="text-base text-ink-soft">
                {`You can ask for a new code in ${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"}.`}
              </p>
            )}
            {secondsLeft === 0 && !codeLimitReached && (
              <p id="new-code-hint" role="status" className="text-base text-ink-soft">
                You can send a new code now.
              </p>
            )}
            <button
              type="button"
              onClick={() => void sendNewCode()}
              disabled={busy || secondsLeft > 0 || codeLimitReached}
              aria-describedby="new-code-hint"
              className={`${buttonClasses("secondary")} disabled:opacity-60`}
            >
              Send a new code
            </button>
            <button type="button" onClick={startAgain} className={LINK_BUTTON_CLASSES}>
              Start again
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
