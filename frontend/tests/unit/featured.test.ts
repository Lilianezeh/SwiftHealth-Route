/** Who can be featured: published, verified, not overdue (api-spec section 8, "Sponsored rules"). Requirements: FR-44, FR-45. */
import { describe, expect, it } from "vitest";

import { ONLY_PUBLISHED, ONLY_VERIFIED, whyNotFeatured } from "@/lib/staff/featured";

const OK = { status: "published", last_verified_at: "2026-10-06T09:00:00Z", verification_due: false } as const;

describe("whyNotFeatured", () => {
  it("is null for a published, verified listing that is not overdue", () => {
    expect(whyNotFeatured(OK)).toBeNull();
  });

  it.each(["draft", "pending_review", "recheck_due", "hidden"] as const)("says only a published listing for %s", (status) => {
    expect(whyNotFeatured({ ...OK, status })).toBe(ONLY_PUBLISHED);
  });

  it("says only a verified listing when it was never verified or is overdue", () => {
    expect(whyNotFeatured({ ...OK, last_verified_at: null })).toBe(ONLY_VERIFIED);
    expect(whyNotFeatured({ ...OK, verification_due: true })).toBe(ONLY_VERIFIED);
  });

  it("asks about publishing first, so a hidden unverified listing is told to get published", () => {
    expect(whyNotFeatured({ status: "hidden", last_verified_at: null, verification_due: true })).toBe(ONLY_PUBLISHED);
  });

  it("uses the same two sentences as the API", () => {
    expect(ONLY_PUBLISHED).toBe("Only a published listing can be featured.");
    expect(ONLY_VERIFIED).toBe("Only a verified listing can be featured.");
  });
});
