"use client";

/** The one h1 of the results page. Requirements: US-01, FR-05, NFR-10. Spec: specs/2026-10-15-find-by-type/requirements.md D3.
 * `text` is null while the page does not know yet what to say (the stored position is still being read): then it shows a grey bar of the
 * same height, with "Loading results" for screen readers only, so the plain words "Search results" never show for a moment before the
 * heading of the chosen type. It is focusable by code only (`tabIndex -1`): the chip moves focus here when it removes the type.
 */
import type { Ref } from "react";

type SearchHeadingProps = { text: string | null; headingRef: Ref<HTMLHeadingElement> };

export function SearchHeading({ text, headingRef }: SearchHeadingProps) {
  return (
    <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-forest">
      {text ?? (
        <>
          <span className="sr-only">Loading results</span>
          <span aria-hidden="true" className="block h-8 w-2/3 animate-pulse rounded-lg bg-closed-bg motion-reduce:animate-none" />
        </>
      )}
    </h1>
  );
}
