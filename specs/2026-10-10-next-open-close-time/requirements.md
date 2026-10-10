# The next opening or closing time on search results (small backend PR): requirements

What this small backend feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it
is done is in [validation.md](validation.md). It is the "next opening or closing time on the card" item of `LOG.md`: the Figma
reference shows "Closes 9:00 PM" and "Opens 7:30 AM tomorrow" on each card, and `ListingSummary` had no hours (owner's
decision of 2026-10-09: the card shows only the badge until this PR).

## Requirements

- **FR-06:** each result shows name, category, distance, open or closed status, and the Call and Directions buttons. The status
  gets one more line of meaning: when the listing next closes or opens.
- **US-01:** a resident finds an open place quickly. "Closes 9:00 PM" tells them if it is worth the trip; "Opens 7:30 AM
  tomorrow" tells them not to go now.
- **FR-05:** the hours are the ones the open now filter already uses (the same rows, the same Lagos time).
- **NFR-02:** `GET /search` stays fast; the text is worked out for the returned page only (20 results at most).
- **NFR-10:** the card text is plain words, with the time written out, so it reads well in a screen reader.

Source of truth: [prd.md](../prd.md), [api-spec.md](../backend/api-spec.md) (`ListingSummary`, `hours_note`). Branch:
`feature/next-open-close-time`. Every commit and test references these IDs. Related earlier work: the
[search backend](../2026-10-09-search-backend/requirements.md) (decisions 7 to 9 on hours in Lagos time).

Fit with the project: [mission.md](../mission.md) says a resident finds a facility that is open near them, and
[tech-stack.md](../tech-stack.md) fixes the layers (service, repository). It adds **no table, no column, no migration, no
package and no setting**; it reads the `opening_hours` rows that search already loads.

## In scope

- A new field `hours_note` on `ListingSummary` (api-spec, Task 0), filled by `GET /search`.
- A pure function `next_change` in `services/hours.py` that finds the next change, and a formatter that writes the text.
- Tests that pin every rule below, including that the note always agrees with `is_open_now`.

## Out of scope (planned elsewhere)

- Showing the text on the card (`ListingCard`) and the frontend type: the **next small frontend PR** (`LOG.md`). Until it is
  merged, the card ignores the new field.
- The listing page's weekly hours (`ListingDetail`): roadmap phase 6.
- Other languages: see decision 7.
- The emergency and blood lists (phases 7 and 8): they return `null` until they fill the field.

## Decisions

1. **Server text, not data (owner's decision, 2026-10-10).** `hours_note` is a ready-made English string. The "tomorrow" and
   day-name logic then lives in one tested place and uses Lagos time, not the visitor's device clock. The alternative, a
   structured `{type, at}` that the frontend formats, was rejected.
2. **Forms of the text** (owner's changes, 2026-10-10): 12-hour time with minutes, no leading zero ("9:00 PM"); full day names
   ("Opens Monday 7:30 AM"); "Closes at midnight" and "Opens at midnight" instead of "12:00 AM". The exact list is in the
   api-spec. Noon is "12:00 PM". Midnight at the start of **tomorrow** is the coming midnight, so it has no day word; at the start
   of a **later** day it names the day ("Opens Monday at midnight"). Seconds in a stored time are ignored.
3. **`null` in four cases:** a 24-hour listing (the badge says "Open 24 hours"), a listing with no hours recorded (no rows,
   only closed days, or rows without times; the owner's rule), a zero-length row (opens equals closes: never open, as in
   `is_open_at`), and a listing that does not open or close within the next 7 days.
4. **It always agrees with `is_open_now`.** Open now gives "Closes ...", closed now gives "Opens ...". A test walks every
   minute of 8 days over several weekly schedules and checks this against the existing `is_open_at`.
5. **Shifts that meet at midnight are one opening.** A day that closes at 00:00 followed by a day that opens at 00:00 is not
   "Closes at midnight": the note names the end of the whole run. The search finds the run by building the open intervals of the
   days around the moment (yesterday to 7 days ahead) and joining the ones that touch.
6. **Only the returned page.** The note is worked out in `to_summary`, after sorting and paging, so at most 20 results pay for it.
7. **English only (owner's decision, 2026-10-10).** The words ("Closes", "Opens", "tomorrow", the day names, "midnight") are
   written in the code. If SwiftHealth adds another language, this text must be translated, so it is a reminder in
   `LOG.md`; at that point the option of sending data and formatting on the frontend must be reconsidered.
8. **Lagos time.** The moment is converted to Africa/Lagos with the existing `LAGOS_TIME`. Lagos has no daylight saving, so
   a day is always 24 hours.
