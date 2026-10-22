// @vitest-environment jsdom
/** The SwiftRescue page. Requirements: FR-14 (112 first and always), FR-15, FR-16, FR-19, FR-25, FR-26, US-04, NFR-01, NFR-03, NFR-10.
 * UI spec 2.5 and "Standard states". Decisions A1, A5 and A10 in specs/2026-10-17-swiftrescue/requirements.md.
 * It replaces the tests of the interim page (a button and a "coming soon" line) that phase 7 removed.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EmergencyPage from "@/app/(public)/emergency/page";
import { savePosition } from "@/lib/location/locationStore";

import { emergencyResponse, json, listing, neverAnswers, oldEmergencyResponse, stubApi } from "../helpers/api";
import { readSource } from "../helpers/source";

const SENTENCE =
  "SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112.";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the static part: 112, the sentence and the heading (they need no network)", () => {
  it("has one h1, SwiftRescue", () => {
    stubApi({ emergency: neverAnswers });
    render(<EmergencyPage />);

    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/^SwiftRescue$/);
  });

  it("shows 112 first: the first thing after the heading, before any other link or button", () => {
    stubApi({ emergency: neverAnswers });
    render(<EmergencyPage />);

    const call = screen.getByRole("link", { name: "Call 112" });
    expect(call).toHaveAttribute("href", "tel:112");
    expect(screen.getAllByRole("link")[0]).toBe(call); // the first link of the page content
    const position = (element: HTMLElement) => document.body.innerHTML.indexOf(element.outerHTML);
    for (const button of screen.queryAllByRole("button")) expect(position(call)).toBeLessThan(position(button));
    expect(screen.getByText("National emergency number — 112")).toBeInTheDocument();
  });

  it("makes Call 112 red with white text, 64 px high with 24 px text, the whole width on a phone", () => {
    stubApi({ emergency: neverAnswers });
    render(<EmergencyPage />);

    const call = screen.getByRole("link", { name: "Call 112" });
    expect(call.className).toMatch(/\bbg-emergency\b/);
    expect(call.className).toMatch(/\btext-white\b/);
    expect(call.className).toMatch(/\bmin-h-16\b/);
    expect(call.className).toMatch(/\btext-2xl\b/);
    expect(call.className).toMatch(/\bw-full\b/);
    expect(call.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the sentence of FR-26 under 112, as text on the page, not behind a click", () => {
    stubApi({ emergency: neverAnswers });
    const { container } = render(<EmergencyPage />);

    const sentence = screen.getByText(SENTENCE);
    expect(sentence).toBeVisible();
    expect(sentence.className).not.toMatch(/\btext-(xs|sm)\b/);
    const text = container.textContent ?? "";
    expect(text.indexOf("Call 112")).toBeLessThan(text.indexOf("SwiftRescue connects you"));
    expect(container.querySelectorAll("details, summary")).toHaveLength(0);
  });

  it("the old 'coming soon' line is gone", () => {
    stubApi({ emergency: neverAnswers });
    const { container } = render(<EmergencyPage />);

    expect(container.textContent).not.toMatch(/coming soon/i);
  });

  it("the page file and the 112 card are server components with no data of their own", () => {
    for (const file of ["app/(public)/emergency/page.tsx", "components/emergency/NationalLineCard.tsx"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/["']use client["']/);
      expect(source).not.toMatch(/fetch\(|\bawait\b|lib\/api/);
    }
  });

  it("has no search box and no medical advice", () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    expect(container.querySelectorAll("input[type=search], [role=searchbox], [role=search]")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\b(symptom|diagnos|treatment|dose|medicine to take)/i);
  });
});

describe("the contacts", () => {
  it("shows the groups with a contact, in the API order, and hides the empty ones", async () => {
    stubApi({});
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf("Ambulance")).toBeLessThan(headings.indexOf("Police"));
    expect(headings).not.toContain("Blood banks"); // an empty group other than Ambulance and Fire stays hidden
    expect(headings).not.toContain("Security");
    expect(headings).not.toContain("Roadside assistance");
  });

  it("shows for each contact its name as a link to the listing, its area, the verified date and a Call button", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const ambulance = (await screen.findByRole("heading", { level: 2, name: "Ambulance" })).closest("section");
    expect(ambulance).not.toBeNull();
    const card = within(ambulance as HTMLElement).getByRole("article");
    expect(within(card).getByRole("link", { name: "Demo Ambulance One" })).toHaveAttribute("href", "/listing/contact-101");
    expect(card).toHaveTextContent("New Haven");
    expect(card).toHaveTextContent(/Verified 3 days ago/);
    const call = within(card).getByRole("link", { name: "Call Demo Ambulance One" });
    expect(call).toHaveAttribute("href", "tel:+2340000000101");
    expect(call.className).toMatch(/\bmin-h-\[50px\]/); // at least 48 px
  });

  it("gives every contact a 'Report a problem' link to its report page, at least 48 px high (FR-20)", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const link = await screen.findByRole("link", { name: "Report a problem with Demo Ambulance One" });

    expect(link).toHaveAttribute("href", "/report/contact-101");
    expect(link.className).toMatch(/\bmin-h-12\b/);
    expect(link).toHaveTextContent("Report a problem");
  });

  it("shows no Call button for a contact with no number, and no distance without a position", async () => {
    const response = emergencyResponse();
    response.groups[0].contacts[0].primary_phone = null;
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    const card = (await screen.findAllByRole("article"))[0];
    expect(within(card).queryByRole("link", { name: /^Call/ })).toBeNull();
    expect(card.textContent).not.toMatch(/\bkm\b/);
  });

  it("with a position, asks again with it and shows the distances", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    const response = emergencyResponse();
    response.groups[0].contacts[0].distance_km = 1.4;
    const { requests } = stubApi({
      emergency: (parameters) => json(parameters.has("lat") ? response : emergencyResponse()),
    });
    render(<EmergencyPage />);

    await waitFor(() => expect(screen.getAllByRole("article")[0]).toHaveTextContent("1.4 km"));

    expect(requests.some((url) => url.searchParams.get("lat") === "6.452")).toBe(true);
    expect(window.location.search).toBe(""); // the position is never in the address
  });

  it("says so when every group is empty, with 112 still on the page", async () => {
    const response = emergencyResponse();
    response.groups.forEach((group) => (group.contacts = []));
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    expect(await screen.findByText("We are still adding verified contacts. In danger, call 112.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call 112" })).toBeInTheDocument();
  });
});

const EMPTY_TEXT = "No contacts added yet. In danger, call 112.";

function emptyResponse(keep: string[] = []) {
  const response = emergencyResponse();
  response.groups.forEach((group) => {
    if (!keep.includes(group.category.slug)) group.contacts = [];
  });
  return response;
}

/** The h2 headings from Ambulance on: the groups (the blood card is a link, not a heading; the static h2s above are left out). */
function groupHeadings(): string[] {
  const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent ?? "");
  return headings.slice(headings.indexOf("Ambulance"));
}

