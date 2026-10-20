/** Report a problem `/report/<slug>`. Requirements: US-08, FR-20, FR-21, NFR-07, NFR-10. UI spec 2.8. Spec: specs/2026-10-20-reports/.
 * A server page that only takes the slug from the address; the listing is loaded in the browser (ReportView), like the listing page,
 * because the free API can take about a minute to wake.
 */
import type { Metadata } from "next";

import { ReportView } from "@/components/report/ReportView";

export const metadata: Metadata = {
  title: "Report a problem",
  description: "Tell us a number is not working or a facility has moved. No account needed.",
};

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ReportView slug={slug} />;
}
