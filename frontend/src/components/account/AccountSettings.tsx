"use client";

/** The account screen `/account`: your details, a new email or phone, a new password, closing the account.
 * Requirements: FR-54, FR-56, NFR-06, NFR-10, US-21. UI spec 3.1d (accounts phase 5); api-spec 4d.
 * Every role opens it (the gate's "account" area). Each section is its own small form with its own button and message, and the
 * details at the top are read again from the API after a change, so what is shown is what is stored.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { ChangeContact } from "@/components/account/ChangeContact";
import { ChangePassword } from "@/components/account/ChangePassword";
import { CloseAccount } from "@/components/account/CloseAccount";
import { FIELD, FIELD_LABEL, PROBLEM, SECTION } from "@/components/account/accountStyles";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { changeName, getAccount } from "@/lib/api/account";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import { sentenceFor } from "@/lib/staff/accountText";
import type { AccountDetails } from "@/types/account";

function Details({ account, onChanged }: { account: AccountDetails; onChanged: (account: AccountDetails) => void }) {
  const { call, updateUser } = useStaff();
  const [name, setName] = useState(account.name);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (name.trim() === "") {
      setProblem("Type your name first.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const saved = await call((token) => changeName(token, name.trim()));
      onChanged(saved);
      updateUser({ name: saved.name }); // the staff bar shows it
      setName(saved.name);
      setMessage("Your name was saved.");
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="details-heading" className={SECTION}>
      <h2 id="details-heading" className="text-xl font-bold text-forest">Your details</h2>
      <p className="text-base text-ink">{account.email}</p>
      <p className="text-base text-ink-soft">{account.email_confirmed ? "Email confirmed" : "Email not confirmed yet"}</p>
      {account.phone && <p className="text-base text-ink">{formatPhoneForReading(account.phone)}</p>}
      <p className="text-base text-ink-soft">{account.phone_confirmed ? "Phone confirmed" : "Phone not confirmed yet"}</p>
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="account-name" className={FIELD_LABEL}>Name</label>
          <input id="account-name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
        </div>
        {problem && <p role="alert" className={PROBLEM}>{problem}</p>}
        <button type="submit" disabled={busy} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
          {busy ? "Saving…" : "Save name"}
        </button>
      </form>
    </section>
  );
}

export function AccountSettings() {
  const { call } = useStaff();
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    call((token) => getAccount(token))
      .then((details) => {
        if (!isCurrent) return;
        setAccount(details);
        setLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, attempt]);

  const changed = useCallback((details: AccountDetails) => setAccount(details), []);

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">My account</h1>
      {load === "loading" && (
        <div aria-busy="true">
          <ResultsSkeleton />
        </div>
      )}
      {load === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className={buttonClasses("primary")}>Retry</button>
        </div>
      )}
      {load === "ready" && account && (
        <>
          <Details account={account} onChanged={changed} />
          <ChangeContact kind="email" onChanged={changed} />
          <ChangeContact kind="phone" onChanged={changed} />
          <ChangePassword />
          <CloseAccount />
        </>
      )}
    </section>
  );
}
