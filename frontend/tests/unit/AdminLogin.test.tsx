// @vitest-environment jsdom
/** /admin/login (the dashboard at /admin is tested in Dashboard.test.tsx). Requirements: FR-30, FR-42. */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/(dashboards)/admin/login/page";

import { readSource } from "../helpers/source";

const replace = vi.fn();
const router = { replace, push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
});

describe("/admin/login", () => {
  it("is the login form", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Staff login" })).toBeInTheDocument();
  });

  it("is not in the footer or the header: staff open it by address", () => {
    expect(readSource("config/site.ts")).not.toMatch(/admin/);
  });
});
