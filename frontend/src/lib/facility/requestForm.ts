/** The values of the owner form ("List your facility"), the checks in words and the body for the API. Requirements: US-17, FR-50,
 * FR-23. Spec: specs/2026-11-01-owner-form-fields/; api-spec 7, "The full owner form and drafts".
 * The values are text, as the person typed them. The API checks everything again; these checks only save a round trip.
 */
import type { FacilityRegistration, FacilityRole, HoursEntry, OtherPhone, SavedRequest } from "@/lib/api/facility";
import { formatPhoneForReading, toE164 } from "@/lib/formatters/phone";
import { DAY_NAMES } from "@/lib/staff/listingForm";

export const MAX_DESCRIPTION = 200;
export const MAX_NOTES = 300;
export const MAX_OTHER_PHONES = 4;

export type PhoneEntry = { number: string; label: string; hasWhatsApp: boolean };
/** One day. Both times empty and not closed means no hours were given for that day. */
export type DayHours = { opens: string; closes: string; closed: boolean };

export type RequestForm = {
  facilityName: string;
  category: string;
  area: string;
  address: string;
  landmark: string;
  description: string;
  email: string;
  phone: string; // the main number: the one staff phone
  phoneHasWhatsApp: boolean;
  otherPhones: PhoneEntry[];
  is24Hours: boolean;
  hours: DayHours[]; // Monday first, as DAY_NAMES
  services: string[];
  role: FacilityRole;
  notes: string;
};

const ORDINALS = ["second", "third", "fourth", "fifth"] as const;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyRequestForm(): RequestForm {
  return {
    facilityName: "", category: "", area: "", address: "", landmark: "", description: "", email: "",
    phone: "", phoneHasWhatsApp: false, otherPhones: [],
    is24Hours: false,
    hours: DAY_NAMES.map(() => ({ opens: "", closes: "", closed: false })),
    services: [], role: "owner", notes: "",
  };
}

/** Fills the form again from a saved request: numbers in the local reading format, times as hours and minutes. */
export function formFromRead(saved: SavedRequest): RequestForm {
  return {
    facilityName: saved.facility_name,
    category: saved.category,
    area: saved.area,
    address: saved.address,
    landmark: saved.landmark ?? "",
    description: saved.description ?? "",
    email: saved.email ?? "",
    phone: formatPhoneForReading(saved.phone),
    phoneHasWhatsApp: saved.phone_has_whatsapp,
    otherPhones: saved.other_phones.map((other) => ({
      number: formatPhoneForReading(other.number),
      label: other.label ?? "",
      hasWhatsApp: other.is_whatsapp,
    })),
    is24Hours: saved.is_24_hours,
    hours: DAY_NAMES.map((_name, day) => {
      const entry = saved.opening_hours.find((hours) => hours.day_of_week === day);
      if (!entry) return { opens: "", closes: "", closed: false };
      if (entry.is_closed) return { opens: "", closes: "", closed: true };
      return { opens: (entry.opens_at ?? "").slice(0, 5), closes: (entry.closes_at ?? "").slice(0, 5), closed: false };
    }),
    services: saved.services,
    role: saved.role,
    notes: saved.notes ?? "",
  };
}

function givenOtherPhones(form: RequestForm): PhoneEntry[] {
  return form.otherPhones.filter((other) => other.number.trim() !== "");
}

/** What is missing or wrong, in words, all at once. Empty when the form can be saved or sent. */
export function problemsOf(form: RequestForm): string[] {
  const problems: string[] = [];
  if (form.facilityName.trim().length < 2) problems.push("Enter the facility name.");
  if (form.category === "") problems.push("Choose a category.");
  if (form.area === "") problems.push("Choose an area.");
  if (form.address.trim().length < 3) problems.push("Enter the address.");
  if (toE164(form.phone.trim()) === null) problems.push("Check the phone number. It should look like 0803 123 4567.");
  const numbers = [toE164(form.phone.trim())];
  form.otherPhones.forEach((other, index) => {
    if (other.number.trim() === "") return;
    const normalised = toE164(other.number.trim());
    if (normalised === null) {
      problems.push(`Check the ${ORDINALS[index]} phone number. It should look like 0803 123 4567.`);
    } else {
      numbers.push(normalised);
    }
  });
  const known = numbers.filter((number): number is string => number !== null);
  if (new Set(known).size !== known.length) problems.push("Each phone number can be listed only once.");
  if (form.description.trim().length > MAX_DESCRIPTION) problems.push(`The description can have at most ${MAX_DESCRIPTION} characters.`);
  if (form.email.trim() !== "" && !EMAIL_SHAPE.test(form.email.trim())) problems.push("Check the email address.");
  if (!form.is24Hours) {
    form.hours.forEach((day, index) => {
      if (!day.closed && (day.opens === "") !== (day.closes === "")) {
        problems.push(`${DAY_NAMES[index]}: enter the opening and the closing time, or choose Closed.`);
      }
    });
  }
  return problems;
}

function hoursEntries(form: RequestForm): HoursEntry[] {
  const entries: HoursEntry[] = [];
  form.hours.forEach((day, index) => {
    if (day.closed) entries.push({ day_of_week: index, is_closed: true });
    else if (day.opens !== "" && day.closes !== "") {
      entries.push({ day_of_week: index, opens_at: day.opens, closes_at: day.closes, is_closed: false });
    }
  });
  return entries;
}

/** The body of the API call. An empty optional field is left out, so the API sees only what the person gave. */
export function toBody(form: RequestForm, saveAsDraft: boolean): FacilityRegistration {
  const others: OtherPhone[] = givenOtherPhones(form).map((other) => ({
    number: other.number.trim(),
    ...(other.label.trim() ? { label: other.label.trim() } : {}),
    is_whatsapp: other.hasWhatsApp,
  }));
  const hours = form.is24Hours ? [] : hoursEntries(form);
  const text = (value: string) => value.trim();
  return {
    facility_name: text(form.facilityName),
    category: form.category,
    area: form.area,
    address: text(form.address),
    ...(text(form.landmark) ? { landmark: text(form.landmark) } : {}),
    ...(text(form.description) ? { description: text(form.description) } : {}),
    ...(text(form.email) ? { email: text(form.email) } : {}),
    phone: text(form.phone),
    phone_has_whatsapp: form.phoneHasWhatsApp,
    ...(others.length > 0 ? { other_phones: others } : {}),
    is_24_hours: form.is24Hours,
    ...(hours.length > 0 ? { opening_hours: hours } : {}),
    ...(form.services.length > 0 ? { services: form.services } : {}),
    role: form.role,
    ...(text(form.notes) ? { notes: text(form.notes) } : {}),
    save_as_draft: saveAsDraft,
  };
}
