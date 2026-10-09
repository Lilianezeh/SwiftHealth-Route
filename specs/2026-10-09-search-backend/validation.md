# Search backend (Phase 5A): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves US-01, US-05, FR-04 to FR-06, FR-08, FR-22, NFR-02 or NFR-08. Tick a box
only after the test exists and passes.

## How to run

- Backend tests: `docker compose exec backend pytest -q`
- Warnings as errors: `docker compose exec backend pytest -q -W error`
- Backend lint: `docker compose exec backend ruff check .`
- Migration both ways: `docker compose exec backend alembic upgrade head`, then `alembic downgrade -1`, then
  `alembic upgrade head`.
- Seed: `docker compose exec backend python -m seed.seed`

## Tests per task

### Task 1: `tests/unit/test_hours.py`
All times below are `Africa/Lagos` unless the test says UTC. A Monday is `day_of_week` 0.
- [ ] `test_open_during_normal_hours` (08:00 to 21:00, checked at 10:00)
- [ ] `test_open_at_the_opening_minute_and_closed_at_the_closing_minute` (08:00 is open, 21:00 is closed)
- [ ] `test_closed_before_opening_and_after_closing`
- [ ] `test_past_midnight_shift_open_at_2300` (22:00 to 06:00)
- [ ] `test_past_midnight_shift_open_at_0300_through_yesterdays_row` (the same shift, 03:00 the next day)
- [ ] `test_past_midnight_shift_closed_after_it_ends` (20:00 to 02:00 is closed at 03:00)
- [ ] `test_sunday_night_shift_is_still_open_on_monday_morning` (the week wraps: Monday's "yesterday" is Sunday)
- [ ] `test_a_closed_day_does_not_open_the_next_morning` (yesterday `is_closed`, so 01:00 is closed)
- [ ] `test_is_closed_row_is_closed_all_day`
- [ ] `test_missing_day_row_is_closed` (not a 24-hour listing and no row for that day)
- [ ] `test_24_hour_listing_is_always_open` (checked at 00:00, 23:59 and 23:59:30, with no hours rows and with hours
  rows that end at 23:59)
- [ ] `test_uses_lagos_time_not_utc` (Monday 23:30 UTC is Tuesday 00:30 in Lagos: a Tuesday-only shift is open, a
  Monday-only shift is closed)
- [ ] `test_a_moment_in_another_time_zone_is_converted` (the same instant in UTC and in UTC+5 gives the same answer)
- [ ] `test_a_moment_without_a_time_zone_is_refused`

### Task 1b: `tests/unit/test_config.py` and `tests/unit/test_security.py` (FR-22, NFR-07)
- [ ] `test_production_refuses_a_missing_reporter_key_secret`
- [ ] `test_production_refuses_an_empty_reporter_key_secret`
- [ ] `test_production_refuses_the_default_reporter_key_secret`
- [ ] `test_production_refuses_a_reporter_key_secret_under_32_bytes` (31 bytes fails, 32 bytes passes)
- [ ] `test_the_reporter_key_error_never_contains_the_secret`
- [ ] `test_development_accepts_a_blank_reporter_key_secret` (falls back to the public development default)
- [ ] `test_either_secret_bad_is_refused_in_production` (a good `JWT_SECRET` does not excuse a bad
  `REPORTER_KEY_SECRET`, and the reverse), `test_one_error_names_every_bad_secret` and
  `test_the_two_secrets_may_not_be_the_same_value`
- [ ] `test_reporter_key_secret_is_read_from_the_environment`
- Existing config tests changed only to give production a good second secret (`production_settings` helper); their
  checks are the same.
- [ ] `test_reporter_key_is_a_64_character_hex_string`
- [ ] `test_same_value_gives_the_same_reporter_key` (so two reports can be matched)
- [ ] `test_different_values_give_different_reporter_keys`
- [ ] `test_reporter_key_depends_on_the_server_secret` (another secret gives another key)
- [ ] `test_reporter_key_does_not_depend_on_jwt_secret` (changing `jwt_secret` does not change the key: the reason for
  decision 6)
- [ ] `test_reporter_key_does_not_contain_the_phone_or_the_ip`
- [ ] `test_reporter_key_is_not_a_plain_hash` (it differs from `sha256(value)` and from `sha256("reporter:" + value)`)
- [ ] The existing `test_config.py` and `test_security.py` tests still pass unchanged.

### Task 2: `tests/unit/test_search_service.py` (async, test database)
The first three are the spike's three checks, rewritten with the new rule (overdue listings are labelled, not hidden).
- [ ] `test_late_shift_is_still_open_at_0130` (US-01)
- [ ] `test_late_shift_is_closed_at_0300` (US-01)
- [ ] `test_nearest_open_place_comes_first` (US-01, FR-06)
- [ ] `test_overdue_listing_is_returned_with_verification_due` (FR-08, NFR-08; `next_check_due` in the past, still
  `published`)
- [ ] `test_listing_within_its_check_cycle_has_verification_due_false`
- [ ] `test_listing_without_next_check_due_is_not_overdue`
- [ ] `test_distance_is_rounded_to_one_decimal_but_sorted_unrounded`
- [ ] `test_distance_in_km_known_pair_and_same_point`
- [ ] `test_without_location_distance_is_null_and_results_sort_by_name`
- [ ] `test_radius_excludes_listings_farther_away` and `test_radius_ignored_without_location`
- [ ] `test_open_now_filter_keeps_only_open_listings` and `test_open_24_hours_filter_uses_only_the_flag`
- [ ] `test_is_open_now_is_filled_on_every_result` (also when the `open_now` filter is off)
- [ ] `test_paging_total_counts_all_matches_before_limit_and_offset`
- [ ] `test_sponsored_is_always_false` (until phase 12c; a listing with `featured_until` in the future is not first)
- [ ] `test_primary_phone_is_the_primary_number_in_plus234_format`

### Task 2: `tests/integration/test_search_repository.py` (async, test database)
- [ ] `test_draft_pending_review_hidden_and_recheck_due_are_never_returned` (US-01, trust rule 1)
- [ ] `test_category_filter_uses_the_slug`
- [ ] `test_service_filter_finds_only_listings_that_offer_it` (US-05)
- [ ] `test_area_filter`
- [ ] `test_q_finds_a_misspelled_facility_name` (FR-04; realistic Enugu examples fixed in Task 2)
- [ ] `test_q_finds_a_misspelled_area`
- [ ] `test_q_finds_a_misspelled_service_name`
- [ ] `test_q_with_an_unrelated_word_finds_nothing`
- [ ] `test_q_matches_each_listing_once_even_when_two_services_match` (no duplicate rows from the join)
- [ ] `test_two_not_working_reports_from_different_reporters_in_7_days_exclude_the_listing` (FR-22)
- [ ] `test_one_report_does_not_exclude_the_listing`
- [ ] `test_two_reports_with_the_same_reporter_key_count_as_one`
- [ ] `test_reports_older_than_7_days_do_not_count` (6 days 23 hours counts, 7 days 1 hour does not)
- [ ] `test_other_report_reasons_do_not_count` (`wrong_number`, `closed`, `moved`, `wrong_hours`, `other`)
- [ ] `test_resolved_and_dismissed_reports_do_not_count` (decision 5)
- [ ] `test_reports_without_a_reporter_key_never_exclude_a_listing`
- [ ] `test_reports_for_one_listing_do_not_hide_another`
- [ ] The `pg_trgm` threshold and its examples are written in [requirements.md](requirements.md), "Threshold result".

### Task 3: `tests/integration/test_search.py` (async client)
- [ ] `test_search_needs_no_login` (200 with no token)
- [ ] `test_search_returns_items_and_total_in_the_listing_summary_shape` (every `ListingSummary` field in the
  [api-spec](../backend/api-spec.md), money-free, phone as `+234...`)
- [ ] `test_lat_without_lng_is_422` and `test_lng_without_lat_is_422`
- [ ] `test_radius_over_50_is_422`, `test_limit_over_100_is_422` and `test_negative_offset_is_422`
- [ ] `test_unknown_area_is_422` and `test_unknown_category_returns_an_empty_list`
- [ ] `test_open_now_uses_lagos_time` (the clock dependency is replaced with 23:30 UTC; Lagos is already the next day)
- [ ] `test_open_now_past_midnight_through_the_route` (01:30 open, 03:00 closed)
- [ ] `test_search_without_location_sorts_by_name_and_distance_is_null`
- [ ] `test_search_with_location_sorts_nearest_first`
- [ ] `test_overdue_listing_appears_with_verification_due_true` (FR-08)
- [ ] `test_flagged_listing_is_missing_from_the_results` (FR-22)
- [ ] `test_draft_listing_is_never_returned`
- [ ] `test_misspelled_q_finds_the_right_listing_and_an_unrelated_q_finds_nothing` (FR-04)
- [ ] `test_sponsored_is_false_on_every_item`

### Task 3b: `tests/unit/test_demo_listings.py` and `tests/integration/test_demo_listings.py`
- [ ] `test_every_demo_name_starts_with_demo_dash` (`DEMO – `)
- [ ] `test_demo_slugs_are_fixed_unique_and_start_with_demo` (compared with a literal list, so a changed slug fails)
- [ ] `test_demo_phones_are_fictional` (each is `+234` then a zero, and none equals a number in the main seed)
- [ ] `test_demo_data_has_no_user_or_password`
- [ ] `test_seed_creates_the_demo_listings_with_phones_hours_and_services`
- [ ] `test_seed_twice_creates_nothing_the_second_time` (same row counts)
- [ ] `test_seed_does_not_overwrite_a_changed_demo_listing`
- [ ] `test_seed_adds_a_missing_category_and_creates_no_user`
- [ ] `test_every_demo_category_is_in_the_real_category_list` (no demo-only category)
- [ ] `test_demo_listings_are_published_and_not_overdue`
- [ ] `test_demo_listings_are_found_by_search_and_by_a_misspelled_name` (the same check as "After the merge")
- [ ] `test_cleanup_deletes_exactly_the_demo_slugs_and_their_rows` (phones, hours, services, reports and audit entries
  go; counted per table)
- [ ] `test_cleanup_keeps_a_real_listing_whose_name_starts_with_demo_dash` (same prefix, different slug)
- [ ] `test_cleanup_keeps_the_main_seed_listings_and_all_categories_and_users`
- [ ] `test_cleanup_twice_is_safe_and_reports_zero_left`
- [ ] `test_cleanup_is_one_transaction` (if a delete fails, nothing is deleted)
- [ ] `test_main_does_nothing_without_the_flags` and `test_only_the_exact_value_true_turns_a_flag_on` (`True`, `1`,
  `yes`, `false`, empty)
- [ ] `test_when_both_flags_are_true_the_cleanup_runs_and_the_seed_does_not`
- [ ] `test_a_failure_is_logged_and_does_not_crash_the_start`

## Review-focus edge cases

- [ ] **UTC server.** Render runs in UTC. A moment of 23:30 UTC on Monday is 00:30 Tuesday in Lagos, and the answer
  follows Lagos. Nothing calls `datetime.now()` without a time zone.
- [ ] **Hours past midnight.** A 22:00 to 06:00 shift is open at 23:00 and at 03:00, closed at 07:00. The 03:00 case
  comes from yesterday's row, including Sunday to Monday.
- [ ] **24-hour listings.** `is_24_hours` listings are open at every minute, including 23:59:30 (the old 23:59 gap).
- [ ] **Overdue is a label, not a filter.** An overdue published listing is returned with `verification_due: true`.
  Nothing copied the spike's `overdue_for_recheck` exclusion.
- [ ] **No location.** The search works, `distance_km` is `null`, the sort is by name, and `radius_km` is ignored.
- [ ] **Misspellings.** A misspelled query finds the right listing; an unrelated word finds nothing.
- [ ] **Boundary times.** Exactly at `opens_at` is open; exactly at `closes_at` is closed.
- [ ] **Flag boundary.** Exactly 2 distinct reporters is excluded; 1 is not. The 7-day edge is tested both sides.
- [ ] **`sponsored`.** Always `false` in 5A; the sponsored slot is phase 12c.
- [ ] **Layers.** The route only reads the request, calls `search_listings` and returns the schema. SQL is only in
  `search_repository.py`. `hours.py` and `distance_in_km` are plain `def`; `search_listings` is `async def`.
- [ ] **No N+1 queries.** Phones, hours and category come with the listings in a small fixed number of queries, not
  one query per listing.
- [ ] **Money.** The search response has no money fields, so no `float` appears.

## Security checklist

- [ ] The route has no login, and the response has no field that is not in `ListingSummary`: no `status`, `owner_id`,
  `created_by`, `reporter_key`, `reporter_phone` or `featured_until`.
- [ ] All query values reach SQL as bound parameters (no f-strings in the repository); `q` with `'`, `%`, `_` and `;`
  returns normally and `%` and `_` act as plain characters.
- [ ] `q`, `service` and `category` have a length limit, so a very long string cannot slow the trigram match.
- [ ] `reporter_key` is never returned and never logged. No raw IP or phone is stored by this feature.
- [ ] `REPORTER_KEY_SECRET` is in `render.yaml` with `generateValue: true` and in `.env.example` as a blank. No real
  value is in any committed file, and `.env` is not edited (`git ls-files` shows no `.env`).
- [ ] `git grep -n "reporter_key_secret\|REPORTER_KEY_SECRET"` finds it only in `config.py`, `security.py`,
  `render.yaml`, `.env.example`, the tests and the specs. `search_*` and the routes never read it.
- [ ] Mutation checks on security code, then the code is restored (the rest of the feature is not security code, so it
  gets none):
  - `hash_reporter_key`: remove the `"reporter:"` prefix, use `jwt_secret` instead of `reporter_key_secret`, and
    return a plain `sha256`; each change must fail at least one test.
  - The startup check: remove the `reporter_key_secret` length check, and remove the default check; each must fail a
    test.
  - The FR-22 rule (it hides a listing from the public): change `>= 2` to `>= 3`, remove the 7-day limit, remove the
    `not_working` filter, and count rows instead of distinct keys; each must fail at least one test.

## Smoke test

- [ ] `alembic upgrade head` on the development database creates `pg_trgm` and the `reporter_key` column; `downgrade -1`
  removes them; `upgrade head` again works. The test database also works from an empty start.
- [ ] After `python -m seed.seed`: `GET /search?lat=6.45&lng=7.5` lists the demo listings nearest first, with
  `distance_km`, and `GET /search?open_now=true&lat=6.45&lng=7.5` lists only open ones.
- [ ] `GET /search?q=` with a misspelled demo name finds it. `GET /search?lat=6.45` gives 422.
- [ ] `GET /docs` shows `GET /search` with every query parameter and the `ListingSummary` response.
- [ ] Timing (NFR-02): 20 requests to `GET /search?lat=6.45&lng=7.5` on the seeded data. The slowest is under 1 second.
  Write the numbers (median and slowest) here: _not measured yet_.
- [ ] `docker compose exec backend pytest -q -W error` shows no warning.

## After the merge (owner)

Render runs `alembic upgrade head` when the container starts (`backend/Dockerfile`), so the migration runs on deploy.
The production database blocks outside connections and the free plan has no shell, so we do not look inside it. The
checks use the deploy and the live API only.

Do the four steps in this order. In these steps, "the API" is `https://swifthealth-api.onrender.com`. Render's
screens may look a little different from the words below. Look for the same names (Environment, Save and deploy, Logs).
The free API goes to sleep when nobody uses it: the first page you open can take about a minute. Wait, then refresh.

**Step 1. Confirm `REPORTER_KEY_SECRET` exists.** The API will not start without it. A new variable in `render.yaml`
may not appear by itself (this happened with `CORS_ORIGINS`).
- [ ] Open <https://dashboard.render.com> and sign in. Click the service `swifthealth-api`.
- [ ] In the left menu click **Environment**. Under **Environment Variables**, look for `REPORTER_KEY_SECRET`. It
  should be in the list with a hidden value (dots). Do not write the value down or paste it anywhere.
- [ ] If it is missing: click **+ Add Environment Variable**. Key: `REPORTER_KEY_SECRET`. For the value, open a terminal
  on your computer, run `openssl rand -base64 48`, copy the line it prints, and paste it as the Value. Do not reuse
  the value of `JWT_SECRET`: the API refuses to start if the two are the same. Click **Save and deploy**.

**Step 2. Confirm the deploy succeeded.** This also proves the database migration ran: it would fail, and the new
version would not start, if `pg_trgm` could not be created or `reporter_key` could not be added.
- [ ] On the service page, open **Events** (or **Logs**). The newest deploy must say **Live** (a green mark). If it
  says **Failed**, open **Logs** and read the last red lines:
  - `REPORTER_KEY_SECRET is missing` means Step 1 is not finished. Fix it there.
  - An error that mentions `pg_trgm` or `CREATE EXTENSION` means Render does not allow the extension. Render keeps
    the old version running. Stop and tell the developer: decision 1 in [requirements.md](requirements.md) must be redone.
- [ ] Open <https://swifthealth-api.onrender.com/health> in your browser. It must show `{"status":"ok"}`.

**Step 3. Add the demo listings, then switch the flag off again.** Nothing is opened to the internet: the code runs
inside the service when it starts (Task 3b, decision 13). Only the exact text `true` turns the flag on.
- [ ] In **Environment**, find `SEED_DEMO_LISTINGS` (it is `false`). Change its value to `true` and click
  **Save and deploy**. (Saving an environment variable normally starts a new deploy, say the Render docs.)
- [ ] Wait until the new deploy says **Live**. Open **Logs** and look for the line
  `Demo listings seeded: {'categories': ..., 'listings': 4}. Demo listings left: 4.` (If the demo listings were
  already there it says `'listings': 0` and still `left: 4`. That is fine: running it again adds nothing.)
- [ ] Change `SEED_DEMO_LISTINGS` back to `false` and click **Save and deploy** again. After the deploy, **Logs**
  show `Demo listings: no flag set, nothing to do.` Render's docs say the next Blueprint sync overwrites dashboard
  values that differ from `render.yaml`, so the flag may also switch itself back. That is safe.
- [ ] `REMOVE_DEMO_LISTINGS` is still `false`. You only turn it on at launch (roadmap, phase 14d).

**Step 4. Try a misspelled search on the live API.**
- [ ] Open <https://swifthealth-api.onrender.com/docs>. You see a page of blue and green boxes. Find the group named
  **Search** and click the row `GET /search`. Click **Try it out**.
- [ ] In the `q` box type `After Hours Pharmcy` (the word *Pharmacy* is spelled wrong on purpose). Leave the other
  boxes empty. Click **Execute**.
- [ ] Scroll down to **Server response**. The code must be `200`. In the body, `items` must contain one listing named
  `DEMO – After Hours Pharmacy`, and `"total": 1`.
- [ ] Now type `banana` in `q` and click **Execute** again. The body must be `{"items": [], "total": 0}`. This shows a
  wrong word finds nothing.
- [ ] Clear `q`, type `DEMO` and click **Execute**: `total` must be `4` (the four demo listings).
- [ ] Nothing else was opened: the database setting `ipAllowList` in `render.yaml` is still empty.

## Merge checklist

- [ ] `pytest -q` and `ruff check .` are clean, with no warnings.
- [ ] `backend.yml` is green on the pull request (it runs on `postgres:16`, so it proves the extension works in CI).
- [ ] The migration works up, down and up again.
- [ ] The spec ([api-spec.md](../backend/api-spec.md), [prd.md](../prd.md) if it lists columns), the
  [roadmap](../roadmap.md) and `LOG.md` are up to date, and [requirements.md](requirements.md) has the threshold
  result.
- [ ] The `LOG.md` reminders exist: the "thousands of listings" note, phase 9a (call `hash_reporter_key` when a report is created)
  and phase 11a (clear `reporter_key` on resolve).
- [ ] The pull request stays a draft until every box above is ticked.
