"use client";

/** "Register a new facility", for a logged-in provider; also the form of a saved request (`saved`). Requirements: FR-50, FR-51, FR-23,
 * US-17, NFR-06, NFR-07, NFR-10. UI spec 2.9; decisions D14 and D15 in specs/2026-10-23-accounts-and-facility-ownership/requirements.md
 * and specs/2026-11-01-owner-form-fields/ (the full form, Save as draft, the fee words).
 *
 * The name, category, area, address and main phone number are required; everything else is optional. The values are checked in words
 * before the call (lib/facility/requestForm.ts; the API checks again). The contact details are the account's own, so the form does not
 * ask for them. "Save as draft" keeps the request with the owner (no payment, staff see nothing) and stays on the form; the next save
 * goes to the same request. "Send" asks for the first month, or, for a request that needed changes, puts it back in front of our team.
 * A 409 shows the API's sentence and, when the facility can be claimed, a button to ask to manage it. The page never asks for a position
 * and keeps nothing in the browser.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { CHOICE, FIELD, OpeningHours, OtherPhones, ServiceChoices } from "@/components/facility/RequestFields";
import { PayOwnerFee } from "@/components/provider/PayOwnerFee";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { brand } from "@/config/brand";
import { useMeta } from "@/hooks/useMeta";
import { useOwnerFee } from "@/hooks/useOwnerFee";
import { registerFacility, saveFacilityRequest, type SavedRequest } from "@/lib/api/facility";
import { ApiError } from "@/lib/api/request";
import { emptyRequestForm, formFromRead, MAX_DESCRIPTION, MAX_NOTES, problemsOf, toBody, type RequestForm } from "@/lib/facility/requestForm";
import { formatNaira } from "@/lib/formatters/fees";
import { ownerStatusWords } from "@/lib/formatters/ownerStatus";

const COUNTER_FROM_NOTES = 250;
const COUNTER_FROM_DESCRIPTION = 150;
const TEXTAREA = "w-full rounded-xl border border-line bg-surface p-3 text-base text-ink";

type Props = {
  /** Runs a call with the provider's token; a 401 ends the session (the parent does that). */
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  /** The person chose "Ask to manage it" for a facility the API said already exists. */
  onAskToManage?: (facility: { id: number; name: string }) => void;
  /** A request that was saved before (a draft, or one that needs changes): the form starts with it, and saves go to it. */
  saved?: SavedRequest;
};

type Sent = { linkId: number; fee: string; status: string; message: string };

