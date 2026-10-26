"use client";

/** "Register a new facility", for a logged-in provider. Requirements: FR-50, FR-51, FR-23, NFR-06, NFR-07, NFR-10. UI spec 2.9;
 * decisions D14 and D15 in specs/2026-10-23-accounts-and-facility-ownership/requirements.md. Everything except the notes is
 * required and is checked in words before the call (the API checks again). The contact details are the account's own, so the form
 * does not ask for them. A 409 shows the API's sentence and, when the facility can be claimed, a button to ask to manage it. The
 * page never asks for a position and keeps nothing in the browser.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import { registerFacility, type FacilityRole } from "@/lib/api/facility";
import { ApiError } from "@/lib/api/request";
import { toE164 } from "@/lib/formatters/phone";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
const CHOICE = "flex min-h-12 items-center gap-3 text-base text-ink";
const MAX_NOTES = 300;
const COUNTER_FROM = 250;

type Form = {
  facility_name: string; category: string; area: string; address: string;
  phone: string; role: FacilityRole; notes: string;
};
const EMPTY: Form = { facility_name: "", category: "", area: "", address: "", phone: "", role: "owner", notes: "" };

function problemsOf(form: Form): string[] {
  const problems: string[] = [];
  if (form.facility_name.trim().length < 2) problems.push("Enter the facility name.");
  if (form.category === "") problems.push("Choose a category.");
  if (form.area === "") problems.push("Choose an area.");
  if (form.address.trim().length < 3) problems.push("Enter the address.");
  if (toE164(form.phone.trim()) === null) problems.push("Check the phone number. It should look like 0803 123 4567.");
  return problems;
}

type Props = {
  /** Runs a call with the provider's token; a 401 ends the session (the parent does that). */
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  /** The person chose "Ask to manage it" for a facility the API said already exists. */
  onAskToManage: (facility: { id: number; name: string }) => void;
};

export function RegisterFacility({ call, onAskToManage }: Props) {
  const { meta } = useMeta();
  const [form, setForm] = useState<Form>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
  const [claimable, setClaimable] = useState<{ id: number; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);

  const categories = meta?.categories.filter((category) => !category.is_emergency) ?? [];
  const set = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found = problemsOf(form);
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    setSending(true);
    setProblems([]);
    setClaimable(null);
    try {
      await call((token) => registerFacility(token, form));
      setForm(EMPTY);
      setThanks(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setProblems([error.detail ?? "This facility is already registered. Please contact us."]);
        if (error.listingId !== null) setClaimable({ id: error.listingId, name: form.facility_name.trim() });
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

  if (thanks) {
    return (
      <section aria-labelledby="register-heading" className="flex flex-col gap-3">
        <h2 id="register-heading" className="text-xl font-bold text-forest">Register a new facility</h2>
        <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-lg text-ink">
          Thanks. We&apos;ll verify your facility before it&apos;s listed. Our team will phone the facility to check that you may manage it.
        </p>
        <Link href="/provider" className={buttonClasses("secondary")}>Go to My facilities</Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="register-heading" className="flex flex-col gap-4">
      <h2 id="register-heading" className="text-xl font-bold text-forest">Register a new facility</h2>
      <p className="text-base text-ink">Listing is free during our launch. Our team checks every listing before it goes live.</p>
      <form onSubmit={send} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-name" className="text-base font-semibold text-ink">Facility name</label>
          <input id="facility-name" required value={form.facility_name} onChange={(event) => set("facility_name", event.target.value)} className={FIELD} />
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
          <label htmlFor="facility-phone" className="text-base font-semibold text-ink">Phone number of the facility</label>
          <input id="facility-phone" required inputMode="tel" autoComplete="off" value={form.phone} onChange={(event) => set("phone", event.target.value)} className={FIELD} />
          <p className="text-base text-ink-soft">Our team phones this number to check your request.</p>
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
          <textarea id="facility-notes" rows={3} maxLength={MAX_NOTES} value={form.notes} onChange={(event) => set("notes", event.target.value)} className="w-full rounded-xl border border-line bg-white p-3 text-base text-ink" />
          {form.notes.length >= COUNTER_FROM && <p className="text-base text-ink-soft">{MAX_NOTES - form.notes.length} characters left</p>}
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
        {claimable && (
          <button type="button" onClick={() => onAskToManage(claimable)} className={buttonClasses("secondary")}>
            Ask to manage it
          </button>
        )}
        <button type="submit" disabled={sending} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
