// @vitest-environment jsdom
/** The import and export screen (admin only). Requirements: FR-39, FR-40, NFR-06, NFR-10. UI spec 3.9 and its phase 14 details;
 * decisions E1 to E3 in specs/2026-10-20-launch-readiness/requirements.md.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AdminImportExportPage from "@/app/(dashboards)/admin/import-export/page";
import { saveStaffSession } from "@/lib/staff/session";
import type { StaffRole } from "@/types/staff";

import { json } from "../helpers/api";
import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 1, name: "Ada Admin", email: "a@b.co", phone: null, role, is_active: true } });
}

type Call = { method: string; path: string; search: string; body: unknown; headers: Record<string, string> };

function stubApi(options: { importAnswer?: Response; exportAnswer?: Response } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      calls.push({ method: init?.method ?? "GET", path: url.pathname, search: url.search, body: init?.body, headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.pathname === "/admin/import") return options.importAnswer ?? json({ created: 2, errors: [] });
      if (url.pathname === "/admin/export") return options.exportAnswer ?? new Response("id,name\n1,Night Pharmacy\n", { headers: { "content-type": "text/csv" } });
      return json({ detail: "Not found" }, 404);
    }),
  );
  return calls;
}

function csvFile(text = "name,category\nA,pharmacy\n", name = "listings.csv") {
  return new File([text], name, { type: "text/csv" });
}

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
  loginAs("admin");
});
afterEach(() => vi.unstubAllGlobals());

describe("the screen", () => {
  it("has the heading, the column names in words, the limits, a labelled file field and Import", async () => {
    stubApi();
    render(<AdminImportExportPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Import and export" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Import listings" })).toBeInTheDocument();
    expect(screen.getByText(/name, category, area, address, landmark, latitude, longitude, phone, is_24_hours/)).toBeInTheDocument();
    expect(screen.getByText(/Row 1 is the header/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 500 rows/)).toBeInTheDocument();
    const file = screen.getByLabelText("CSV file");
    expect(file).toHaveAttribute("type", "file");
    expect(file).toHaveAttribute("accept", ".csv,text/csv");
    expect(screen.getByRole("button", { name: "Import" }).className).toMatch(/min-h-\[50px\]/);
  });

  it("is closed to every role but the admin, and to a visitor with no session", async () => {
    for (const role of ["verifier", "editor", "provider"] as const) {
      loginAs(role);
      stubApi();
      const view = render(<AdminImportExportPage />);
      expect(await screen.findByText("Your role cannot open this page.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Import" })).toBeNull();
      view.unmount();
    }
    window.sessionStorage.clear();
    render(<AdminImportExportPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/log-in"));
  });
});

describe("importing", () => {
  it("asks for a file first and calls nothing", async () => {
    const calls = stubApi();
    render(<AdminImportExportPage />);
    await screen.findByLabelText("CSV file");

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("Choose a CSV file first.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("refuses a file over 1 MB before any call", async () => {
    const calls = stubApi();
    render(<AdminImportExportPage />);
    const big = csvFile("x", "big.csv");
    Object.defineProperty(big, "size", { value: 1024 * 1024 + 1 });
    fireEvent.change(await screen.findByLabelText("CSV file"), { target: { files: [big] } });

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText("The file is over 1 MB. Split it and import the parts one by one.")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("sends the text of the file as text/csv with the token, and says how many drafts were created", async () => {
    const calls = stubApi({ importAnswer: json({ created: 2, errors: [] }) });
    render(<AdminImportExportPage />);
    await userEvent.upload(await screen.findByLabelText("CSV file"), csvFile("name,category\nA,pharmacy\n"));

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("2 listings were created as drafts.")).toBeInTheDocument();
    expect(calls[0].method).toBe("POST");
    expect(calls[0].path).toBe("/admin/import");
    expect(calls[0].body).toBe("name,category\nA,pharmacy\n");
    expect(calls[0].headers["Content-Type"]).toBe("text/csv");
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(calls[0].search).toBe("");
  });

  it("says '1 listing was created' for one", async () => {
    stubApi({ importAnswer: json({ created: 1, errors: [] }) });
    render(<AdminImportExportPage />);
    await userEvent.upload(await screen.findByLabelText("CSV file"), csvFile());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("1 listing was created as a draft.")).toBeInTheDocument();
  });

  it("lists the skipped rows with their number and reason", async () => {
    stubApi({ importAnswer: json({ created: 1, errors: [{ row: 3, detail: "Unknown area" }, { row: 7, detail: "Already listed" }] }) });
    render(<AdminImportExportPage />);
    await userEvent.upload(await screen.findByLabelText("CSV file"), csvFile());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    const list = await screen.findByRole("list", { name: "Skipped rows" });
    const items = within(list).getAllByRole("listitem").map((item) => item.textContent);
    expect(items).toEqual(["Row 3: Unknown area", "Row 7: Already listed"]);
    expect(screen.getByText("1 listing was created as a draft.")).toBeInTheDocument();
  });

  it("shows the API's sentence when the whole file is refused, and no success", async () => {
    stubApi({ importAnswer: json({ detail: "The first row must name these columns: phone." }, 422) });
    render(<AdminImportExportPage />);
    await userEvent.upload(await screen.findByLabelText("CSV file"), csvFile());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("The first row must name these columns: phone.")).toBeInTheDocument();
    expect(screen.queryByText(/were created/)).toBeNull();
  });

  it("says it could not import on any other failure", async () => {
    stubApi({ importAnswer: json({ detail: "boom" }, 500) });
    render(<AdminImportExportPage />);
    await userEvent.upload(await screen.findByLabelText("CSV file"), csvFile());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByText("We couldn't import the file. Check your connection and try again.")).toBeInTheDocument();
  });

  it("cannot be sent twice while it is working", async () => {
    let finish: (response: Response) => void = () => undefined;
    const sent: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async () => { sent.push(1); return new Promise<Response>((resolve) => (finish = resolve)); }));
    render(<AdminImportExportPage />);
    await userEvent.upload(await screen.findByLabelText("CSV file"), csvFile());

    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    const working = await screen.findByRole("button", { name: "Importing…" });
    await userEvent.click(working);

    expect(working).toBeDisabled();
    expect(sent).toHaveLength(1);
    finish(json({ created: 0, errors: [] }));
    await screen.findByText("0 listings were created as drafts.");
  });
});

describe("exporting", () => {
  let download: { name: string; href: string }[];
  let createObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    download = [];
    createObjectURL = vi.fn(() => "blob:fake");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      download.push({ name: this.download, href: this.href });
    });
  });

  it("has two buttons, each at least 48 px high", async () => {
    stubApi();
    render(<AdminImportExportPage />);

    for (const name of ["Download listings (CSV)", "Download verification checks (CSV)"]) {
      expect((await screen.findByRole("button", { name })).className).toMatch(/min-h-\[50px\]/);
    }
  });

  it.each([
    ["Download listings (CSV)", "listings", "listings.csv"],
    ["Download verification checks (CSV)", "checks", "checks.csv"],
  ])("%s asks for type=%s with the token and saves %s", async (button, type, fileName) => {
    const calls = stubApi();
    render(<AdminImportExportPage />);

    await userEvent.click(await screen.findByRole("button", { name: button }));

    await waitFor(() => expect(download).toHaveLength(1));
    expect(calls[0].path).toBe("/admin/export");
    expect(new URLSearchParams(calls[0].search).get("type")).toBe(type);
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
    expect(download[0].name).toBe(fileName);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(await blob.text()).toBe("id,name\n1,Night Pharmacy\n");
  });

  it("says so when a download fails, and saves nothing", async () => {
    stubApi({ exportAnswer: json({ detail: "boom" }, 500) });
    render(<AdminImportExportPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Download listings (CSV)" }));

    expect(await screen.findByText("We couldn't download the file. Check your connection and try again.")).toBeInTheDocument();
    expect(download).toHaveLength(0);
  });
});

describe("what is never done", () => {
  it("keeps no file in any storage and writes nothing to the console", () => {
    expect(readSource("components/admin/ImportExport.tsx")).not.toMatch(/localStorage|sessionStorage|console\./);
  });
});
