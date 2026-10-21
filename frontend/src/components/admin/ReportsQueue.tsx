"use client";

/** The staff report queue. Requirements: US-12, FR-35, NFR-07, NFR-10. UI spec 3.6 and "Phase 11 details"; decisions H1 to H3
 * and H7 in specs/2026-10-20-reports-queue/requirements.md.
 *
 * The API sends the reports urgent first, then newest first. Resolve and Dismiss call the API, which deletes the reporter's
 * phone number; the card then leaves the list. The comment and the phone are rendered as text (React escapes them), never as HTML.
 */
import Link from "next/link";
import { useCallback, useState } from "react";

import { QueueStatus } from "@/components/admin/QueueStatus";
import { useStaff } from "@/components/admin/StaffGate";
import { STATUS_LABELS } from "@/components/admin/StatusBadge";
import { buttonClasses } from "@/components/ui/buttonStyles";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { REPORT_REASONS } from "@/config/reports";
import { usePagedList } from "@/hooks/usePagedList";
import { closeReport, listReports } from "@/lib/api/staff";
import { ApiError, type RequestOptions } from "@/lib/api/request";
import type { Page } from "@/lib/api/search";
import { formatLagosDateTime, formatTimeAgo } from "@/lib/formatters/dates";
import { formatMaskedPhone } from "@/lib/formatters/phone";
import type { ReportItem, ReportStatus } from "@/types/staff";

const STATUS_CHOICES: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];
const REASON_LABELS = Object.fromEntries(REPORT_REASONS.map((reason) => [reason.value, reason.label]));
const CLOSE_FAILED = "We couldn't do this. Try again.";
const CONTROL_CLASSES = "min-h-12";

export function ReportsQueue() {
  const { call } = useStaff();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchPage = useCallback(
    (page: Page, options: RequestOptions) => call((token) => listReports(token, status, page, options)),
    [call, status],
  );
  const list = usePagedList<ReportItem>(status, fetchPage, true);

  async function close(report: ReportItem, newStatus: "resolved" | "dismissed") {
    if (busyId !== null) return;
    setBusyId(report.id);
    setMessage(null);
    try {
      await call((token) => closeReport(token, report.id, newStatus));
      list.remove(report.id);
      setMessage({ text: `Report ${newStatus}. The reporter's phone number, if any, was deleted.`, isError: false });
    } catch (error) {
      // A 400 is the API's own sentence for a report someone else already closed; any other failure gets the plain one.
      const detail = error instanceof ApiError && error.status === 400 ? error.detail : null;
      setMessage({ text: detail ?? CLOSE_FAILED, isError: true });
    } finally {
      setBusyId(null);
    }
  }

  const now = new Date();

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Reports</h1>

      <div role="group" aria-label="Show reports that are" className="grid grid-cols-3 gap-2">
        {STATUS_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={choice.value === status}
            onClick={() => {
              setStatus(choice.value);
              setMessage(null);
            }}
            className={`inline-flex ${CONTROL_CLASSES} items-center justify-center rounded-xl border px-3 text-base font-semibold ${
              choice.value === status ? "border-pine bg-pine text-white" : "border-pine bg-white text-forest"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {message && !message.isError && (
        <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">
          {message.text}
        </p>
      )}
      {message?.isError && (
        <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
          {message.text}
        </p>
      )}

      <QueueStatus status={list.status} onRetry={list.retry} />

      {list.status === "ready" && list.items.length === 0 && (
        <p className="rounded-2xl border border-line bg-pine-50 p-4 text-base text-ink">{`No ${status} reports.`}</p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.items.map((report) => (
          <ReportCard key={report.id} report={report} now={now} isBusy={busyId === report.id} onClose={close} />
        ))}
      </div>
      <LoadMoreButton hasMore={list.hasMore} isLoading={list.isLoadingMore} failed={list.loadMoreFailed} onLoadMore={list.loadMore} />
    </section>
  );
}

type ReportCardProps = {
  report: ReportItem;
  now: Date;
  isBusy: boolean;
  onClose: (report: ReportItem, status: "resolved" | "dismissed") => void;
};

function ReportCard({ report, now, isBusy, onClose }: ReportCardProps) {
  const { listing } = report;
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        {report.urgent && (
          <span className="inline-flex rounded-full bg-emergency px-3 py-1 text-base font-bold text-white">Urgent</span>
        )}
        <p className="text-base font-semibold text-ink-soft">{REASON_LABELS[report.reason] ?? report.reason}</p>
      </div>
      <h2 className="text-lg font-bold leading-snug text-forest">
        <Link href={`/admin/listings/${listing.id}`} prefetch={false} className={`inline-flex ${CONTROL_CLASSES} items-center underline`}>
          {listing.name}
        </Link>
      </h2>
      <p className="text-base text-ink-soft">
        {listing.area} · {STATUS_LABELS[listing.status]}
      </p>
      {report.comment && <p className="text-base text-ink">{report.comment}</p>}
      {report.reporter_phone && <p className="text-base text-ink-soft">{`Reporter ${formatMaskedPhone(report.reporter_phone)}`}</p>}
      <p className="text-base text-ink-soft">
        <span title={formatLagosDateTime(report.created_at)}>{formatTimeAgo(report.created_at, now)}</span>
        {report.status !== "open" && ` · ${report.status === "resolved" ? "Resolved" : "Dismissed"}`}
      </p>

      {report.status === "open" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link href={`/admin/listings/${listing.id}`} prefetch={false} className={buttonClasses("secondary")}>
            Open listing
          </Link>
          <button type="button" onClick={() => onClose(report, "resolved")} disabled={isBusy} className={`${buttonClasses("primary")} disabled:opacity-60`}>
            Resolve
          </button>
          <button type="button" onClick={() => onClose(report, "dismissed")} disabled={isBusy} className={`${buttonClasses("secondary")} disabled:opacity-60`}>
            Dismiss
          </button>
        </div>
      )}
    </article>
  );
}
