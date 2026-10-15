/** The note at the top of a listing that was recently reported as not working. Requirements: FR-22, NFR-10.
 * Spec: specs/2026-10-13-listing-page/requirements.md D6 (owner decision 6). Amber, never red: red belongs to emergencies. The listing, the
 * Call button and the rest of the page stay as they are; the page only shows this component when `recently_reported_not_working` is true.
 */
import { TriangleAlert } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

export function ReportedNotice() {
  return (
    <div role="note" className="flex gap-3 rounded-2xl bg-amber-wash p-4 text-amber-ink">
      <DecorativeIcon icon={TriangleAlert} className="mt-0.5 h-6 w-6" />
      <p className="text-base font-semibold">Recently reported as not working. Call before you go.</p>
    </div>
  );
}