export function RegisterFacility({ call, onAskToManage, saved }: Props) {
  const { meta } = useMeta();
  const fee = useOwnerFee(call);
  const [form, setForm] = useState<RequestForm>(() => (saved ? formFromRead(saved) : emptyRequestForm()));
  const [linkId, setLinkId] = useState<number | null>(saved?.link_id ?? null); // set once the request exists, so saves go to it
  const [problems, setProblems] = useState<string[]>([]);
  const [claimable, setClaimable] = useState<{ id: number; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null); // "Your draft is saved..."
  const [sent, setSent] = useState<Sent | null>(null);

  const categories = meta?.categories.filter((category) => !category.is_emergency) ?? [];
  const set = <K extends keyof RequestForm>(key: K, value: RequestForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const feeWords =
    fee === undefined
      ? null
      : `Managing your facility on ${brand.name} costs ${fee ?? "a monthly fee"}${fee ? " a month" : ""}. You pay after submitting; if our team can't approve it, you get a full refund.`;

  async function submit(saveAsDraft: boolean) {
    if (sending) return;
    const found = problemsOf(form);
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    setSending(true);
    setProblems([]);
    setClaimable(null);
    setNotice(null);
    try {
      const body = toBody(form, saveAsDraft);
      const answer = await call((token) => (linkId === null ? registerFacility(token, body) : saveFacilityRequest(token, linkId, body)));
      setLinkId(answer.link_id);
      if (saveAsDraft) setNotice(answer.message);
      else setSent({ linkId: answer.link_id, fee: formatNaira(answer.fee_naira) ?? answer.fee_naira, status: answer.status, message: answer.message });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setProblems([error.detail ?? "This facility is already registered. Please contact us."]);
        if (error.listingId !== null) setClaimable({ id: error.listingId, name: form.facilityName.trim() });
      } else if (error instanceof ApiError && error.status === 429) {
        setProblems(["You've sent several submissions. Please try again tomorrow."]);
      } else if (error instanceof ApiError && error.status === 422) {
        setProblems(["Check the form: one of the answers is not accepted. Read each one again."]);
      } else if (!(error instanceof ApiError && error.status === 401)) {
        setProblems(["We couldn't send the form. Check your connection and try again."]);
      }
    } finally {
      setSending(false);
    }
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(false);
  }

  if (sent) {
    return (
      <section aria-labelledby="register-heading" className="flex flex-col gap-3">
        <h2 id="register-heading" className="text-xl font-bold text-forest">{saved ? "Your request" : "Register a new facility"}</h2>
        {sent.status === "awaiting_payment" ? (
          <>
            <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-lg text-ink">
              Thanks. Your request is saved. Pay the first month ({sent.fee}) and we&apos;ll verify your facility before it&apos;s listed.
              Our team will phone the facility to check that you may manage it.
            </p>
            <PayOwnerFee call={call} linkId={sent.linkId} label={`Pay ${sent.fee} to send your request`} />
          </>
        ) : (
          <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-lg text-ink">{sent.message}</p>
        )}
        <Link href="/provider" className={buttonClasses("secondary")}>Go to My facilities</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="register-heading" className="flex flex-col gap-4">
      <h2 id="register-heading" className="text-xl font-bold text-forest">{saved ? "Your request" : "Register a new facility"}</h2>
      {saved && <p className="text-base font-semibold text-ink">{`Status: ${ownerStatusWords(saved.status, "draft")}`}</p>}
      {feeWords && <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">{feeWords}</p>}
      <p className="text-base text-ink">Our team checks every listing before it goes live. Nothing is public until then.</p>
      <form onSubmit={send} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-name" className="text-base font-semibold text-ink">Facility name</label>
          <input id="facility-name" required value={form.facilityName} onChange={(event) => set("facilityName", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-category" className="text-base font-semibold text-ink">Category</label>
          <select id="facility-category" required value={form.category} onChange={(event) => set("category", event.target.value)} className={FIELD}>
            <option value="">Choose a category</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-area" className="text-base font-semibold text-ink">Area</label>
          <select id="facility-area" required value={form.area} onChange={(event) => set("area", event.target.value)} className={FIELD}>
            <option value="">Choose an area</option>
            {meta?.areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-address" className="text-base font-semibold text-ink">Address</label>
          <input id="facility-address" required value={form.address} onChange={(event) => set("address", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-landmark" className="text-base font-semibold text-ink">Landmark (optional)</label>
          <input id="facility-landmark" maxLength={200} value={form.landmark} onChange={(event) => set("landmark", event.target.value)} className={FIELD} />
          <p className="text-base text-ink-soft">A place people know, for example &quot;Opposite the main market&quot;.</p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-description" className="text-base font-semibold text-ink">Short description (optional)</label>
          <textarea id="facility-description" rows={3} maxLength={MAX_DESCRIPTION} value={form.description} onChange={(event) => set("description", event.target.value)} className={TEXTAREA} />
          {form.description.length >= COUNTER_FROM_DESCRIPTION && <p className="text-base text-ink-soft">{MAX_DESCRIPTION - form.description.length} characters left</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-phone" className="text-base font-semibold text-ink">Phone number of the facility</label>
          <input id="facility-phone" required inputMode="tel" autoComplete="off" value={form.phone} onChange={(event) => set("phone", event.target.value)} className={FIELD} />
          <p className="text-base text-ink-soft">Our team phones this number to check your request.</p>
          <label className={CHOICE}>
            <input type="checkbox" checked={form.phoneHasWhatsApp} onChange={(event) => set("phoneHasWhatsApp", event.target.checked)} className="size-5" />
            This number has WhatsApp
          </label>
        </div>
        <OtherPhones phones={form.otherPhones} onChange={(phones) => set("otherPhones", phones)} />
        <OpeningHours
          is24Hours={form.is24Hours}
          hours={form.hours}
          onChange={(changes) => setForm((current) => ({ ...current, ...changes }))}
        />
        <ServiceChoices catalogue={meta?.service_catalogue ?? []} chosen={form.services} onChange={(chosen) => set("services", chosen)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-email" className="text-base font-semibold text-ink">Email of the facility (optional)</label>
          <input id="facility-email" type="email" autoComplete="off" maxLength={254} value={form.email} onChange={(event) => set("email", event.target.value)} className={FIELD} />
          <p className="text-base text-ink-soft">Only our team sees this email. It is never shown to the public.</p>
        </div>
        <fieldset className="flex flex-col">
          <legend className="text-base font-semibold text-ink">Your role</legend>
          <label className={CHOICE}>
            <input type="radio" name="facility-role" value="owner" checked={form.role === "owner"} onChange={() => set("role", "owner")} className="size-5" />
            I own it
          </label>
          <label className={CHOICE}>
            <input type="radio" name="facility-role" value="manager" checked={form.role === "manager"} onChange={() => set("role", "manager")} className="size-5" />
            I manage it
          </label>
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-notes" className="text-base font-semibold text-ink">Notes (optional)</label>
          <textarea id="facility-notes" rows={3} maxLength={MAX_NOTES} value={form.notes} onChange={(event) => set("notes", event.target.value)} className={TEXTAREA} />
          {form.notes.length >= COUNTER_FROM_NOTES && <p className="text-base text-ink-soft">{MAX_NOTES - form.notes.length} characters left</p>}
        </div>
        {problems.length > 0 && (
          <div role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
            <ul className="list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {claimable && onAskToManage && (
          <button type="button" onClick={() => onAskToManage(claimable)} className={buttonClasses("secondary")}>
            Ask to manage it
          </button>
        )}
        {notice && (
          <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-base font-semibold text-ink">{notice}</p>
        )}
        <button type="button" onClick={() => void submit(true)} disabled={sending} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
          Save as draft
        </button>
        <button type="submit" disabled={sending} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
