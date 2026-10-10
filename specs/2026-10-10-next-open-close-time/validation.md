# The next opening or closing time on search results: validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-06, US-01, FR-05 or NFR-02. Tick a box only after the test exists and passes.

## How to run

The commands run in the backend container:
- Tests: `docker compose exec backend pytest -q -W error`
- Lint: `docker compose exec backend ruff check .`

## Tests per task

### Task 1: `tests/unit/test_hours.py` (done, `2aac578`)
Plain `OpeningHours` objects and fixed Lagos moments; no database. 2026-10-05 is a Monday. The 43 new tests failed first (the
functions did not exist) and pass; the old hours tests are unchanged.

`next_change` (what happens next and when):
- [x] `test_next_change_open_now_closes_later_today`
- [x] `test_next_change_on_a_shift_past_midnight_closes_tomorrow` (20:00 to 02:00, at 23:00)
- [x] `test_next_change_after_midnight_on_a_late_shift_closes_today` (the same shift, at 01:00, from yesterday's row)
- [x] `test_next_change_closed_now_opens_later_today`
- [x] `test_next_change_after_closing_opens_tomorrow`
- [x] `test_next_change_skips_closed_days_and_finds_a_later_day`
- [x] `test_next_change_wraps_from_sunday_to_monday`
- [x] `test_next_change_at_the_opening_minute_is_closes_and_at_the_closing_minute_is_opens`
- [x] `test_next_change_is_none_for_a_24_hour_listing`
- [x] `test_next_change_is_none_without_hours` (no rows; only closed days; rows without times; a zero-length row)
- [x] `test_next_change_joins_shifts_that_meet_at_midnight` (a day to 00:00 then a day from 00:00 is one opening), and
  `test_next_change_joins_shifts_across_the_end_of_the_week` (Sunday to Monday)
- [x] `test_next_change_works_from_a_utc_moment_and_needs_a_time_zone`

The words (`hours_note`):
- [x] `test_hours_note_forms` (12 cases: the eight forms of the api-spec plus noon, a half hour and a closing just after midnight:
  "Closes 9:00 PM", "Closes 12:30 PM", "Closes 2:00 AM tomorrow", "Closes 12:30 AM tomorrow", "Closes 2:00 AM", "Closes at midnight",
  "Opens 7:30 AM", "Opens 12:00 PM", "Opens 7:30 AM tomorrow", "Opens Monday 7:30 AM", "Opens at midnight", "Opens Monday at midnight")
- [x] `test_hours_note_uses_full_day_names` (every weekday)
- [x] `test_hours_note_midnight_has_no_clock_time_and_no_12_00_am`
- [x] `test_hours_note_ignores_seconds`
- [x] `test_hours_note_is_none_for_24_hours_and_for_no_hours` (a weekly schedule repeats, so with at least one usable day there is
  always a change within 7 days; "nothing within 7 days" and "no hours" are the same case)

The two must agree:
- [x] `test_hours_note_agrees_with_is_open_at_for_every_minute_of_eight_days` (five weekly schedules: normal hours, a shift past
  midnight, weekdays only, shifts that meet at midnight, and a split week; for every minute: "Closes" exactly when `is_open_at` is
  true, the change is in the future, the state just before it is the current one and at it the other one). It takes about 15 seconds.

### Task 2: `tests/integration/test_search.py` and `tests/unit/test_search_service.py` (done, `e76e18e`)
The clock is fixed at Tuesday 10:00 in Lagos. They failed first (8 tests) and pass.
- [x] `test_search_returns_items_and_total_in_the_listing_summary_shape` and `test_the_summary_has_only_the_fields_in_the_api_spec`
  (the field lists gained `hours_note`)
- [x] `test_hours_note_closes_for_an_open_listing` ("Closes 9:00 PM")
- [x] `test_hours_note_opens_for_a_closed_listing` (the clock moved to 22:00: "Opens 8:00 AM tomorrow")
- [x] `test_hours_note_is_null_for_a_24_hour_listing_and_for_a_listing_without_hours`
- [x] `test_hours_note_follows_lagos_time_not_utc` (23:30 UTC on Tuesday is 00:30 on Wednesday in Lagos: "Closes 2:00 AM")
- [x] `test_hours_note_agrees_with_is_open_now_for_every_result`
- [x] `test_hours_note_is_given_to_every_item_of_a_later_page` (offset and limit)

## Review-focus edge cases

- [x] **Only the page.** The note is worked out in `to_summary`, after sorting and paging, not for every candidate.
- [x] **No change to what is found or sorted.** The existing search tests pass unchanged (only the two field lists grew).
- [x] **No database change.** No migration, no model change: `git diff --stat origin/main -- backend/alembic backend/app/models frontend`
  is empty (checked 2026-10-10).
- [x] **A time with minutes.** A listing that opens at 07:30 reads "7:30 AM" (`test_hours_note_forms`), and seconds are ignored.
- [x] **Words only.** Every part of the text is a fixed word or a number from the hours; no listing text (name, address) can end up in it
  (read `describe_next_change`).

## Security checklist

- [x] No new input: the endpoint takes the same parameters as before.
- [x] The text is built from fixed words and the stored times only, so nothing from a visitor or an editor is echoed back.
- [x] No secrets, no `.env` change, no new package (`git diff --name-only origin/main` shows no requirements or `.env` file).

## Smoke test (local)

- [x] With the dev data, `GET /search?limit=6` shows `hours_note` on every item, and it agrees with `is_open_now` (2026-10-10):
  "Demo Child Care Clinic" closed, "Opens Monday 9:00 AM"; "Demo Midnight Pharmacy" closed, "Opens 9:00 PM"; the four 24-hour
  demo listings `null`.
- [x] Timing (NFR-02), 30 requests from inside the backend container, on the 30 dev listings: with the change, medians of
  17, 24, 27 and 30 ms and slowest 36 to 207 ms over several runs; without it (the change temporarily stashed), medians of 38 and
  41 ms and slowest 110 and 120 ms. The machine is noisy (the first runs right after the test suite were slower: median 116 to
  132 ms); the change does not add a measurable cost. The earlier numbers were median 25 ms and slowest 150 ms.

## After the deploy (owner, production)

- [ ] `curl -s "https://swifthealth-api.onrender.com/search?limit=5"` shows `hours_note` on every item, and it agrees with
  `is_open_now`. (The demo listings may have no hours: then `null` is right.)
- [ ] `total` is still 4, and nothing else in the answer changed.

## Merge checklist

- [x] `pytest -q -W error` and `ruff check .` are clean in the backend container (685 passed, 642 before this feature; ruff "All
  checks passed", 2026-10-10, on `e76e18e`).
- [x] On the draft pull request `Backend CI` runs and is green, and `Frontend CI` does not run. What `gh pr checks 17` showed
  (2026-10-10, after `8c0b92d`): `backend` **pass** (1m27s, run 38079792119); the only workflow run on the branch is Backend CI
  (no Frontend CI run); Netlify `deploy-preview` pass. The PR is clean and mergeable.
- [x] The api-spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date (including the English-only reminder); the status
  lines are set to done after the merge.
- [ ] The pull request stays a draft until every box above is ticked.
