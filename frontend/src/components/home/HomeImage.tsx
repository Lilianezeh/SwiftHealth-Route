/** One photo of the home page, with `next/image`. Requirements: US-13, NFR-01, NFR-10. Decision 7 in
 * specs/2026-10-11-home-redesign/requirements.md.
 * The photo comes from config/home.ts, so its fixed width, its fixed height and its alt text are always there (the type
 * `HomePhoto` requires them). The files are already the right size and format, so they are served as they are
 * (`unoptimized`). It loads lazily, which is the default of `next/image`: only the hero is loaded at once, and that one is
 * made in HomeHero.
 */
import Image from "next/image";

import type { HomePhoto } from "@/config/home";

type HomeImageProps = { photo: HomePhoto; className?: string };

export function HomeImage({ photo, className }: HomeImageProps) {
  return (
    <Image src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} unoptimized className={className} />
  );
}
