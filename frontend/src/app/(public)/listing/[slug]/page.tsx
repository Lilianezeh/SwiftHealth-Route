/** The listing page `/listing/<slug>`. Requirements: US-02, US-03, US-06, US-07, FR-09 to FR-13, FR-47, NFR-12. UI spec 2.4.
 * Spec: specs/2026-10-13-listing-page/requirements.md D8. A server page that only takes the slug from the address: the listing is loaded in
 * the browser (ListingDetailView), because the free API can take about a minute to wake and the hosting gives up on a server page after
 * about 30 seconds. Server rendering for Google waits for the Render upgrade (LOG.md).
 */
import type { Metadata } from "next";

import { ListingDetailView } from "@/components/listing/ListingDetailView";

// The listing's own name replaces this title in the browser once it has loaded (ListingDetailView).
export const metadata: Metadata = {
  title: "Listing",
  description: "Phone numbers, opening hours, services and directions for a verified health facility.",
};

export default async function ListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ListingDetailView slug={slug} />;
}
