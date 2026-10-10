// @vitest-environment jsdom
/** Tests for AreaSelect. Requirements: FR-03 (if location is refused, the visitor picks an area from GET /meta), NFR-10. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AreaSelect } from "@/components/location/AreaSelect";
import { resetMetaCache } from "@/lib/api/meta";

import { AREAS, json, META, stubApi } from "../helpers/api";

beforeEach(() => {
  resetMetaCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AreaSelect", () => {
  it("lists the areas of GET /meta under a visible label", async () => {
    stubApi({});
    render(<AreaSelect value={null} onChange={() => {}} />);

    const select = await screen.findByRole("combobox", { name: "Choose an area" });
    const options = [...select.querySelectorAll("option")].map((option) => option.textContent);
    expect(options).toEqual(["Choose an area…", ...AREAS]);
  });

  it("tells the parent which area was picked", async () => {
    stubApi({});
    const onChange = vi.fn();
    render(<AreaSelect value={null} onChange={onChange} />);

    await userEvent.selectOptions(await screen.findByRole("combobox"), "Ogui");

    expect(onChange).toHaveBeenCalledWith("Ogui");
  });

  it("shows the chosen area", async () => {
    stubApi({});
    render(<AreaSelect value="GRA" onChange={() => {}} />);

    expect(await screen.findByRole("combobox")).toHaveValue("GRA");
  });

  it("has a 50 px field with 16 px text, so phones do not zoom in", async () => {
    stubApi({});
    render(<AreaSelect value={null} onChange={() => {}} />);

    const className = (await screen.findByRole("combobox")).className;
    expect(className).toMatch(/min-h-\[50px\]/);
    expect(className).toMatch(/\btext-base\b/);
  });

  it("shows an error with Retry when the lists cannot be loaded, then the areas after Retry", async () => {
    let attempts = 0;
    stubApi({ meta: () => (++attempts === 1 ? json({ detail: "down" }, 500) : json(META)) });
    render(<AreaSelect value={null} onChange={() => {}} />);

    expect(await screen.findByText("We couldn't load the areas. Check your connection and try again.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("combobox", { name: "Choose an area" })).toBeInTheDocument();
  });
});
