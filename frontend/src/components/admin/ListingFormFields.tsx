"use client";

/** The sections of the listing editor: Basics, Location, Phones, Opening hours, Services and fees, Description.
 * Requirements: FR-31, FR-42, NFR-10. UI spec 3.4 and "Phase 10 details"; decisions C1 and C12 in
 * specs/2026-10-20-staff-screens/requirements.md. The form values are text; the container (ListingEditor) owns them and checks them.
 * Every field has a label (the rows of phones, hours and services have one per row), is at least 48 px high and 16 px or larger.
 */
import { LocateFixed, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { DAY_NAMES, type ListingForm, type PhoneRow, type ServiceRow } from "@/lib/staff/listingForm";
import type { MetaResponse } from "@/types/api";

const FIELD = "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink disabled:bg-closed-bg";
const SECTION = "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4";
const SMALL_BUTTON = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-pine bg-surface px-4 text-base font-semibold text-forest disabled:opacity-50";

type FieldProps = { id: string; label: string; children: ReactNode };

function Field({ id, label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      {children}
    </div>
  );
}

type ListingFormFieldsProps = {
  form: ListingForm;
  onChange: (form: ListingForm) => void;
  meta: MetaResponse | null;
  disabled: boolean;
  mapPinIsDefault: boolean;
  submissionDetails: string | null;
  onUseMyLocation: () => void;
  locationMessage: string | null;
  /** A provider changes only phones, hours, services and the description (FR-43): no Basics, Location or submission details. */
  providerView?: boolean;
};

export function ListingFormFields({
  form,
  onChange,
  meta,
  disabled,
  mapPinIsDefault,
  submissionDetails,
  onUseMyLocation,
  locationMessage,
  providerView = false,
}: ListingFormFieldsProps) {
  const set = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => onChange({ ...form, [key]: value });

  function setPhone(index: number, changes: Partial<PhoneRow>) {
    set("phones", form.phones.map((phone, position) => (position === index ? { ...phone, ...changes } : phone)));
  }

  function choosePrimary(index: number) {
    set("phones", form.phones.map((phone, position) => ({ ...phone, isPrimary: position === index })));
  }

  function removePhone(index: number) {
    const remaining = form.phones.filter((_phone, position) => position !== index);
    if (remaining.length > 0 && !remaining.some((phone) => phone.isPrimary)) remaining[0] = { ...remaining[0], isPrimary: true };
    set("phones", remaining);
  }

  function setService(index: number, changes: Partial<ServiceRow>) {
    set("services", form.services.map((service, position) => (position === index ? { ...service, ...changes } : service)));
  }

  const serviceNames = meta?.service_catalogue ?? [];
  const bloodGroups = meta?.blood_groups ?? [];

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-6 border-0 p-0">
      {!providerView && (
        <>
      <section className={SECTION} aria-labelledby="basics-heading">
        <h2 id="basics-heading" className="text-xl font-bold text-forest">Basics</h2>
        <Field id="listing-name" label="Name">
          <input id="listing-name" value={form.name} onChange={(event) => set("name", event.target.value)} className={FIELD} />
        </Field>
        <Field id="listing-category" label="Category">
          <select id="listing-category" value={form.category} onChange={(event) => set("category", event.target.value)} className={FIELD}>
            <option value="">Choose a category</option>
            {meta?.categories.map((category) => (
              <option key={category.slug} value={category.slug}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field id="listing-area" label="Area">
          <select id="listing-area" value={form.area} onChange={(event) => set("area", event.target.value)} className={FIELD}>
            <option value="">Choose an area</option>
            {meta?.areas.map((area) => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </Field>
        <Field id="listing-address" label="Address">
          <input id="listing-address" value={form.address} onChange={(event) => set("address", event.target.value)} className={FIELD} />
        </Field>
        <Field id="listing-landmark" label="Landmark">
          <input id="listing-landmark" value={form.landmark} onChange={(event) => set("landmark", event.target.value)} className={FIELD} />
        </Field>
        <label className="inline-flex min-h-12 items-center gap-3 text-base text-ink">
          <input type="checkbox" checked={form.is24Hours} onChange={(event) => set("is24Hours", event.target.checked)} className="h-5 w-5 accent-pine" />
          Open 24 hours
        </label>
      </section>

      <section className={SECTION} aria-labelledby="location-heading">
        <h2 id="location-heading" className="text-xl font-bold text-forest">Location</h2>
        {mapPinIsDefault && (
          <p className="rounded-2xl border border-line bg-amber-wash p-3 text-base font-semibold text-amber-ink">
            The map pin is still the default. Set the real position before you submit.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="listing-latitude" label="Latitude">
            <input id="listing-latitude" inputMode="decimal" value={form.latitude} onChange={(event) => set("latitude", event.target.value)} className={FIELD} />
          </Field>
          <Field id="listing-longitude" label="Longitude">
            <input id="listing-longitude" inputMode="decimal" value={form.longitude} onChange={(event) => set("longitude", event.target.value)} className={FIELD} />
          </Field>
        </div>
        <button type="button" onClick={onUseMyLocation} className={buttonClasses("secondary")}>
          <DecorativeIcon icon={LocateFixed} />
          Use my current location
        </button>
        {locationMessage && (
          <p role="status" className="text-base text-ink">{locationMessage}</p>
        )}
      </section>
        </>
      )}

      <section className={SECTION} aria-labelledby="phones-heading">
        <h2 id="phones-heading" className="text-xl font-bold text-forest">Phones</h2>
        {form.phones.map((phone, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <Field id={`phone-number-${index}`} label={`Phone number ${index + 1}`}>
              <input id={`phone-number-${index}`} inputMode="tel" value={phone.number} onChange={(event) => setPhone(index, { number: event.target.value })} className={FIELD} />
            </Field>
            <Field id={`phone-label-${index}`} label={`Label for phone ${index + 1}`}>
              <input id={`phone-label-${index}`} value={phone.label} onChange={(event) => setPhone(index, { label: event.target.value })} className={FIELD} placeholder="Front desk" />
            </Field>
            <div className="flex flex-wrap items-center gap-x-6">
              <label className="inline-flex min-h-12 items-center gap-3 text-base text-ink">
                <input type="radio" name="primary-phone" checked={phone.isPrimary} onChange={() => choosePrimary(index)} aria-label={`Phone ${index + 1} is primary`} className="h-5 w-5 accent-pine" />
                Primary
              </label>
              <label className="inline-flex min-h-12 items-center gap-3 text-base text-ink">
                <input type="checkbox" checked={phone.isWhatsApp} onChange={(event) => setPhone(index, { isWhatsApp: event.target.checked })} aria-label={`Phone ${index + 1} is on WhatsApp`} className="h-5 w-5 accent-pine" />
                On WhatsApp
              </label>
              <button type="button" onClick={() => removePhone(index)} disabled={form.phones.length === 1} className={SMALL_BUTTON} aria-label={`Remove phone ${index + 1}`}>
                <DecorativeIcon icon={Trash2} />
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set("phones", [...form.phones, { number: "", label: "", isPrimary: false, isWhatsApp: false }])}
          className={SMALL_BUTTON}
        >
          <DecorativeIcon icon={Plus} />
          Add a phone number
        </button>
      </section>

      <section className={SECTION} aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-xl font-bold text-forest">Opening hours</h2>
        <p className="text-base text-ink-soft">A closing time earlier than the opening time runs past midnight.</p>
        {form.hours.map((day, index) => (
          <div key={DAY_NAMES[index]} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[8rem_1fr_1fr_auto]">
            <p className="col-span-2 text-base font-semibold text-ink sm:col-span-1 sm:self-center">{DAY_NAMES[index]}</p>
            <Field id={`hours-opens-${index}`} label={`${DAY_NAMES[index]} opens`}>
              <input id={`hours-opens-${index}`} type="time" value={day.opens} disabled={day.closed} onChange={(event) => set("hours", form.hours.map((row, position) => (position === index ? { ...row, opens: event.target.value } : row)))} className={FIELD} />
            </Field>
            <Field id={`hours-closes-${index}`} label={`${DAY_NAMES[index]} closes`}>
              <input id={`hours-closes-${index}`} type="time" value={day.closes} disabled={day.closed} onChange={(event) => set("hours", form.hours.map((row, position) => (position === index ? { ...row, closes: event.target.value } : row)))} className={FIELD} />
            </Field>
            <label className="col-span-2 inline-flex min-h-12 items-center gap-3 text-base text-ink sm:col-span-1">
              <input type="checkbox" checked={day.closed} onChange={(event) => set("hours", form.hours.map((row, position) => (position === index ? { ...row, closed: event.target.checked } : row)))} aria-label={`${DAY_NAMES[index]} closed`} className="h-5 w-5 accent-pine" />
              Closed
            </label>
          </div>
        ))}
      </section>

      <section className={SECTION} aria-labelledby="services-heading">
        <h2 id="services-heading" className="text-xl font-bold text-forest">Services and fees</h2>
        <p className="text-base text-ink-soft">Fees are optional estimates in naira. Pick each service from the list.</p>
        {form.services.map((service, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <Field id={`service-name-${index}`} label={`Service ${index + 1} name`}>
              <select id={`service-name-${index}`} value={service.name} onChange={(event) => setService(index, { name: event.target.value })} className={FIELD}>
                <option value="">Choose a service</option>
                {serviceNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field id={`service-min-${index}`} label={`Service ${index + 1} minimum fee (naira)`}>
                <input id={`service-min-${index}`} inputMode="decimal" value={service.min} onChange={(event) => setService(index, { min: event.target.value })} className={FIELD} />
              </Field>
              <Field id={`service-max-${index}`} label={`Service ${index + 1} maximum fee (naira)`}>
                <input id={`service-max-${index}`} inputMode="decimal" value={service.max} onChange={(event) => setService(index, { max: event.target.value })} className={FIELD} />
              </Field>
              <Field id={`service-collected-${index}`} label={`Service ${index + 1} date collected`}>
                <input id={`service-collected-${index}`} type="date" value={service.collected} onChange={(event) => setService(index, { collected: event.target.value })} className={FIELD} />
              </Field>
            </div>
            <button type="button" onClick={() => set("services", form.services.filter((_service, position) => position !== index))} className={`${SMALL_BUTTON} self-start`} aria-label={`Remove service ${index + 1}`}>
              <DecorativeIcon icon={Trash2} />
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set("services", [...form.services, { name: "", min: "", max: "", collected: "" }])} className={SMALL_BUTTON}>
          <DecorativeIcon icon={Plus} />
          Add a service
        </button>
      </section>

      <section className={SECTION} aria-labelledby="description-heading">
        <h2 id="description-heading" className="text-xl font-bold text-forest">Description</h2>
        <Field id="listing-description" label="Description (shown to the public)">
          <textarea id="listing-description" rows={3} value={form.description} onChange={(event) => set("description", event.target.value)} className="w-full rounded-xl border border-line bg-surface p-3 text-base text-ink disabled:bg-closed-bg" />
        </Field>
      </section>

      {!providerView && submissionDetails && (
        <section className={SECTION} aria-labelledby="submission-heading">
          <h2 id="submission-heading" className="text-xl font-bold text-forest">Submission details</h2>
          <p className="text-base text-ink-soft">From the &ldquo;List your facility&rdquo; form. Staff only: this is never shown to the public.</p>
          <p className="whitespace-pre-wrap text-base text-ink">{submissionDetails}</p>
        </section>
      )}
    </fieldset>
  );
}
