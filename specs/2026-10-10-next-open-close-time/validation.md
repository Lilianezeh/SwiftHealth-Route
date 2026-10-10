# The next opening or closing time on search results: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-06, US-01, FR-05 or NFR-02. Tick a box only after the test exists and passes.

## How to run

The commands run in the backend container:
- Tests: `docker compose exec backend pytest -q -W error`
- Lint: `docker compose exec backend ruff check .`

## Tests per task

### Task 1: `tests/unit/test_hours.py`
Plain `OpeningHours` objects and fixed Lagos moments; no database. 2026-10-05 is a Monday.

`next_change` (what happens next and when):
- [ ] `test_next_change_open_now_closes_later_today`
- [ ] `test_next_change_on_a_shift_past_midnight_closes_tomorrow` (20:00 to 02:00, at 23:00)
- [ ] `test_next_change_after_midnight_on_a_late_shift_closes_today` (the same shift, at 01:00, from yesterday's row)
- [ ] `test_next_change_closed_now_opens_later_today`
- [ ] `test_next_change_after_closing_opens_tomorrow`
- [ ] `test_next_change_skips_closed_days_and_finds_a_later_day`
- [ ] `test_next_change_wraps_from_sunday_to_monday`
- [ ] `test_next_change_at_the_opening_minute_is_closes_and_at_the_closing_minute_is_opens`
- [ ] `test_next_change_is_none_for_a_24_hour_listing`
- [ ] `test_next_change_is_none_without_hours` (no rows; only closed days; rows without times; a zero-length row)
- [ ] `test_next_change_joins_shifts_that_meet_at_midnight` (a day to 00:00 then a day from 00:00 is one opening)
- [ ] `test_next_change_works_from_a_utc_moment_and_needs_a_time_zone`

The words (`hours_note`):
- [ ] `test_hours_note_forms` (one case for each of the eight forms in the api-spec, and the noon and half-hour cases:
  "Closes 9:00 PM", "Closes 12:30 PM", "Closes 2:00 AM tomorrow", "Closes at midnight", "Opens 7:30 AM", "Opens 7:30 AM tomorrow",
  "Opens Monday 7:30 AM", "Opens at midnight", "Opens Monday at midnight")
- [ ] `test_hours_note_uses_full_day_names` (every weekday)
- [ ] `test_hours_note_midnight_has_no_clock_time_and_no_12_00_am`
- [ ] `test_hours_note_ignores_seconds`
- [ ] `test_hours_note_is_none_when_nothing_changes_within_seven_days`

The two must agree:
- [ ] `test_hours_note_agrees_with_is_open_at_for_every_minute_of_eight_days` (five weekly schedules: normal hours, a shift past
  midnight, weekdays only, a day to midnight joined with the next, and a split week; "Closes" exactly when `is_open_at` is true)

### Task 2: `tests/integration/test_search.py` (with the fixed clock, Tuesday 10:00 in Lagos)
- [ ] `test_every_item_has_the_summary_fields_including_hours_note` (`SUMMARY_FIELDS` gets `hours_note`)
- [ ] `test_hours_note_closes_for_an_open_listing` ("Closes 9:00 PM")
- [ ] `test_hours_note_opens_for_a_closed_listing` (the clock moved to 22:00: "Opens 8:00 AM tomorrow")
- [ ] `test_hours_note_is_null_for_a_24_hour_listing_and_for_a_listing_without_hours`
- [ ] `test_hours_note_follows_lagos_time_not_utc` (a UTC moment that is a different day in UTC and in Lagos)
- [ ] `test_hours_note_agrees_with_is_open_now_for_every_result`
- [ ] `test_hours_note_is_given_to_every_item_of_a_later_page` (offset and limit)

## Review-focus edge cases

- [ ] **Only the page.** The note is worked out in `to_summary`, after sorting and paging, not for every candidate.
- [ ] **No change to what is found or sorted.** The existing search tests pass unchanged (only `SUMMARY_FIELDS` grows).
- [ ] **No database change.** No migration, no model change: `git diff --stat origin/main -- backend/alembic backend/app/models` is empty.
- [ ] **A time with minutes.** A listing that opens at 07:30 reads "7:30 AM", not "7:00 AM" or "7:30:00 AM".
- [ ] **Words only.** Every part of the text is a fixed word or a number from the hours; no listing text (name, address) can end up in it.

## Security checklist

- [ ] No new input: the endpoint takes the same parameters as before.
- [ ] The text is built from fixed words and the stored times only, so nothing from a visitor or an editor is echoed back.
- [ ] No secrets, no `.env` change, no new package.

## Smoke test (local)

- [ ] With the dev data, `curl -s "http://localhost:8000/search?limit=5"` shows `hours_note` on every item, and it agrees with
  `is_open_now` ("Closes ..." when true, "Opens ..." when false; `null` for a 24-hour listing).
- [ ] Timing (NFR-02): 20 requests to `GET /search` on the dev data; write the median and the slowest next to the earlier numbers
  (median 25 ms, slowest 150 ms on the 28 seed listings): _not measured yet_.

## After the deploy (owner, production)

- [ ] `curl -s "https://swifthealth-api.onrender.com/search?limit=5"` shows `hours_note` on every item, and it agrees with
  `is_open_now`. (The demo listings may have no hours: then `null` is right.)
- [ ] `total` is still 4, and nothing else in the answer changed.

## Merge checklist

- [ ] `pytest -q -W error` and `ruff check .` are clean in the backend container.
- [ ] On the draft pull request `Backend CI` runs and is green, and `Frontend CI` does not run. Write what `gh pr checks` showed
  here: _not checked yet_.
- [ ] The api-spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date (including the English-only reminder).
- [ ] The pull request stays a draft until every box above is ticked.
