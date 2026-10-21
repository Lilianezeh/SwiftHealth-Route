/** POST /reports from the browser. Requirements: US-08, FR-21, NFR-06, NFR-07. Contract: api-spec, "POST /reports".
 * Nothing about the visitor's position is sent: only the listing, the reason and the two optional fields. Empty optional fields are
 * left out. A 422 (bad phone number) and a 429 (rate limit) reach the caller as an ApiError with that status.
 */
import type { ReportReason } from "@/config/reports";
import { requestJson } from "@/lib/api/request";

export type ReportInput = { listing_id: number; reason: ReportReason; comment: string; reporter_phone: string };
export type ReportCreated = { id: number; message: string };

export function postReport(input: ReportInput): Promise<ReportCreated> {
  const comment = input.comment.trim();
  const phone = input.reporter_phone.trim();
  return requestJson<ReportCreated>("/reports", {
    body: {
      listing_id: input.listing_id,
      reason: input.reason,
      ...(comment ? { comment } : {}),
      ...(phone ? { reporter_phone: phone } : {}),
    },
  });
}
