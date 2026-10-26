/** The listing editor's form logic: from an API detail to form values, from form values to the API body (with the checks the screen shows
 * before it calls), and what a PATCH should carry. Requirements: FR-31, FR-38 (only real changes are sent, so only they are audited).
 * UI spec 3.4 and "Phase 10 details"; decisions C1 and C12 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { describe, expect, it } from "vitest";

import { diffForPatch, emptyForm, formFromDetail, toInput, type ListingForm } from "@/lib/staff/listingForm";
import type { StaffListingDetail } from "@/types/staff";

import { makeListing } from "../helpers/listing";

function detail(overrides: Partial<StaffListingDetail> = {}): StaffListingDetail {
  return {
    ...makeListing(),
    status: "draft",
    next_check_due: null,
    owner_id: null,
    created_by: 3,
    featured_until: null,
    map_pin_is_default: false,
    submission_details: null,
    closed_at: null,
    closed_reason: null,
    ...overrides,
  };
}

function validForm(changes: Partial<ListingForm> = {}): ListingForm {
  return {
    ...emptyForm(),
    name: "Night Pharmacy A",
    category: "pharmacy",
    area: "New Haven",
    address: "12 Example Road",
    latitude: "6.452",
    longitude: "7.51",
    phones: [{ number: "0803 000 0000", label: "Front desk", isPrimary: true, isWhatsApp: false }],
    ...changes,
  };
}

describe("emptyForm", () => {
  it("has one empty primary phone row, seven closed days and no services", () => {
    const form = emptyForm();

    expect(form.phones).toEqual([{ number: "", label: "", isPrimary: true, isWhatsApp: false }]);
    expect(form.hours).toHaveLength(7);
    expect(form.hours.every((day) => day.closed && day.opens === "" && day.closes === "")).toBe(true);
    expect(form.services).toEqual([]);
    expect(form.is24Hours).toBe(false);
  });
});

describe("formFromDetail", () => {
  it("turns a detail into text values, with the category as a slug and seven hours rows", () => {
    const form = formFromDetail(detail());

    expect(form.name).toBe("Night Pharmacy A");
    expect(form.category).toBe("pharmacy");
    expect(form.area).toBe("New Haven");
    expect(form.landmark).toBe("Opposite the Example Market");
    expect(form.latitude).toBe("6.452");
    expect(form.longitude).toBe("7.51");
    expect(form.hours).toHaveLength(7);
    expect(form.hours[4]).toEqual({ opens: "20:00", closes: "02:00", closed: false });
    expect(form.hours[6]).toEqual({ opens: "", closes: "", closed: true });
    expect(form.phones[0]).toEqual({ number: "+2340000000012", label: "Front desk", isPrimary: true, isWhatsApp: false });
    expect(form.services[0]).toEqual({ name: "Consultation", min: "1500.00", max: "3000.00", collected: "2026-09-28" });
    expect(form.services[3]).toEqual({ name: "Home visit", min: "", max: "", collected: "" });
  });

  it("uses empty text for a missing landmark and description", () => {
    const form = formFromDetail(detail({ landmark: null, description: null }));

    expect(form.landmark).toBe("");
    expect(form.description).toBe("");
  });
});

describe("toInput: a good form becomes the API body", () => {
  it("trims text, turns blanks into null and numbers into numbers", () => {
    const result = toInput(validForm({ name: "  Night Pharmacy A ", landmark: "  ", description: "", is24Hours: true }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({
      name: "Night Pharmacy A", category: "pharmacy", area: "New Haven", address: "12 Example Road", landmark: null,
      latitude: 6.452, longitude: 7.51, description: null, is_24_hours: true,
    });
    expect(result.input.phones).toEqual([{ number: "0803 000 0000", label: "Front desk", is_primary: true, is_whatsapp: false }]);
  });

  it("sends all seven days: a closed day has null times and an open day its times", () => {
    const hours = emptyForm().hours.map((day, index) => (index === 0 ? { opens: "20:00", closes: "02:00", closed: false } : day));
    const result = toInput(validForm({ hours }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.opening_hours).toHaveLength(7);
    expect(result.input.opening_hours[0]).toEqual({ day_of_week: 0, opens_at: "20:00", closes_at: "02:00", is_closed: false });
    expect(result.input.opening_hours[1]).toEqual({ day_of_week: 1, opens_at: null, closes_at: null, is_closed: true });
  });

  it("writes fees with two decimals from what was typed, and keeps a missing fee null", () => {
    const services = [
      { name: "X-ray", min: "5000", max: "12000.5", collected: "2026-09-28" },
      { name: "Consultation", min: "", max: "", collected: "" },
    ];
    const result = toInput(validForm({ services }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.services).toEqual([
      { name: "X-ray", fee_min_naira: "5000.00", fee_max_naira: "12000.50", fee_collected_at: "2026-09-28" },
      { name: "Consultation", fee_min_naira: null, fee_max_naira: null, fee_collected_at: null },
    ]);
  });

  it("accepts the lowest and highest map values", () => {
    expect(toInput(validForm({ latitude: "-90", longitude: "180" })).ok).toBe(true);
    expect(toInput(validForm({ latitude: "90", longitude: "-180" })).ok).toBe(true);
  });
});

describe("toInput: what is wrong is said in words", () => {
  function errorsOf(form: ListingForm): string[] {
    const result = toInput(form);
    expect(result.ok).toBe(false);
    return result.ok ? [] : result.errors;
  }

  it.each([
    [{ name: " " }, "Enter the name."],
    [{ category: "" }, "Choose a category."],
    [{ area: "" }, "Choose an area."],
    [{ address: "" }, "Enter the address."],
    [{ latitude: "" }, "Enter the latitude as a number between -90 and 90."],
    [{ latitude: "91" }, "Enter the latitude as a number between -90 and 90."],
    [{ latitude: "six" }, "Enter the latitude as a number between -90 and 90."],
    [{ longitude: "181" }, "Enter the longitude as a number between -180 and 180."],
  ] as const)("%j says: %s", (changes, message) => {
    expect(errorsOf(validForm(changes))).toContain(message);
  });

  it("asks for a phone number, and for exactly one primary", () => {
    expect(errorsOf(validForm({ phones: [] }))).toContain("Add at least one phone number.");
    expect(errorsOf(validForm({ phones: [{ number: "", label: "", isPrimary: true, isWhatsApp: false }] }))).toContain("Enter every phone number.");
    const none = [{ number: "0803 000 0000", label: "", isPrimary: false, isWhatsApp: false }];
    expect(errorsOf(validForm({ phones: none }))).toContain("Choose exactly one primary phone.");
    const two = [
      { number: "0803 000 0000", label: "", isPrimary: true, isWhatsApp: false },
      { number: "0803 000 0001", label: "", isPrimary: true, isWhatsApp: false },
    ];
    expect(errorsOf(validForm({ phones: two }))).toContain("Choose exactly one primary phone.");
  });

  it("asks for both times on an open day, and names the day", () => {
    const hours = emptyForm().hours.map((day, index) => (index === 2 ? { opens: "08:00", closes: "", closed: false } : day));

    expect(errorsOf(validForm({ hours }))).toContain("Wednesday: enter the opening and the closing time, or tick Closed.");
  });

  it("checks the fees: a number with at most two decimals, the minimum not above the maximum", () => {
    const bad = (min: string, max: string) => errorsOf(validForm({ services: [{ name: "X-ray", min, max, collected: "" }] }));

    expect(bad("abc", "")).toContain("X-ray: the minimum fee must be an amount in naira, like 1500 or 1500.50.");
    expect(bad("", "10.005")).toContain("X-ray: the maximum fee must be an amount in naira, like 1500 or 1500.50.");
    expect(bad("-5", "")).toContain("X-ray: the minimum fee must be an amount in naira, like 1500 or 1500.50.");
    expect(bad("5000", "100")).toContain("X-ray: the minimum fee cannot be above the maximum.");
  });

  it("refuses a service with no name and the same service twice", () => {
    expect(errorsOf(validForm({ services: [{ name: "", min: "", max: "", collected: "" }] }))).toContain("Choose a name for every service.");
    const twice = [
      { name: "X-ray", min: "", max: "", collected: "" },
      { name: "X-ray", min: "", max: "", collected: "" },
    ];
    expect(errorsOf(validForm({ services: twice }))).toContain("X-ray is listed twice.");
  });

  it("reports every problem at once, not only the first", () => {
    expect(errorsOf(validForm({ name: "", address: "", latitude: "x" })).length).toBeGreaterThanOrEqual(3);
  });
});

describe("diffForPatch: only what changed is sent", () => {
  it("is empty when nothing changed", () => {
    const initial = formFromDetail(detail());

    expect(diffForPatch(initial, formFromDetail(detail()))).toEqual({});
  });

  it("carries a changed text field, and a cleared landmark as null", () => {
    const initial = formFromDetail(detail());

    expect(diffForPatch(initial, { ...initial, name: "New Name" })).toEqual({ name: "New Name" });
    expect(diffForPatch(initial, { ...initial, landmark: "" })).toEqual({ landmark: null });
  });

  it("carries the position as numbers when either value changed", () => {
    const initial = formFromDetail(detail());

    expect(diffForPatch(initial, { ...initial, latitude: "6.5" })).toEqual({ latitude: 6.5 });
  });

  it("carries a whole list when anything in it changed, and no list when none did", () => {
    const initial = formFromDetail(detail());
    const phones = [{ ...initial.phones[0], isWhatsApp: true }, ...initial.phones.slice(1)];

    const patch = diffForPatch(initial, { ...initial, phones });

    expect(Object.keys(patch)).toEqual(["phones"]);
    expect(patch.phones?.[0].is_whatsapp).toBe(true);
    expect(patch.phones).toHaveLength(initial.phones.length);
  });

  it("treats 1500 and 1500.00 as the same fee", () => {
    const initial = formFromDetail(detail());
    const services = initial.services.map((service) => (service.min === "1500.00" ? { ...service, min: "1500" } : service));

    expect(diffForPatch(initial, { ...initial, services })).toEqual({});
  });

  it("carries a changed category as its slug", () => {
    const initial = formFromDetail(detail());

    expect(diffForPatch(initial, { ...initial, category: "clinic" })).toEqual({ category: "clinic" });
  });
});
