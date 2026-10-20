/** GET /blood/banks and GET /blood/donation-centres from the browser. Requirements: US-15, US-16, FR-27, FR-28.
 * Contract: api-spec, "Phase 8 rules for both blood endpoints".
 *
 * The visitor's position is sent only here, only as `lat` and `lng` together (never in a page address).
 */
import { PAGE_SIZE } from "@/config/search";
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { Page, Position } from "@/lib/api/search";
import type { BloodBankList, DonationCentreList } from "@/types/api";

function pageQuery(position: Position | null, page: Page): URLSearchParams {
  const parameters = new URLSearchParams();
  if (position) {
    parameters.set("lat", String(position.latitude));
    parameters.set("lng", String(position.longitude));
  }
  parameters.set("limit", String(page.limit));
  parameters.set("offset", String(page.offset));
  return parameters;
}

export function getBloodBanks(
  bloodGroup: string | null,
  position: Position | null,
  page: Page = { limit: PAGE_SIZE, offset: 0 },
  options: RequestOptions = {},
): Promise<BloodBankList> {
  const parameters = pageQuery(position, page);
  if (bloodGroup) parameters.set("blood_group", bloodGroup);
  return requestJson<BloodBankList>(`/blood/banks?${parameters.toString()}`, options);
}

export function getDonationCentres(
  position: Position | null,
  page: Page = { limit: PAGE_SIZE, offset: 0 },
  options: RequestOptions = {},
): Promise<DonationCentreList> {
  return requestJson<DonationCentreList>(`/blood/donation-centres?${pageQuery(position, page).toString()}`, options);
}
