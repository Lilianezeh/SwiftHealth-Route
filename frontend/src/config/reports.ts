/** The reasons of the report form (FR-21), in the order of `GET /meta` `report_reasons`. UI spec 2.8; decision B8 in
 * specs/2026-10-20-reports/requirements.md. They are fixed by the requirement and by the API's list, so the form does not wait
 * for a second request on a slow connection; a test keeps them equal to the API's list.
 */
export const REPORT_REASONS = [
  { value: "not_working", label: "Number not working" },
  { value: "wrong_number", label: "Wrong number" },
  { value: "closed", label: "Facility closed" },
  { value: "moved", label: "Facility moved" },
  { value: "wrong_hours", label: "Wrong opening hours" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const MAX_COMMENT_LENGTH = 500; // the API's limit
export const COMMENT_COUNTER_FROM = 400; // show "N characters left" from here
