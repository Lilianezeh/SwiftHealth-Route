/** The services of a listing with their fee ranges. Requirements: FR-09, FR-11, US-06, NFR-10. Spec: specs/2026-10-13-listing-page/requirements.md D6.
 * The words "Estimate — confirm with the facility" always show once above the services (FR-11). A service with no fee says "Ask for price"
 * (owner, 2026-10-13), and a fee with no date has no date. Nothing at all when the listing has no services.
 */
import { describeFee } from "@/lib/formatters/fees";
import type { ServiceRead } from "@/types/api";

type ServicesFeesProps = { services: ServiceRead[] };

export function ServicesFees({ services }: ServicesFeesProps) {
  if (services.length === 0) return null;

  return (
    <section aria-labelledby="services-heading">
      <h2 id="services-heading" className="text-xl font-bold text-forest">
        Services and fees
      </h2>
      <p className="mt-1 text-base text-ink-soft">Estimate — confirm with the facility</p>
      <ul className="mt-3 flex flex-col">
        {services.map((service) => {
          const fee = describeFee(service);
          return (
            <li key={service.name} className="border-b border-line py-3">
              <p className="text-base font-semibold text-ink">{service.name}</p>
              {fee.amount ? (
                <p className="text-base text-ink">
                  {fee.amount}
                  {fee.collected && <span className="text-ink-soft"> · {fee.collected}</span>}
                </p>
              ) : (
                <p className="text-base text-ink-soft">Ask for price</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
