"use client";

/** The Filters button and its sheet: a native <dialog>, so keyboard and screen reader support come from the browser.
 * Requirements: US-05, FR-04, FR-05, NFR-07, NFR-10. UI spec 2.3, item 1, and decision 6.
 * Apply writes every filter into the address (never lat or lng) and replaces the history entry. Clear filters empties
 * them all but keeps the search text. The choices come from GET /meta; the service is picked from a list.
 */
import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { DISTANCE_CHOICES_KM } from "@/config/search";
import { useMeta } from "@/hooks/useMeta";
import { filtersToQuery, type SearchFilters } from "@/lib/search/searchQuery";
import type { MetaResponse } from "@/types/api";

type FiltersDialogProps = { filters: SearchFilters; hasPosition: boolean };

type Choice = { value: string; label: string };

type FormProps = {
  filters: SearchFilters;
  hasPosition: boolean;
  meta: MetaResponse | null;
  metaFailed: boolean;
  onRetryMeta: () => void;
  onApply: (next: SearchFilters) => void;
  onClear: () => void;
  onClose: () => void;
};

const FIELD_CLASSES = "min-h-[50px] w-full rounded-xl border border-line bg-white px-3 text-base text-ink";

/** The choices of a list, with the value from a shared link added when it is not in the list (so it stays selected). */
function withCurrentValue(choices: Choice[], current: string, isLoaded: boolean): Choice[] {
  if (!isLoaded || current === "" || choices.some((choice) => choice.value === current)) return choices;
  return [...choices, { value: current, label: current }];
}

