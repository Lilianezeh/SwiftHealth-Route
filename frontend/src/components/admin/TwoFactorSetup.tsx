"use client";

/** The Security screen: switch on the authenticator app, see the backup codes once, get new ones, switch it off.
 * Requirements: FR-58, NFR-06, NFR-10. Spec: specs/2026-10-23-accounts-and-facility-ownership/ (Phase 2c; the owner's answers D17 to D19).
 *
 * Every step that changes the account asks for the password again (and, to switch it off or renew the codes, a code). The secret is
 * shown once, as a QR code made in the browser (the `qrcode` package, loaded only here, D17) and as text to type; the ten backup codes
 * are shown once. Nothing secret is kept in a storage: only React state, which is gone when the page is. The sentences of an error are
 * the API's own. Fields and buttons are at least 48 px, 16 px text, no red.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  getTwoFactorStatus,
  renewBackupCodes,
  startTwoFactorSetup,
} from "@/lib/api/staff";
import { ApiError } from "@/lib/api/request";
import type { TwoFactorStatus } from "@/types/staff";

const FIELD = "min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink";
const PROBLEM = "rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink";
const LINK_BUTTON = "inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-base font-semibold text-forest underline";
const CODE_LENGTH = 6;

type Stage = "idle" | "password" | "scan" | "codes" | "renew" | "disable";

function sentenceFor(error: unknown): string {
  if (error instanceof ApiError && error.detail) return error.detail;
  return "We couldn't do that. Check your connection and try again.";
}

/** A key of 32 letters in groups of four, easier to copy by eye: "JBSW Y3DP ...". */
function groupsOfFour(key: string): string {
  return key.replace(/(.{4})/g, "$1 ").trim();
}

/** What was typed for "a code from your app, or a backup code": no spaces or dashes, capitals. */
function cleanCode(typed: string): string {
  return typed.replace(/[\s-]/g, "").toUpperCase();
}

