"use client";

/** The owner's pin picker: a small map with a red pin that can be dragged, or the map can be tapped to place it. Requirements: US-17, US-02,
 * FR-23, NFR-07, NFR-10. Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L1, L5, L6); UI spec 2.9. It is the same red pin as the
 * listing page's (never a cross). Plain Leaflet with OpenStreetMap tiles, like the other maps. The picker only reports where the pin is
 * (`onChange`); it never asks for the owner's position (that is the button in LocationFields), makes no request of its own and keeps
 * nothing. A tap or a drag is moved inside the same box around Nigeria as the API, so a slip of the finger cannot end up in the sea.
 * Leaflet needs the browser, so the form loads this file only when it shows the map (next/dynamic, no server rendering).
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { DEFAULT_MAP_CENTRE, DEFAULT_MAP_ZOOM, MAP_ATTRIBUTION, MAP_MAX_ZOOM, NIGERIA_LATITUDE_RANGE, NIGERIA_LONGITUDE_RANGE, TILE_URL } from "@/config/map";
import { createFacilityPinIcon } from "@/lib/map/mapIcons";
import "@/styles/map.css";

const PIN_ZOOM = 16; // close enough to see the street and the building

export type PinPosition = { latitude: number; longitude: number };
type PinPickerProps = { pin: PinPosition | null; onChange: (pin: PinPosition) => void };

function insideNigeria(latitude: number, longitude: number): PinPosition {
  return {
    latitude: Math.min(Math.max(latitude, NIGERIA_LATITUDE_RANGE.min), NIGERIA_LATITUDE_RANGE.max),
    longitude: Math.min(Math.max(longitude, NIGERIA_LONGITUDE_RANGE.min), NIGERIA_LONGITUDE_RANGE.max),
  };
}

export function PinPicker({ pin, onChange }: PinPickerProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange); // the newest callback, so the map is not built again when the parent draws again
  const latitude = pin?.latitude ?? null;
  const longitude = pin?.longitude ?? null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // The map: built once, removed when the picker goes away.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const map = L.map(box, {
      center: latitude !== null && longitude !== null ? [latitude, longitude] : [DEFAULT_MAP_CENTRE.latitude, DEFAULT_MAP_CENTRE.longitude],
      zoom: latitude !== null ? PIN_ZOOM : DEFAULT_MAP_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      scrollWheelZoom: false, // the wheel scrolls the page
      dragging: !L.Browser.mobile, // one finger scrolls the page on a phone; the pin itself can still be dragged, and a tap places it
      attributionControl: false,
    });
    L.control.attribution({ prefix: false }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: MAP_MAX_ZOOM, attribution: MAP_ATTRIBUTION }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      onChangeRef.current(insideNigeria(event.latlng.lat, event.latlng.lng));
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The first centre only; later pins move the view in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pin: placed, moved or taken away to follow what the form holds.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (latitude === null || longitude === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current === null) {
      const marker = L.marker([latitude, longitude], { icon: createFacilityPinIcon(), draggable: true, keyboard: true }).addTo(map);
      marker.on("dragend", () => {
        const dropped = marker.getLatLng();
        onChangeRef.current(insideNigeria(dropped.lat, dropped.lng));
      });
      marker.getElement()?.setAttribute("aria-label", "Pin of your facility"); // a plain attribute: text, never HTML
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([latitude, longitude]);
    }
    map.setView([latitude, longitude], Math.max(map.getZoom(), PIN_ZOOM));
  }, [latitude, longitude]);

  return (
    <div role="region" aria-label="Map to place the pin of your facility" className="flex flex-col gap-2">
      <div ref={boxRef} className="pin-picker__box isolate h-64 w-full rounded-2xl border border-line" />
    </div>
  );
}
