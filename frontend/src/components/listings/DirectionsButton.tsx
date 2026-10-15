/** The Google Maps directions link, from the listing's own latitude and longitude. Requirements: FR-06, FR-10, NFR-10.
 * The one Directions button of the site: the result cards, the map popups and the listing page all use it, so the road-sign icon
 * (DirectionsIcon, 24 px) changes everywhere at once. The link holds the facility's position only, never the visitor's (NFR-07).
 */
import { DirectionsIcon } from "@/components/listings/DirectionsIcon";
import { buttonClasses } from "@/components/ui/buttonStyles";

type DirectionsButtonProps = { latitude: number; longitude: number; facilityName: string };

function isRealPosition(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

export function DirectionsButton({ latitude, longitude, facilityName }: DirectionsButtonProps) {
  if (!isRealPosition(latitude, longitude)) return null;

  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Directions to ${facilityName} (opens in a new tab)`}
      className={buttonClasses("secondary")}
    >
      <DirectionsIcon />
      Directions
    </a>
  );
}
