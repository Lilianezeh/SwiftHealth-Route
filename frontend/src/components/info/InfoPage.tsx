/** The shared layout of the information pages (About, How we verify, Privacy, Terms, Contact). Requirements: FR-23, NFR-10.
 * UI spec 2.10. Server components: no script. One `h1`, `h2` sections, 16 px text, a column at most 42 rem wide. A link that is
 * not inside a sentence is an `InfoLink`, at least 48 px high.
 */
import Link from "next/link";
import type { ReactNode } from "react";

export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex max-w-[42rem] flex-col gap-8 px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">{title}</h1>
      {children}
    </article>
  );
}

export function InfoSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-forest">{heading}</h2>
      <div className="flex flex-col gap-3 text-base leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/** The notice at the top of Privacy and Terms (decision D1 in specs/2026-10-20-info-pages/requirements.md). */
export function DraftNotice() {
  return (
    <p role="note" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
      This page describes how SwiftHealth Route works today. It has not yet been reviewed by a lawyer.
    </p>
  );
}

export function InfoLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className="inline-flex min-h-12 items-center text-base font-semibold text-forest underline underline-offset-4">
      {children}
    </Link>
  );
}
