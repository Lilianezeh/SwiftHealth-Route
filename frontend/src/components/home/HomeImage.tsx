/** One photo of the home page (the owners' photo). Requirements: US-13, NFR-01, NFR-10. Decision 7 and revision R45 (2026-10-13) in
 * specs/2026-10-11-home-redesign/requirements.md.
 * The photo comes from config/home.ts, so its fixed width, its fixed height and its alt text are always there (the type
 * `HomePhoto` requires them). The files are already the right size and format, so they are served as they are (`unoptimized`).
 * It loads lazily (the browser's own lazy loading: only the hero is loaded at once, and that one is made in HomeHero).
 * It is drawn with the plain <img> attributes that `getImageProps` gives, not with the `next/image` component: that component is
 * client code, and this page should send as little JavaScript as it can. The attributes are the same.
 */
import { getImageProps } from "next/image";

import type { HomePhoto } from "@/config/home";

type HomeImageProps = { photo: HomePhoto; className?: string };

export function HomeImage({ photo, className }: HomeImageProps) {
  const { props } = getImageProps({
    src: photo.src,
    width: photo.width,
    height: photo.height,
    alt: photo.alt,
    unoptimized: true,
    className,
  });

  // A plain <img> on purpose: getImageProps gives the attributes of next/image without its client component.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={photo.alt} />;
}
