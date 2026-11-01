"use client";

/** The owner requests screen (editor and admin): read every field of the request, phone the facility, write who answered, approve,
 * send it back with a note ("Request changes", owner form part (b)) or reject.
 * Requirements: FR-50, US-19, US-17, NFR-10. UI spec 3.10 (accounts phase 6b); api-spec 7, "Phase 6a"; decision D4.
 * One card per request: who asked, for which facility, as an owner or a manager, and the FACILITY's own phone numbers as `tel:`
 * links (the numbers staff phone, shown in the local form, kept international in the link). Approve needs the note (who was
 * reached) and asks first; reject takes the note if there is one and asks first. The API's own sentence is shown when a decision
 * is refused; the card leaves the list after a decision.
 */
import { useCallback, useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { OwnerRequestDetails } from "@/components/admin/OwnerRequestDetails";
import { approveOwnerRequest, listOwnerRequests, rejectOwnerRequest, requestOwnerChanges } from "@/lib/api/staff";
import { formatLagosDateTime } from "@/lib/formatters/dates";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import { sentenceFor } from "@/lib/staff/accountText";
import type { OwnerRequest } from "@/types/staff";

const NOTE_MAX_LENGTH = 300;
const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
const SECONDARY = `${buttonClasses("secondary")} disabled:opacity-60 sm:w-auto sm:px-6`;
const PRIMARY = `${buttonClasses("primary")} disabled:opacity-60 sm:w-auto sm:px-6`;
const PHONE_LINK = "inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4";

const roleWords = (role: OwnerRequest["role"]) => (role === "owner" ? "an owner" : "a manager");

type CardProps = { request: OwnerRequest; onDecided: (request: OwnerRequest, message: string) => void };

/** A rejection gives the owner's first payment back in full, automatically (owner fee). Said in words, or nothing if nothing was paid. */
function refundWords(refund: "done" | "pending" | null): string {
  if (refund === "done") return " Their payment is being given back in full.";
  if (refund === "pending") return " Their payment will be given back in full; the refund is not finished yet and will be tried again.";
  return "";
}

function RequestCard({ request, onDecided }: CardProps) {
  const { call } = useStaff();
  const [note, setNote] = useState("");
  const [changeNote, setChangeNote] = useState(""); // what the owner should change: not the same note as "who did you speak to"
  const [asking, setAsking] = useState<"approve" | "reject" | "changes" | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const { person, listing } = request;
  const trimmed = note.trim();
  const trimmedChange = changeNote.trim();

  async function run(action: "approve" | "reject" | "changes") {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (action === "approve") {
        await call((token) => approveOwnerRequest(token, request.id, trimmed));
        onDecided(request, `${person.name} was approved as ${roleWords(request.role)} of ${listing.name}.`);
      } else if (action === "changes") {
        await call((token) => requestOwnerChanges(token, request.id, trimmedChange));
        onDecided(request, `${person.name} was asked to change ${listing.name}. They will see your note.`);
      } else {
        const answer = await call((token) => rejectOwnerRequest(token, request.id, trimmed || undefined));
        onDecided(request, `${person.name} was rejected for ${listing.name}.${refundWords(answer.refund)}`);
      }
    } catch (error) {
      setProblem(sentenceFor(error));
      setAsking(null);
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <p className="text-lg font-bold text-forest">{person.name}</p>
      <p className="text-base text-ink-soft">{person.email}</p>
      {person.phone && <p className="text-base text-ink">{formatPhoneForReading(person.phone)}</p>}
      <p className="text-base font-semibold text-ink">{`Asked to be ${roleWords(request.role)}`}</p>
      <p className="text-base text-ink-soft">{`Asked on ${formatLagosDateTime(request.requested_at)}`}</p>
      <p className="mt-1 text-base font-bold text-forest">{listing.name}</p>
      <p className="text-base text-ink-soft">{listing.area}</p>
      {request.reason && <p className="text-base text-ink">{`Their reason: ${request.reason}`}</p>}
      <p className="text-base font-semibold text-ink">Phone the facility on:</p>
      <div className="flex flex-col">
        {listing.phones.map((phone) => (
          <a key={phone.number} href={`tel:${phone.number}`} className={PHONE_LINK}>
            {`${phone.label ? `${phone.label} ` : ""}${formatPhoneForReading(phone.number)}${phone.is_whatsapp ? " · WhatsApp" : ""}`}
          </a>
        ))}
      </div>
      <OwnerRequestDetails listing={listing} />
      {request.previous_change_note && (
        <p className="rounded-2xl border border-line bg-pine-50 p-3 text-base text-ink">{`Last time you asked: ${request.previous_change_note}`}</p>
      )}

      <div className="flex flex-col gap-1 border-t border-line pt-3">
        <label htmlFor={`note-${request.id}`} className="text-base font-semibold text-ink">
          {`Who did you speak to? (needed to approve) for ${person.name}`}
        </label>
        <input
          id={`note-${request.id}`}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={FIELD}
        />
        {trimmed === "" && <p className="text-base text-ink-soft">Write who you spoke to first.</p>}
      </div>

      {asking === null && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => setAsking("approve")} disabled={trimmed === ""} aria-label={`Approve ${person.name}`} className={PRIMARY}>
            Approve
          </button>
          <button type="button" onClick={() => setAsking("changes")} aria-label={`Request changes from ${person.name}`} className={SECONDARY}>
            Request changes
          </button>
          <button type="button" onClick={() => setAsking("reject")} aria-label={`Reject ${person.name}`} className={SECONDARY}>
            Reject
          </button>
        </div>
      )}
      {asking === "changes" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`changes-${request.id}`} className="text-base font-semibold text-ink">{`What should ${person.name} change?`}</label>
          <textarea
            id={`changes-${request.id}`}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            value={changeNote}
            onChange={(event) => setChangeNote(event.target.value)}
            className="w-full rounded-xl border border-line bg-surface p-3 text-base text-ink"
          />
          {trimmedChange === "" && <p className="text-base text-ink-soft">Write what the owner should change first.</p>}
        </div>
      )}
      {asking !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-ink">
            {asking === "approve" && `Approve ${person.name} as ${roleWords(request.role)} of ${listing.name}?`}
            {asking === "reject" && `Reject ${person.name} for ${listing.name}?`}
            {asking === "changes" && `Send ${listing.name} back to ${person.name} with your note?`}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void run(asking)} disabled={busy || (asking === "changes" && trimmedChange === "")} className={PRIMARY}>
              {asking === "approve" && (busy ? "Approving…" : "Yes, approve")}
              {asking === "reject" && (busy ? "Rejecting…" : "Yes, reject")}
              {asking === "changes" && (busy ? "Sending…" : "Yes, send it back")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}
    </li>
  );
}

export function OwnerRequests() {
  const { call } = useStaff();
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    call((token) => listOwnerRequests(token))
      .then((answer) => {
        if (!isCurrent) return;
        setRequests(answer.items);
        setLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, attempt]);

  const decided = useCallback((request: OwnerRequest, message: string) => {
    setRequests((current) => current.filter((candidate) => candidate.id !== request.id));
    setNotice(message);
  }, []);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Owner requests</h1>
      {notice && <p role="status" className="text-base font-semibold text-ink">{notice}</p>}
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
      {load === "ready" && requests.length === 0 && <p className="text-base text-ink">Nobody is waiting for a phone call.</p>}
      {load === "ready" && requests.length > 0 && (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onDecided={decided} />
          ))}
        </ul>
      )}
    </section>
  );
}
