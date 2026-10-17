/** One emergency contact, compact. Requirements: FR-16 (name, area, distance, Call, last-verified date), FR-19, NFR-10.
 * UI spec 2.5, point 5. All text is rendered as text. It never shows a "Sponsored" tag (FR-19).
 */
import Link from "next/link";

import { CallButton } from "@/components/listings/CallButton";
import { VerifiedDate } from "@/components/listings/VerifiedDate";
import { formatDistance } from "@/lib/formatters/distance";
import type { ListingSummary } from "@/types/api";

type EmergencyContactCardProps = { contact: ListingSummary; now?: Date };

export function EmergencyContactCard({ contact, now }: EmergencyContactCardProps) {
  const distance = formatDistance(contact.distance_km);

  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h3 className="text-lg font-bold leading-snug text-forest">
        <Link href={`/listing/${contact.slug}`} prefetch={false} className="inline-flex min-h-12 items-center underline">
          {contact.name}
        </Link>
      </h3>
      <p className="text-base text-ink-soft">{distance ? `${contact.area} · ${distance}` : contact.area}</p>
      <div>
        <VerifiedDate lastVerifiedAt={contact.last_verified_at} verificationDue={contact.verification_due} now={now} />
      </div>
      {contact.primary_phone && <CallButton phone={contact.primary_phone} facilityName={contact.name} />}
    </article>
  );
}
