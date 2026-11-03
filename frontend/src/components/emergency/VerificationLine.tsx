/** The one verification line of a SwiftRescue contact card. Requirements: FR-08, FR-16 (the last-verified date), US-07, NFR-08, NFR-10.
 * Spec: specs/2026-11-03-emergency-page-tidy/requirements.md (owner, 2026-11-03). Before, an overdue contact showed an amber badge "Verification due"
 * and, beside it, the date: two things that said the same. Now there is one line: "Verified 27 days ago · check due", amber when the check is due, and the
 * calm green "Verified 3 days ago" when it is not. The listing cards and the listing page keep VerifiedDate. Colours are theme tokens (Light and Dark).
 */
import { Clock, ShieldCheck } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { formatVerified } from "@/lib/formatters/dates";

type VerificationLineProps = { lastVerifiedAt: string | null; verificationDue: boolean; now?: Date };

export function VerificationLine({ lastVerifiedAt, verificationDue, now = new Date() }: VerificationLineProps) {
  const verified = formatVerified(lastVerifiedAt, now);

  if (verificationDue) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-wash px-3 py-1 text-base font-semibold text-amber-ink">
        <DecorativeIcon icon={Clock} className="h-4 w-4 shrink-0" />
        {`${verified} · check due`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-pine-100 px-3 py-1 text-base font-semibold text-forest">
      <DecorativeIcon icon={ShieldCheck} className="h-4 w-4 shrink-0" />
      {verified}
    </span>
  );
}