export function TwoFactorSetup() {
  const { call, updateUser } = useStaff();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<{ secret: string; picture: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [renewed, setRenewed] = useState(false); // the codes on show are new ones: the old ones are dead
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await call((token) => getTwoFactorStatus(token)));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [call]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  function go(next: Stage) {
    setStage(next);
    setPassword("");
    setCode("");
    setProblem(null);
    setNotice(null);
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password === "") {
      setProblem("Type your password.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const started = await call((token) => startTwoFactorSetup(token, password));
      const { default: QRCode } = await import("qrcode"); // loaded only here: no other screen pays for it
      const picture = await QRCode.toDataURL(started.otpauth_uri, { margin: 2, width: 240 });
      setSetup({ secret: started.secret, picture });
      setPassword("");
      setStage("scan");
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (code.length !== CODE_LENGTH) {
      setProblem(`Enter the ${CODE_LENGTH} digits of the code.`);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await call((token) => confirmTwoFactorSetup(token, code));
      setCodes(result.backup_codes);
      setRenewed(false);
      setSetup(null); // the key is not needed any more and is not kept
      setCode("");
      updateUser({ two_factor_enabled: true });
      setStage("codes");
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function renew(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password === "" || code.trim() === "") {
      setProblem("Type your password and a code.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await call((token) => renewBackupCodes(token, password, cleanCode(code)));
      setCodes(result.backup_codes);
      setRenewed(true);
      setPassword("");
      setCode("");
      setStage("codes");
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function switchOff(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password === "" || code.trim() === "") {
      setProblem("Type your password and a code.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await call((token) => disableTwoFactor(token, password, cleanCode(code)));
      updateUser({ two_factor_enabled: false });
      go("idle");
      await loadStatus();
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setNotice("Copied.");
    } catch {
      setNotice("Could not copy. Select the codes and copy them by hand.");
    }
  }

  function savedThem() {
    setCodes([]); // gone from the page
    go("idle");
    void loadStatus();
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">Security</h1>
      <p className="text-base text-ink">
        An authenticator app (such as Google Authenticator) makes a new 6-digit code on your phone every 30 seconds. It is free, and no SMS is
        sent.
      </p>

      {loadFailed && status === null && (
        <p role="alert" className={PROBLEM}>
          We couldn&apos;t load this. Check your connection and try again.
        </p>
      )}

      {status !== null && stage !== "codes" && (
        <p role="status" className="text-lg font-semibold text-ink">
          {status.enabled ? "The authenticator app is on." : "The authenticator app is off."}
        </p>
      )}

      {status !== null && !status.available && !status.enabled && (
        <p className="text-base text-ink">The authenticator app is not available yet.</p>
      )}

      {status !== null && stage === "idle" && !status.enabled && status.available && (
        <button type="button" onClick={() => go("password")} className={buttonClasses("primary")}>
          Set up the authenticator app
        </button>
      )}

      {status !== null && stage === "idle" && status.enabled && (
        <div className="flex flex-col gap-3">
          <p className="text-base text-ink">Backup codes left: {status.backup_codes_left}</p>
          <button type="button" onClick={() => go("renew")} className={buttonClasses("secondary")}>
            Get new backup codes
          </button>
          <button type="button" onClick={() => go("disable")} className={buttonClasses("secondary")}>
            Switch it off
          </button>
        </div>
      )}

      {stage === "password" && (
        <form onSubmit={start} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="security-password" className="text-base font-semibold text-ink">
              Your password
            </label>
            <PasswordField id="security-password" autoComplete="current-password" value={password} onChange={setPassword} />
          </div>
          {problem && (
            <p role="alert" className={PROBLEM}>
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Making the code…" : "Show the QR code"}
          </button>
          <button type="button" onClick={() => go("idle")} className={LINK_BUTTON}>
            Cancel
          </button>
        </form>
      )}

      {stage === "scan" && setup && (
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <p className="text-base text-ink">Open your authenticator app, add an account, and scan this picture.</p>
          {/* A plain <img>: a picture made in the browser, not a file of ours, so there is nothing for next/image to optimise. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.picture} alt="QR code to scan with your authenticator app" width={240} height={240} className="self-center" />
          <p className="text-base text-ink">Can&apos;t scan? Type this key into the app:</p>
          <p className="break-words font-mono text-lg font-semibold text-ink">{groupsOfFour(setup.secret)}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="security-first-code" className="text-base font-semibold text-ink">
              6-digit code from the app
            </label>
            <input
              id="security-first-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH + 1}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              className={`${FIELD} tracking-widest`}
            />
          </div>
          {problem && (
            <p role="alert" className={PROBLEM}>
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Checking…" : "Switch it on"}
          </button>
          <button type="button" onClick={() => { setSetup(null); go("idle"); }} className={LINK_BUTTON}>
            Cancel
          </button>
        </form>
      )}

      {stage === "codes" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-forest">Your backup codes</h2>
          <p className="text-base text-ink">
            Each code works once, if you lose your phone. They are shown only this once: copy them, print them or write them down, and keep
            them safe.
          </p>
          {renewed && <p className="text-base font-semibold text-ink">The old codes no longer work.</p>}
          <ul aria-label="Backup codes" className="grid grid-cols-2 gap-2 font-mono text-lg font-semibold text-ink">
            {codes.map((backup) => (
              <li key={backup}>{backup}</li>
            ))}
          </ul>
          {notice && (
            <p role="status" className="text-base text-ink">
              {notice}
            </p>
          )}
          <button type="button" onClick={() => void copyCodes()} className={buttonClasses("secondary")}>
            Copy the codes
          </button>
          <button type="button" onClick={() => window.print()} className={buttonClasses("secondary")}>
            Print the codes
          </button>
          <button type="button" onClick={savedThem} className={buttonClasses("primary")}>
            I have saved them
          </button>
        </div>
      )}

      {(stage === "renew" || stage === "disable") && (
        <form onSubmit={stage === "renew" ? renew : switchOff} className="flex flex-col gap-3">
          <p className="text-base text-ink">
            {stage === "renew" ? "The old backup codes will stop working." : "Your login will use an SMS code again."}
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="security-password" className="text-base font-semibold text-ink">
              Your password
            </label>
            <PasswordField id="security-password" autoComplete="current-password" value={password} onChange={setPassword} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="security-code" className="text-base font-semibold text-ink">
              A code from your app, or a backup code
            </label>
            <input
              id="security-code"
              type="text"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={FIELD}
            />
          </div>
          {problem && (
            <p role="alert" className={PROBLEM}>
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Checking…" : stage === "renew" ? "Make new codes" : "Yes, switch it off"}
          </button>
          <button type="button" onClick={() => go("idle")} className={LINK_BUTTON}>
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
