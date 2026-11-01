/** The blood bank and donation centre calls from the browser. Requirements: US-15, US-16, FR-27, FR-28, NFR-07.
 * Contract: api-spec, "Phase 8 rules for both blood endpoints" and "POST /blood/banks", "POST /blood/donation-centres".
 *
 * The visitor's position is sent only here, only as `lat` and `lng` together, in the BODY of a POST (never in a page address and never in
 * the address of the API call: a hosting platform may log an address). Without a position it is a plain GET.
 */
import { PAGE_SIZE } from "@/config/search";
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { Page, Position } from "@/lib/api/search";
import type { BloodBankList, DonationCentreList } from "@/types/api";

type Fields = Record<string, string | number>;

function pageFields(position: Position | null, page: Page): Fields {
  const fields: Fields = {};
  if (position) {
    fields.lat = position.latitude;
    fields.lng = position.longitude;
  }
  fields.limit = page.limit;
  fields.offset = page.offset;
  return fields;
}

/** A POST with the fields in the body when there is a position (it is among them), else a GET with them in the address. */
function ask<T>(path: string, fields: Fields, hasPosition: boolean, options: RequestOptions): Promise<T> {
  if (hasPosition) return requestJson<T>(path, { ...options, body: fields });
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(fields)) parameters.set(name, String(value));
  return requestJson<T>(`${path}?${parameters.toString()}`, options);
}

export function getBloodBanks(
  bloodGroup: string | null,
  position: Position | null,
  page: Page = { limit: PAGE_SIZE, offset: 0 },
  options: RequestOptions = {},
): Promise<BloodBankList> {
  const fields = pageFields(position, page);
  if (bloodGroup) fields.blood_group = bloodGroup;
  return ask<BloodBankList>("/blood/banks", fields, position !== null, options);
}

export function getDonationCentres(
  position: Position | null,
  page: Page = { limit: PAGE_SIZE, offset: 0 },
  options: RequestOptions = {},
): Promise<DonationCentreList> {
  return ask<DonationCentreList>("/blood/donation-centres", pageFields(position, page), position !== null, options);
}
