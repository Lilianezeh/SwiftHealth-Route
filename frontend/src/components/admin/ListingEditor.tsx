"use client";

/** The listing editor: a new listing or an existing one. Requirements: FR-31, FR-32, FR-38, FR-42, NFR-06, NFR-10. UI spec 3.4 and
 * "Phase 10 details"; decisions C3, C4, C5, C12 and C13 in specs/2026-10-20-staff-screens/requirements.md.
 *
 * It loads the listing with the staff token, keeps the form values as text, checks them before calling (lib/staff/listingForm.ts),
 * and on Save sends only the fields that changed (so only real changes are audited). The status buttons call the API and show the
 * answer; they are off while there are unsaved changes. Leaving with unsaved changes: the browser asks on close or reload, and
 * Cancel asks first. "Use my current location" asks for the exact position after the tap and only fills the two fields.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ListingActions } from "@/components/admin/ListingActions";
import { ListingFormFields } from "@/components/admin/ListingFormFields";
import { useStaff } from "@/components/admin/StaffGate";
import { StatusBadge, STATUS_LABELS } from "@/components/admin/StatusBadge";
import { ListingNotFound } from "@/components/listing/ListingNotFound";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useMeta } from "@/hooks/useMeta";
import {
  createListing,
  getStaffListing,
  hideListing,
  moveListing,
  updateListing,
  type ListingMove,
} from "@/lib/api/staff";
import { ApiError } from "@/lib/api/request";
import { diffForPatch, emptyForm, formFromDetail, toInput, type ListingForm } from "@/lib/staff/listingForm";
import type { StaffListingDetail } from "@/types/staff";

type ListingEditorProps = { listingId: number | null };
type LoadState = "loading" | "ready" | "not-found" | "error";

function sentenceFor(error: unknown): string {
  if (error instanceof ApiError && error.detail) return error.detail;
  if (error instanceof ApiError && error.status === 403) return "Your role cannot do this.";
  return "We couldn't do that. Check your connection and try again.";
}

export function ListingEditor({ listingId }: ListingEditorProps) {
  const router = useRouter();
  const { session, call } = useStaff();
  const { meta } = useMeta();
  const [loadState, setLoadState] = useState<LoadState>(listingId === null ? "ready" : "loading");
  const [detail, setDetail] = useState<StaffListingDetail | null>(null);
  const [form, setForm] = useState<ListingForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<ListingForm>(emptyForm);
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (listingId === null) return;
    let isCurrent = true;
    setLoadState("loading");
    call((token) => getStaffListing(token, listingId))
      .then((loaded) => {
        if (!isCurrent) return;
        setDetail(loaded);
        setForm(formFromDetail(loaded));
        setInitialForm(formFromDetail(loaded));
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadState(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, listingId, attempt]);

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

  const takeDetail = useCallback((loaded: StaffListingDetail) => {
    setDetail(loaded);
    setForm(formFromDetail(loaded));
    setInitialForm(formFromDetail(loaded));
  }, []);

  async function save() {
    setMessage(null);
    const checked = toInput(form);
    if (!checked.ok) {
      setProblems(checked.errors);
      return;
    }
    setProblems([]);
    setBusy(true);
    try {
      if (listingId === null) {
        const created = await call((token) => createListing(token, checked.input));
        router.replace(`/admin/listings/${created.id}`);
        return;
      }
      const patch = diffForPatch(initialForm, form);
      if (Object.keys(patch).length === 0) return;
      const saved = await call((token) => updateListing(token, listingId, patch));
      takeDetail(saved);
      setMessage("Saved.");
    } catch (error) {
      setProblems([sentenceFor(error)]);
    } finally {
      setBusy(false);
    }
  }

  async function move(action: () => Promise<StaffListingDetail>) {
    setProblems([]);
    setMessage(null);
    setBusy(true);
    try {
      const moved = await action();
      takeDetail(moved);
      setMessage(`Now: ${STATUS_LABELS[moved.status]}.`);
    } catch (error) {
      setProblems([sentenceFor(error)]);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    router.push("/admin/listings");
  }

  function useMyLocation() {
    setLocationMessage(null);
    if (!navigator.geolocation) {
      setLocationMessage("We could not get your position. Type the latitude and longitude instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setLocationMessage("Position filled in. Check it, then save.");
      },
      () => setLocationMessage("We could not get your position. Type the latitude and longitude instead."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }, // exact and fresh; kept nowhere but these two fields
    );
  }

  if (loadState === "not-found") return <ListingNotFound />;

  if (loadState === "loading") {
    return (
      <div aria-busy="true" className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <ListingSkeleton />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={() => setAttempt((current) => current + 1)} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const role = session.user.role;
  const isEditorOrAdmin = role === "editor" || role === "admin";
  const ownDraft = detail !== null && detail.status === "draft" && detail.created_by === session.user.id;
  const canEdit = listingId === null || isEditorOrAdmin || (role === "verifier" && ownDraft);

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-forest">{detail ? detail.name : "New listing"}</h1>
        {detail && (
          <div>
            <StatusBadge status={detail.status} />
          </div>
        )}
        {!canEdit && <p className="text-base text-ink">You can only edit drafts you created.</p>}
      </header>

      <ListingFormFields
        form={form}
        onChange={setForm}
        meta={meta}
        disabled={!canEdit}
        mapPinIsDefault={detail?.map_pin_is_default ?? false}
        submissionDetails={detail?.submission_details ?? null}
        onUseMyLocation={useMyLocation}
        locationMessage={locationMessage}
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

      <ListingActions
        listingId={listingId}
        status={detail?.status ?? null}
        role={role}
        canEdit={canEdit}
        dirty={dirty}
        busy={busy}
        onSave={() => void save()}
        onCancel={cancel}
        onMove={(action: ListingMove) => void move(() => call((token) => moveListing(token, listingId as number, action)))}
        onHide={(reason) => void move(() => call((token) => hideListing(token, listingId as number, reason)))}
      />
    </article>
  );
}
