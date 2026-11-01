"use client";

/** The groups of fields of the owner form that are more than one input: more phone numbers, opening hours for each day, and the services.
 * Requirements: US-17, FR-50, NFR-10. Spec: specs/2026-11-01-owner-form-fields/; UI spec 2.9. The container (RegisterFacility) owns the
 * values and checks them. Every field has a label, is at least 48 px high and 16 px or larger.
 */
import { Plus, Trash2 } from "lucide-react";

import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { MAX_OTHER_PHONES, type DayHours, type PhoneEntry } from "@/lib/facility/requestForm";
import { DAY_NAMES } from "@/lib/staff/listingForm";

export const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink disabled:bg-closed-bg";
export const CHOICE = "flex min-h-12 items-center gap-3 text-base text-ink";
const GROUP = "flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3";
const SMALL_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pine bg-surface px-4 text-base font-semibold text-forest";

type PhonesProps = { phones: PhoneEntry[]; onChange: (phones: PhoneEntry[]) => void };

/** The numbers after the main one: a number, an optional label, and "This number has WhatsApp" for each. */
export function OtherPhones({ phones, onChange }: PhonesProps) {
  const change = (index: number, changes: Partial<PhoneEntry>) =>
    onChange(phones.map((phone, position) => (position === index ? { ...phone, ...changes } : phone)));

  return (
    <>
      {phones.map((phone, index) => (
        <fieldset key={index} className={GROUP}>
          <legend className="px-1 text-base font-semibold text-ink">{`Phone number ${index + 2}`}</legend>
          <div className="flex flex-col gap-1">
            <label htmlFor={`other-phone-${index}`} className="text-base font-semibold text-ink">Number</label>
            <input id={`other-phone-${index}`} inputMode="tel" autoComplete="off" value={phone.number} onChange={(event) => change(index, { number: event.target.value })} className={FIELD} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`other-label-${index}`} className="text-base font-semibold text-ink">Label (optional)</label>
            <input id={`other-label-${index}`} maxLength={50} value={phone.label} onChange={(event) => change(index, { label: event.target.value })} className={FIELD} />
          </div>
          <label className={CHOICE}>
            <input type="checkbox" checked={phone.hasWhatsApp} onChange={(event) => change(index, { hasWhatsApp: event.target.checked })} className="size-5" />
            This number has WhatsApp
          </label>
          <button type="button" onClick={() => onChange(phones.filter((_phone, position) => position !== index))} className={SMALL_BUTTON}>
            <DecorativeIcon icon={Trash2} />
            Remove
          </button>
        </fieldset>
      ))}
      {phones.length < MAX_OTHER_PHONES && (
        <button type="button" onClick={() => onChange([...phones, { number: "", label: "", hasWhatsApp: false }])} className={SMALL_BUTTON}>
          <DecorativeIcon icon={Plus} />
          Add another phone number
        </button>
      )}
    </>
  );
}

type HoursProps = {
  is24Hours: boolean;
  hours: DayHours[];
  onChange: (changes: { is24Hours: boolean; hours: DayHours[] }) => void;
};

/** "Open 24 hours" for the whole facility, or the opening and closing time of each day, or the day closed. */
export function OpeningHours({ is24Hours, hours, onChange }: HoursProps) {
  const changeDay = (index: number, changes: Partial<DayHours>) =>
    onChange({ is24Hours, hours: hours.map((day, position) => (position === index ? { ...day, ...changes } : day)) });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-base font-semibold text-ink">Opening hours</p>
      <label className={CHOICE}>
        <input type="checkbox" checked={is24Hours} onChange={(event) => onChange({ is24Hours: event.target.checked, hours })} className="size-5" />
        Open 24 hours
      </label>
      {!is24Hours &&
        hours.map((day, index) => (
          <fieldset key={DAY_NAMES[index]} className={GROUP}>
            <legend className="px-1 text-base font-semibold text-ink">{DAY_NAMES[index]}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor={`hours-${index}-opens`} className="text-base text-ink">Opens</label>
                <input id={`hours-${index}-opens`} type="time" disabled={day.closed} value={day.opens} onChange={(event) => changeDay(index, { opens: event.target.value })} className={FIELD} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`hours-${index}-closes`} className="text-base text-ink">Closes</label>
                <input id={`hours-${index}-closes`} type="time" disabled={day.closed} value={day.closes} onChange={(event) => changeDay(index, { closes: event.target.value })} className={FIELD} />
              </div>
            </div>
            <label className={CHOICE}>
              <input
                type="checkbox"
                checked={day.closed}
                onChange={(event) => changeDay(index, event.target.checked ? { closed: true, opens: "", closes: "" } : { closed: false })}
                className="size-5"
              />
              Closed
            </label>
          </fieldset>
        ))}
    </div>
  );
}

type ServicesProps = { catalogue: string[]; chosen: string[]; onChange: (chosen: string[]) => void };

/** The services of the API's list, to tick. */
export function ServiceChoices({ catalogue, chosen, onChange }: ServicesProps) {
  if (catalogue.length === 0) return null;
  return (
    <fieldset className="flex flex-col">
      <legend className="text-base font-semibold text-ink">Services (optional)</legend>
      {catalogue.map((service) => (
        <label key={service} className={CHOICE}>
          <input
            type="checkbox"
            name={service}
            checked={chosen.includes(service)}
            onChange={(event) => onChange(event.target.checked ? [...chosen, service] : chosen.filter((name) => name !== service))}
            className="size-5"
          />
          {service}
        </label>
      ))}
    </fieldset>
  );
}
