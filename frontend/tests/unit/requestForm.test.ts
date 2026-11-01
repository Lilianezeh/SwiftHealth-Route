/** The owner form's values, its checks in words and its body for the API. Requirements: US-17, FR-50, FR-23.
 * Spec: specs/2026-11-01-owner-form-fields/; api-spec 7 ("The full owner form and drafts"). Every value here is fictional.
 */
import { describe, expect, it } from "vitest";

import { emptyRequestForm, formFromRead, problemsOf, toBody, type RequestForm } from "@/lib/facility/requestForm";

function filled(changes: Partial<RequestForm> = {}): RequestForm {
  return {
    ...emptyRequestForm(),
    facilityName: "Example Clinic",
    category: "clinic",
    area: "Ogui",
    address: "4 Example Street",
    phone: "0803 000 0000",
    ...changes,
  };
}

describe("a new form", () => {
  it("is empty, with an owner role, seven days with no hours given and nothing ticked", () => {
    const form = emptyRequestForm();

    expect(form).toMatchObject({ facilityName: "", phone: "", role: "owner", is24Hours: false, services: [], otherPhones: [] });
    expect(form.phoneHasWhatsApp).toBe(false);
    expect(form.hours).toHaveLength(7);
    expect(form.hours.every((day) => day.opens === "" && day.closes === "" && !day.closed)).toBe(true);
  });
});

describe("the checks in words", () => {
  it("accepts the required fields alone", () => {
    expect(problemsOf(filled())).toEqual([]);
  });

  it("says what is missing, all at once", () => {
    expect(problemsOf(emptyRequestForm())).toEqual([
      "Enter the facility name.",
      "Choose a category.",
      "Choose an area.",
      "Enter the address.",
      "Check the phone number. It should look like 0803 123 4567.",
    ]);
  });

  it("limits the description to 200 characters", () => {
    expect(problemsOf(filled({ description: "x".repeat(200) }))).toEqual([]);
    expect(problemsOf(filled({ description: "x".repeat(201) }))).toEqual(["The description can have at most 200 characters."]);
  });

  it("checks an email only when one is typed", () => {
    expect(problemsOf(filled({ email: "" }))).toEqual([]);
    expect(problemsOf(filled({ email: "front-desk@clinic.example.com" }))).toEqual([]);
    expect(problemsOf(filled({ email: "front desk" }))).toEqual(["Check the email address."]);
  });

  it("checks the other numbers, and ignores a blank row", () => {
    expect(problemsOf(filled({ otherPhones: [{ number: "", label: "", hasWhatsApp: false }] }))).toEqual([]);
    expect(problemsOf(filled({ otherPhones: [{ number: "12", label: "", hasWhatsApp: false }] }))).toEqual([
      "Check the second phone number. It should look like 0803 123 4567.",
    ]);
  });

  it("refuses the same number twice", () => {
    const twice = filled({ otherPhones: [{ number: "+2348030000000", label: "", hasWhatsApp: false }] });

    expect(problemsOf(twice)).toEqual(["Each phone number can be listed only once."]);
  });

  it("wants both times for a day that is open, and says which day", () => {
    const hours = emptyRequestForm().hours.map((day, index) => (index === 2 ? { ...day, opens: "08:00" } : day));

    expect(problemsOf(filled({ hours }))).toEqual([
      "Wednesday: enter the opening and the closing time, or choose Closed.",
    ]);
  });

  it("does not check the daily hours when the facility is open 24 hours", () => {
    const hours = emptyRequestForm().hours.map((day) => ({ ...day, opens: "08:00" }));

    expect(problemsOf(filled({ is24Hours: true, hours }))).toEqual([]);
  });
});

