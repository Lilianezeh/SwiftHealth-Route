"use client";

/** The activity log (admin only): who did what and when. Requirements: FR-55, FR-38, US-18, NFR-10.
 * UI spec 3.8b (accounts phase 4b); api-spec section 11, "Phase 4a", `GET /admin/activity`.
 * Newest first, 50 an entry page, filtered by person, kind of action and days (sent to the API, which includes both days). Each
 * entry is one sentence, the time in Lagos, the account or listing it was about, and the change as stored. A change of filter starts
 * again from the first page. The API never sends the Paystack reference, so nothing here can show it.
 */
import { useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { listActivity, listAdminUsers } from "@/lib/api/staff";
import { formatLagosDateTime } from "@/lib/formatters/dates";
import { ACTION_CHOICES, actionWords } from "@/lib/staff/accountText";
import type { ActivityItem, ActivityQuery, StaffUser } from "@/types/staff";

const PAGE_SIZE = 50;
const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";

function EntryCard({ entry }: { entry: ActivityItem }) {
  const who = entry.user_name ?? "The system";
  const change = entry.field_changed
    ? `${entry.field_changed}: ${entry.old_value !== null ? `${entry.old_value} → ` : ""}${entry.new_value ?? ""}`
    : null;
  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-4">
      <p className="text-lg font-bold text-forest">{`${who} ${actionWords(entry.action)}`}</p>
      <p className="text-base text-ink-soft">{formatLagosDateTime(entry.at)}</p>
      {entry.target_user_name && <p className="text-base text-ink">{`About: ${entry.target_user_name}`}</p>}
      {entry.listing_name && <p className="text-base text-ink">{`Listing: ${entry.listing_name}`}</p>}
      {change && <p className="text-base text-ink">{change}</p>}
    </li>
  );
}

export function ActivityLog() {
  const { call } = useStaff();
  const [people, setPeople] = useState<StaffUser[]>([]);
  const [personId, setPersonId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  // The accounts for the Person filter. If this fails the filter just offers Everyone: the log itself still works.
  useEffect(() => {
    let isCurrent = true;
    call((token) => listAdminUsers(token, { limit: 200 }))
      .then((list) => {
        if (isCurrent) setPeople(list.items);
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [call]);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    const query: ActivityQuery = { limit: PAGE_SIZE };
    if (personId) query.user_id = Number(personId);
    if (action) query.action = action;
    if (from) query.from = from;
    if (to) query.to = to;
    if (offset) query.offset = offset;
    call((token) => listActivity(token, query))
      .then((list) => {
        if (!isCurrent) return;
        setEntries(list.items);
        setTotal(list.total);
        setLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, personId, action, from, to, offset, attempt]);

  const first = offset + 1;
  const last = offset + entries.length;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Activity</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-person" className="text-base font-semibold text-ink">Person</label>
          <select id="activity-person" value={personId} onChange={(event) => { setPersonId(event.target.value); setOffset(0); }} className={FIELD}>
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-action" className="text-base font-semibold text-ink">What happened</label>
          <select id="activity-action" value={action} onChange={(event) => { setAction(event.target.value); setOffset(0); }} className={FIELD}>
            <option value="">Anything</option>
            {ACTION_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>{choice.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-from" className="text-base font-semibold text-ink">From</label>
          <input id="activity-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="activity-to" className="text-base font-semibold text-ink">To</label>
          <input id="activity-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} className={FIELD} />
        </div>
      </div>

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
      {load === "ready" && entries.length === 0 && <p className="text-base text-ink">Nothing matches these filters.</p>}
      {load === "ready" && entries.length > 0 && (
        <>
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
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
    </section>
  );
}
