"use client";

/** The staff login screen: password, then a one-time code. Requirements: FR-30, FR-42, FR-57, NFR-06, NFR-07, NFR-10. UI spec 3.1
 * and "Phase 10 details"; decision C2 in specs/2026-10-20-staff-screens/requirements.md.
 *
 * The password is typed once and dropped as soon as the code has been sent: "Send a new code" uses the current code token, not the
 * password (POST /auth/resend-code), and "Start again" goes back to the email step. Nothing is kept in a storage; the code is never
 * kept. The code screen says where the code went with only the last four digits of the phone, and a new code can be asked for after
 * 60 seconds (counted on the screen in words; the server keeps the 60 seconds and 5 codes an hour too). After the code step the token
 * and the user go to sessionStorage (lib/staff/session.ts) and the visitor goes to where their role starts. The messages are the
 * API's own meaning in plain words; a wrong email and a wrong password get the same one.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { useSignupOpen } from "@/hooks/useSignupOpen";
import { askForSmsInstead, resendLoginCode, startLogin, verifyLoginCode } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/request";
import { formatPhoneHint } from "@/lib/formatters/phone";
import { addressAfterLogin } from "@/lib/staff/roles";
import { saveStaffSession } from "@/lib/staff/session";
import type { LoginMethod } from "@/types/staff";

const WAIT_FOR_NEW_CODE_SECONDS = 60;
const CODE_LENGTH = 6;
const BACKUP_CODE_LENGTH = 10;
const LINK_BUTTON_CLASSES = "inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-base font-semibold text-forest underline";
const FIELD_CLASSES = "min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink";

type Step = "credentials" | "code";

/** The sentences the API gives for an account that cannot log in (accounts phase 2 and 3). Only these are shown as they come: any
 * other 403 text is replaced by the deactivated one, so nothing unexpected from the server reaches the screen. */
const ACCOUNT_SENTENCES = [
  "This account is waiting for approval by an admin.",
  "Confirm your email address first.",
  "Confirm your phone number first.",
  "This account was not approved.",
  "This account is closed.",
  "This account is deactivated.",
];

function messageForAccount(error: ApiError): string {
  return error.detail !== null && ACCOUNT_SENTENCES.includes(error.detail) ? error.detail : "This account is deactivated.";
}

function messageForLogin(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid email or password";
    if (error.status === 403) return messageForAccount(error);
    if (error.status === 400) return "This account has no phone number, so no code can be sent.";
    if (error.status === 429) return codeLimitSentence(error) ?? "Too many attempts. Try again in a few minutes.";
    if (error.status === 502) return "Could not send the code. Try again.";
  }
  return "We couldn't log you in. Check your connection and try again.";
}

/** The API's sentence for the limit of 5 codes an hour ("Too many codes. Try again in 52 minutes."), else null. */
function codeLimitSentence(error: ApiError): string | null {
  return error.detail?.startsWith("Too many codes.") ? error.detail : null;
}

function messageForNewCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "The code has expired. Choose Start again to get a new one.";
    if (error.status === 403) return messageForAccount(error);
    if (error.status === 429 && error.detail) return error.detail;
    if (error.status === 502) return "Could not send the code. Try again.";
  }
  return "We couldn't send a new code. Check your connection and try again.";
}

function messageForCode(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Invalid or expired code";
    if (error.status === 403) return messageForAccount(error);
    if (error.status === 429) {
      // The lock after 10 wrong codes from the app has its own sentence (with the minutes); any other 429 is the general one.
      return error.detail?.startsWith("Too many wrong codes.") ? error.detail : "Too many attempts. Try again in a few minutes.";
    }
    if (error.status === 503 && error.detail) return error.detail; // the app's codes cannot be checked now: use a backup code
  }
  return "We couldn't check the code. Check your connection and try again.";
}

