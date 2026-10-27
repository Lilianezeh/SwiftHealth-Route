"use client";

/** The "All accounts" tab: every account, with filters and pages. Requirements: FR-41, FR-55, US-18, NFR-10.
 * UI spec 3.8 (accounts phase 4b). The filters (role, state, search text) are sent to the API (`GET /admin/users`), which
 * answers one page of 50 and the number of accounts that match in all. Changing a filter starts again from the first page.
 * The list is read again every time this tab is opened and when an account was added, so it never shows an old state.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AccountRow } from "@/components/admin/AccountRow";
import { useStaff } from "@/components/admin/StaffGate";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { listAdminUsers } from "@/lib/api/staff";
import { ROLE_LABELS } from "@/lib/staff/accountText";
import type { AdminUserQuery, AdminUserRow, StaffRole } from "@/types/staff";

const PAGE_SIZE = 50;
const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
const ROLES: StaffRole[] = ["admin", "editor", "verifier", "provider"];

/** The choices of "Filter by state", and what each one asks the API for. */
const STATES: { label: string; query: Pick<AdminUserQuery, "approval_status" | "is_active"> }[] = [
  { label: "Any", query: {} },
  { label: "Active", query: { is_active: true } },
  { label: "Suspended", query: { is_active: false } },
  { label: "Waiting for approval", query: { approval_status: "pending" } },
  { label: "Not approved", query: { approval_status: "rejected" } },
];

type Props = { reloadKey: number };

export function AllAccounts({ reloadKey }: Props) {
  const { session, call } = useStaff();
  const [role, setRole] = useState<StaffRole | "">("");
  const [stateLabel, setStateLabel] = useState("Any");
  const [typed, setTyped] = useState("");
  const [searchText, setSearchText] = useState("");
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    const stateQuery = STATES.find((state) => state.label === stateLabel)?.query ?? {};
    const query: AdminUserQuery = { ...stateQuery, limit: PAGE_SIZE, offset };
    if (role) query.role = role;
    if (searchText) query.q = searchText;
    call((token) => listAdminUsers(token, query))
      .then((list) => {
        if (!isCurrent) return;
        setUsers(list.items);
        setTotal(list.total);
        setLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, role, stateLabel, searchText, offset, attempt, reloadKey]);

  const replaceUser = useCallback((saved: AdminUserRow) => {
    setUsers((current) => current.map((user) => (user.id === saved.id ? saved : user)));
  }, []);

  function search(event: FormEvent) {
    event.preventDefault();
    setSearchText(typed.trim());
    setOffset(0);
  }

  const first = offset + 1;
  const last = offset + users.length;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-role" className="text-base font-semibold text-ink">Filter by role</label>
          <select
            id="filter-role"
            value={role}
            onChange={(event) => { setRole(event.target.value as StaffRole | ""); setOffset(0); }}
            className={FIELD}
          >
            <option value="">Any</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>{ROLE_LABELS[value]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-state" className="text-base font-semibold text-ink">Filter by state</label>
          <select
            id="filter-state"
            value={stateLabel}
            onChange={(event) => { setStateLabel(event.target.value); setOffset(0); }}
            className={FIELD}
          >
            {STATES.map((state) => (
              <option key={state.label} value={state.label}>{state.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor="filter-search" className="text-base font-semibold text-ink">Search</label>
          <input id="filter-search" value={typed} onChange={(event) => setTyped(event.target.value)} maxLength={100} className={FIELD} />
        </div>
        <button type="submit" className={`${buttonClasses("secondary")} sm:col-span-2 sm:w-auto sm:justify-self-start sm:px-6`}>
          Search
        </button>
      </form>

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
      {load === "ready" && users.length === 0 && <p className="text-base text-ink">No accounts match these filters.</p>}
      {load === "ready" && users.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {users.map((user) => (
              <AccountRow key={user.id} user={user} isMe={user.id === session.user.id} onSaved={replaceUser} />
            ))}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className="text-base text-ink">{`Showing ${first} to ${last} of ${total}`}</p>
            <div className="grid grid-cols-2 gap-3 sm:w-72">
              <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
                Previous
              </button>
              <button type="button" disabled={last >= total} onClick={() => setOffset(offset + PAGE_SIZE)} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
