"use client";

/** The entrance photo of the owner form. Requirements: US-17, FR-32, NFR-06, NFR-10. Spec: specs/2026-11-01-owner-form-location-photo/
 * (decisions L3, L8); UI spec 2.9. The API signs the upload for the OWNER folder only (`POST /uploads/owner-sign`); the photo then goes
 * straight from the phone to Cloudinary (lib/api/cloudinary.ts) and never passes through our server. Only an image of at most 5 MB is
 * sent, and only an https address that comes back is kept and shown. Without a photo the form works as before.
 */
import { useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { PhotoUploadError, uploadPhoto } from "@/lib/api/cloudinary";
import { signOwnerPhotoUpload } from "@/lib/api/facility";
import { ApiError } from "@/lib/api/request";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const NOT_SET_UP = "Photo upload is not set up yet. You can send the form without a photo.";
const FAILED = "The photo could not be uploaded. Try again, or send the form without it.";

type Props = {
  /** Runs a call with the provider's token; a 401 ends the session (the parent does that). */
  call: <T>(operation: (token: string) => Promise<T>) => Promise<T>;
  photoUrl: string | undefined;
  onPhoto: (address: string) => void;
  onRemove: () => void;
};

export function PhotoField({ call, photoUrl, onPhoto, onRemove }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setMessage(null);
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a photo (an image file).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setMessage("The photo is larger than 5 MB. Take a smaller one.");
      return;
    }
    setBusy(true);
    try {
      const signature = await call((token) => signOwnerPhotoUpload(token));
      const address = await uploadPhoto(file, signature);
      if (!address.startsWith("https://")) throw new PhotoUploadError();
      onPhoto(address);
      setMessage("Photo added");
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) setMessage(NOT_SET_UP);
      else if (!(error instanceof ApiError && error.status === 401)) setMessage(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <legend className="px-1 text-base font-semibold text-ink">Photo of the entrance (optional)</legend>
      <p className="text-base text-ink">A photo of the entrance helps people find the door. Up to 5 MB.</p>
      <label htmlFor="entrance-photo" className={`${buttonClasses("secondary")} cursor-pointer sm:w-auto sm:self-start sm:px-6`}>
        {busy ? "Uploading…" : "Take or choose a photo"}
      </label>
      <input
        id="entrance-photo"
        type="file"
        accept="image/*"
        disabled={busy}
        className="sr-only"
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = ""; // the same photo can be chosen again
        }}
      />
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      {photoUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a Cloudinary address; a fixed size, lazy, no optimiser */}
          <img src={photoUrl} alt="The entrance photo you added" loading="lazy" className="h-40 w-full max-w-xs rounded-2xl border border-line object-cover" />
          <button type="button" onClick={() => { setMessage(null); onRemove(); }} className={`${buttonClasses("secondary")} sm:w-auto sm:self-start sm:px-6`}>
            Remove the photo
          </button>
        </>
      )}
    </fieldset>
  );
}
