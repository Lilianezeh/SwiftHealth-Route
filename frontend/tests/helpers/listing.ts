/** A listing page answer for tests: `GET /listings/{slug}` of a clearly fictional pharmacy (api-spec, "ListingDetail").
 * `makeListing({ ... })` changes only what a test cares about. The phone numbers are the impossible "+234 then zeros" form of the seed.
 */
import type { ListingDetail, OpeningHoursRead, PhoneRead, ServiceRead } from "@/types/api";

export const WEEK: OpeningHoursRead[] = [
  { day_of_week: 0, opens_at: "08:00", closes_at: "17:00", is_closed: false },
  { day_of_week: 1, opens_at: "08:00", closes_at: "17:00", is_closed: false },
  { day_of_week: 2, opens_at: "08:00", closes_at: "17:00", is_closed: false },
  { day_of_week: 3, opens_at: "08:00", closes_at: "17:00", is_closed: false },
  { day_of_week: 4, opens_at: "20:00", closes_at: "02:00", is_closed: false }, // past midnight
  { day_of_week: 5, opens_at: "09:00", closes_at: "13:00", is_closed: false },
  { day_of_week: 6, opens_at: null, closes_at: null, is_closed: true },
];

export const PRIMARY_PHONE: PhoneRead = { number: "+2340000000012", label: "Front desk", is_primary: true, is_whatsapp: false };
export const OTHER_PHONE: PhoneRead = { number: "+2340000000013", label: "Emergency", is_primary: false, is_whatsapp: false };

export const SERVICES: ServiceRead[] = [
  { name: "Consultation", fee_min_naira: "1500.00", fee_max_naira: "3000.00", fee_collected_at: "2026-09-28" },
  { name: "Blood pressure check", fee_min_naira: "500.00", fee_max_naira: "500.00", fee_collected_at: null },
  { name: "Malaria test", fee_min_naira: "1000.00", fee_max_naira: null, fee_collected_at: null },
  { name: "Home visit", fee_min_naira: null, fee_max_naira: null, fee_collected_at: null },
];

export function makeListing(overrides: Partial<ListingDetail> = {}): ListingDetail {
  return {
    id: 12,
    slug: "night-pharmacy-a",
    name: "Night Pharmacy A",
    category: { slug: "pharmacy", name: "Pharmacy" },
    area: "New Haven",
    address: "12 Example Road, New Haven",
    latitude: 6.452,
    longitude: 7.51,
    distance_km: null, // the page never sends a position
    is_open_now: true,
    is_24_hours: false,
    primary_phone: PRIMARY_PHONE.number,
    last_verified_at: "2026-10-01T10:00:00Z",
    verification_due: false,
    sponsored: false,
    hours_note: "Closes 5:00 PM",
    landmark: "Opposite the Example Market",
    description: "Demo data (fictional): not a real facility.",
    entrance_photo_url: "https://images.example.com/night-pharmacy-a.jpg",
    phones: [PRIMARY_PHONE, OTHER_PHONE],
    opening_hours: WEEK,
    services: SERVICES,
    recently_reported_not_working: false,
    disclaimer: "SwiftHealth Route is a directory and does not give medical advice. Confirm details with the facility.",
    ...overrides,
  };
}