describe("the body for the API", () => {
  it("sends the required fields, the role and the draft flag, and leaves every empty optional field out", () => {
    expect(toBody(filled(), false)).toEqual({
      facility_name: "Example Clinic",
      category: "clinic",
      area: "Ogui",
      address: "4 Example Street",
      phone: "0803 000 0000",
      phone_has_whatsapp: false,
      is_24_hours: false,
      role: "owner",
      save_as_draft: false,
    });
  });

  it("sends save_as_draft true for a draft", () => {
    expect(toBody(filled(), true)).toMatchObject({ save_as_draft: true });
  });

  it("sends the description, landmark and email trimmed, and the services", () => {
    const body = toBody(
      filled({ description: " A small clinic. ", landmark: " Near the market ", email: " front-desk@clinic.example.com ", services: ["Consultation", "X-ray"] }),
      false,
    );

    expect(body).toMatchObject({
      description: "A small clinic.",
      landmark: "Near the market",
      email: "front-desk@clinic.example.com",
      services: ["Consultation", "X-ray"],
    });
  });

  it("sends WhatsApp for the main number and the other numbers with their labels, skipping blank rows", () => {
    const body = toBody(
      filled({
        phoneHasWhatsApp: true,
        otherPhones: [
          { number: "0803 000 0001", label: "Pharmacy desk", hasWhatsApp: true },
          { number: "", label: "", hasWhatsApp: false },
        ],
      }),
      false,
    );

    expect(body).toMatchObject({
      phone_has_whatsapp: true,
      other_phones: [{ number: "0803 000 0001", label: "Pharmacy desk", is_whatsapp: true }],
    });
  });

  it("sends the days that have hours or are closed, and skips a day with nothing given", () => {
    const hours = emptyRequestForm().hours.map((day, index) => {
      if (index === 0) return { opens: "08:00", closes: "17:00", closed: false };
      if (index === 6) return { opens: "", closes: "", closed: true };
      return day;
    });

    expect(toBody(filled({ hours }), false).opening_hours).toEqual([
      { day_of_week: 0, opens_at: "08:00", closes_at: "17:00", is_closed: false },
      { day_of_week: 6, is_closed: true },
    ]);
  });

  it("sends no daily hours when the facility is open 24 hours", () => {
    const hours = emptyRequestForm().hours.map((day) => ({ ...day, opens: "08:00", closes: "17:00" }));

    const body = toBody(filled({ is24Hours: true, hours }), false);

    expect(body.is_24_hours).toBe(true);
    expect(body).not.toHaveProperty("opening_hours");
  });

  it("sends notes only when typed", () => {
    expect(toBody(filled({ notes: "  " }), false)).not.toHaveProperty("notes");
    expect(toBody(filled({ notes: " Ask for Ada " }), false)).toMatchObject({ notes: "Ask for Ada" });
  });
});

describe("filling the form again from a saved request", () => {
  const SAVED = {
    link_id: 8,
    listing_id: 7,
    status: "draft",
    role: "manager",
    notes: "Ask for Ada",
    facility_name: "Example Clinic",
    category: "clinic",
    area: "Ogui",
    address: "4 Example Street",
    landmark: "Near the market",
    description: null,
    email: "front-desk@clinic.example.com",
    phone: "+2348030000000",
    phone_has_whatsapp: true,
    other_phones: [{ number: "+2348030000001", label: "Pharmacy desk", is_whatsapp: false }],
    is_24_hours: false,
    opening_hours: [
      { day_of_week: 0, opens_at: "08:00:00", closes_at: "17:00:00", is_closed: false },
      { day_of_week: 6, opens_at: null, closes_at: null, is_closed: true },
    ],
    services: ["Consultation"],
  } as const;

  it("shows the numbers in the local reading format and the times as hours and minutes", () => {
    const form = formFromRead({ ...SAVED, other_phones: [...SAVED.other_phones], opening_hours: [...SAVED.opening_hours], services: [...SAVED.services] });

    expect(form).toMatchObject({
      facilityName: "Example Clinic",
      landmark: "Near the market",
      description: "",
      email: "front-desk@clinic.example.com",
      phone: "0803 000 0000",
      phoneHasWhatsApp: true,
      otherPhones: [{ number: "0803 000 0001", label: "Pharmacy desk", hasWhatsApp: false }],
      role: "manager",
      notes: "Ask for Ada",
      services: ["Consultation"],
    });
    expect(form.hours[0]).toEqual({ opens: "08:00", closes: "17:00", closed: false });
    expect(form.hours[1]).toEqual({ opens: "", closes: "", closed: false }); // nothing was given for Tuesday
    expect(form.hours[6]).toEqual({ opens: "", closes: "", closed: true });
  });

  it("makes a form that gives back the same body", () => {
    const form = formFromRead({ ...SAVED, other_phones: [...SAVED.other_phones], opening_hours: [...SAVED.opening_hours], services: [...SAVED.services] });

    expect(problemsOf(form)).toEqual([]);
    expect(toBody(form, true)).toMatchObject({
      phone: "0803 000 0000",
      other_phones: [{ number: "0803 000 0001", label: "Pharmacy desk", is_whatsapp: false }],
      opening_hours: [
        { day_of_week: 0, opens_at: "08:00", closes_at: "17:00", is_closed: false },
        { day_of_week: 6, is_closed: true },
      ],
    });
  });
});
