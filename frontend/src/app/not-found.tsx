import Link from "next/link";

import { PageFrame } from "@/components/layout/PageFrame";
import { buttonClasses } from "@/components/ui/buttonStyles";

/** The page for an address that does not exist. It has the header and the footer like every page: they used to come from the root
 * layout, and now each route group draws its own frame (revision R44 in specs/2026-10-11-home-redesign/), so this page draws one.
 */
export default function NotFound() {
  return (
    <PageFrame>
      <section className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-forest">Page not found</h1>
        <p className="mt-3 text-lg text-ink">We could not find the page you asked for.</p>
        <div className="mt-6 sm:max-w-xs">
          <Link href="/" prefetch={false} className={buttonClasses("primary")}>
            Go to the home page
          </Link>
        </div>
      </section>
    </PageFrame>
  );
}
