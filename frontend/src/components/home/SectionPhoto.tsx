/** One photo of a section of the home page. Requirements: US-13, NFR-01, NFR-10. Spec: specs/2026-10-22-home-photos/requirements.md parts 2 to 4.
 * A plain lazy <img> with its width, height and aspect ratio fixed (so the room is kept before the file arrives and nothing jumps: CLS 0), and
 * honest alt text from config/sectionPhotos.ts. It is inside <Reveal>, which fades and slides it into place once when it scrolls into view.
 * Every one of these photos is below the fold, so it is lazy: nothing is downloaded before the visitor scrolls near it. It is a plain <img>
 * (not the next/image component) because the files are final and that component would add client code for nothing.
 */
import { Reveal } from "@/components/home/Reveal";
import type { SitePhoto } from "@/config/sectionPhotos";

// Whole class names, so Tailwind finds them: a 3:2 photo of a section, or an 8:3 header image of SwiftRescue.
const SHAPES = { "3:2": "aspect-[3/2]", "8:3": "aspect-[8/3]" } as const;

type SectionPhotoProps = { photo: SitePhoto; shape?: keyof typeof SHAPES };

export function SectionPhoto({ photo, shape = "3:2" }: SectionPhotoProps) {
  return (
    <Reveal>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
        decoding="async"
        className={`${SHAPES[shape]} h-auto w-full rounded-2xl object-cover`}
      />
    </Reveal>
  );
}
