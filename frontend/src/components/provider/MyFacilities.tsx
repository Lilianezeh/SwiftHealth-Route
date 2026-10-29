"use client";

/** "My facilities" on the provider's page: every link with its role, its state in words and the monthly owner fee. Requirements:
 * FR-50, US-19, NFR-10. UI spec 4.2b and 4.2c; api-spec 7 and 8; specs/2026-10-29-owner-fee/.
 *
 * Listing is free; the fee pays for managing (editing, moves, closures, branches, Featured). A request is sent to our team only after the
 * first month is paid. The edit link shows while the paid month, the grace days, or a cancelled link's paid month last. Paying again
 * brings editing back at once. Stopping (or withdrawing) asks first; the listing itself always stays public and free. The fee and the
 * grace days are the API's; nothing about a facility the person has no link to is read or shown. If the list cannot be loaded, or there
 * is none, this draws nothing and the page works as before.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { PayOwnerFee } from "@/components/provider/PayOwnerFee";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { cancelLink, listMyFacilities } from "@/lib/api/provider";
import { formatNoticeDate } from "@/lib/formatters/dates";
import { formatNaira } from "@/lib/formatters/fees";
import type { LinkCancelled, MyFacility, MyFacilityList } from "@/types/staff";

const ROLE_WORDS: Record<MyFacility["role"], string> = { owner: "Owner", manager: "Manager" };
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SECONDARY_BUTTON = `${buttonClasses("secondary")} sm:w-auto sm:self-start sm:px-6`;

/** The date `days` after an ISO date, as an ISO date (the end of the grace days). */
function plusDays(isoDate: string, days: number): string {
  return new Date(new Date(isoDate).getTime() + days * MILLISECONDS_PER_DAY).toISOString();
}

function stateWords(facility: MyFacility, graceDays: number): string {
  const until = facility.paid_until ? formatNoticeDate(facility.paid_until) : null;
  switch (facility.fee_state) {
    case "awaiting_payment":
      return "Not sent to our team yet. Pay the first month and our team will phone the facility to check your request.";
    case "waiting_for_staff":
      return "Paid. Waiting for staff to phone the facility.";
    case "paid":
      return `Approved. Paid until ${until}.`;
    case "grace":
      return `The paid month ended on ${until}. You can edit until ${facility.paid_until ? formatNoticeDate(plusDays(facility.paid_until, graceDays)) : ""}. Pay to keep managing.`;
    case "lapsed":
      return "Editing is paused because the month was not paid. Your listing is still public and free. Pay to edit again.";
    case "ending":
      return `You stopped managing this facility. You can edit until ${until}.`;
    default:
      return "Removed.";
  }
}

/** The words of the question before stopping, and of its two buttons. */
function askWords(facility: MyFacility): { question: string; yes: string } {
  const until = facility.paid_until ? formatNoticeDate(facility.paid_until) : "";
  switch (facility.fee_state) {
    case "waiting_for_staff":
      return { question: `Withdraw your request for ${facility.name}? Your payment will be given back in full.`, yes: "Yes, withdraw" };
    case "awaiting_payment":
      return { question: `Withdraw your request for ${facility.name}? Nothing has been paid.`, yes: "Yes, withdraw" };
    case "paid":
      return {
        question: `Stop managing ${facility.name}? You can still edit until ${until}. The month you paid is not refunded. Your listing stays public and free.`,
        yes: "Yes, stop managing",
      };
    default:
      return {
        question: `Stop managing ${facility.name}? Editing stops now and nothing more is due. Your listing stays public and free.`,
        yes: "Yes, stop managing",
      };
  }
}

function resultWords(answer: LinkCancelled): string {
  if (answer.status === "ending" && answer.access_until) {
    return `You stopped managing this facility. You can edit until ${formatNoticeDate(answer.access_until)}.`;
  }
  if (answer.refund === "done") return "Your request was withdrawn. Your payment is being given back in full.";
  if (answer.refund === "pending") {
    return "Your request was withdrawn. Your payment will be given back in full; the refund is not finished yet and we will try again.";
  }
  return "You stopped managing this facility.";
}

