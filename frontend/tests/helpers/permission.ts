/** A fake `navigator.permissions` for tests: what the browser says about the geolocation permission. */
import { vi } from "vitest";

export type PermissionBehaviour = PermissionState | "unsupported" | "throws" | "rejects" | "unknown-state";

/** Returns the `query` spy (or null when the browser has no permission check at all). */
export function stubGeolocationPermission(behaviour: PermissionBehaviour) {
  if (behaviour === "unsupported") {
    Object.defineProperty(navigator, "permissions", { value: undefined, configurable: true });
    return null;
  }
  const query = vi.fn(async (_descriptor: PermissionDescriptor) => {
    if (behaviour === "rejects") throw new TypeError("geolocation is not a valid permission name");
    if (behaviour === "unknown-state") return { state: "something-new" } as unknown as PermissionStatus;
    return { state: behaviour } as PermissionStatus;
  });
  Object.defineProperty(navigator, "permissions", {
    value: {
      query: behaviour === "throws" ? () => { throw new Error("not allowed here"); } : query,
    },
    configurable: true,
  });
  return query;
}

/** A permission answer that comes when the test says so. */
export function stubSlowGeolocationPermission() {
  let answer: (state: PermissionState) => void = () => {};
  const promise = new Promise<PermissionStatus>((resolve) => {
    answer = (state) => resolve({ state } as PermissionStatus);
  });
  Object.defineProperty(navigator, "permissions", { value: { query: () => promise }, configurable: true });
  return answer;
}
