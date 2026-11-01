"use client";

/** The exact location of the owner form: "Use my current location", a pasted Google Maps link or coordinates, and a small map with a red
 * pin that can be dragged. Requirements: US-17, US-02, FR-23, NFR-07, NFR-10. Spec: specs/2026-11-01-owner-form-location-photo/
 * (decisions L1, L2, L5, L6, L7); UI spec 2.9.
 *
 * The place is shown before saving (the readout under the map and the pin). It is optional: without it our team places the pin from the
 * address. The owner's position is read by the browser ONLY after the tap on "Use my current location", becomes the pin and nothing else:
 * it is not stored, not logged, and not given to the site's "near me" feature (that has its own, in memory, for visitors). A pasted link
 * is read in the browser (lib/map/parseLocation.ts) and never fetched; a short link is not readable, so the form asks for the long one.
 */
import { LocateFixed } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { FIELD } from "@/components/facility/RequestFields";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { DecorativeIcon } from "@/components/ui/DecorativeIcon";
import { NIGERIA_LATITUDE_RANGE, NIGERIA_LONGITUDE_RANGE } from "@/config/map";
import { parseLocation } from "@/lib/map/parseLocation";

// Leaflet needs the browser, and the form should not carry its weight until the map is drawn: no server rendering, and the code is fetched
// only when the form is shown.
const PinPicker = dynamic(() => import("@/components/map/PinPicker").then((module) => module.PinPicker), {
  ssr: false,
  loading: () => <p className="text-base text-ink-soft">Loading the map…</p>,
});

export type Pin = { latitude: number; longitude: number };
type Props = { pin: Pin | null; onChange: (pin: Pin | null) => void };

const NO_LOCATION = "We could not get your location. Paste a link or coordinates, or tap the map instead.";
const OUTSIDE = "That place is outside Nigeria. Check the link or the coordinates.";
const SHORT_LINK = "That is a short link. Open it in your browser and copy the long address, or move the pin on the map.";
const UNREADABLE = "We could not read a place from that. Paste coordinates like 6.4521, 7.5103 or a long Google Maps link.";
const LOCATION_WAIT_MS = 15_000;
const SMALL_BUTTON = `${buttonClasses("secondary")} sm:w-auto sm:self-start sm:px-6`;

function isInsideNigeria({ latitude, longitude }: Pin): boolean {
  return (
    latitude >= NIGERIA_LATITUDE_RANGE.min &&
    latitude <= NIGERIA_LATITUDE_RANGE.max &&
    longitude >= NIGERIA_LONGITUDE_RANGE.min &&
    longitude <= NIGERIA_LONGITUDE_RANGE.max
  );
}

export function LocationFields({ pin, onChange }: Props) {
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);

  function useMyLocation() {
    if (finding) return;
    setMessage(null);
    if (!("geolocation" in navigator) || !navigator.geolocation) {
      setMessage(NO_LOCATION);
      return;
    }
    setFinding(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFinding(false);
        const found = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (isInsideNigeria(found)) {
          onChange(found);
          setMessage("The pin is now at your current location. Check it on the map.");
        } else {
          setMessage(OUTSIDE);
        }
      },
      () => {
        setFinding(false);
        setMessage(NO_LOCATION);
      },
      { enableHighAccuracy: true, timeout: LOCATION_WAIT_MS, maximumAge: 0 }, // a fresh reading, never an old one
    );
  }

  function usePastedPlace() {
    const read = parseLocation(pasted);
    if (read.kind === "ok") {
      onChange({ latitude: read.latitude, longitude: read.longitude });
      setMessage("The pin is now at the place you pasted. Check it on the map.");
    } else if (read.kind === "short") {
      setMessage(SHORT_LINK);
    } else if (read.kind === "outside") {
      setMessage(OUTSIDE);
    } else {
      setMessage(UNREADABLE);
    }
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
      <legend className="px-1 text-base font-semibold text-ink">Exact location (optional)</legend>
      <p className="text-base text-ink">Put the pin where people should go. Our team checks the place before your facility is listed.</p>
      <button type="button" onClick={useMyLocation} disabled={finding} className={`${SMALL_BUTTON} disabled:opacity-60`}>
        <DecorativeIcon icon={LocateFixed} />
        {finding ? "Finding your location…" : "Use my current location"}
      </button>
      <div className="flex flex-col gap-1">
        <label htmlFor="pasted-place" className="text-base font-semibold text-ink">Google Maps link or coordinates</label>
        <input
          id="pasted-place"
          autoComplete="off"
          inputMode="text"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          className={FIELD}
        />
        <p className="text-base text-ink-soft">For example 6.4521, 7.5103. For a short Google Maps link, open it and copy the long address.</p>
      </div>
      <button type="button" onClick={usePastedPlace} className={SMALL_BUTTON}>Use this place</button>
      {message && <p role="status" className="text-base font-semibold text-ink">{message}</p>}
      <PinPicker pin={pin} onChange={onChange} />
      {pin ? (
        <>
          <p className="text-base text-ink">{`Pin at ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`}</p>
          <p className="text-base text-ink-soft">Drag the pin, or tap the map, to move it.</p>
          <button type="button" onClick={() => onChange(null)} className={SMALL_BUTTON}>Remove the pin</button>
        </>
      ) : (
        <p className="text-base text-ink">No pin placed yet. If you leave it, our team places it from your address.</p>
      )}
    </fieldset>
  );
}
