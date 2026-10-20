/** Find home. Requirements: FR-01, FR-03, US-01. UI spec 2.2. A server page: only NearYou needs the browser. */
import type { Metadata } from "next";
import Link from "next/link";

import { CategoryShortcuts } from "@/components/search/CategoryShortcuts";
import { NearYou } from "@/components/search/NearYou";
import { SearchBox } from "@/components/search/SearchBox";
import { buttonClasses } from "@/components/ui/buttonStyles";

export const metadata: Metadata = {
  title: "Find care",
  description: "Find a hospital, clinic, pharmacy, maternity home or laboratory that is open now, near you.",
};

export default function FindPage() {
  return (
    <>
      <section className="on-dark bg-forest text-paper">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
          <h1 className="text-3xl font-bold leading-tight">What do you need?</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href="#search" className={buttonClasses("secondary")}>
              Find a healthcare facility
            </a>
            <Link href="/emergency" className={buttonClasses("emergency")}>
              Get emergency help
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <section id="search" aria-label="Search" className="flex flex-col gap-4">
          <SearchBox />
          <CategoryShortcuts />
        </section>
        <NearYou />
      </div>
    </>
  );
}
