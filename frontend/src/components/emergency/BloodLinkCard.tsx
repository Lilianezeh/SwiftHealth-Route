/** A link card to the blood pages, after the emergency groups. Requirements: FR-19, NFR-10, US-15. UI spec 2.5, point 6; decision K3 in
 * specs/2026-10-22-swiftrescue-order/requirements.md. Plain on purpose: no icon, no cross symbol, nothing red (the red of this page is for
 * 112), and never a "Sponsored" tag. The whole card is one link, at least 48 px high, with text of 16 px or more.
 */
import Link from "next/link";

export function BloodLinkCard() {
  return (
    <Link
      href="/blood"
      prefetch={false}
      className="flex min-h-14 flex-col justify-center gap-1 rounded-2xl border border-line bg-white p-4 shadow-card"
    >
      <span className="text-lg font-bold text-forest underline underline-offset-4">Need blood urgently?</span>
      <span className="text-base text-ink">Find blood banks and the blood groups they list.</span>
    </Link>
  );
}
