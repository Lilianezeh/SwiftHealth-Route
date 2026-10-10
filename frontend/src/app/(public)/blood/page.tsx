/** Find blood: a "Coming soon" page until phase 8, so the Blood shortcut on /find does not lead nowhere. FR-27, FR-01. */
import Link from "next/link";

import { buttonClasses } from "@/components/ui/buttonStyles";

export default function BloodPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold text-forest">Find blood</h1>
      <p className="text-base text-ink">Coming soon. Blood bank search will be added in a later release.</p>
      <Link href="/find" className={buttonClasses("secondary")}>
        Back to Find
      </Link>
    </section>
  );
}
