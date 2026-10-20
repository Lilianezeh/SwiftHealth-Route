/** Import and export `/admin/import-export` (admin only). Requirements: FR-39, FR-40. UI spec 3.9 and its phase 14 details. The gate
 * lets only the admin role in; the API checks the role again on every call. */
import { ImportExport } from "@/components/admin/ImportExport";
import { StaffGate } from "@/components/admin/StaffGate";

export default function AdminImportExportPage() {
  return (
    <StaffGate area="staff">
      <ImportExport />
    </StaffGate>
  );
}
