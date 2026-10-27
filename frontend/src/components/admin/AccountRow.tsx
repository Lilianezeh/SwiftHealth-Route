"use client";

/** One account in the "All accounts" tab: who, role, state, last login, Suspend or Reactivate, and the edit form.
 * Requirements: FR-41, FR-55, NFR-06, NFR-07, NFR-10. UI spec 3.8 and "Phase 10 details"; decision C10 in
 * specs/2026-10-20-staff-screens/requirements.md; accounts phase 4b.
 * A password is typed, sent once and dropped: it is never shown again and never kept in a storage. A PATCH carries only what
 * changed. An admin cannot deactivate themselves or give up their own admin role (the API refuses it too). An account that waits
 * for approval is decided in the other tab.
 */
import { useState, type FormEvent } from "react";

import { AccountStateActions } from "@/components/admin/AccountStateActions";
import { useStaff } from "@/components/admin/StaffGate";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { PasswordField } from "@/components/ui/PasswordField";
import { updateAdminUser } from "@/lib/api/staff";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import { lastLoginWords, ROLE_LABELS, sentenceFor, stateWords } from "@/lib/staff/accountText";
import { minPasswordLength } from "@/lib/staff/roles";
import type { AdminUserChanges, AdminUserRow, StaffRole } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink disabled:bg-closed-bg";
const ROLES: StaffRole[] = ["verifier", "editor", "admin", "provider"];
const passwordTooShort = (role: StaffRole) => `The password needs at least ${minPasswordLength(role)} characters.`;
const STAFF_NEEDS_NEW_PASSWORD = `To make a provider staff, type a new password of at least ${minPasswordLength("editor")} characters.`;

type RowProps = { user: AdminUserRow; isMe: boolean; onSaved: (user: AdminUserRow) => void };

export function AccountRow({ user, isMe, onSaved }: RowProps) {
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
  const waiting = user.approval_status === "pending";

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
      onSaved({ ...user, ...saved }); // the answer of a change has the usual fields only: keep the rest of the row
      setMessage(`${saved.name} was updated.`);
    } catch (error) {
      setProblem(sentenceFor(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <p className="text-lg font-bold text-forest">{user.name}</p>
      <p className="text-base text-ink-soft">{user.email}</p>
      <p className="text-base text-ink">
        {ROLE_LABELS[user.role]} · {stateWords(user)}
      </p>
      <p className="text-base text-ink-soft">{lastLoginWords(user)}</p>
      {waiting && <p className="text-base text-ink">Decide on it under Waiting for approval.</p>}
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      <AccountStateActions
        user={user}
        isMe={isMe}
        onChanged={(saved, text) => {
          onSaved({ ...user, ...saved });
          setActive(saved.is_active);
          setMessage(text);
        }}
      />
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
