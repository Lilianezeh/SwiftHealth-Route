"use client";

/** The results on a map: plain Leaflet with OpenStreetMap tiles. Requirements: FR-07, US-01, US-03, NFR-07, NFR-10.
 * UI spec 2.3, "Map view". It draws the results it is given (the same ones as the list) and the visitor's position as a dot
 * when there is one. It makes no request of its own (the tiles are images the browser loads), and it keeps the centre, the
 * zoom and the position nowhere: not in the address, not in storage. Leaflet needs the browser, so SearchResults loads this
 * file only when the map is shown.
 *
 * Leaflet draws into one <div>; React does not manage what is inside it. The two meet in two places: the popup content is
 * drawn by React into a separate element per pin (a portal), and the effects below create and remove the Leaflet objects.
 */
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

import { MapPopup } from "@/components/search/MapPopup";
import {
  DEFAULT_MAP_CENTRE,
  DEFAULT_MAP_ZOOM,
  MAP_ATTRIBUTION,
  MAP_MAX_ZOOM,
  SINGLE_PIN_ZOOM,
  TILE_URL,
} from "@/config/map";
import type { Position } from "@/lib/api/search";
import { mapPoints } from "@/lib/map/coordinates";
import { createPinIcon, createPositionIcon } from "@/lib/map/mapIcons";
import type { ListingSummary } from "@/types/api";
import "@/styles/map.css";

type ResultsMapProps = { listings: ListingSummary[]; position: Position | null };

const FIT_PADDING: L.PointExpression = [48, 48]; // keeps the pins away from the edge and the buttons
const POPUP_WIDTH = { minWidth: 220, maxWidth: 260 }; // fits a 320 px screen

function missingPlacesNotice(count: number): string {
  return count === 1
    ? "1 place has no position on the map. Switch to List to see it."
    : `${count} places have no position on the map. Switch to List to see them.`;
}

export function ResultsMap({ listings, position }: ResultsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const openMarkerRef = useRef<L.Marker | null>(null); // the pin whose popup is open, for Escape

  const { pins, missingCount } = useMemo(() => mapPoints(listings), [listings]);
  // One element per pin to draw its popup content into. Made once per set of results; Leaflet puts it in the popup.
  const pinHosts = useMemo(
    () => pins.map((listing) => ({ listing, popupElement: document.createElement("div") })),
    [pins],
  );

  // Create the map once, and remove it when the component goes away.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      center: [DEFAULT_MAP_CENTRE.latitude, DEFAULT_MAP_CENTRE.longitude],
      zoom: DEFAULT_MAP_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      attributionControl: false, // added below without the "Leaflet" prefix, so only the OpenStreetMap credit shows
    });
    L.control.attribution({ prefix: false }).addTo(map);
    L.tileLayer(TILE_URL, { maxZoom: MAP_MAX_ZOOM, attribution: MAP_ATTRIBUTION }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    // Escape closes the open popup and, if the focus was inside it, puts the focus back on its pin. This runs before
    // Leaflet's own Escape handling (capture phase), because once the popup is gone we can no longer see where the focus was.
    const closePopupOnEscape = (event: KeyboardEvent) => {
      const marker = openMarkerRef.current;
      if (event.key !== "Escape" || !marker) return;
      const focusWasInPopup = marker.getPopup()?.getElement()?.contains(document.activeElement) ?? false;
      marker.closePopup();
      if (focusWasInPopup) marker.getElement()?.focus();
    };
    container.addEventListener("keydown", closePopupOnEscape, true);

    return () => {
      container.removeEventListener("keydown", closePopupOnEscape, true);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      openMarkerRef.current = null;
    };
  }, []);

  // Draw the pins and the position dot, then fit the map to them. Runs again when the results or the position change.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const points: L.LatLngTuple[] = [];

    for (const { listing, popupElement } of pinHosts) {
      const point: L.LatLngTuple = [listing.latitude, listing.longitude];
      const marker = L.marker(point, { icon: createPinIcon(), keyboard: true }).bindPopup(popupElement, POPUP_WIDTH);
      marker.addTo(layer);

      const pinElement = marker.getElement();
      pinElement?.setAttribute("aria-label", `${listing.name}, ${listing.category.name}`);
      // A tap or a click opens the popup through Leaflet. A button is also used with Enter and Space, so they are handled here
      // on keydown rather than through Leaflet's keypress check, which tests the deprecated keyCode. preventDefault stops the
      // keypress that would follow (Leaflet would toggle the popup closed again), and stops Space from scrolling the page.
      pinElement?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        marker.openPopup();
      });

      marker.on("popupopen", (event) => {
        openMarkerRef.current = marker;
        event.popup.getElement()?.querySelector<HTMLElement>("a")?.focus(); // the name link: Call and Directions are next
      });
      marker.on("popupclose", () => {
        if (openMarkerRef.current === marker) openMarkerRef.current = null;
      });
      points.push(point);
    }

    if (position) {
      const dotPoint: L.LatLngTuple = [position.latitude, position.longitude];
      L.marker(dotPoint, { icon: createPositionIcon(), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(layer);
      points.push(dotPoint);
    }

    // One point has no size, so fitBounds stops at the closest zoom we allow: a close view of one place.
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: FIT_PADDING, maxZoom: SINGLE_PIN_ZOOM });
  }, [pinHosts, position]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        role="region"
        aria-label="Map of the search results"
        className="isolate h-[60vh] min-h-72 w-full rounded-2xl border border-line"
      />
      {missingCount > 0 && <p className="text-base text-ink">{missingPlacesNotice(missingCount)}</p>}
      {position && (
        <p className="flex items-center gap-2 text-base text-ink-soft">
          <span aria-hidden="true" className="map-position-dot" />
          Your position
        </p>
      )}
      {pinHosts.map(({ listing, popupElement }) =>
        createPortal(<MapPopup listing={listing} />, popupElement, String(listing.id)),
      )}
    </div>
  );
}