function FiltersForm({ filters, hasPosition, meta, metaFailed, onRetryMeta, onApply, onClear, onClose }: FormProps) {
  const ids = { category: useId(), service: useId(), area: useId(), distance: useId(), hint: useId() };
  const [category, setCategory] = useState(filters.category ?? "");
  const [service, setService] = useState(filters.service ?? "");
  const [area, setArea] = useState(filters.area ?? "");
  const [openNow, setOpenNow] = useState(filters.open_now === true);
  const [is24Hours, setIs24Hours] = useState(filters.is_24_hours === true);
  const [radius, setRadius] = useState(filters.radius_km === undefined ? "" : String(filters.radius_km));

  const isLoaded = meta !== null;
  const categoryChoices = withCurrentValue(
    (meta?.categories ?? []).map((item) => ({ value: item.slug, label: item.name })), category, isLoaded,
  );
  const serviceChoices = withCurrentValue((meta?.services ?? []).map((name) => ({ value: name, label: name })), service, isLoaded);
  const areaChoices = withCurrentValue((meta?.areas ?? []).map((name) => ({ value: name, label: name })), area, isLoaded);
  const distanceChoices = [...DISTANCE_CHOICES_KM.map(String), ...(radius && !DISTANCE_CHOICES_KM.some((km) => String(km) === radius) ? [radius] : [])];

  function apply() {
    onApply({
      q: filters.q,
      category: category || undefined,
      service: service || undefined,
      area: area || undefined,
      open_now: openNow || undefined,
      is_24_hours: is24Hours || undefined,
      radius_km: hasPosition && radius ? Number(radius) : undefined, // a distance means nothing without a position
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      className="flex flex-col gap-4"
    >
      {metaFailed ? (
        <div className="flex flex-col gap-3">
          <p className="text-base text-ink">We couldn&apos;t load the choices. Check your connection and try again.</p>
          <button type="button" onClick={onRetryMeta} className={buttonClasses("primary")}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <SelectField id={ids.category} label="Category" value={category} onChange={setCategory} anyLabel="Any category" choices={categoryChoices} isLoading={!isLoaded} />
          <SelectField id={ids.service} label="Service" value={service} onChange={setService} anyLabel="Any service" choices={serviceChoices} isLoading={!isLoaded} />
          <SelectField id={ids.area} label="Area" value={area} onChange={setArea} anyLabel="Any area" choices={areaChoices} isLoading={!isLoaded} />
        </>
      )}

      <label className="flex min-h-12 items-center gap-3 text-base text-ink">
        <input type="checkbox" checked={openNow} onChange={(event) => setOpenNow(event.target.checked)} className="h-6 w-6 accent-pine" />
        Open now
      </label>
      <label className="flex min-h-12 items-center gap-3 text-base text-ink">
        <input type="checkbox" checked={is24Hours} onChange={(event) => setIs24Hours(event.target.checked)} className="h-6 w-6 accent-pine" />
        Open 24 hours
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor={ids.distance} className="text-base font-semibold text-ink">
          Distance
        </label>
        <select
          id={ids.distance}
          value={hasPosition ? radius : ""}
          disabled={!hasPosition}
          aria-describedby={hasPosition ? undefined : ids.hint}
          onChange={(event) => setRadius(event.target.value)}
          className={FIELD_CLASSES}
        >
          <option value="">Any distance</option>
          {distanceChoices.map((km) => (
            <option key={km} value={km}>
              Within {km} km
            </option>
          ))}
        </select>
        {!hasPosition && (
          <p id={ids.hint} className="text-base text-ink-soft">
            Share your location to filter by distance.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-2">
        <button type="submit" className={buttonClasses("primary")}>
          Apply
        </button>
        <button type="button" onClick={onClear} className={buttonClasses("secondary")}>
          Clear filters
        </button>
        <button type="button" onClick={onClose} className={buttonClasses("secondary")}>
          Close
        </button>
      </div>
    </form>
  );
}

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  anyLabel: string;
  choices: Choice[];
  isLoading: boolean;
};

function SelectField({ id, label, value, onChange, anyLabel, choices, isLoading }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      <select id={id} value={value} disabled={isLoading} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASSES}>
        <option value="">{isLoading ? "Loading…" : anyLabel}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FiltersDialog({ filters, hasPosition }: FiltersDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pressStartedOnBackdrop = useRef(false);
  const titleId = useId();
  const { status, meta, retry } = useMeta(); // kept here, so the sheet shows the choices at once when it is opened again
  // Opening the sheet again starts a fresh form, so changes that were not applied are forgotten.
  const [openCount, setOpenCount] = useState(0);

  function openSheet() {
    setOpenCount((current) => current + 1);
    dialogRef.current?.showModal();
  }

  function closeSheet() {
    dialogRef.current?.close();
  }

  /** Replaces the address (no new history entry). Only filters go in it, never the position. */
  function goTo(next: SearchFilters) {
    const query = filtersToQuery(next);
    router.replace(query ? `/search?${query}` : "/search");
    closeSheet();
  }

  return (
    <>
      <button ref={buttonRef} type="button" onClick={openSheet} className={`${buttonClasses("secondary")} sm:w-auto`}>
        <DecorativeIcon icon={SlidersHorizontal} />
        Filters
      </button>
      {/* The backdrop is part of the <dialog>, so a tap outside the sheet lands on the <dialog> itself. The padding is on an
          inner box, so a tap on the sheet never lands on the <dialog> itself. The press must also START on the backdrop, so
          selecting text or a finger that slips off the sheet does not close it. Esc is handled by the browser. */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => buttonRef.current?.focus()} // Esc, Close, Apply and a backdrop tap all end here: focus goes back to the button
        onPointerDown={(event) => {
          pressStartedOnBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          const closesSheet = event.target === event.currentTarget && pressStartedOnBackdrop.current;
          pressStartedOnBackdrop.current = false;
          if (closesSheet) closeSheet();
        }}
        className="mx-auto mb-0 mt-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-paper p-0 text-ink backdrop:bg-ink/50"
      >
        <div className="p-4">
          <h2 id={titleId} className="mb-4 text-2xl font-bold text-forest">
            Filters
          </h2>
          <FiltersForm
            key={openCount}
            filters={filters}
            hasPosition={hasPosition}
            meta={meta}
            metaFailed={status === "error"}
            onRetryMeta={retry}
            onApply={goTo}
            onClear={() => goTo({ q: filters.q })}
            onClose={closeSheet}
          />
        </div>
      </dialog>
    </>
  );
}
