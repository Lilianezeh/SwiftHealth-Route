/** Edit my facility `/provider/edit` (provider role only). Requirements: FR-43, FR-50. UI spec 4.2 and 4.2b. `?listing=` is the
 * facility chosen on "My facilities"; a missing or odd value means the first approved one. The API checks the link again.
 * `searchParams` is a promise in Next.js 15; `use` reads it here, and a page drawn with none (a test) simply has no choice. */
import { use } from "react";

import { StaffGate } from "@/components/admin/StaffGate";
import { ProviderEdit } from "@/components/provider/ProviderEdit";

type Props = { searchParams?: Promise<{ listing?: string | string[] }> };

export default function ProviderEditPage({ searchParams }: Props) {
  const listing = searchParams ? use(searchParams).listing : undefined;
  const chosen = typeof listing === "string" && /^\d{1,9}$/.test(listing) ? Number(listing) : undefined;
  return (
    <StaffGate area="provider">
      <ProviderEdit listingId={chosen} />
    </StaffGate>
  );
}
