/** A tel: link styled as the primary button. Requirements: FR-06, FR-10, NFR-10.
 * Phone numbers are stored as +234 and ten digits; anything else is not shown as a link.
 * On the listing page the Call button of the primary number is `large` (56 px, so Call stays the biggest button) and a number's `label`
 * ("Front desk", "Emergency") is part of the button's name when the page lists several numbers (spec D1).
 */
import { Phone } from "lucide-react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";

type CallButtonProps = { phone: string; facilityName: string; label?: string | null; large?: boolean };

const NIGERIAN_NUMBER = /^\+234\d{10}$/;

export function CallButton({ phone, facilityName, label, large = false }: CallButtonProps) {
  if (!NIGERIAN_NUMBER.test(phone)) return null;

  return (
    <a
      href={`tel:${phone}`}
      aria-label={`Call ${facilityName}${label ? ` (${label})` : ""}`}
      className={buttonClasses("primary", { large })}
    >
      <DecorativeIcon icon={Phone} />
      Call
    </a>
  );
}
