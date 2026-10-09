/** A tel: link styled as the primary button. Requirements: FR-06, FR-10, NFR-10.
 * Phone numbers are stored as +234 and ten digits; anything else is not shown as a link.
 */
import { buttonClasses } from "@/components/ui/buttonStyles";

type CallButtonProps = { phone: string; facilityName: string };

const NIGERIAN_NUMBER = /^\+234\d{10}$/;

export function CallButton({ phone, facilityName }: CallButtonProps) {
  if (!NIGERIAN_NUMBER.test(phone)) return null;

  return (
    <a href={`tel:${phone}`} aria-label={`Call ${facilityName}`} className={buttonClasses("primary")}>
      Call
    </a>
  );
}
