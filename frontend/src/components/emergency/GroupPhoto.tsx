"use client";

/** The small photo under the heading of the Ambulance and the Fire service groups. Requirements: FR-14, FR-17, NFR-01, NFR-03,
 * NFR-10, NFR-13, US-04. Spec: specs/2026-10-22-home-photos/requirements.md part 6; ui-spec 2.5 (Photos).
 * A plain lazy <img> with its size fixed (640 x 240, an 8:3 box, at most 160 px high), so the room is kept before the file arrives and nothing
 * jumps. It is lazy and below the 112 card, so 112 and Call 112 never wait for it, and the browser asks for it only near the screen. The service
 * worker keeps the two files for offline use (public/sw.js); the saved copy of the contacts holds no picture data.
 * If the file cannot be had (first visit offline, a failed request), a quiet panel of the same size stays: no broken-image icon, no text, and no
 * credit. There is no credit under the photo any more: the one credit for the photos of the site is in the site footer (owner, 2026-10-28).
 */
import { useState } from "react";

import { EMERGENCY_PHOTOS, type SitePhoto } from "@/config/sitePhotos";

type GroupPhotoProps = { slug: string };

const PHOTO_BY_GROUP: Record<string, SitePhoto> = {
  ambulance: EMERGENCY_PHOTOS.ambulance,
  fire: EMERGENCY_PHOTOS.fire,
};

// 160 px high at 8:3 is 427 px wide: a wider screen does not make the photo taller.
const BOX = "aspect-[8/3] w-full max-w-[427px] rounded-2xl";

export function GroupPhoto({ slug }: GroupPhotoProps) {
  const [failed, setFailed] = useState(false);
  const photo = PHOTO_BY_GROUP[slug];
  if (!photo) return null;

  if (failed) return <div data-photo-missing="" aria-hidden="true" className={`${BOX} bg-pine-100`} />;

  return (
    <div className="flex flex-col">
      {/* A plain <img> on purpose: a small file of ours, so next/image would add client code for nothing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${BOX} object-cover`}
      />
    </div>
  );
}