describe("Ambulance and Fire are always shown, first, even when empty (decision K1)", () => {
  it("shows both headings with 'No contacts added yet. In danger, call 112.' when both are empty", async () => {
    stubApi({ emergency: () => json(emptyResponse(["police"])) });
    render(<EmergencyPage />);

    const ambulance = await screen.findByRole("heading", { level: 2, name: "Ambulance" });
    const fire = screen.getByRole("heading", { level: 2, name: "Fire" });

    for (const heading of [ambulance, fire]) {
      const section = heading.closest("section") as HTMLElement;
      expect(within(section).getByText(EMPTY_TEXT)).toBeInTheDocument();
      expect(within(section).queryAllByRole("article")).toHaveLength(0);
    }
  });

  it("puts Ambulance and Fire before every other group, then the others in the API order", async () => {
    const response = emptyResponse(["police"]);
    response.groups.find((group) => group.category.slug === "security")?.contacts.push(
      listing({ id: 401, slug: "demo-security", name: "Demo Security", category: { slug: "security", name: "Security" } }),
    );
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Fire" });

    expect(groupHeadings().slice(0, 4)).toEqual(["Ambulance", "Fire", "Police", "Security"]);
  });

  it("shows the contacts of a group that has some, and not the empty text", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const ambulance = (await screen.findByRole("heading", { level: 2, name: "Ambulance" })).closest("section") as HTMLElement;
    const fire = screen.getByRole("heading", { level: 2, name: "Fire" }).closest("section") as HTMLElement;

    expect(within(ambulance).getAllByRole("article")).toHaveLength(1);
    expect(within(ambulance).queryByText(EMPTY_TEXT)).toBeNull();
    expect(within(fire).getByText(EMPTY_TEXT)).toBeInTheDocument(); // the stub has an ambulance but no fire contact
  });

  it("keeps hiding every other empty group", async () => {
    stubApi({ emergency: () => json(emptyResponse()) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(expect.arrayContaining(["Ambulance", "Fire"]));
    for (const hidden of ["Police", "24-hour emergency units", "Roadside assistance", "Security", "Blood banks"]) {
      expect(headings).not.toContain(hidden);
    }
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(2);
  });

  it("still draws both when an old saved answer lacks them", async () => {
    const response = emergencyResponse();
    response.groups = response.groups.filter((group) => !["ambulance", "fire"].includes(group.category.slug));
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(groupHeadings().slice(0, 2)).toEqual(["Ambulance", "Fire"]);
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(2);
  });

  it("keeps the 'still adding' sentence above the two empty groups when everything is empty (decision K2)", async () => {
    const response = emptyResponse();
    stubApi({ emergency: () => json(response) });
    render(<EmergencyPage />);

    const sentence = await screen.findByText("We are still adding verified contacts. In danger, call 112.");
    const ambulance = screen.getByRole("heading", { level: 2, name: "Ambulance" });

    expect(sentence.compareDocumentPosition(ambulance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(2);
  });

  it("shows the empty text in 16 px text, not smaller, and 112 stays the first thing after the heading", async () => {
    stubApi({ emergency: () => json(emptyResponse()) });
    render(<EmergencyPage />);

    const empty = (await screen.findAllByText(EMPTY_TEXT))[0];

    expect(empty.className).toMatch(/\btext-base\b/);
    expect(empty.className).not.toMatch(/text-(xs|sm)\b/);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveAccessibleName("Call 112");
  });
});

describe("the blood link card (decision K3)", () => {
  it("is a link to /blood with the heading and the line, after the groups, and the last thing in the list", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const link = await screen.findByRole("link", { name: /Need blood urgently\?/ });

    expect(link).toHaveAttribute("href", "/blood");
    expect(link).toHaveTextContent("Need blood urgently?");
    expect(link).toHaveTextContent("Find blood banks and the blood groups they list.");
    const lastGroup = screen.getByRole("heading", { level: 2, name: "Police" });
    expect(lastGroup.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.parentElement?.lastElementChild).toBe(link); // nothing comes after it
  });

  it("is the only blood on the page: blood banks are listed on /blood, not here (decision M1)", async () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    await screen.findByRole("link", { name: /Need blood urgently\?/ });

    expect(screen.queryByRole("heading", { name: /blood/i })).toBeNull(); // no "Blood banks" group
    expect(container.textContent).not.toContain("Demo Blood Bank");
  });

  it("ignores a Blood banks group that an older API still sends, even with a blood bank in it", async () => {
    stubApi({ emergency: () => json(oldEmergencyResponse()) });
    const { container } = render(<EmergencyPage />);

    const link = await screen.findByRole("link", { name: /Need blood urgently\?/ });

    expect(screen.queryByRole("heading", { name: "Blood banks" })).toBeNull();
    expect(container.textContent).not.toContain("Demo Blood Bank");
    expect(link).toHaveAttribute("href", "/blood"); // the way to blood is the card
  });

  it("does not count an ignored Blood banks group as 'something to show': with every other group empty the sentence stays", async () => {
    const answer = oldEmergencyResponse();
    answer.groups.forEach((group) => {
      if (group.category.slug !== "blood-bank") group.contacts = [];
    });
    stubApi({ emergency: () => json(answer) });
    render(<EmergencyPage />);

    expect(await screen.findByText("We are still adding verified contacts. In danger, call 112.")).toBeInTheDocument();
    expect(screen.queryByText("Demo Blood Bank")).toBeNull();
  });

  it("is shown when every group is empty too", async () => {
    stubApi({ emergency: () => json(emptyResponse()) });
    render(<EmergencyPage />);

    expect(await screen.findByRole("link", { name: /Need blood urgently\?/ })).toHaveAttribute("href", "/blood");
  });

  it("is at least 48 px high, uses 16 px text or more, and has no icon, no cross and nothing red", async () => {
    stubApi({});
    render(<EmergencyPage />);

    const link = await screen.findByRole("link", { name: /Need blood urgently\?/ });

    expect(link.className).toMatch(/min-h-12|min-h-\[50px\]|min-h-14|min-h-16/);
    expect(link.querySelector("svg")).toBeNull();
    expect(link.textContent).not.toMatch(/[✚✛✜✙+➕⚕✝†]/u);
    expect(link.outerHTML).not.toMatch(/emergency|red-|rose-|#b3261e/);
    for (const element of [link, ...Array.from(link.querySelectorAll("*"))]) {
      expect(element.className, element.outerHTML).not.toMatch(/text-(xs|sm)\b/);
    }
    expect(link.textContent).not.toMatch(/Sponsored|Featured/);
  });

  it("is shown from a saved copy too (offline), because the link works once the connection is back", async () => {
    const first = stubApi({});
    const { unmount } = render(<EmergencyPage />);
    await screen.findByRole("heading", { level: 2, name: "Ambulance" });
    unmount();
    first.fetchStub.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<EmergencyPage />);

    expect(await screen.findByText(/Offline — showing saved contacts/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Need blood urgently\?/ })).toHaveAttribute("href", "/blood");
  });
});

