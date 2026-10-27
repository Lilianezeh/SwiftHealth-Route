"use client";

/** The SwiftRescue contacts screen (editor and admin): every group, every status, with Add, Edit and Remove.
 * Requirements: FR-15, FR-19, FR-31, FR-32, NFR-10. UI spec 3.13; api-spec section 5, "SwiftRescue contacts for staff".
 * Add and Edit go to the listing editor (a new contact is a draft that is verified and published like any listing). Remove is
 * hiding with a reason, after a question: nothing is deleted, and the card stays with its Edit link. The API's own sentence is
 * shown when a call is refused. No phone number is made up here: the screen shows what the database holds.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useStaff } from "@/components/admin/StaffGate";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ResultsSkeleton } from "@/components/search/ResultsSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { hideListing, listEmergencyContacts } from "@/lib/api/staff";
import { formatPhoneForReading } from "@/lib/formatters/phone";
import { sentenceFor } from "@/lib/staff/accountText";
import type { EmergencyContactGroups, StaffListingSummary } from "@/types/staff";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink";
const REASON_MIN = 3;
const REASON_MAX = 200;

type CardProps = {
  contact: StaffListingSummary;
  onRemoved: (contact: StaffListingSummary) => void;
  onProblem: (sentence: string) => void;
};

function ContactCard({ contact, onRemoved, onProblem }: CardProps) {
  const { call } = useStaff();
  const [step, setStep] = useState<"idle" | "reason" | "confirm">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = reason.trim();

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await call((token) => hideListing(token, contact.id, trimmed));
      setStep("idle");
      setReason("");
      onRemoved(contact);
    } catch (error) {
      onProblem(sentenceFor(error));
      setStep("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <p className="text-lg font-bold text-forest">{contact.name}</p>
      <p className="text-base text-ink-soft">{contact.area}</p>
      <div>
        <StatusBadge status={contact.status} />
      </div>
      {contact.primary_phone && <p className="text-base text-ink">{formatPhoneForReading(contact.primary_phone)}</p>}

      {step === "idle" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href={`/admin/listings/${contact.id}`} prefetch={false} aria-label={`Edit ${contact.name}`} className={buttonClasses("secondary")}>
            Edit
          </Link>
          {contact.status !== "hidden" && (
            <button type="button" onClick={() => setStep("reason")} aria-label={`Remove ${contact.name}`} className={buttonClasses("secondary")}>
              Remove
            </button>
          )}
        </div>
      )}

      {step === "reason" && (
        <div className="flex flex-col gap-2">
          <label htmlFor={`remove-reason-${contact.id}`} className="text-base font-semibold text-ink">
            Why is it removed?
          </label>
          <input
            id={`remove-reason-${contact.id}`}
            value={reason}
            maxLength={REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            className={FIELD}
          />
          {trimmed.length < REASON_MIN && <p className="text-base text-ink-soft">Write why first.</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStep("confirm")}
              disabled={trimmed.length < REASON_MIN}
              className={`${buttonClasses("primary")} disabled:opacity-60`}
            >
              Remove from SwiftRescue
            </button>
            <button type="button" onClick={() => setStep("idle")} className={buttonClasses("secondary")}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-2">
          <p className="text-base font-semibold text-ink">{`Remove ${contact.name} from SwiftRescue? It will be hidden, not deleted.`}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void remove()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
              {busy ? "Removing…" : "Yes, remove"}
            </button>
            <button type="button" onClick={() => setStep("idle")} className={buttonClasses("secondary")}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function EmergencyContacts() {
  const { call } = useStaff();
  const [data, setData] = useState<EmergencyContactGroups | null>(null);
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    call((token) => listEmergencyContacts(token))
      .then((answer) => {
        if (!isCurrent) return;
        setData(answer);
        setLoad("ready");
      })
      .catch(() => {
        if (isCurrent) setLoad("error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, attempt]);

  const removed = useCallback((contact: StaffListingSummary) => {
    setProblem(null);
    setNotice(`${contact.name} was removed from SwiftRescue. It is hidden, not deleted.`);
    setData((current) =>
      current && {
        groups: current.groups.map((group) => ({
          ...group,
          contacts: group.contacts.map((item) => (item.id === contact.id ? { ...item, status: "hidden" as const } : item)),
        })),
      },
    );
  }, []);

  const refused = useCallback((sentence: string) => {
    setNotice(null);
    setProblem(sentence);
  }, []);

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-forest">SwiftRescue contacts</h1>
        <p className="text-base text-ink">
          These are the contacts people see in SwiftRescue, by group. 112 is always first and is not listed here. A new contact appears in
          SwiftRescue after our team has verified and published it.
        </p>
      </header>
      {notice && <p role="status" className="text-base font-semibold text-ink">{notice}</p>}
      {problem && <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>}

      {load === "loading" && (
        <div aria-busy="true">
          <ResultsSkeleton />
        </div>
      )}
      {load === "error" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      )}
      {load === "ready" &&
        data?.groups.map((group) => (
          <section key={group.category.slug} aria-labelledby={`group-${group.category.slug}`} className="flex flex-col gap-3">
            <h2 id={`group-${group.category.slug}`} className="text-xl font-bold text-forest">
              {`${group.category.name} (${group.total})`}
            </h2>
            {group.contacts.length === 0 && <p className="text-base text-ink">No contacts in this group yet.</p>}
            {group.contacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} onRemoved={removed} onProblem={refused} />
            ))}
            <Link
              href={`/admin/listings/new?category=${group.category.slug}`}
              prefetch={false}
              className={buttonClasses("secondary")}
            >
              {`Add a contact to ${group.category.name}`}
            </Link>
          </section>
        ))}
    </section>
  );
}
