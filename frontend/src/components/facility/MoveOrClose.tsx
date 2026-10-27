"use client";

/** "Moved to a new address?", "Closed for good?" and the address history of a facility. Requirements: FR-53, US-20, NFR-10.
 * UI spec 3.11; api-spec 7, "Phase 8a". Used under the staff editor (editor and admin) and on "Edit my facility" (a provider).
 * Both actions ask first and show the API's own sentence when they are refused. A move hides the listing until it is re-checked,
 * a closing hides it for good; nothing is ever deleted. The parent may be told of a change (`onChanged`) to show the new status.
 * Staff see who made each change; the API sends no names to a provider.
 */
import { useCallback, useEffect, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import {
  closeListing,
  getAddressHistory,
  moveListingAddress,
  type AddressHistoryItem,
} from "@/lib/api/listingChanges";
import { ApiError } from "@/lib/api/request";
import { formatLagosDateTime } from "@/lib/formatters/dates";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
const SECTION = "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4";
const ALERT = "rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink";
const FIELD_NAMES = { address: "Address", area: "Area", landmark: "Landmark" } as const;
const REASON_MIN = 3;
const REASON_MAX = 200;

type Props = {
  listingId: number;
  listingName: string;
  current: { address: string; area: string; landmark: string | null };
  closedReason: string | null;
  isClosed: boolean;
  isStaff: boolean;
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  /** Called after a move or a closing succeeded, so the page can show the new status (optional). */
  onChanged?: () => void;
};

function sentenceFor(error: unknown, whenForbidden: string): string {
  if (error instanceof ApiError && error.status === 403) return whenForbidden;
  if (error instanceof ApiError && error.detail) return error.detail;
  return "We couldn't do that. Check your connection and try again.";
}

export function MoveOrClose({ listingId, listingName, current, closedReason, isClosed, isStaff, call, onChanged }: Props) {
  const { meta } = useMeta();
  // What the facility has now, kept here after a move so the form does not offer the same move again.
  const [baseline, setBaseline] = useState(current);
  const [closedHere, setClosedHere] = useState(false);
  const [address, setAddress] = useState(current.address);
  const [area, setArea] = useState(current.area);
  const [landmark, setLandmark] = useState(current.landmark ?? "");
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState<"move" | "close" | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<AddressHistoryItem[] | null>(null);

  const loadHistory = useCallback(() => {
    call((token) => getAddressHistory(token, listingId))
      .then(setHistory)
      .catch(() => setHistory(null));
  }, [call, listingId]);

  useEffect(loadHistory, [loadHistory]);

  const changed =
    address.trim() !== baseline.address || area !== baseline.area || landmark.trim() !== (baseline.landmark ?? "");
  const addressOk = address.trim().length >= 3;

  async function runMove() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await call((token) =>
        moveListingAddress(token, listingId, { address, area, landmark: landmark.trim() === "" ? null : landmark }),
      );
      const pinSentence = result.pin_needs_setting
        ? isStaff
          ? " Set the map pin in the form above."
          : " Our team will set the map pin when they re-check it."
        : "";
      setNotice(`${result.message}${pinSentence}`);
      setBaseline({ address: address.trim(), area, landmark: landmark.trim() === "" ? null : landmark.trim() });
      setAsking(null);
      loadHistory();
      onChanged?.();
    } catch (error) {
      setProblem(sentenceFor(error, "You cannot move this facility."));
      setAsking(null);
    } finally {
      setBusy(false);
    }
  }

  async function runClose() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await call((token) => closeListing(token, listingId, reason));
      setNotice(`${listingName} is closed. It is hidden from the public, and nothing was deleted.`);
      setClosedHere(true);
      setAsking(null);
      loadHistory();
      onChanged?.();
    } catch (error) {
      setProblem(sentenceFor(error, "Only the owner of a facility can close it."));
      setAsking(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && <p role="status" className="text-base font-semibold text-ink">{notice}</p>}
      {problem && <p role="alert" className={ALERT}>{problem}</p>}

      {isClosed || closedHere ? (
        <section className={SECTION}>
          <h2 className="text-xl font-bold text-forest">This facility is closed.</h2>
          {isStaff && (closedReason ?? (closedHere ? reason.trim() : null)) && (
            <p className="text-base text-ink">{`Reason: ${closedReason ?? reason.trim()}`}</p>
          )}
          {isStaff && <p className="text-base text-ink">An editor or admin can reopen it with the Reopen button.</p>}
        </section>
      ) : (
        <>
          <section id="move" aria-labelledby="move-heading" className={SECTION}>
            <h2 id="move-heading" className="text-xl font-bold text-forest">Moved to a new address?</h2>
            <div className="flex flex-col gap-1">
              <label htmlFor="move-address" className="text-base font-semibold text-ink">New address</label>
              <input id="move-address" value={address} onChange={(event) => setAddress(event.target.value)} className={FIELD} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="move-area" className="text-base font-semibold text-ink">New area</label>
              <select id="move-area" value={area} onChange={(event) => setArea(event.target.value)} className={FIELD}>
                {meta?.areas.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {meta && !meta.areas.includes(area) && <option value={area}>{area}</option>}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="move-landmark" className="text-base font-semibold text-ink">Landmark (optional)</label>
              <input id="move-landmark" value={landmark} maxLength={200} onChange={(event) => setLandmark(event.target.value)} className={FIELD} />
            </div>
            {asking === "move" ? (
              <div className="flex flex-col gap-2">
                <p className="text-base font-semibold text-ink">
                  {`Move ${listingName}? It will be hidden from the public until our team re-checks it.`}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => void runMove()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
                    {busy ? "Moving…" : "Yes, move it"}
                  </button>
                  <button type="button" onClick={() => setAsking(null)} className={buttonClasses("secondary")}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {!changed && <p className="text-base text-ink-soft">Change the address, area or landmark first.</p>}
                <button
                  type="button"
                  onClick={() => setAsking("move")}
                  disabled={!changed || !addressOk}
                  className={`${buttonClasses("primary")} disabled:opacity-60`}
                >
                  Save the new address
                </button>
              </>
            )}
          </section>

          <section id="close" aria-labelledby="close-heading" className={SECTION}>
            <h2 id="close-heading" className="text-xl font-bold text-forest">Closed for good?</h2>
            <div className="flex flex-col gap-1">
              <label htmlFor="close-reason" className="text-base font-semibold text-ink">Why is it closing?</label>
              <input id="close-reason" value={reason} maxLength={REASON_MAX} onChange={(event) => setReason(event.target.value)} className={FIELD} />
            </div>
            {asking === "close" ? (
              <div className="flex flex-col gap-2">
                <p className="text-base font-semibold text-ink">
                  {`Close ${listingName} for good? It will be hidden from the public. Nothing is deleted, and our team can reopen it.`}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => void runClose()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
                    {busy ? "Closing…" : "Yes, close it"}
                  </button>
                  <button type="button" onClick={() => setAsking(null)} className={buttonClasses("secondary")}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {reason.trim().length < REASON_MIN && <p className="text-base text-ink-soft">Write why it is closing first.</p>}
                <button
                  type="button"
                  onClick={() => setAsking("close")}
                  disabled={reason.trim().length < REASON_MIN}
                  className={`${buttonClasses("secondary")} disabled:opacity-60`}
                >
                  Close this facility
                </button>
              </>
            )}
          </section>
        </>
      )}

      <section aria-labelledby="history-heading" className={SECTION}>
        <h2 id="history-heading" className="text-xl font-bold text-forest">Address history</h2>
        {history !== null && history.length === 0 && <p className="text-base text-ink">No changes yet.</p>}
        {history !== null && history.length > 0 && (
          <ul className="flex flex-col gap-2">
            {history.map((item, index) => (
              <li key={`${item.changed_at}-${item.field}-${index}`} className="text-base text-ink">
                {`${formatLagosDateTime(item.changed_at)}: ${FIELD_NAMES[item.field]} ${item.old_value ?? "none"} to ${item.new_value ?? "none"}`}
                {isStaff && item.by ? ` (by ${item.by})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