describe("there are no 24-hour pharmacies on SwiftRescue (FR-25 removed, decision K6)", () => {
  /** An answer from an old API: the list the API used to send. The page must ignore it. */
  function oldAnswerWithPharmacies() {
    return {
      ...emergencyResponse(),
      pharmacies_24h: [listing({ id: 201, slug: "night-pharmacy", name: "Demo Night Pharmacy", is_24_hours: true })],
    };
  }

  it("has no pharmacy section, heading or card", async () => {
    stubApi({});
    const { container } = render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(screen.queryByRole("heading", { name: /pharmac/i })).toBeNull();
    expect(container.textContent).not.toMatch(/pharmac/i);
  });

  it("ignores the list when an old API still sends it", async () => {
    stubApi({ emergency: () => json(oldAnswerWithPharmacies()) });
    const { container } = render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(screen.queryByRole("heading", { name: /pharmac/i })).toBeNull();
    expect(container.textContent).not.toContain("Demo Night Pharmacy");
  });

  it("does not count a pharmacy list as 'something to show': with every group empty the sentence is still there", async () => {
    const answer = oldAnswerWithPharmacies();
    answer.groups.forEach((group) => (group.contacts = []));
    stubApi({ emergency: () => json(answer) });
    render(<EmergencyPage />);

    expect(await screen.findByText("We are still adding verified contacts. In danger, call 112.")).toBeInTheDocument();
    expect(screen.queryByText("Demo Night Pharmacy")).toBeNull();
  });

  it("is not kept in the browser either: a position does not bring a 'nearby' section", async () => {
    savePosition({ latitude: 6.452, longitude: 7.51 });
    stubApi({});
    const { container } = render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(container.textContent).not.toMatch(/nearby/i);
  });
});

