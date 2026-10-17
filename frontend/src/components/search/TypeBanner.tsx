/** The slim photo banner of a chosen type, with its credit under it. Requirements: US-01, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-15-find-by-type/requirements.md D6. The caller shows it only for an approved photo (config/types.ts `bannerFor`).
 * One plain <img> with its size fixed (960 x 320, 3:1), so the room is kept before it loads and nothing jumps, and the results never wait for
 * it. It is a small file of ours, so next/image would add client code for nothing. Only the chosen type's photo is on the page, so only
 * that file downloads. No text is on the photo; the credit is a link under it, in a visible colour, opening in a new tab.
 */
import type { TypePhoto } from "@/config/types";

type TypeBannerProps = { photo: TypePhoto };

export function TypeBanner({ photo }: TypeBannerProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} decoding="async" className="h-auto w-full rounded-2xl" />
      {photo.credit && (
        <a
          href={photo.credit.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center self-start text-base font-semibold text-forest underline"
        >
          {photo.credit.text}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
