// @vitest-environment jsdom
/** The verification log screen. Requirements: FR-32, US-10 (a verifier logs a call or visit on a phone), FR-36, NFR-06, NFR-10.
 * UI spec 3.5 and "Phase 10 details"; decisions C3, C8 and C9 in specs/2026-10-20-staff-screens/requirements.md.
 * Cloudinary is never called for real: the upload goes to a fake.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminChecksPage from "@/app/(dashboards)/admin/listings/[id]/checks/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { CheckRead, StaffListingDetail, StaffRole } from "@/types/staff";

import { json } from "../helpers/api";
import { makeListing } from "../helpers/listing";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const PHOTO = "https://res.cloudinary.com/demo-cloud/image/upload/v1/swifthealth/entrances/front.jpg";

function detail(status: StaffListingDetail["status"] = "draft"): StaffListingDetail {
  return { ...makeListing(), status, next_check_due: null, owner_id: null, created_by: 3, featured_until: null, map_pin_is_default: false, submission_details: null, closed_at: null, closed_reason: null };
}

function check(id: number, overrides: Partial<CheckRead> = {}): CheckRead {
  return {
    id, method: "call", result: "pass", person_reached: "Pharmacist on duty", notes: "Hours confirmed", photo_url: null,
    checked_at: "2026-10-05T10:30:00Z", staff_id: 3, staff_name: "Ada Verifier", ...overrides,
  };
}

function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 3, name: "Ada Verifier", email: "a@b.co", phone: null, role, is_active: true } });
}

type Options = { history?: CheckRead[]; listing?: StaffListingDetail | null; sign?: Response; cloudinary?: Response; save?: Response };

function stubApi(options: Options = {}) {
  const history = [...(options.history ?? [])];
  const calls: { method: string; url: URL; body: unknown; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      calls.push({ method: init?.method ?? "GET", url, body: init?.body, headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.hostname === "api.cloudinary.com") return options.cloudinary ?? json({ secure_url: PHOTO });
      if (url.pathname === "/uploads/sign") {
        return options.sign ?? json({ cloud_name: "demo-cloud", api_key: "123", timestamp: 1700000000, signature: "sig", folder: "swifthealth/entrances", upload_preset: null });
      }
      if (url.pathname === "/listings/id/12") return options.listing === null ? json({ detail: "Listing not found" }, 404) : json(options.listing ?? detail());
      if (url.pathname === "/listings/12/checks" && init?.method === "POST") {
        if (options.save) return options.save;
        const body = JSON.parse(String(init.body)) as Partial<CheckRead>;
        const saved = check(99, { method: body.method, result: body.result, person_reached: body.person_reached ?? null, notes: body.notes ?? null, photo_url: body.photo_url ?? null });
        history.unshift(saved);
        return json(saved, 201);
      }
      if (url.pathname === "/listings/12/checks") return json({ items: history, total: history.length });
      return json({ detail: "Not found" }, 404);
    }),
  );
  return { calls, posts: () => calls.filter((call) => call.method === "POST" && call.url.pathname === "/listings/12/checks") };
}

async function openPage(id = "12") {
  render(await AdminChecksPage({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("verifier");
});
afterEach(() => vi.unstubAllGlobals());

describe("the verification log", () => {
  it("names the listing, links back to it, and shows an empty history in words", async () => {
    stubApi();
    await openPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Verification log: Night Pharmacy A" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the listing" })).toHaveAttribute("href", "/admin/listings/12");
    expect(screen.getByText("No checks yet.")).toBeInTheDocument();
  });

  it("shows the history newest first with who, when, the method and result in words, and the notes", async () => {
    stubApi({
      history: [
        check(2, { method: "visit", result: "fail", staff_name: "Eve Editor", checked_at: "2026-10-06T15:00:00Z", notes: "Shop was shut", person_reached: null }),
        check(1, { photo_url: PHOTO }),
      ],
    });
    await openPage();

    const entries = await screen.findAllByRole("listitem");

    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Visit · Failed");
    expect(entries[0]).toHaveTextContent("Eve Editor");
    expect(entries[0]).toHaveTextContent("6 Oct 2026");
    expect(entries[0]).toHaveTextContent("Shop was shut");
    expect(entries[1]).toHaveTextContent("Call · Passed");
    expect(entries[1]).toHaveTextContent("Pharmacist on duty");
    const photo = within(entries[1]).getByRole("link", { name: "Photo" });
    expect(photo).toHaveAttribute("href", PHOTO);
    expect(photo).toHaveAttribute("target", "_blank");
    expect(photo).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not link a photo that is not an https address", async () => {
    stubApi({ history: [check(1, { photo_url: "javascript:alert(1)" })] });
    await openPage();

    await screen.findByRole("listitem");

    expect(screen.queryByRole("link", { name: "Photo" })).toBeNull();
  });

  it("has Call or Visit and Pass or Fail as big radio buttons, none chosen, and Save off until both are chosen", async () => {
    stubApi();
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    const radios = screen.getAllByRole("radio");

    expect(radios.map((radio) => (radio as HTMLInputElement).value)).toEqual(["call", "visit", "pass", "fail"]);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    for (const radio of radios) expect(radio.closest("label")?.className).toMatch(/\bmin-h-12\b/);
    expect(screen.getByRole("button", { name: "Save check" })).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Call"));
    expect(screen.getByRole("button", { name: "Save check" })).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Pass"));
    expect(screen.getByRole("button", { name: "Save check" })).toBeEnabled();
  });

  it("saves a check with the typed fields, puts it first in the history and clears the form", async () => {
    const { posts } = stubApi({ history: [check(1)] });
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByLabelText("Visit"));
    await userEvent.click(screen.getByLabelText("Pass"));
    await userEvent.type(screen.getByLabelText("Person reached"), "Pharmacist on duty");
    await userEvent.type(screen.getByLabelText("Notes"), "Hours confirmed");
    await userEvent.click(screen.getByRole("button", { name: "Save check" }));

    expect(await screen.findByText("Check saved.")).toBeInTheDocument();
    expect(posts()[0].body).toBe(JSON.stringify({ method: "visit", result: "pass", person_reached: "Pharmacist on duty", notes: "Hours confirmed", photo_url: null }));
    expect(posts()[0].headers.Authorization).toBe("Bearer tok");
    const entries = screen.getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Visit · Passed");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save check" })).toBeDisabled();
  });

  it("says a failed check hid a published listing, and shows the new status", async () => {
    let status: StaffListingDetail["status"] = "published";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (address: string, init?: RequestInit) => {
        const url = new URL(address);
        if (url.pathname === "/listings/id/12") return json(detail(status));
        if (url.pathname === "/listings/12/checks" && init?.method === "POST") {
          status = "hidden";
          return json(check(5, { method: "call", result: "fail" }), 201);
        }
        return json({ items: [], total: 0 });
      }),
    );
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await userEvent.click(screen.getByLabelText("Call"));
    await userEvent.click(screen.getByLabelText("Fail"));
    await userEvent.click(screen.getByRole("button", { name: "Save check" }));

    expect(await screen.findByText("This listing was published, so it is now hidden. The editors have been told.")).toBeInTheDocument();
  });

  it("shows the API's sentence when a check is refused, and keeps the form", async () => {
    stubApi({ save: json({ detail: "photo_url must be an https://res.cloudinary.com/ address" }, 422) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByLabelText("Call"));
    await userEvent.click(screen.getByLabelText("Pass"));
    await userEvent.type(screen.getByLabelText("Notes"), "kept");

    await userEvent.click(screen.getByRole("button", { name: "Save check" }));

    expect(await screen.findByText("We couldn't save the check. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Notes")).toHaveValue("kept");
  });

  it("says Listing not found for an unknown id", async () => {
    stubApi({ listing: null });
    await openPage("99999");

    expect(await screen.findByText("Listing not found")).toBeInTheDocument();
  });
});

describe("the photo", () => {
  function takePhoto(file: File) {
    const input = screen.getByLabelText("Take photo") as HTMLInputElement;
    return userEvent.upload(input, file);
  }

  it("is a file input for images that opens the phone's back camera", async () => {
    stubApi();
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    const input = screen.getByLabelText("Take photo");

    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input).toHaveAttribute("capture", "environment");
  });

  it("asks for a signature, uploads straight to Cloudinary, and saves the check with the photo address", async () => {
    const { calls, posts } = stubApi();
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await userEvent.click(screen.getByLabelText("Visit"));
    await userEvent.click(screen.getByLabelText("Pass"));

    await takePhoto(new File(["pixels"], "front.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText("Photo added")).toBeInTheDocument();
    const upload = calls.find((call) => call.url.hostname === "api.cloudinary.com");
    expect(upload?.url.href).toBe("https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
    expect(upload?.method).toBe("POST");
    const form = upload?.body as FormData;
    expect(form.get("api_key")).toBe("123");
    expect(form.get("timestamp")).toBe("1700000000");
    expect(form.get("signature")).toBe("sig");
    expect(form.get("folder")).toBe("swifthealth/entrances");
    expect(form.get("upload_preset")).toBeNull(); // none was given
    expect((form.get("file") as File).name).toBe("front.jpg");
    expect(calls.find((call) => call.url.pathname === "/uploads/sign")?.headers.Authorization).toBe("Bearer tok");

    await userEvent.click(screen.getByRole("button", { name: "Save check" }));
    await screen.findByText("Check saved.");
    expect(JSON.parse(String(posts()[0].body)).photo_url).toBe(PHOTO);
  });

  it("sends the upload preset when the API gives one", async () => {
    const { calls } = stubApi({ sign: json({ cloud_name: "demo-cloud", api_key: "123", timestamp: 1, signature: "sig", folder: "swifthealth/entrances", upload_preset: "entrances_preset" }) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await takePhoto(new File(["pixels"], "front.jpg", { type: "image/jpeg" }));
    await screen.findByText("Photo added");

    expect(((calls.find((call) => call.url.hostname === "api.cloudinary.com")?.body) as FormData).get("upload_preset")).toBe("entrances_preset");
  });

  it("says the upload is not set up on a 503, and the check can still be saved without a photo", async () => {
    const { posts } = stubApi({ sign: json({ detail: "Photo upload is not set up." }, 503) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await takePhoto(new File(["pixels"], "front.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText("Photo upload is not set up yet. You can save the check without a photo.")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Call"));
    await userEvent.click(screen.getByLabelText("Pass"));
    await userEvent.click(screen.getByRole("button", { name: "Save check" }));
    await screen.findByText("Check saved.");
    expect(JSON.parse(String(posts()[0].body)).photo_url).toBeNull();
  });

  it("refuses a file that is not an image or is over 5 MB, without calling anything", async () => {
    const { calls } = stubApi();
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    const before = calls.length;

    // fireEvent, not userEvent.upload: the latter drops a file that the input's `accept` would not allow, as a browser's own picker does.
    const input = screen.getByLabelText("Take photo");
    fireEvent.change(input, { target: { files: [new File(["text"], "notes.txt", { type: "text/plain" })] } });
    expect(await screen.findByText("Choose a photo (an image file).")).toBeInTheDocument();
    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText("The photo is larger than 5 MB. Take a smaller one.")).toBeInTheDocument();

    expect(calls.length).toBe(before);
  });

  it("says the upload failed when Cloudinary refuses, and does not keep the photo", async () => {
    stubApi({ cloudinary: json({ error: { message: "bad" } }, 400) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await takePhoto(new File(["pixels"], "front.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText("The photo could not be uploaded. Try again, or save the check without it.")).toBeInTheDocument();
    expect(screen.queryByText("Photo added")).toBeNull();
  });

  it("does not keep an upload address that is not on res.cloudinary.com", async () => {
    stubApi({ cloudinary: json({ secure_url: "https://evil.example/x.jpg" }) });
    await openPage();
    await screen.findByRole("heading", { level: 1 });

    await takePhoto(new File(["pixels"], "front.jpg", { type: "image/jpeg" }));

    expect(await screen.findByText("The photo could not be uploaded. Try again, or save the check without it.")).toBeInTheDocument();
  });

  it("can remove a photo that was added", async () => {
    stubApi();
    await openPage();
    await screen.findByRole("heading", { level: 1 });
    await takePhoto(new File(["pixels"], "front.jpg", { type: "image/jpeg" }));
    await screen.findByText("Photo added");

    await userEvent.click(screen.getByRole("button", { name: "Remove the photo" }));

    expect(screen.queryByText("Photo added")).toBeNull();
  });
});

describe("access", () => {
  it("is closed to a visitor with no session and to a provider", async () => {
    window.sessionStorage.clear();
    stubApi();
    const first = render(await AdminChecksPage({ params: Promise.resolve({ id: "12" }) }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
    first.unmount();

    loginAs("provider");
    render(await AdminChecksPage({ params: Promise.resolve({ id: "12" }) }));
    expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
  });

  it("calls the Cloudinary address only from lib/api and keeps the photo out of every storage", () => {
    expect(readSource("components/admin/VerificationLog.tsx")).not.toMatch(/fetch\(|localStorage|sessionStorage|console\./);
  });
});
