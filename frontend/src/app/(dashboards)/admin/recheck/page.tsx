/** The re-check lists `/admin/recheck` (editor and admin). Requirements: US-11, FR-33. UI spec 3.7. `?tab=this_week` shows the listings due
 * within a week; anything else shows the overdue ones. The lists are loaded in the browser with the staff token (Rechecks). */
import { Rechecks } from "@/components/admin/Rechecks";
import { StaffGate } from "@/components/admin/StaffGate";

export default async function AdminRecheckPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return (
    <StaffGate area="review">
      <Rechecks due={tab === "this_week" ? "this_week" : "overdue"} />
    </StaffGate>
  );
}
