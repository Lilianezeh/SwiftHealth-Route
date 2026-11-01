/** Edit a saved request `/provider/request?link=` (provider role only). Requirements: US-17, FR-50. UI spec 2.9. `?link=` is the owner
 * link chosen on "My facilities" ("Edit and send"); a missing or odd value shows that the request was not found. The API checks that
 * the link is the caller's. `searchParams` is a promise in Next.js 15; `use` reads it here, as on `/provider/edit`.
 */
import { use } from "react";

import { StaffGate } from "@/components/admin/StaffGate";
import { EditRequest } from "@/components/facility/EditRequest";

type Props = { searchParams?: Promise<{ link?: string | string[] }> };

export default function ProviderRequestPage({ searchParams }: Props) {
  const link = searchParams ? use(searchParams).link : undefined;
  const chosen = typeof link === "string" && /^\d{1,9}$/.test(link) ? Number(link) : 0; // 0 is no link: the API answers 404
  return (
    <StaffGate area="provider">
      <EditRequest linkId={chosen} />
    </StaffGate>
  );
}