function messageForSmsInstead(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "The code has expired. Choose Start again to get a new one.";
    if (error.status === 403) return messageForAccount(error);
    if ((error.status === 409 || error.status === 429) && error.detail) return error.detail;
    if (error.status === 502) return "Could not send the code. Try again.";
  }
  return "We couldn't send an SMS code. Check your connection and try again.";
}

export function LoginForm() {
  const router = useRouter();
  const signUpIsOpen = useSignupOpen(); // "No account yet? Sign up." only while sign-up is open (GET /meta)
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ token: string; sentTo: string | null } | null>(null);
  const [method, setMethod] = useState<LoginMethod>("sms"); // what the code step asks for: a sent code, or the app's code (FR-58)
  const [canUseSms, setCanUseSms] = useState(false); // with the app: SMS may be asked for instead
  const [useBackup, setUseBackup] = useState(false); // with the app: a backup code is typed instead
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The wait before "Send a new code" is a moment on the clock (`readyAt`), not a count of ticks: a tab in the
  // background, or a phone that slept, still shows the right seconds as soon as it wakes.
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [codeLimitReached, setCodeLimitReached] = useState(false); // the 5 codes an hour are used: only "Start again" is left
  const secondsLeft = readyAt === null ? 0 : Math.max(0, Math.ceil((readyAt - now) / 1000));

  useEffect(() => {
    if (step !== "code" || readyAt === null || secondsLeft <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, readyAt, secondsLeft]);

  function waitBeforeNewCode(seconds: number) {
    const moment = Date.now();
    setNow(moment);
    setReadyAt(moment + seconds * 1000);
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const started = await startLogin(email.trim(), password);
      setPassword(""); // not needed any more: a new code uses the token, not the password
      setChallenge({ token: started.challenge_token, sentTo: started.sent_to });
      setMethod(started.method);
      setCanUseSms(started.can_use_sms);
      setUseBackup(false);
      setCode("");
      setStep("code");
      if (started.method !== "totp") waitBeforeNewCode(WAIT_FOR_NEW_CODE_SECONDS); // the app sends nothing, so nothing to wait for
      setCodeLimitReached(false);
    } catch (error) {
      setProblem(messageForLogin(error));
    } finally {
      setBusy(false);
    }
  }

  async function sendNewCode() {
    if (busy || challenge === null || secondsLeft > 0 || codeLimitReached) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const started = await resendLoginCode(challenge.token);
      setChallenge({ token: started.challenge_token, sentTo: started.sent_to });
      setCode("");
      waitBeforeNewCode(WAIT_FOR_NEW_CODE_SECONDS);
      setNotice("A new code was sent.");
    } catch (error) {
      setProblem(messageForNewCode(error));
      if (error instanceof ApiError && error.status === 429) {
        const wait = error.retryAfterSeconds ?? WAIT_FOR_NEW_CODE_SECONDS;
        if (wait > WAIT_FOR_NEW_CODE_SECONDS) setCodeLimitReached(true);
        else waitBeforeNewCode(wait);
      }
    } finally {
      setBusy(false);
    }
  }

  /** With the app: ask for an SMS code instead (the server says when that is possible). */
  async function switchToSms() {
    if (busy || challenge === null) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const started = await askForSmsInstead(challenge.token);
      setChallenge({ token: started.challenge_token, sentTo: started.sent_to });
      setMethod(started.method);
      setCanUseSms(false);
      setUseBackup(false);
      setCode("");
      waitBeforeNewCode(WAIT_FOR_NEW_CODE_SECONDS);
      setCodeLimitReached(false);
    } catch (error) {
      setProblem(messageForSmsInstead(error));
    } finally {
      setBusy(false);
    }
  }

  function startAgain() {
    setStep("credentials");
    setChallenge(null);
    setMethod("sms");
    setCanUseSms(false);
    setUseBackup(false);
    setCode("");
    setPassword("");
    setProblem(null);
    setNotice(null);
    setReadyAt(null);
    setCodeLimitReached(false);
  }

  async function checkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || challenge === null) return;
    if (method === "totp" && useBackup) {
      if (code.length !== BACKUP_CODE_LENGTH) {
        setProblem(`A backup code has ${BACKUP_CODE_LENGTH} letters and digits.`);
        return;
      }
    } else if (code.length !== CODE_LENGTH) {
      setProblem(`Enter the ${CODE_LENGTH} digits of the code.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const completed = await verifyLoginCode(challenge.token, code);
      saveStaffSession({ token: completed.access_token, user: completed.user });
      setPassword(""); // the password is not needed any more
      router.replace(addressAfterLogin(completed.user.role, window.location.search));
    } catch (error) {
      setProblem(messageForCode(error));
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Log in</h1>

      {step === "credentials" && (
        <form onSubmit={sendCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="staff-email" className="text-base font-semibold text-ink">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD_CLASSES}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="staff-password" className="text-base font-semibold text-ink">
              Password
            </label>
            <PasswordField id="staff-password" autoComplete="current-password" required value={password} onChange={setPassword} />
            <Link href="/forgot-password" className="inline-flex min-h-12 items-center font-semibold text-forest underline">
              Forgot your password?
            </Link>
          </div>
          {problem && (
            <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Sending…" : "Send me a code"}
          </button>
          {signUpIsOpen && (
            <p className="text-base text-ink">
              No account yet?{" "}
              <Link href="/sign-up" className="inline-flex min-h-12 items-center font-semibold text-forest underline">
                Sign up
              </Link>
            </p>
          )}
        </form>
      )}

      {step === "code" && challenge && (
        <form onSubmit={checkCode} className="flex flex-col gap-4">
          {method === "totp" ? (
            <p className="text-base text-ink">Open your authenticator app and type the 6-digit code. Nothing is sent to your phone.</p>
          ) : (
            <p className="text-base text-ink">Code sent to {method === "email" ? challenge.sentTo : formatPhoneHint(challenge.sentTo ?? "")}</p>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="staff-code" className="text-base font-semibold text-ink">
              {method !== "totp" ? "6-digit code" : useBackup ? "Backup code" : "Code from your app"}
            </label>
            {method === "totp" && useBackup ? (
              <input
                id="staff-code"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={BACKUP_CODE_LENGTH}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, BACKUP_CODE_LENGTH))}
                className={`${FIELD_CLASSES} tracking-widest`}
              />
            ) : (
              <input
                id="staff-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                className={`${FIELD_CLASSES} tracking-widest`}
              />
            )}
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
            {busy ? "Checking…" : "Log in"}
          </button>
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            {method !== "totp" && secondsLeft > 0 && (
              <p id="new-code-hint" className="text-base text-ink-soft">
                {`You can ask for a new code in ${secondsLeft} ${secondsLeft === 1 ? "second" : "seconds"}.`}
              </p>
            )}
            {method !== "totp" && secondsLeft === 0 && !codeLimitReached && (
              <p id="new-code-hint" role="status" className="text-base text-ink-soft">
                You can send a new code now.
              </p>
            )}
            {method !== "totp" && (
              <button
                type="button"
                onClick={() => void sendNewCode()}
                disabled={busy || secondsLeft > 0 || codeLimitReached}
                aria-describedby="new-code-hint"
                className={`${buttonClasses("secondary")} disabled:opacity-60`}
              >
                Send a new code
              </button>
            )}
            {method === "totp" && (
              <button
                type="button"
                onClick={() => {
                  setUseBackup((before) => !before);
                  setCode("");
                  setProblem(null);
                }}
                className={LINK_BUTTON_CLASSES}
              >
                {useBackup ? "Use the app code instead" : "Use a backup code"}
              </button>
            )}
            {method === "totp" && canUseSms && (
              <button type="button" onClick={() => void switchToSms()} disabled={busy} className={buttonClasses("secondary")}>
                Use SMS instead
              </button>
            )}
            <button type="button" onClick={startAgain} className={LINK_BUTTON_CLASSES}>
              Start again
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
