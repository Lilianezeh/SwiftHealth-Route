/** Sample data for the provider screens (phase 12). Everything is fictional. */
import type { ProviderListing } from "@/types/staff";

import { makeListing } from "./listing";

export function providerListing(overrides: Partial<ProviderListing> = {}): ProviderListing {
  return {
    ...makeListing(),
    status: "published",
    next_check_due: "2026-11-20T09:00:00Z",
    owner_id: 3, // the logged-in provider of tests/helpers/queue.ts
    created_by: null,
    featured_until: null,
    map_pin_is_default: false,
    submission_details: null,
    closed_at: null,
    closed_reason: null,
    featured_price_naira: "5000.00",
    ...overrides,
  };
}
