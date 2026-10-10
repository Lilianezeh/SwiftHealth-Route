/** What the browser says about the geolocation permission, read without asking the visitor. Requirements: FR-03, NFR-07.
 * `navigator.permissions.query` only reads the state; it never shows the browser's prompt. A browser that has no such
 * check, or fails it, gives "unknown", and the app then behaves as it did before this check existed.
 */
export type GeolocationPermission = "granted" | "prompt" | "denied" | "unknown";

export function isPermissionCheckSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.permissions?.query === "function";
}

export async function readGeolocationPermission(): Promise<GeolocationPermission> {
  if (!isPermissionCheckSupported()) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "granted" || status.state === "prompt" || status.state === "denied" ? status.state : "unknown";
  } catch {
    return "unknown"; // some browsers throw or reject for "geolocation"
  }
}
