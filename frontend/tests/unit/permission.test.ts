// @vitest-environment jsdom
/** Tests for lib/location/permission.ts. Requirements: FR-03, NFR-07.
 * The browser's own answer about the geolocation permission, read without ever asking the visitor (a read, not a prompt).
 * If the browser cannot tell, the answer is "unknown" and the app keeps its old behaviour.
 */
import { describe, expect, it } from "vitest";

import { isPermissionCheckSupported, readGeolocationPermission } from "@/lib/location/permission";

import { stubGeolocationPermission } from "../helpers/permission";

describe("isPermissionCheckSupported", () => {
  it("is false when the browser has no permissions object", () => {
    stubGeolocationPermission("unsupported");
    expect(isPermissionCheckSupported()).toBe(false);
  });

  it("is true when the browser has navigator.permissions.query", () => {
    stubGeolocationPermission("granted");
    expect(isPermissionCheckSupported()).toBe(true);
  });
});

describe("readGeolocationPermission", () => {
  it.each(["granted", "prompt", "denied"] as const)("returns %s when the browser says so", async (state) => {
    stubGeolocationPermission(state);

    await expect(readGeolocationPermission()).resolves.toBe(state);
  });

  it("asks about geolocation only", async () => {
    const query = stubGeolocationPermission("granted");

    await readGeolocationPermission();

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({ name: "geolocation" });
  });

  it("returns unknown when there is no permission check", async () => {
    stubGeolocationPermission("unsupported");

    await expect(readGeolocationPermission()).resolves.toBe("unknown");
  });

  it.each(["throws", "rejects", "unknown-state"] as const)(
    "returns unknown when the check %s (the app then keeps its old behaviour)",
    async (behaviour) => {
      stubGeolocationPermission(behaviour);

      await expect(readGeolocationPermission()).resolves.toBe("unknown");
    },
  );
});
