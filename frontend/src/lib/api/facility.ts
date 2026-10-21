/** POST /facility-submissions from the browser ("List your facility"). Requirements: FR-37, NFR-06, NFR-07.
 * Contract: api-spec, "POST /facility-submissions". Nothing about the visitor's position is sent. A 422 and a 429 reach the caller as
 * an ApiError with that status. The owner's name and email are sent once and are not kept anywhere in the browser.
 */
import { requestJson } from "@/lib/api/request";

export type FacilitySubmission = {
  facility_name: string;
  category: string;
  area: string;
  address: string;
  phone: string;
  contact_name: string;
  contact_email: string;
  notes: string;
};

export function postFacilitySubmission(submission: FacilitySubmission): Promise<{ message: string }> {
  const notes = submission.notes.trim();
  return requestJson<{ message: string }>("/facility-submissions", {
    body: {
      facility_name: submission.facility_name.trim(),
      category: submission.category,
      area: submission.area,
      address: submission.address.trim(),
      phone: submission.phone.trim(),
      contact_name: submission.contact_name.trim(),
      contact_email: submission.contact_email.trim(),
      ...(notes ? { notes } : {}),
    },
  });
}
