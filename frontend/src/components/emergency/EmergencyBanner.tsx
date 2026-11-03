"use client";

/** The photo banner of SwiftRescue: the ambulance and the fire photo side by side, directly below the 112 card. Requirements: FR-14, FR-17,
 * NFR-01, NFR-03, NFR-10, NFR-13, US-04. Spec: specs/2026-11-03-emergency-page-tidy/requirements.md (owner, 2026-11-03); it replaces the small photos
 * under the headings of the Ambulance and Fire service groups (specs/2026-10-22-home-photos/ part 6), so the groups show contacts only.
 * Two plain lazy <img> files of ours in two boxes of a fixed shape, so the room is kept before a file arrives and nothing jumps (CLS 0): a 5:3 box
 * on a phone (96 px high at 360 px, so the first contacts stay close below) and the whole 8:3 photo from 640 px (about 124 px high at 672 px).
 * On a phone the box shows 400 x 240 of the 640 x 240 photo and `focus` keeps the face whole. Full brightness: no filter, tint or text over a photo.
 * The banner is in the page's own HTML and asks for no data; the images are lazy and below the 112 card, so 112 and Call 112 never wait for them.
 * The service worker keeps the two files for offline use (public/sw.js); the saved copy of the contacts holds no picture data.
 * If a file cannot be had (first visit offline, a failed request), a quiet panel of the same shape stays: no broken-image icon, no text and no
 * credit (the one credit for the photos of the site is in the footer, owner, 2026-10-28).
 */
import { useState, type CSSProperties } from "react";

import { EMERGENCY_PHOTOS, type EmergencyPhoto } from "@/config/sitePhotos";

const BOX = "aspect-[5/3] min-[640px]:aspect-[8/3] w-full overflow-hidden rounded-2xl";

function BannerPhoto({ photo }: { photo: EmergencyPhoto }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <div data-photo-missing="" aria-hidden="true" className={`${BOX} bg-pine-100`} />;

  return (
    <div data-emergency-photo="" className={BOX}>
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
        style={{ "--focus": photo.focus } as CSSProperties}
        className="h-full w-full object-cover [object-position:var(--focus)] min-[640px]:[object-position:50%_50%]"
      />
    </div>
  );
}

export function EmergencyBanner() {
  return (
    <div data-emergency-banner="" className="grid grid-cols-2 gap-2">
      <BannerPhoto photo={EMERGENCY_PHOTOS.ambulance} />
      <BannerPhoto photo={EMERGENCY_PHOTOS.fire} />
    </div>
  );
}
