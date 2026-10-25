"use client";

/** The staff accounts screen (admin only): the list, adding a user and editing one. Requirements: FR-41, NFR-06, NFR-07, NFR-10.
 * UI spec 3.8 and "Phase 10 details"; decision C10 in specs/2026-10-20-staff-screens/requirements.md.
 * A password is typed, sent once and dropped: it is never shown again and never kept in a storage. A PATCH carries only what
 * changed. An admin cannot deactivate themselves or give up their own admin role (the API refuses it too).
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { createAdminUser, listAdminUsers, updateAdminUser } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/request";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import { minPasswordLength } from "@/lib/staff/roles";
import type { AdminUserChanges, StaffRole, StaffUser } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink disabled:bg-closed-bg";
const ROLES: StaffRole[] = ["verifier", "editor", "admin", "provider"];
const ROLE_LABELS: Record<StaffRole, string> = { verifier: "Verifier", editor: "Editor", admin: "Admin", provider: "Provider" };
const passwordTooShort = (role: StaffRole) => `The password needs at least ${minPasswordLength(role)} characters.`;
const STAFF_NEEDS_NEW_PASSWORD = `To make a provider staff, type a new password of at least ${minPasswordLength("editor")} characters.`;

function sentenceFor(error: unknown): string {
  if (error instanceof ApiError && error.detail) return error.detail;
  if (error instanceof ApiError && error.status === 422) {
    return "Check the fields: the phone must look like 0803 123 4567 and the email must be an email address.";
  }
  return "We couldn't do that. Check your connection and try again.";
}

type RowProps = { user: StaffUser; isMe: boolean; onSaved: (user: StaffUser) => void };

function AccountRow({ user, isMe, onSaved }: RowProps) {
  const { call } = useStaff();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ? formatPhoneForReading(user.phone) : "");
  const [role, setRole] = useState<StaffRole>(user.role);
  const [active, setActive] = useState(user.is_active);
  const [password, setPassword] = useState("");
  const [listing, setListing] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const changes: AdminUserChanges = {};
  if (name.trim() !== user.name) changes.name = name.trim();
  if (phone.trim() !== (user.phone ? formatPhoneForReading(user.phone) : "")) changes.phone = phone.trim();
  if (role !== user.role) changes.role = role;
  if (active !== user.is_active) changes.is_active = active;
  if (password !== "") changes.password = password;
  if (role === "provider" && listing.trim() !== "") changes.listing_id = Number(listing);
  const nothingToSave = Object.keys(changes).length === 0;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (nothingToSave || busy) return;
    if (user.role === "provider" && role !== "provider" && changes.password === undefined) {
      setProblem(STAFF_NEEDS_NEW_PASSWORD); // a short provider password must never become a staff password (FR-56)
      return;
    }
    if (changes.password !== undefined && changes.password.length < minPasswordLength(role)) {
      setProblem(passwordTooShort(role));
      return;
    }
    if (changes.listing_id !== undefined && !Number.isInteger(changes.listing_id)) {
      setProblem("The listing number must be a whole number.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setMessage(null);
    try {
      const saved = await call((token) => updateAdminUser(token, user.id, changes));
      setPassword("");
      setListing("");
      onSaved(saved);
      setMessage(`${saved.name} was updated.`);
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
      <p className="text-lg font-bold text-forest">{user.name}</p>
      <p className="text-base text-ink-soft">{user.email}</p>
      <p className="text-base text-ink">
        {ROLE_LABELS[user.role]} · {user.is_active ? "Active" : "Deactivated"}
      </p>
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Edit ${user.name}`} className={`${buttonClasses("secondary")} sm:w-auto sm:self-start sm:px-6`}>
          Edit
        </button>
      )}
      {open && (
        <form onSubmit={save} className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`name-${user.id}`} className="text-base font-semibold text-ink">{`Name of ${user.name}`}</label>
            <input id={`name-${user.id}`} value={name} onChange={(event) => setName(event.target.value)} className={FIELD} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`phone-${user.id}`} className="text-base font-semibold text-ink">{`Phone of ${user.name}`}</label>
            <input id={`phone-${user.id}`} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={FIELD} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`role-${user.id}`} className="text-base font-semibold text-ink">{`Role of ${user.name}`}</label>
            <select id={`role-${user.id}`} value={role} disabled={isMe} onChange={(event) => setRole(event.target.value as StaffRole)} className={FIELD}>
              {ROLES.map((value) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
          </div>
          <label className="inline-flex min-h-12 items-center gap-3 text-base text-ink">
            <input type="checkbox" checked={active} disabled={isMe} onChange={(event) => setActive(event.target.checked)} aria-label={`${user.name} is active`} className="h-5 w-5 accent-pine" />
            Active
          </label>
          {isMe && <p className="text-base text-ink-soft">You cannot deactivate yourself or give up your own admin role.</p>}
          <div className="flex flex-col gap-1">
            <label htmlFor={`password-${user.id}`} className="text-base font-semibold text-ink">{`New password for ${user.name} (at least ${minPasswordLength(role)} characters)`}</label>
            <PasswordField id={`password-${user.id}`} autoComplete="new-password" value={password} onChange={setPassword} />
          </div>
          {role === "provider" && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`listing-${user.id}`} className="text-base font-semibold text-ink">{`Listing number for ${user.name}`}</label>
              <input id={`listing-${user.id}`} inputMode="numeric" value={listing} onChange={(event) => setListing(event.target.value.replace(/\D/g, ""))} className={FIELD} />
            </div>
          )}
          {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
          <button type="submit" disabled={nothingToSave || busy} aria-label={`Save ${user.name}`} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            {busy ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </li>
  );
}

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
    <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
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

export function StaffAccounts() {
  const { session, call } = useStaff();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    call((token) => listAdminUsers(token))
      .then((list) => {
        if (!isCurrent) return;
        setUsers(list.items);
        setLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, attempt]);

  const replaceUser = useCallback((saved: StaffUser) => {
    setUsers((current) => current.map((user) => (user.id === saved.id ? saved : user)));
  }, []);

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
            setUsers((current) => [...current, created]);
            setAdding(false);
            setNotice(`${created.name} was added.`);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {load === "loading" && (
        <div aria-busy="true">
          <ResultsSkeleton />
        </div>
      )}
      {load === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className={buttonClasses("primary")}>Retry</button>
        </div>
      )}
      {load === "ready" && (
        <ul className="flex flex-col gap-3">
          {users.map((user) => (
            <AccountRow key={user.id} user={user} isMe={user.id === session.user.id} onSaved={replaceUser} />
          ))}
        </ul>
      )}
    </section>
  );
}
