/** Reads a place the owner pasted: plain coordinates or a long Google Maps link. Requirements: US-17, US-02, FR-23.
 * Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L2 and L6). Nothing is fetched. A SHORT link (maps.app.goo.gl,
 * goo.gl/maps) holds no coordinates until it is opened, and the browser may not fetch it for us, so it is only recognised: the form then
 * asks for the long link or for the pin to be moved. A link of any other site is never read.
 */
import { NIGERIA_LATITUDE_RANGE, NIGERIA_LONGITUDE_RANGE } from "@/config/map";

export type ParsedLocation =
  | { kind: "ok"; latitude: number; longitude: number }
  | { kind: "short" } // a short Google Maps link: ask for the long one
  | { kind: "outside" } // readable, but not in Nigeria
  | { kind: "bad" }; // not a place we can read

const NUMBER = "(-?\\d+(?:\\.\\d+)?)";
// "6.4521, 7.5103", "6.4521 7.5103", "6.4521° N, 7.5103° E", "(6.4521; 7.5103)"
const PLAIN_COORDINATES = new RegExp(`^\\(?\\s*${NUMBER}\\s*°?\\s*([NnSs])?\\s*[,; ]\\s*${NUMBER}\\s*°?\\s*([EeWw])?\\s*\\)?$`);
const PLACE_PIN = new RegExp(`!3d${NUMBER}!4d${NUMBER}`); // the pin of a place, inside a long link's data part
const MAP_CENTRE = new RegExp(`@${NUMBER},${NUMBER}`);
const PAIR = new RegExp(`^\\s*(?:loc:)?${NUMBER}\\s*,\\s*${NUMBER}\\s*$`);
const PLACE_PARAMETERS = ["q", "ll", "query", "center", "destination", "daddr"];
const GOOGLE_HOST = /^(?:[a-z0-9-]+\.)*google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/i;

function checked(latitude: number, longitude: number): ParsedLocation {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { kind: "bad" };
  }
  const inside =
    latitude >= NIGERIA_LATITUDE_RANGE.min &&
    latitude <= NIGERIA_LATITUDE_RANGE.max &&
    longitude >= NIGERIA_LONGITUDE_RANGE.min &&
    longitude <= NIGERIA_LONGITUDE_RANGE.max;
  return inside ? { kind: "ok", latitude, longitude } : { kind: "outside" };
}

function fromPlainCoordinates(text: string): ParsedLocation | null {
  const match = PLAIN_COORDINATES.exec(text);
  if (!match) return null;
  const latitude = Number(match[1]) * (match[2]?.toUpperCase() === "S" ? -1 : 1);
  const longitude = Number(match[3]) * (match[4]?.toUpperCase() === "W" ? -1 : 1);
  return checked(latitude, longitude);
}

function toUrl(text: string): URL | null {
  if (/\s/.test(text) || !/[./]/.test(text)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function safelyDecoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function fromGoogleLink(url: URL): ParsedLocation {
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || (host === "goo.gl" && url.pathname.startsWith("/maps"))) return { kind: "short" };
  if (!GOOGLE_HOST.test(host)) return { kind: "bad" };

  const whole = safelyDecoded(url.href);
  const pin = PLACE_PIN.exec(whole) ?? MAP_CENTRE.exec(safelyDecoded(url.pathname));
  if (pin) return checked(Number(pin[1]), Number(pin[2]));
  for (const name of PLACE_PARAMETERS) {
    const pair = PAIR.exec(url.searchParams.get(name) ?? "");
    if (pair) return checked(Number(pair[1]), Number(pair[2]));
  }
  return { kind: "bad" };
}

export function parseLocation(text: string): ParsedLocation {
  const typed = text.trim();
  if (typed === "") return { kind: "bad" };
  const plain = fromPlainCoordinates(typed);
  if (plain) return plain;
  const url = toUrl(typed);
  return url ? fromGoogleLink(url) : { kind: "bad" };
}
