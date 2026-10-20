"use client";

/** The "List your facility" form. Requirements: FR-37, FR-23, NFR-06, NFR-07, NFR-10. UI spec 2.9 and "Phase 10 details"; decisions C6
 * and C7 in specs/2026-10-20-staff-screens/requirements.md. Everything except the notes is required and is checked in words before
 * the call (the API checks again). The owner's details are sent once, and the form is cleared and gone after the thanks: nothing is
 * kept in the browser. The page never asks for a position.
 */
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import { postFacilitySubmission } from "@/lib/api/facility";
import { ApiError } from "@/lib/api/request";
import { toE164 } from "@/lib/formatters/phone";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
const MAX_NOTES = 500;
const COUNTER_FROM = 400;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Form = {
  facility_name: string; category: string; area: string; address: string;
  phone: string; contact_name: string; contact_email: string; notes: string;
};
const EMPTY: Form = { facility_name: "", category: "", area: "", address: "", phone: "", contact_name: "", contact_email: "", notes: "" };

function problemsOf(form: Form): string[] {
  const problems: string[] = [];
  if (form.facility_name.trim().length < 2) problems.push("Enter the facility name.");
  if (form.category === "") problems.push("Choose a category.");
  if (form.area === "") problems.push("Choose an area.");
  if (form.address.trim().length < 3) problems.push("Enter the address.");
  if (toE164(form.phone.trim()) === null) problems.push("Check the phone number. It should look like 0803 123 4567.");
  if (form.contact_name.trim().length < 2) problems.push("Enter your name.");
  if (!EMAIL_SHAPE.test(form.contact_email.trim())) problems.push("Check the email address.");
  return problems;
}

export function FacilityForm() {
  const { meta } = useMeta();
  const [form, setForm] = useState<Form>(EMPTY);
  const [problems, setProblems] = useState<string[]>([]);
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
    try {
      await postFacilitySubmission(form);
      setForm(EMPTY); // the owner's details are dropped as soon as they are sent
      setThanks(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) setProblems(["You've sent several submissions. Please try again tomorrow."]);
      else if (error instanceof ApiError && error.status === 422) {
        setProblems(["Check the form: one of the answers is not accepted. Read each one again."]);
      } else setProblems(["We couldn't send the form. Check your connection and try again."]);
    } finally {
      setSending(false);
    }
  }

  if (thanks) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
        <h1 className="text-2xl font-bold text-forest">List your facility</h1>
        <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-lg text-ink">
          Thanks. We&apos;ll verify your facility before it&apos;s listed.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold text-forest">List your facility</h1>
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
          <label htmlFor="facility-phone" className="text-base font-semibold text-ink">Phone number</label>
          <input id="facility-phone" required inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-contact" className="text-base font-semibold text-ink">Your name</label>
          <input id="facility-contact" required autoComplete="name" value={form.contact_name} onChange={(event) => set("contact_name", event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="facility-email" className="text-base font-semibold text-ink">Your email</label>
          <input id="facility-email" required type="email" autoComplete="email" value={form.contact_email} onChange={(event) => set("contact_email", event.target.value)} className={FIELD} />
        </div>
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
        <button type="submit" disabled={sending} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
