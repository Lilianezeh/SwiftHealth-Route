/** The listing editor's form logic. Requirements: FR-31, FR-38, FR-42. UI spec 3.4 and "Phase 10 details"; decisions C1 and C12 in
 * specs/2026-10-20-staff-screens/requirements.md.
 *
 * Form values are text (what the inputs hold). `toInput` checks them and builds the API body; the messages are what the screen shows
 * before it calls, so a mistake is caught at once (the API checks again). `diffForPatch` keeps only what changed, so a save writes
 * only real changes in the audit log. Fees stay strings with two decimals and never pass through a floating point number.
 */
import type { HoursInput, ListingInput, PhoneInput, ServiceInput, StaffListingDetail } from "@/types/staff";

export type PhoneRow = { number: string; label: string; isPrimary: boolean; isWhatsApp: boolean };
export type HoursRow = { opens: string; closes: string; closed: boolean };
export type ServiceRow = { name: string; min: string; max: string; collected: string };

export type ListingForm = {
  name: string;
  category: string; // slug
  area: string;
  address: string;
  landmark: string;
  latitude: string;
  longitude: string;
  description: string;
  is24Hours: boolean;
  phones: PhoneRow[];
  hours: HoursRow[]; // always 7, Monday first
  services: ServiceRow[];
};

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const FEE_FORMAT = /^\d+(\.\d{1,2})?$/;

export function emptyForm(): ListingForm {
  return {
    name: "",
    category: "",
    area: "",
    address: "",
    landmark: "",
    latitude: "",
    longitude: "",
    description: "",
    is24Hours: false,
    phones: [{ number: "", label: "", isPrimary: true, isWhatsApp: false }],
    hours: DAY_NAMES.map(() => ({ opens: "", closes: "", closed: true })),
    services: [],
  };
}

export function formFromDetail(detail: StaffListingDetail): ListingForm {
  return {
    name: detail.name,
    category: detail.category.slug,
    area: detail.area,
    address: detail.address,
    landmark: detail.landmark ?? "",
    latitude: String(detail.latitude),
    longitude: String(detail.longitude),
    description: detail.description ?? "",
    is24Hours: detail.is_24_hours,
    phones: detail.phones.map((phone) => ({
      number: phone.number,
      label: phone.label ?? "",
      isPrimary: phone.is_primary,
      isWhatsApp: phone.is_whatsapp,
    })),
    hours: DAY_NAMES.map((_name, day) => {
      const entry = detail.opening_hours.find((hours) => hours.day_of_week === day);
      return entry && !entry.is_closed
        ? { opens: entry.opens_at ?? "", closes: entry.closes_at ?? "", closed: false }
        : { opens: "", closes: "", closed: true };
    }),
    services: detail.services.map((service) => ({
      name: service.name,
      min: service.fee_min_naira ?? "",
      max: service.fee_max_naira ?? "",
      collected: service.fee_collected_at ?? "",
    })),
  };
}

/** A fee typed as 1500 or 1500.5, written as "1500.00" or "1500.50". The text is only padded, never turned into a float. */
function feeText(typed: string): string | null {
  const text = typed.trim();
  if (text === "") return null;
  const [whole, decimals = ""] = text.split(".");
  return `${whole}.${decimals.padEnd(2, "0")}`;
}

function nullIfBlank(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

/** The body for the API from the form values, with no checking (see `toInput`). */
function bodyFromForm(form: ListingForm): ListingInput {
  const phones: PhoneInput[] = form.phones.map((phone) => ({
    number: phone.number.trim(),
    label: nullIfBlank(phone.label),
    is_primary: phone.isPrimary,
    is_whatsapp: phone.isWhatsApp,
  }));
  const opening_hours: HoursInput[] = form.hours.map((day, index) => ({
    day_of_week: index,
    opens_at: day.closed ? null : nullIfBlank(day.opens),
    closes_at: day.closed ? null : nullIfBlank(day.closes),
    is_closed: day.closed,
  }));
  const services: ServiceInput[] = form.services.map((service) => ({
    name: service.name.trim(),
    fee_min_naira: feeText(service.min),
    fee_max_naira: feeText(service.max),
    fee_collected_at: nullIfBlank(service.collected),
  }));
  return {
    name: form.name.trim(),
    category: form.category,
    area: form.area,
    address: form.address.trim(),
    landmark: nullIfBlank(form.landmark),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    description: nullIfBlank(form.description),
    is_24_hours: form.is24Hours,
    phones,
    opening_hours,
    services,
  };
}

function isNumberBetween(text: string, low: number, high: number): boolean {
  const trimmed = text.trim();
  if (trimmed === "") return false;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= low && value <= high;
}

export type ToInputResult = { ok: true; input: ListingInput } | { ok: false; errors: string[] };

/** Checks the form and builds the body. Every problem is reported at once, in plain words. */
export function toInput(form: ListingForm): ToInputResult {
  const errors: string[] = [];
  if (form.name.trim() === "") errors.push("Enter the name.");
  if (form.category === "") errors.push("Choose a category.");
  if (form.area === "") errors.push("Choose an area.");
  if (form.address.trim() === "") errors.push("Enter the address.");
  if (!isNumberBetween(form.latitude, -90, 90)) errors.push("Enter the latitude as a number between -90 and 90.");
  if (!isNumberBetween(form.longitude, -180, 180)) errors.push("Enter the longitude as a number between -180 and 180.");

  if (form.phones.length === 0) errors.push("Add at least one phone number.");
  else {
    if (form.phones.some((phone) => phone.number.trim() === "")) errors.push("Enter every phone number.");
    if (form.phones.filter((phone) => phone.isPrimary).length !== 1) errors.push("Choose exactly one primary phone.");
  }

  form.hours.forEach((day, index) => {
    if (!day.closed && (day.opens.trim() === "" || day.closes.trim() === "")) {
      errors.push(`${DAY_NAMES[index]}: enter the opening and the closing time, or tick Closed.`);
    }
  });

  const seen = new Set<string>();
  for (const service of form.services) {
    const name = service.name.trim();
    if (name === "") {
      errors.push("Choose a name for every service.");
      continue;
    }
    if (seen.has(name)) errors.push(`${name} is listed twice.`);
    seen.add(name);
    const fees = [
      ["minimum", service.min],
      ["maximum", service.max],
    ] as const;
    for (const [which, typed] of fees) {
      if (typed.trim() !== "" && !FEE_FORMAT.test(typed.trim())) {
        errors.push(`${name}: the ${which} fee must be an amount in naira, like 1500 or 1500.50.`);
      }
    }
    const low = feeInKobo(service.min);
    const high = feeInKobo(service.max);
    if (low !== null && high !== null && low > high) errors.push(`${name}: the minimum fee cannot be above the maximum.`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, input: bodyFromForm(form) };
}

/** A valid fee as a number of kobo, for comparing two fees only (never sent anywhere). Null if blank or not a valid amount. */
function feeInKobo(fee: string): number | null {
  const text = fee.trim();
  if (!FEE_FORMAT.test(text)) return null;
  const [whole, decimals = ""] = text.split(".");
  return Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
}

/** The fields of `current` that differ from `initial`, as a PATCH body. A list is sent whole when anything in it changed. */
export function diffForPatch(initial: ListingForm, current: ListingForm): Partial<ListingInput> {
  const before = bodyFromForm(initial);
  const after = bodyFromForm(current);
  const patch: Partial<ListingInput> = {};
  const keys = Object.keys(after) as (keyof ListingInput)[];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      (patch as Record<string, unknown>)[key] = after[key];
    }
  }
  return patch;
}