type CardProps = { facility: MyFacility; fee: string | null; graceDays: number };

function FacilityCard({ facility, fee, graceDays }: CardProps) {
  const { call } = useStaff();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const state = facility.fee_state;
  const canEdit = state === "paid" || state === "grace" || state === "ending";
  const price = fee ?? "the monthly fee";
  const payLabel: Record<string, string> = {
    awaiting_payment: `Pay ${price} to send your request`,
    paid: `Pay ${price} for next month`,
    grace: `Pay ${price} for next month`,
    lapsed: `Pay ${price} to edit again`,
    ending: `Pay ${price} to keep managing`,
  };
  const canStop = state === "awaiting_payment" || state === "waiting_for_staff" || state === "paid" || state === "grace" || state === "lapsed";
  const stopLabel = state === "awaiting_payment" || state === "waiting_for_staff" ? "Withdraw my request" : "Stop managing";
  const words = askWords(facility);

  async function stop() {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const answer = await call((token) => cancelLink(token, facility.link_id));
      setResult(resultWords(answer));
    } catch {
      setProblem("We could not do that. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <p className="text-lg font-bold text-forest">{facility.name}</p>
      <p className="text-base text-ink-soft">{`${facility.category.name} · ${facility.area} · ${ROLE_WORDS[facility.role]}`}</p>
      {result === null ? (
        <>
          <p className="text-base font-semibold text-ink">{stateWords(facility, graceDays)}</p>
          {canEdit && (
            <Link href={`/provider/edit?listing=${facility.listing_id}`} prefetch={false} className={SECONDARY_BUTTON}>
              Edit this facility
            </Link>
          )}
          {payLabel[state] && (
            <PayOwnerFee
              call={call}
              linkId={facility.link_id}
              label={payLabel[state]}
              variant={state === "awaiting_payment" || state === "lapsed" ? "primary" : "secondary"}
            />
          )}
          {canStop && !asking && (
            <button type="button" onClick={() => setAsking(true)} className={SECONDARY_BUTTON}>
              {stopLabel}
            </button>
          )}
          {asking && (
            <div className="flex flex-col gap-2 rounded-2xl border border-line bg-pine-50 p-4">
              <p className="text-base text-ink">{words.question}</p>
              <button type="button" onClick={() => void stop()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
                {words.yes}
              </button>
              <button type="button" onClick={() => setAsking(false)} disabled={busy} className={buttonClasses("secondary")}>
                Keep managing
              </button>
              {problem && (
                <p role="alert" className="text-base font-semibold text-amber-ink">
                  {problem}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-base font-semibold text-ink">
          {result}
        </p>
      )}
    </li>
  );
}

export function MyFacilities() {
  const { call } = useStaff();
  const [list, setList] = useState<MyFacilityList | null>(null);

  useEffect(() => {
    let isCurrent = true;
    call((token) => listMyFacilities(token))
      .then((answer) => {
        if (isCurrent) setList(answer);
      })
      .catch(() => undefined); // the section is an extra: without it the page still works
    return () => {
      isCurrent = false;
    };
  }, [call]);

  if (list === null || list.items.length === 0) return null;
  const fee = formatNaira(list.fee_naira);

  return (
    <section aria-labelledby="my-facilities-heading" className="flex flex-col gap-3">
      <h2 id="my-facilities-heading" className="text-xl font-bold text-forest">My facilities</h2>
      <p className="text-base text-ink-soft">
        {`Being listed is free. ${fee ?? "A monthly fee"} a month pays for managing your listing: editing, moves, closures and branches.`}
      </p>
      <ul className="flex flex-col gap-3">
        {list.items.map((facility) => (
          <FacilityCard key={facility.link_id} facility={facility} fee={fee} graceDays={list.grace_days} />
        ))}
      </ul>
    </section>
  );
}
