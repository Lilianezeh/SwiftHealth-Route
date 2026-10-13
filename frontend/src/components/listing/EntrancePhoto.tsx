"use client";

/** The entrance photo of a listing. Requirements: FR-09, NFR-01, NFR-10, NFR-07. Spec: specs/2026-10-13-listing-page/requirements.md D7.
 * Shown only when the address starts with https:// (never http://, javascript: or data:). A plain <img> with a fixed size (so the page does
 * not jump), lazy loading, no referrer, and always alt text. next/image and its `remotePatterns` wait for the Cloudinary phase. If the photo
 * fails to load, the frame goes away: no empty box. A client component only for that one error.
 */
import { useState } from "react";

type EntrancePhotoProps = { url: string | null; facilityName: string };

export function EntrancePhoto({ url, facilityName }: EntrancePhotoProps) {
  const [failed, setFailed] = useState(false);
  const address = url?.trim() ?? "";
  if (failed || !address.startsWith("https://")) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-pine-50">
      {/* A plain <img> on purpose (see above). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={address}
        alt={`Entrance of ${facilityName}`}
        width={640}
        height={360}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="aspect-video h-auto w-full object-cover"
      />
    </div>
  );
}
