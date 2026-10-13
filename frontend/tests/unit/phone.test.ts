import { describe, expect, it } from "vitest";
import { formatPhoneForReading, toE164 } from "../../src/lib/formatters/phone";

/** formatPhoneForReading: stored +234... is shown as 0803 123 4567 (owner, 2026-10-13; spec D12). */
describe("formatPhoneForReading", () => {
  it("shows the stored form in the local reading format: leading 0, groups of 4, 3 and 4", () => {
    expect(formatPhoneForReading("+2348031234567")).toBe("0803 123 4567");
  });

  it("reads the local form and the bare 234 form the same way", () => {
    expect(formatPhoneForReading("08031234567")).toBe("0803 123 4567");
    expect(formatPhoneForReading("2348031234567")).toBe("0803 123 4567");
    expect(formatPhoneForReading("+234 803 123 4567")).toBe("0803 123 4567");
  });

  it("reads the fictional fixture numbers too", () => {
    expect(formatPhoneForReading("+2340000000951")).toBe("0000 000 0951");
  });

  it("returns a number that is not a Nigerian number exactly as it was given", () => {
    expect(formatPhoneForReading("+14155550123")).toBe("+14155550123");
    expect(formatPhoneForReading("12345")).toBe("12345");
    expect(formatPhoneForReading("+234803123456")).toBe("+234803123456"); // one digit short
    expect(formatPhoneForReading("")).toBe("");
  });
});

describe("toE164", () => {
  it("formats local numbers", () => expect(toE164("0803 123 4567")).toBe("+2348031234567"));
  it("keeps international numbers", () => expect(toE164("+234 803 123 4567")).toBe("+2348031234567"));
  it("rejects short numbers", () => expect(toE164("12345")).toBeNull());
});
