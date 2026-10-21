"use client";

/** The verification log of one listing, built for a phone in the field. Requirements: FR-32, US-10, FR-36, NFR-06, NFR-10.
 * UI spec 3.5 and "Phase 10 details"; decisions C3, C8 and C9 in specs/2026-10-20-staff-screens/requirements.md.
 * Call or Visit, Pass or Fail, who was reached, notes and an optional photo (taken with the phone's camera and sent straight to
 * Cloudinary with a signature from the API). The history is below, newest first. A failed check of a published listing hides it:
 * the screen says so after saving.
 */
import Link from "next/link";
import { Camera } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { useStaff } from "@/components/admin/StaffGate";
import { ListingNotFound } from "@/components/listing/ListingNotFound";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { uploadPhoto, PhotoUploadError } from "@/lib/api/cloudinary";
import { ApiError } from "@/lib/api/request";
import { getStaffListing, listChecks, logCheck, signUpload } from "@/lib/api/staff";
import { formatNoticeDate } from "@/lib/formatters/dates";
import type { CheckMethod, CheckRead, CheckResult, StaffListingDetail } from "@/types/staff";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const FIELD = "min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";
const CHOICE = "flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4 text-base text-ink has-[:checked]:border-pine has-[:checked]:bg-pine-50";

type LogProps = { listingId: number };
type Load = "loading" | "ready" | "not-found" | "error";

function isHttps(address: string | null): address is string {
  return address !== null && address.startsWith("https://");
}

export function VerificationLog({ listingId }: LogProps) {
  const { call } = useStaff();
  const [load, setLoad] = useState<Load>("loading");
  const [detail, setDetail] = useState<StaffListingDetail | null>(null);
  const [history, setHistory] = useState<CheckRead[]>([]);
  const [method, setMethod] = useState<CheckMethod | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [personReached, setPersonReached] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoad("loading");
    Promise.all([call((token) => getStaffListing(token, listingId)), call((token) => listChecks(token, listingId))])
      .then(([loaded, checks]) => {
        if (!isCurrent) return;
        setDetail(loaded);
        setHistory(checks.items);
        setLoad("ready");
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoad(error instanceof ApiError && error.status === 404 ? "not-found" : "error");
      });
    return () => {
      isCurrent = false;
    };
  }, [call, listingId, attempt]);

  const takePhoto = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setPhotoMessage(null);
      if (!file.type.startsWith("image/")) {
        setPhotoMessage("Choose a photo (an image file).");
        return;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoMessage("The photo is larger than 5 MB. Take a smaller one.");
        return;
      }
      try {
        const signature = await call((token) => signUpload(token));
        setPhotoUrl(await uploadPhoto(file, signature));
        setPhotoMessage("Photo added");
      } catch (error) {
        setPhotoUrl(null);
        if (error instanceof ApiError && error.status === 503) {
          setPhotoMessage("Photo upload is not set up yet. You can save the check without a photo.");
        } else if (error instanceof PhotoUploadError || error instanceof ApiError) {
          setPhotoMessage("The photo could not be uploaded. Try again, or save the check without it.");
        } else {
          setPhotoMessage("The photo could not be uploaded. Try again, or save the check without it.");
        }
      }
    },
    [call],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (method === null || result === null || busy) return;
    setBusy(true);
    setProblem(null);
    setMessage(null);
    const statusBefore = detail?.status;
    try {
      const saved = await call((token) =>
        logCheck(token, listingId, {
          method,
          result,
          person_reached: personReached.trim() || null,
          notes: notes.trim() || null,
          photo_url: photoUrl,
        }),
      );
      setHistory((current) => [saved, ...current]);
      setMethod(null);
      setResult(null);
      setPersonReached("");
      setNotes("");
      setPhotoUrl(null);
      setPhotoMessage(null);
      const refreshed = await call((token) => getStaffListing(token, listingId));
      setDetail(refreshed);
      setMessage(
        statusBefore === "published" && refreshed.status === "hidden"
          ? "This listing was published, so it is now hidden. The editors have been told."
          : "Check saved.",
      );
    } catch {
      setProblem("We couldn't save the check. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (load === "not-found") return <ListingNotFound />;
  if (load === "loading") {
    return (
      <div aria-busy="true" className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <ListingSkeleton />
      </div>
    );
  }
  if (load === "error" || detail === null) {
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

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-forest">Verification log: {detail.name}</h1>
        <div>
          <StatusBadge status={detail.status} />
        </div>
        <Link href={`/admin/listings/${listingId}`} prefetch={false} className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4">
          Back to the listing
        </Link>
      </header>

      <form onSubmit={save} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold text-ink">How did you check?</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className={CHOICE}>
              <input type="radio" name="method" value="call" checked={method === "call"} onChange={() => setMethod("call")} className="h-5 w-5 accent-pine" />
              Call
            </label>
            <label className={CHOICE}>
              <input type="radio" name="method" value="visit" checked={method === "visit"} onChange={() => setMethod("visit")} className="h-5 w-5 accent-pine" />
              Visit
            </label>
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold text-ink">What was the result?</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className={CHOICE}>
              <input type="radio" name="result" value="pass" checked={result === "pass"} onChange={() => setResult("pass")} className="h-5 w-5 accent-pine" />
              Pass
            </label>
            <label className={CHOICE}>
              <input type="radio" name="result" value="fail" checked={result === "fail"} onChange={() => setResult("fail")} className="h-5 w-5 accent-pine" />
              Fail
            </label>
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="check-person" className="text-base font-semibold text-ink">Person reached</label>
          <input id="check-person" value={personReached} maxLength={200} onChange={(event) => setPersonReached(event.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="check-notes" className="text-base font-semibold text-ink">Notes</label>
          <textarea id="check-notes" value={notes} maxLength={1000} rows={3} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-xl border border-line bg-white p-3 text-base text-ink" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="check-photo" className={`${buttonClasses("secondary")} cursor-pointer`}>
            <DecorativeIcon icon={Camera} />
            Take photo
          </label>
          <input
            id="check-photo"
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Take photo"
            className="sr-only"
            onChange={(event) => {
              void takePhoto(event.target.files?.[0]);
              event.target.value = ""; // the same photo can be chosen again
            }}
          />
          {photoMessage && (
            <p role="status" className="text-base text-ink">{photoMessage}</p>
          )}
          {photoUrl && (
            <button type="button" onClick={() => { setPhotoUrl(null); setPhotoMessage(null); }} className={buttonClasses("secondary")}>
              Remove the photo
            </button>
          )}
        </div>

        {problem && (
          <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">{problem}</p>
        )}
        {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
        <button type="submit" disabled={method === null || result === null || busy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {busy ? "Saving…" : "Save check"}
        </button>
      </form>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-xl font-bold text-forest">History</h2>
        {history.length === 0 && <p className="text-base text-ink">No checks yet.</p>}
        {history.length > 0 && (
          <ul className="flex flex-col gap-3">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-4">
                <p className="text-base font-semibold text-ink">
                  {entry.method === "call" ? "Call" : "Visit"} · {entry.result === "pass" ? "Passed" : "Failed"}
                </p>
                <p className="text-base text-ink-soft">{entry.staff_name} · {formatNoticeDate(entry.checked_at)}</p>
                {entry.person_reached && <p className="text-base text-ink">Reached: {entry.person_reached}</p>}
                {entry.notes && <p className="text-base text-ink">{entry.notes}</p>}
                {isHttps(entry.photo_url) && (
                  <a href={entry.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4">
                    Photo
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
