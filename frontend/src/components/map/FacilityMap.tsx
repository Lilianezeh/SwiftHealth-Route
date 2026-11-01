"use client";

/** The small map of ONE facility, with a red pin exactly at its coordinates. Requirements: FR-07, FR-10, NFR-07, NFR-10.
 * Spec: specs/2026-11-01-maps-near-me/; UI spec 2.4, "Map". Plain Leaflet with OpenStreetMap tiles, like the results map. It asks for
 * nothing about the visitor (no position, no permission), makes no request of its own (the tiles are images the browser loads; a tile
 * address holds only an area of the map) and keeps nothing. The same place is said in words under the map ("Pin at 6.45200, 7.51000"),
 * so the page is complete without it. One finger scrolls the page on a phone (the map does not trap it); the zoom buttons zoom.
 * Leaflet needs the browser, so the listing page loads this file only when it shows the map (next/dynamic, no server rendering).
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { MAP_ATTRIBUTION, MAP_MAX_ZOOM, TILE_URL } from "@/config/map";
import { hasRealCoordinates } from "@/lib/map/coordinates";
import { createFacilityPinIcon } from "@/lib/map/mapIcons";
import "@/styles/map.css";

const FACILITY_ZOOM = 16; // close enough to see the street and the building

type FacilityMapProps = { name: string; latitude: number; longitude: number };

export function FacilityMap({ name, latitude, longitude }: FacilityMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const isReal = hasRealCoordinates({ latitude, longitude });

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !isReal) return;

    const map = L.map(box, {
      center: [latitude, longitude],
      zoom: FACILITY_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      scrollWheelZoom: false, // the wheel scrolls the page
      dragging: !L.Browser.mobile, // one finger scrolls the page on a phone; the zoom buttons and a pinch still work
      attributionControl: false, // added below without the "Leaflet" prefix, so only the OpenStreetMap credit shows
    });
    L.control.attribution({ prefix: false }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: MAP_MAX_ZOOM, attribution: MAP_ATTRIBUTION }).addTo(map);

    const marker = L.marker([latitude, longitude], { icon: createFacilityPinIcon(), interactive: false, keyboard: false }).addTo(map);
    const pinElement = marker.getElement();
    pinElement?.setAttribute("role", "img");
    pinElement?.setAttribute("aria-label", name); // set as a plain attribute: the name is text, never HTML

    return () => {
      map.remove();
    };
  }, [isReal, latitude, longitude, name]);

  if (!isReal) {
    return <p className="text-base text-ink">The map is not available for this place.</p>;
  }

  return (
    <div role="region" aria-label={`Map showing where ${name} is`} className="flex flex-col gap-2">
      <div ref={boxRef} className="facility-map__box isolate h-64 w-full rounded-2xl border border-line" />
      <p className="text-base text-ink-soft">{`Pin at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</p>
    </div>
  );
}
