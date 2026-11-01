// @vitest-environment jsdom
/** The owner form, part (b): the exact location and the entrance photo. Requirements: US-17, US-02, FR-23, FR-32, NFR-07, NFR-10.
 * Spec: specs/2026-11-01-owner-form-location-photo/ (decisions L1 to L9); UI spec 2.9. The pin picker (Leaflet) has its own tests in
 * PinPicker.test.tsx; here it is a stand-in that shows the pin it was given and can "drag" it. The photo goes straight to Cloudinary
 * (replaced by a fake): nothing real is called. Every name, number and address here is fictional.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ListYourFacilityPage from "@/app/(public)/list-your-facility/page";
import { PhotoUploadError } from "@/lib/api/cloudinary";
import { resetMetaCache } from "@/lib/api/meta";
import { readPosition } from "@/lib/location/locationStore";
import { saveStaffSession } from "@/lib/staff/session";

import { json, stubGeolocation } from "../helpers/api";
import { META } from "../helpers/api";
import { readSource } from "../helpers/source";

const PHOTO = "https://res.cloudinary.com/demo-cloud/image/upload/v1/swifthealth/owner-entrances/front.jpg";
const SIGNATURE = { cloud_name: "demo-cloud", api_key: "123", timestamp: 1, signature: "abc", folder: "swifthealth/owner-entrances", upload_preset: null };

vi.mock("@/components/map/PinPicker", () => ({
  PinPicker: ({ pin, onChange }: { pin: { latitude: number; longitude: number } | null; onChange: (pin: { latitude: number; longitude: number }) => void }) => (
    <div role="region" aria-label="Map to place the pin of your facility">
      <p>{pin ? `Map pin at ${pin.latitude}, ${pin.longitude}` : "Map without a pin"}</p>
      <button type="button" onClick={() => onChange({ latitude: 6.47, longitude: 7.53 })}>Drag the pin</button>
    </div>
  ),
}));
const upload = vi.fn();
vi.mock("@/lib/api/cloudinary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/cloudinary")>()),
  uploadPhoto: (...parameters: unknown[]) => upload(...parameters),
}));

type Call = { method: string; path: string; body: Record<string, unknown> | undefined };

function stubApi(options: { sign?: () => Response } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      const call: Call = { method: init?.method ?? "GET", path: url.pathname, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined };
      calls.push(call);
      if (url.pathname === "/meta") return json(META);
      if (url.pathname === "/provider/listings") return json({ fee_naira: "10000.00", grace_days: 7, items: [] });
      if (url.pathname === "/uploads/owner-sign") return (options.sign ?? (() => json(SIGNATURE)))();
      if (url.pathname === "/provider/facilities") {
        return json({ message: "Your draft is saved.", listing_id: 7, link_id: 8, status: "draft", fee_naira: "10000.00" }, 201);
      }
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, saved: () => calls.filter((call) => call.path === "/provider/facilities") };
}

async function openForm() {
  render(<ListYourFacilityPage />);
  await screen.findByRole("option", { name: "Clinic" });
  await userEvent.type(screen.getByLabelText("Facility name"), "Example Clinic");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "clinic");
  await userEvent.selectOptions(screen.getByLabelText("Area"), "Ogui");
  await userEvent.type(screen.getByLabelText("Address"), "4 Example Street");
  await userEvent.type(screen.getByLabelText("Phone number of the facility"), "0803 000 0000");
}

function locationGroup(): HTMLElement {
  return screen.getByRole("group", { name: "Exact location (optional)" });
}

beforeEach(() => {
  resetMetaCache();
  window.sessionStorage.clear();
  window.localStorage.clear();
  upload.mockReset();
  saveStaffSession({ token: "tok", user: { id: 5, name: "Ada Eze", email: "ada@example.com", phone: null, role: "provider", is_active: true } });
});
afterEach(() => vi.unstubAllGlobals());

describe("the exact location", () => {
  it("has its own group, says what happens if it is left out, and shows a map with no pin yet", async () => {
    stubApi();
    await openForm();

    const group = locationGroup();
    expect(within(group).getByText("No pin placed yet. If you leave it, our team places it from your address.")).toBeInTheDocument();
    expect(await within(group).findByText("Map without a pin")).toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: "Remove the pin" })).toBeNull();
  });

  it("has 'Use my current location' as a button of 48 px, and does not ask the browser before the tap", async () => {
    stubApi();
    const getCurrentPosition = stubGeolocation({ latitude: 6.45212, longitude: 7.50987 });
    await openForm();

    const button = within(locationGroup()).getByRole("button", { name: "Use my current location" });

    expect(button.className).toMatch(/min-h-12|min-h-\[50px\]/);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("places the pin at the current location after the tap, shows it before saving, and sends it with the form", async () => {
    const { saved } = stubApi();
    stubGeolocation({ latitude: 6.45212, longitude: 7.50987 });
    await openForm();

    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Use my current location" }));

    expect(await within(locationGroup()).findByText("Pin at 6.45212, 7.50987")).toBeInTheDocument();
    expect(await within(locationGroup()).findByText("Map pin at 6.45212, 7.50987")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByText("Your draft is saved.");
    expect(saved()[0].body).toMatchObject({ latitude: 6.45212, longitude: 7.50987 });
  });

  it("keeps the owner's position nowhere else: not in storage, not in the shared location of the site", async () => {
    stubApi();
    stubGeolocation({ latitude: 6.45212, longitude: 7.50987 });
    await openForm();

    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Use my current location" }));
    await within(locationGroup()).findByText("Pin at 6.45212, 7.50987");

    expect(readPosition()).toBeNull(); // the visitor's position of "Find care near me" is a different thing
    // (the staff session is in sessionStorage; the owner's position must be in no stored value)
    const stored = JSON.stringify({ ...window.sessionStorage }) + JSON.stringify({ ...window.localStorage }) + document.cookie;
    expect(stored).not.toMatch(/6\.45212|7\.50987/);
    expect(window.location.href).not.toMatch(/6\.45|7\.50/);
  });

  it("says so when the location is refused, and the form still works", async () => {
    stubApi();
    stubGeolocation({ errorCode: 1 });
    await openForm();

    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Use my current location" }));

    expect(await within(locationGroup()).findByText("We could not get your location. Paste a link or coordinates, or tap the map instead.")).toBeInTheDocument();
    expect(within(locationGroup()).getByText(/No pin placed yet/)).toBeInTheDocument();
  });

  it("says so when the phone has no location at all", async () => {
    stubApi();
    Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
    await openForm();

    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Use my current location" }));

    expect(await within(locationGroup()).findByText("We could not get your location. Paste a link or coordinates, or tap the map instead.")).toBeInTheDocument();
  });

  it("does not accept a current location outside Nigeria", async () => {
    stubApi();
    stubGeolocation({ latitude: 51.5, longitude: -0.12 });
    await openForm();

    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Use my current location" }));

    expect(await within(locationGroup()).findByText("That place is outside Nigeria. Check the link or the coordinates.")).toBeInTheDocument();
    expect(within(locationGroup()).getByText(/No pin placed yet/)).toBeInTheDocument();
  });

  it("moves the pin when it is dragged on the map, and the new place is shown and sent", async () => {
    const { saved } = stubApi();
    await openForm();

    await userEvent.click(await within(locationGroup()).findByRole("button", { name: "Drag the pin" }));

    expect(within(locationGroup()).getByText("Pin at 6.47000, 7.53000")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByText("Your draft is saved.");
    expect(saved()[0].body).toMatchObject({ latitude: 6.47, longitude: 7.53 });
  });

  it("removes the pin with 'Remove the pin', and then sends none", async () => {
    const { saved } = stubApi();
    await openForm();
    await userEvent.click(await within(locationGroup()).findByRole("button", { name: "Drag the pin" }));

    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Remove the pin" }));

    expect(within(locationGroup()).getByText(/No pin placed yet/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByText("Your draft is saved.");
    expect(saved()[0].body).not.toHaveProperty("latitude");
  });
});

describe("a pasted link or coordinates", () => {
  async function paste(text: string) {
    const field = within(locationGroup()).getByLabelText("Google Maps link or coordinates");
    await userEvent.clear(field);
    await userEvent.type(field, text);
    await userEvent.click(within(locationGroup()).getByRole("button", { name: "Use this place" }));
  }

  it("reads plain coordinates, shows the place and says where it came from", async () => {
    stubApi();
    await openForm();

    await paste("6.4521, 7.5103");

    expect(within(locationGroup()).getByText("Pin at 6.45210, 7.51030")).toBeInTheDocument();
    expect(within(locationGroup()).getByText("The pin is now at the place you pasted. Check it on the map.")).toBeInTheDocument();
  });

  it("reads a long Google Maps link", async () => {
    stubApi();
    await openForm();

    await paste("https://www.google.com/maps/place/Example+Clinic/@6.4600,7.5200,17z/data=!3d6.4521!4d7.5103");

    expect(within(locationGroup()).getByText("Pin at 6.45210, 7.51030")).toBeInTheDocument();
  });

  it("asks for the long link, or for the pin to be moved, when the link is a short one, and keeps the old pin", async () => {
    stubApi();
    await openForm();
    await userEvent.click(await within(locationGroup()).findByRole("button", { name: "Drag the pin" }));

    await paste("https://maps.app.goo.gl/AbCdEf123");

    expect(
      within(locationGroup()).getByText("That is a short link. Open it in your browser and copy the long address, or move the pin on the map."),
    ).toBeInTheDocument();
    expect(within(locationGroup()).getByText("Pin at 6.47000, 7.53000")).toBeInTheDocument();
  });

  it("says a place outside Nigeria is outside, and does not move the pin", async () => {
    stubApi();
    await openForm();

    await paste("51.5072, -0.1276");

    expect(within(locationGroup()).getByText("That place is outside Nigeria. Check the link or the coordinates.")).toBeInTheDocument();
    expect(within(locationGroup()).getByText(/No pin placed yet/)).toBeInTheDocument();
  });

  it("says what it could not read, and what to paste", async () => {
    stubApi();
    await openForm();

    await paste("near the market");

    expect(
      within(locationGroup()).getByText("We could not read a place from that. Paste coordinates like 6.4521, 7.5103 or a long Google Maps link."),
    ).toBeInTheDocument();
  });

  it("asks the browser for nothing and sends nothing to the API when a link is pasted", async () => {
    const { calls } = stubApi();
    const getCurrentPosition = stubGeolocation({ latitude: 6.9, longitude: 7.9 });
    await openForm();
    const before = calls.length;

    await paste("6.4521, 7.5103");

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(calls.length).toBe(before); // parsed in the browser: the link is never fetched
  });

  it("has labels, 48 px fields and 16 px text", async () => {
    stubApi();
    await openForm();

    const field = within(locationGroup()).getByLabelText("Google Maps link or coordinates");
    expect(field.className).toMatch(/min-h-12/);
    expect(within(locationGroup()).getByRole("button", { name: "Use this place" }).className).toMatch(/min-h-12|min-h-\[50px\]/);
    expect(readSource("components/facility/LocationFields.tsx")).not.toMatch(/text-sm|text-xs/);
  });
});

describe("the entrance photo", () => {
  function photoGroup(): HTMLElement {
    return screen.getByRole("group", { name: "Photo of the entrance (optional)" });
  }

  function image(name = "front.jpg", type = "image/jpeg", size = 1000): File {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  }

  it("offers a camera or file button of 48 px and says what the photo is for", async () => {
    stubApi();
    await openForm();

    const label = within(photoGroup()).getByText("Take or choose a photo");
    expect(label.className).toMatch(/min-h-12|min-h-\[50px\]/);
    const input = within(photoGroup()).getByLabelText("Take or choose a photo") as HTMLInputElement;
    expect(input).toHaveAttribute("accept", "image/*");
    expect(within(photoGroup()).getByText(/helps people find the door/)).toBeInTheDocument();
  });

  it("signs for the owner folder with the token, uploads straight to Cloudinary, shows the photo and sends its address", async () => {
    upload.mockResolvedValue(PHOTO);
    const { calls, saved } = stubApi();
    await openForm();

    await userEvent.upload(within(photoGroup()).getByLabelText("Take or choose a photo"), image());

    expect(await within(photoGroup()).findByText("Photo added")).toBeInTheDocument();
    expect(calls.find((call) => call.path === "/uploads/owner-sign")).toMatchObject({ method: "POST" });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][1]).toEqual(SIGNATURE);
    const preview = within(photoGroup()).getByRole("img", { name: "The entrance photo you added" });
    expect(preview).toHaveAttribute("src", PHOTO);
    expect(preview).toHaveAttribute("loading", "lazy");
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByText("Your draft is saved.");
    expect(saved()[0].body).toMatchObject({ entrance_photo_url: PHOTO });
  });

  it("removes the photo with 'Remove the photo', and then sends none", async () => {
    upload.mockResolvedValue(PHOTO);
    const { saved } = stubApi();
    await openForm();
    await userEvent.upload(within(photoGroup()).getByLabelText("Take or choose a photo"), image());
    await within(photoGroup()).findByText("Photo added");

    await userEvent.click(within(photoGroup()).getByRole("button", { name: "Remove the photo" }));

    expect(within(photoGroup()).queryByRole("img")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByText("Your draft is saved.");
    expect(saved()[0].body).not.toHaveProperty("entrance_photo_url"); // a new form had no saved photo to remove
  });

  it("refuses a file that is not an image, and one larger than 5 MB, before anything is sent", async () => {
    const { calls } = stubApi();
    await openForm();
    const input = within(photoGroup()).getByLabelText("Take or choose a photo");

    await userEvent.upload(input, image("notes.pdf", "application/pdf"), { applyAccept: false });
    expect(await within(photoGroup()).findByText("Choose a photo (an image file).")).toBeInTheDocument();
    await userEvent.upload(input, image("huge.jpg", "image/jpeg", 6 * 1024 * 1024));
    expect(await within(photoGroup()).findByText("The photo is larger than 5 MB. Take a smaller one.")).toBeInTheDocument();

    expect(calls.some((call) => call.path === "/uploads/owner-sign")).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });

  it("says the photo could not be uploaded, and the form can still be sent without it", async () => {
    upload.mockRejectedValue(new PhotoUploadError());
    const { saved } = stubApi();
    await openForm();

    await userEvent.upload(within(photoGroup()).getByLabelText("Take or choose a photo"), image());

    expect(await within(photoGroup()).findByText("The photo could not be uploaded. Try again, or send the form without it.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await screen.findByText("Your draft is saved.");
    expect(saved()[0].body).not.toHaveProperty("entrance_photo_url");
  });

  it("says photo upload is not set up when the API answers 503", async () => {
    stubApi({ sign: () => json({ detail: "Photo upload is not set up." }, 503) });
    await openForm();

    await userEvent.upload(within(photoGroup()).getByLabelText("Take or choose a photo"), image());

    expect(await within(photoGroup()).findByText("Photo upload is not set up yet. You can send the form without a photo.")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("never shows a photo whose address is not https", async () => {
    upload.mockResolvedValue("http://example.com/a.jpg");
    stubApi();
    await openForm();

    await userEvent.upload(within(photoGroup()).getByLabelText("Take or choose a photo"), image());

    await waitFor(() => expect(within(photoGroup()).queryByRole("img")).toBeNull());
  });
});

describe("the files", () => {
  it("keep the API calls in lib/api and keep the location and photo nowhere in the browser", () => {
    for (const file of ["components/facility/LocationFields.tsx", "components/facility/PhotoField.tsx"]) {
      expect(readSource(file)).not.toMatch(/fetch\(|localStorage|sessionStorage|document\.cookie|console\.|savePosition/);
    }
  });
});
