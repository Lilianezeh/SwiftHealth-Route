/** The slim photo banner of a chosen type, with its credit right under it. Requirements: US-01, NFR-01, NFR-10, NFR-13.
 * Spec: specs/2026-10-15-find-by-type/requirements.md D6. The caller shows it only for an approved photo (config/types.ts `bannerFor`).
 * One plain <img> with its size fixed (960 x 320, 3:1), so the room is kept before it loads and nothing jumps, and the results never wait for
 * it. It is a small file of ours, so next/image would add client code for nothing. Only the chosen type's photo is on the page, so only
 * that file downloads. No text is on the photo.
 * Size (owner, 2026-10-17): on a phone the whole 3:1 picture, as before; from 768 px (`md`) it is 140 px high and cropped (`object-cover`) around
 * the part named in the config (`focus`), so it is not a tall band on a tablet or a laptop.
 * The credit is a link directly under the photo: still 16 px text (NFR-10), with only a hair of space above it, and its 48 px tap area reaches
 * down below the text (`items-start`), so it sits next to the picture as Magnific asks and stays easy to tap.
 */
import type { TypePhoto } from "@/config/types";

type TypeBannerProps = { photo: TypePhoto };

export function TypeBanner({ photo }: TypeBannerProps) {
  return (
    <div className="flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        decoding="async"
        style={{ objectPosition: photo.focus }}
        className="h-auto w-full rounded-2xl md:h-[140px] md:object-cover"
      />
      {photo.credit && (
        <a
          href={photo.credit.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-start self-start pt-1 text-base font-semibold text-forest underline"
        >
          {photo.credit.text}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </div>
  );
}
