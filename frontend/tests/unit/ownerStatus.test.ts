/** The words an owner sees for the state of a request. Requirements: US-17, FR-50, NFR-10.
 * Spec: specs/2026-11-01-owner-form-fields/ (the five statuses the owner asked for: Draft, Waiting for payment,
 * Waiting for review, Changes requested, Published).
 */
import { describe, expect, it } from "vitest";

import { ownerStatusWords } from "@/lib/formatters/ownerStatus";

describe("the status of a request, in the owner's words", () => {
  it.each([
    ["draft", "draft", "Draft"],
    ["awaiting_payment", "draft", "Waiting for payment"],
    ["pending", "draft", "Waiting for review"],
    ["changes_requested", "draft", "Changes requested"],
    ["approved", "published", "Published"],
    ["approved", "draft", "Waiting for review"], // staff approved the owner; the listing is not published yet
    ["lapsed", "published", "Published"], // an unpaid month does not hide the listing
    ["ending", "published", "Published"],
    ["removed", "draft", "Removed"],
    ["removed", "published", "Removed"],
  ])("link %s with a %s listing is %s", (linkStatus, listingStatus, words) => {
    expect(ownerStatusWords(linkStatus, listingStatus)).toBe(words);
  });
});
