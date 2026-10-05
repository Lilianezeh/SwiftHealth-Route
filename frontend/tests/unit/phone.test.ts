import { describe, expect, it } from "vitest";
import { toE164 } from "../../src/lib/formatters/phone";

describe("toE164", () => {
  it("formats local numbers", () => expect(toE164("0803 123 4567")).toBe("+2348031234567"));
  it("keeps international numbers", () => expect(toE164("+234 803 123 4567")).toBe("+2348031234567"));
  it("rejects short numbers", () => expect(toE164("12345")).toBeNull());
});
