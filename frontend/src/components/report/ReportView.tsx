"use client";

/** The report page, loaded in the browser like the listing page. Requirements: US-08, FR-20, NFR-07. UI spec 2.8.
 * It reads the listing by its slug (the name for the heading and the id for the report), with the usual states: skeleton,
 * "waking up" after 5 s, Retry, and the "Listing not found" page for an unknown or unpublished listing.
 */
import { ListingNotFound } from "@/components/listing/ListingNotFound";
import { ListingSkeleton } from "@/components/listing/ListingSkeleton";
import { ReportForm } from "@/components/report/ReportForm";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { useListing } from "@/hooks/useListing";

type ReportViewProps = { slug: string };

export function ReportView({ slug }: ReportViewProps) {
  const { status, listing, retry } = useListing(slug);

  if (status === "not-found") return <ListingNotFound />;

  if (status === "loading" || status === "slow") {
    return (
      <div aria-busy="true" className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <p role="status" aria-live="polite" className="text-base text-ink">
          {status === "slow" ? "The service is waking up. This can take up to a minute." : ""}
        </p>
        <ListingSkeleton />
      </div>
    );
  }

  if (status === "error" || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="text-base text-ink">We couldn&apos;t load this. Check your connection and try again.</p>
          <button type="button" onClick={retry} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <ReportForm listingId={listing.id} listingName={listing.name} listingSlug={listing.slug} />;
}
