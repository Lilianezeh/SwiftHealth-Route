/** When the listing was last verified, with an amber label when it is overdue. Requirements: FR-08, US-07, NFR-08.
 * An overdue listing still shows its date next to the label: every listing shows when it was last verified.
 */
import { Clock, ShieldCheck } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { formatVerified } from "@/lib/formatters/dates";

type VerifiedDateProps = { lastVerifiedAt: string | null; verificationDue: boolean; now?: Date };

export function VerifiedDate({ lastVerifiedAt, verificationDue, now = new Date() }: VerifiedDateProps) {
  const verified = formatVerified(lastVerifiedAt, now);

  if (verificationDue) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-wash px-3 py-1 text-base font-semibold text-amber-ink">
          <DecorativeIcon icon={Clock} className="h-4 w-4" />
          Verification due
        </span>
        <span className="text-base text-ink-soft">{verified}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-pine-100 px-3 py-1 text-base font-semibold text-forest">
      <DecorativeIcon icon={ShieldCheck} className="h-4 w-4" />
      {verified}
    </span>
  );
}
