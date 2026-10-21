/** Sample data and a fake API for the staff queue screens (reports, re-checks, dashboard). Everything is fictional. */
import { vi } from "vitest";

import { saveStaffSession } from "@/lib/staff/session";
import type { DashboardStats, ReportItem, StaffRole } from "@/types/staff";

import { json } from "./api";

export function loginAs(role: StaffRole) {
  saveStaffSession({ token: "tok", user: { id: 3, name: "Ada Staff", email: "a@b.co", phone: null, role, is_active: true } });
}

export function reportItem(overrides: Partial<ReportItem> = {}): ReportItem {
  return {
    id: 88,
    listing: { id: 12, slug: "night-pharmacy-a", name: "Night Pharmacy A", area: "New Haven", status: "published" },
    reason: "wrong_number",
    comment: "Rang twice, nobody answered",
    reporter_phone: "+234******0000",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "open",
    urgent: false,
    resolved_at: null,
    ...overrides,
  };
}

export function dashboardStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  const days = Array.from({ length: 30 }, (_unused, index) => ({
    date: new Date(Date.UTC(2026, 8, 7 + index)).toISOString().slice(0, 10),
    passed: index % 3,
    failed: index % 5 === 0 ? 1 : 0,
  }));
  return {
    listings_by_status: { draft: 12, pending_review: 4, published: 140, recheck_due: 6, hidden: 3 },
    rechecks_due_this_week: 18,
    overdue_rechecks: 2,
    open_reports: 5,
    urgent_reports: 1,
    checks_last_30_days: days,
    featured_active: 3,
    ...overrides,
  };
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** Puts a fake API behind fetch. `handlers` are keyed by the path. Returns every request seen, in order. */
export function stubStaffApi(handlers: Record<string, Handler>) {
  const requests: { url: URL; init: RequestInit | undefined }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init?: RequestInit) => {
      const url = new URL(address);
      requests.push({ url, init });
      const handler = handlers[url.pathname];
      return handler ? handler(url, init) : json({ detail: "Not found" }, 404);
    }),
  );
  return {
    requests,
    on: (path: string, method = "GET") =>
      requests.filter((request) => request.url.pathname === path && (request.init?.method ?? "GET") === method),
  };
}

export const headerOf = (init: RequestInit | undefined, name: string) => (init?.headers as Record<string, string> | undefined)?.[name];
