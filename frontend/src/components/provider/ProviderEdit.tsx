"use client";

/** The provider's edit screen: phones, opening hours, services and the description of their own listing. Requirements: FR-43, FR-38,
 * NFR-06, NFR-10. UI spec 4.2 and "Phase 12 details"; decision I2 in specs/2026-10-20-providers-payments/requirements.md.
 *
 * It reuses the sections of the staff editor and keeps the form values as text. On Save it checks them, sends only the fields that
 * changed (so only real changes are audited) and shows the answer. A change to phones or hours is re-verified by the team; the
 * listing stays visible meanwhile. Leaving with unsaved changes: the browser asks on close or reload.
 */
import { useEffect, useState } from "react";

import { ListingFormFields } from "@/components/admin/ListingFormFields";
import { QueueStatus } from "@/components/admin/QueueStatus";
import { useStaff } from "@/components/admin/StaffGate";
import { NoLinkedFacility } from "@/components/provider/NoLinkedFacility";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import { useProviderListing } from "@/hooks/useProviderListing";
import { updateProviderListing, type ProviderChanges } from "@/lib/api/provider";
import { ApiError } from "@/lib/api/request";
import { diffForPatch, emptyForm, formFromDetail, toInput, type ListingForm } from "@/lib/staff/listingForm";

function sentenceFor(error: unknown): string {
  if (error instanceof ApiError && error.detail) return error.detail;
  return "We couldn't save that. Check your connection and try again.";
}

const NOOP = () => {};

/** `listingId` is the facility chosen on "My facilities" (`?listing=` in the address); without it, the first approved one. */
export function ProviderEdit({ listingId }: { listingId?: number }) {
  const { call } = useStaff();
  const { meta } = useMeta();
  const { status, listing, retry } = useProviderListing(listingId);
  const [form, setForm] = useState<ListingForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<ListingForm>(emptyForm);
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!listing) return;
    setForm(formFromDetail(listing));
    setInitialForm(formFromDetail(listing));
  }, [listing]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    if (!dirty) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // the text of the browser's own question cannot be changed
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [dirty]);

  async function save() {
    setMessage(null);
    const checked = toInput(form);
    if (!checked.ok) {
      setProblems(checked.errors);
      return;
    }
    setProblems([]);
    const patch = diffForPatch(initialForm, form);
    if (Object.keys(patch).length === 0) return;
    setBusy(true);
    try {
      // The form shows only the four fields a provider may change, so the patch holds no others.
      const saved = await call((token) => updateProviderListing(token, patch as ProviderChanges, {}, listingId));
      setForm(formFromDetail(saved));
      setInitialForm(formFromDetail(saved));
      setMessage("Saved.");
    } catch (error) {
      setProblems([sentenceFor(error)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Edit my facility</h1>

      <QueueStatus status={status === "none" ? "ready" : status} onRetry={retry} />
      {status === "none" && <NoLinkedFacility />}

      {listing && (
        <>
          <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
            Changes to phone numbers or hours are re-verified by our team. Your listing stays visible until then.
          </p>

          <ListingFormFields
            form={form}
            onChange={setForm}
            meta={meta}
            disabled={busy}
            mapPinIsDefault={false}
            submissionDetails={null}
            onUseMyLocation={NOOP}
            locationMessage={null}
            providerView
          />

          {problems.length > 0 && (
            <div role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
              <ul className="list-disc pl-5">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </div>
          )}
          {message && (
            <p role="status" className="text-base font-semibold text-ink">
              {message}
            </p>
          )}

          <button type="button" onClick={() => void save()} disabled={busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            Save
          </button>
        </>
      )}
    </section>
  );
}
