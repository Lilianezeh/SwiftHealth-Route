"use client";

/** The report form. Requirements: US-08 (reason, then Send: two taps), FR-21, NFR-06, NFR-07, NFR-10. UI spec 2.8.
 * Decisions B1 to B3 and B8 in specs/2026-10-20-reports/requirements.md. The phone number is optional and is explained in words;
 * the form keeps what was typed after a failure. It reads no position and stores nothing.
 */
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { buttonClasses } from "@/components/ui/buttonStyles";
import { COMMENT_COUNTER_FROM, MAX_COMMENT_LENGTH, REPORT_REASONS, type ReportReason } from "@/config/reports";
import { postReport } from "@/lib/api/reports";
import { ApiError } from "@/lib/api/request";

type ReportFormProps = { listingId: number; listingName: string; listingSlug: string };
type Step = "editing" | "sending" | "sent";
type Problem = "rate-limit" | "phone" | "failed" | null;

const PROBLEM_TEXT: Record<Exclude<Problem, null>, string> = {
  "rate-limit": "You've sent several reports. Please try again later.",
  phone: "Check the phone number. It should look like 0803 123 4567.",
  failed: "We couldn't send your report. Check your connection and try again.",
};

export function ReportForm({ listingId, listingName, listingSlug }: ReportFormProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("editing");
  const [problem, setProblem] = useState<Problem>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason === null || step === "sending") return;
    setStep("sending");
    setProblem(null);
    try {
      await postReport({ listing_id: listingId, reason, comment, reporter_phone: phone });
      setStep("sent");
    } catch (error) {
      setProblem(
        error instanceof ApiError && error.status === 429
          ? "rate-limit"
          : error instanceof ApiError && error.status === 422
            ? "phone"
            : "failed",
      );
      setStep("editing");
    }
  }

  if (step === "sent") {
    return (
      <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold text-forest">Report a problem with {listingName}</h1>
        <p role="status" className="rounded-2xl border border-line bg-pine-50 p-4 text-lg text-ink">
          Thank you. We&apos;ll check this listing.
        </p>
        <Link href={`/listing/${listingSlug}`} prefetch={false} className={`${buttonClasses("primary")} sm:max-w-xs`}>
          Back to the listing
        </Link>
      </section>
    );
  }

  const charactersLeft = MAX_COMMENT_LENGTH - comment.length;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold text-forest">Report a problem with {listingName}</h1>
      <form onSubmit={send} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-lg font-semibold text-ink">What is wrong?</legend>
          {REPORT_REASONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-4 text-base text-ink has-[:checked]:border-pine has-[:checked]:bg-pine-50"
            >
              <input
                type="radio"
                name="reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
                className="h-5 w-5 accent-pine"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="report-comment" className="text-base font-semibold text-ink">
            Comment (optional)
          </label>
          <textarea
            id="report-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={MAX_COMMENT_LENGTH}
            rows={3}
            className="rounded-xl border border-line bg-white p-3 text-base text-ink"
          />
          {comment.length >= COMMENT_COUNTER_FROM && (
            <p className="text-base text-ink-soft">{charactersLeft} characters left</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="report-phone" className="text-base font-semibold text-ink">
            Your phone number (optional)
          </label>
          <input
            id="report-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="min-h-12 rounded-xl border border-line bg-white px-3 text-base text-ink"
          />
          <p className="text-base text-ink-soft">Only if you want us to follow up. We delete it when the report is closed.</p>
        </div>

        {problem && (
          <p role="alert" className="rounded-2xl border border-line bg-amber-wash p-4 text-base font-semibold text-amber-ink">
            {PROBLEM_TEXT[problem]}
          </p>
        )}

        <button type="submit" disabled={reason === null || step === "sending"} className={`${buttonClasses("primary")} disabled:opacity-60`}>
          {step === "sending" ? "Sending…" : "Send report"}
        </button>
      </form>
    </section>
  );
}
