"use client";

/** The staff accounts screen (admin only): approve staff sign-ups, the list of all accounts, adding a user. Requirements: FR-41,
 * FR-49, FR-55, US-18, NFR-06, NFR-07, NFR-10. UI spec 3.8 and "Phase 10 details"; decision C10 in
 * specs/2026-10-20-staff-screens/requirements.md; accounts phase 4b in specs/2026-10-23-accounts-and-facility-ownership/.
 * Two tabs: "Waiting for approval (N)" (the staff sign-ups to decide on) and "All accounts" (the default, with filters). The
 * number comes from asking the API for the accounts that wait. A password is typed, sent once and dropped: it is never shown
 * again and never kept in a storage.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AllAccounts } from "@/components/admin/AllAccounts";
import { useStaff } from "@/components/admin/StaffGate";
import { WaitingForApproval } from "@/components/admin/WaitingForApproval";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { createAdminUser, listAdminUsers } from "@/lib/api/staff";
import { ROLE_LABELS, sentenceFor } from "@/lib/staff/accountText";
import { minPasswordLength } from "@/lib/staff/roles";
import type { AdminUserRow, StaffRole, StaffUser } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink disabled:bg-closed-bg";
const ROLES: StaffRole[] = ["verifier", "editor", "admin", "provider"];
const passwordTooShort = (role: StaffRole) => `The password needs at least ${minPasswordLength(role)} characters.`;
const WAITING_LIMIT = 200; // the API's largest page; a waiting list is never near it
const TAB = "inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border px-3 text-base font-semibold sm:flex-none sm:px-6";

function AddUserForm({ onAdded, onClose }: { onAdded: (user: StaffUser) => void; onClose: () => void }) {
  const { call } = useStaff();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("verifier");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < minPasswordLength(role)) {
      setProblem(passwordTooShort(role));
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const created = await call((token) =>
        createAdminUser(token, { name: name.trim(), email: email.trim(), phone: phone.trim(), role, password }),
      );
      onAdded(created); // the form closes: the password is dropped with it
    } catch (error) {
      setProblem(sentenceFor(error));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-xl font-bold text-forest">Add a user</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-name" className="text-base font-semibold text-ink">Name</label>
        <input id="new-name" value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-email" className="text-base font-semibold text-ink">Email</label>
        <input id="new-email" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} className={FIELD} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-phone" className="text-base font-semibold text-ink">Phone</label>
        <input id="new-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={FIELD} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-role" className="text-base font-semibold text-ink">Role</label>
        <select id="new-role" value={role} onChange={(event) => setRole(event.target.value as StaffRole)} className={FIELD}>
          {ROLES.map((value) => (
            <option key={value} value={value}>{ROLE_LABELS[value]}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-password" className="text-base font-semibold text-ink">{`Password (at least ${minPasswordLength(role)} characters)`}</label>
        <PasswordField id="new-password" autoComplete="new-password" value={password} onChange={setPassword} />
      </div>
      {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="submit" disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {busy ? "Adding…" : "Add this user"}
        </button>
        <button type="button" onClick={onClose} className={buttonClasses("secondary")}>
          Cancel
        </button>
      </div>
    </form>
  );
}

type Tab = "waiting" | "all";

export function StaffAccounts() {
  const { call } = useStaff();
  const [tab, setTab] = useState<Tab>("all");
  const [waiting, setWaiting] = useState<AdminUserRow[]>([]);
  const [waitingLoad, setWaitingLoad] = useState<"loading" | "ready" | "error">("loading");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // The accounts that wait: their number is on the tab and in words, and the first tab's cards are these.
  useEffect(() => {
    let isCurrent = true;
    setWaitingLoad("loading");
    call((token) => listAdminUsers(token, { approval_status: "pending", limit: WAITING_LIMIT }))
      .then((list) => {
        if (!isCurrent) return;
        setWaiting(list.items);
        setWaitingLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setWaitingLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, attempt]);

  const decided = useCallback((user: AdminUserRow, message: string) => {
    setWaiting((current) => current.filter((candidate) => candidate.id !== user.id));
    setNotice(message);
  }, []);

  const updated = useCallback((user: AdminUserRow) => {
    setWaiting((current) => current.map((candidate) => (candidate.id === user.id ? user : candidate)));
  }, []);

  const count = waiting.length;
  const waitingLabel = waitingLoad === "ready" ? `Waiting for approval (${count})` : "Waiting for approval";

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-forest">Staff and providers</h1>
        {!adding && (
          <button type="button" onClick={() => { setAdding(true); setNotice(null); }} className={`${buttonClasses("primary")} sm:w-auto sm:px-6`}>
            Add user
          </button>
        )}
      </div>
      {notice && <p role="status" className="text-base font-semibold text-ink">{notice}</p>}
      {adding && (
        <AddUserForm
          onAdded={(created) => {
            setAdding(false);
            setNotice(`${created.name} was added.`);
            setReloadKey((current) => current + 1); // the list asks again, so the new account is where the filters put it
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {waitingLoad === "ready" && count > 0 && (
        <p className="text-base font-semibold text-ink">{`${count} ${count === 1 ? "person is" : "people are"} waiting for approval.`}</p>
      )}

      <div role="tablist" aria-label="Accounts" className="flex gap-2">
        <button
          type="button"
          role="tab"
          id="tab-waiting"
          aria-selected={tab === "waiting"}
          aria-controls="panel-accounts"
          onClick={() => setTab("waiting")}
          className={`${TAB} ${tab === "waiting" ? "border-pine bg-pine text-white" : "border-pine bg-surface text-forest"}`}
        >
          {waitingLabel}
        </button>
        <button
          type="button"
          role="tab"
          id="tab-all"
          aria-selected={tab === "all"}
          aria-controls="panel-accounts"
          onClick={() => setTab("all")}
          className={`${TAB} ${tab === "all" ? "border-pine bg-pine text-white" : "border-pine bg-surface text-forest"}`}
        >
          All accounts
        </button>
      </div>

      <div role="tabpanel" id="panel-accounts" aria-labelledby={tab === "waiting" ? "tab-waiting" : "tab-all"} className="flex flex-col gap-4">
        {tab === "all" && <AllAccounts reloadKey={reloadKey} />}
        {tab === "waiting" && waitingLoad === "loading" && (
          <div aria-busy="true">
            <ResultsSkeleton />
          </div>
        )}
        {tab === "waiting" && waitingLoad === "error" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
            <button type="button" onClick={() => setAttempt((current) => current + 1)} className={buttonClasses("primary")}>Retry</button>
          </div>
        )}
        {tab === "waiting" && waitingLoad === "ready" && <WaitingForApproval users={waiting} onDecided={decided} onUpdated={updated} />}
      </div>
    </section>
  );
}