describe("no sponsored content (FR-19)", () => {
  it("shows no 'Sponsored' or 'Featured' even if the API ever sent sponsored: true", async () => {
    const response = emergencyResponse();
    response.groups[0].contacts[0].sponsored = true;
    stubApi({ emergency: () => json(response) });
    const { container } = render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });

    expect(container.textContent).not.toMatch(/\bfeatured\b/i);
    expect(screen.queryByText(/^Sponsored$/)).toBeNull();
  });
});

describe("the standard states", () => {
  it("shows a skeleton while loading, and after 5 seconds says the service is waking up", async () => {
    vi.useFakeTimers();
    stubApi({ emergency: neverAnswers });
    render(<EmergencyPage />);
    expect(screen.getByTestId("emergency-status")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByText("The service is waking up. This can take up to a minute.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call 112" })).toBeInTheDocument();
  });

  it("shows the error with Retry after a failure, and 112 stays on top", async () => {
    stubApi({ emergency: () => json({ detail: "boom" }, 500) });
    render(<EmergencyPage />);

    expect(await screen.findByText("We couldn't load this. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText(/In danger, call 112/)).toBeInTheDocument();
  });

  it("offline with a saved copy: shows the saved contacts with the date they were saved", async () => {
    stubApi({});
    const first = render(<EmergencyPage />);
    await screen.findByRole("heading", { level: 2, name: "Ambulance" });
    first.unmount();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    render(<EmergencyPage />);

    const notice = await screen.findByText(/^Offline — showing saved contacts from \d{1,2} \w{3} \d{4}$/);
    expect(notice).toBeVisible();
    expect(await screen.findByRole("heading", { level: 2, name: "Ambulance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("does not show the offline notice when the network works", async () => {
    stubApi({});
    render(<EmergencyPage />);

    await screen.findByRole("heading", { level: 2, name: "Ambulance" });
    expect(screen.queryByText(/Offline/)).toBeNull();
  });
});

describe("asking for distances", () => {
  it("offers 'Show distances from my location' when there is no position, and a tap asks the browser", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    stubApi({});
    render(<EmergencyPage />);

    const button = await screen.findByRole("button", { name: "Show distances from my location" });
    expect(getCurrentPosition).not.toHaveBeenCalled(); // the prompt appears only after a tap
    await userEvent.click(button);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });
});
