# Search backend (Phase 5A): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves US-01, US-05, FR-04 to FR-06, FR-08, FR-22, NFR-02, NFR-07 or NFR-08.
Tick a box only after the test exists and passes. The "After the merge" boxes are for the owner and stay open until
the merge.

## How to run

- Backend tests: `docker compose exec backend pytest -q`
- Warnings as errors: `docker compose exec backend pytest -q -W error`
- Backend lint: `docker compose exec backend ruff check .`
- Migration both ways: `docker compose exec backend alembic upgrade head`, then `alembic downgrade -1`, then
  `alembic upgrade head`.
- Seed: `docker compose exec backend python -m seed.seed`

Result at the end of the feature: 485 tests passed with `-W error`, `ruff check .` clean (242 tests before the feature).

## Tests per task

### Task 1: `tests/unit/test_hours.py` (21 tests)
All times below are `Africa/Lagos` unless the test says UTC. A Monday is `day_of_week` 0.
- [x] `test_open_during_normal_hours` (08:00 to 21:00, checked at 10:00)
- [x] `test_open_at_the_opening_minute_and_closed_at_the_closing_minute` (08:00 is open, 21:00 is closed)
- [x] `test_closed_before_opening_and_after_closing`
- [x] `test_past_midnight_shift_open_at_2300` (22:00 to 06:00)
- [x] `test_past_midnight_shift_open_at_0300_through_yesterdays_row` (the same shift, 03:00 the next day)
- [x] `test_past_midnight_shift_closed_after_it_ends` (20:00 to 02:00 is closed at 03:00)
- [x] `test_sunday_night_shift_is_still_open_on_monday_morning` (the week wraps: Monday's "yesterday" is Sunday)
- [x] `test_a_closed_day_does_not_open_the_next_morning`
- [x] `test_a_shift_that_started_on_a_day_marked_closed_does_not_carry_over`
- [x] `test_is_closed_row_is_closed_all_day`
- [x] `test_missing_day_row_is_closed` and `test_a_row_without_times_is_closed`
- [x] `test_hours_with_the_same_opening_and_closing_time_are_closed`
- [x] `test_24_hour_listing_is_always_open` (4 cases: 00:00, 12:00, 23:59, 23:59:30; with no rows and with rows that
  end at 23:59)
- [x] `test_a_listing_with_hours_to_23_59_but_no_24_hour_flag_closes_at_23_59`
- [x] `test_uses_lagos_time_not_utc` (Monday 23:30 UTC is Tuesday 00:30 in Lagos)
- [x] `test_a_moment_in_another_time_zone_is_converted`
- [x] `test_a_moment_without_a_time_zone_is_refused`

### Task 1b: `tests/unit/test_config.py` and `tests/unit/test_security.py` (FR-22, NFR-07; 21 new tests)
- [x] `test_production_refuses_a_missing_reporter_key_secret`
- [x] `test_production_refuses_an_empty_reporter_key_secret`
- [x] `test_production_refuses_the_default_reporter_key_secret`
- [x] `test_production_refuses_a_reporter_key_secret_under_32_bytes` (31 bytes fails, 32 bytes passes)
- [x] `test_the_reporter_key_error_never_contains_the_secret`
- [x] `test_development_accepts_a_blank_reporter_key_secret` (falls back to the public development default)
- [x] `test_either_secret_bad_is_refused_in_production`, `test_one_error_names_every_bad_secret` and
  `test_the_two_secrets_may_not_be_the_same_value`
- [x] `test_reporter_key_secret_is_read_from_the_environment`
- [x] `test_reporter_key_is_a_64_character_hex_string`
- [x] `test_same_value_gives_the_same_reporter_key` and `test_different_values_give_different_reporter_keys`
- [x] `test_reporter_key_depends_on_the_reporter_key_secret`
- [x] `test_reporter_key_does_not_depend_on_jwt_secret` (the reason for decision 6)
- [x] `test_reporter_key_does_not_contain_the_phone_or_the_ip`
- [x] `test_reporter_key_is_not_a_plain_hash` (it differs from `sha256(value)` and from `sha256("reporter:" + value)`)
- [x] `test_reporter_key_uses_the_reporter_label_and_the_reporter_secret`
- [x] `test_reporter_key_differs_from_a_login_code_hash_of_the_same_text`
- Existing config tests changed only to give production a good second secret (`production_settings` helper); their
  checks are the same. All other existing tests pass.

### Task 1c: PostgreSQL 18 (no new tests)
- [x] The 242 existing tests passed on PostgreSQL 18.6 after the local volume was recreated, and again in CI on the
  `postgres:18` service (the log shows `docker pull postgres:18`).

### Task 2: `tests/unit/test_search_service.py` (async, test database)
The first three are the spike's three checks, rewritten with the new rule (overdue listings are labelled, not hidden).
- [x] `test_late_shift_is_still_open_at_0130` (US-01)
- [x] `test_late_shift_is_closed_at_0300` (US-01)
- [x] `test_nearest_open_place_comes_first` (US-01, FR-06)
- [x] `test_overdue_listing_is_returned_with_verification_due` (FR-08, NFR-08)
- [x] `test_listing_within_its_check_cycle_has_verification_due_false`
- [x] `test_listing_without_next_check_due_is_not_overdue`
- [x] `test_distance_is_rounded_to_one_decimal_but_sorted_unrounded`
- [x] `test_distance_in_km_known_pair_and_same_point`
- [x] `test_without_location_distance_is_null_and_results_sort_by_name`
- [x] `test_radius_excludes_listings_farther_away` and `test_radius_ignored_without_location`
- [x] `test_open_now_filter_keeps_only_open_listings` and `test_open_24_hours_filter_uses_only_the_flag`
- [x] `test_is_open_now_is_filled_on_every_result`
- [x] `test_open_now_follows_lagos_time_when_the_server_clock_is_utc`
- [x] `test_paging_total_counts_all_matches_before_limit_and_offset`
- [x] `test_sponsored_is_always_false` (until phase 12c)
- [x] `test_primary_phone_is_the_primary_number_in_plus234_format`
- [x] `test_the_summary_has_only_the_fields_in_the_api_spec`

### Task 2: `tests/integration/test_search_repository.py` (async, test database)
- [x] `test_draft_pending_review_hidden_and_recheck_due_are_never_returned` (US-01, trust rule 1)
- [x] `test_category_filter_uses_the_slug`
- [x] `test_service_filter_finds_only_listings_that_offer_it` (US-05)
- [x] `test_area_filter` and `test_is_24_hours_filter_uses_the_flag`
- [x] `test_q_finds_a_misspelled_facility_name`, `test_q_finds_a_misspelled_area` and
  `test_q_finds_a_misspelled_service_name` (FR-04; Enugu examples)
- [x] `test_q_with_an_unrelated_word_finds_nothing` and `test_a_misspelling_does_not_pull_in_a_different_place`
- [x] `test_q_matches_each_listing_once_even_when_two_services_match` (no duplicate rows from the join)
- [x] `test_q_filters_together_with_the_other_filters` and `test_q_with_odd_characters_returns_normally`
- [x] `test_two_not_working_reports_from_different_reporters_in_7_days_exclude_the_listing` (FR-22)
- [x] `test_one_report_does_not_exclude_the_listing`
- [x] `test_two_reports_with_the_same_reporter_key_count_as_one` and
  `test_three_reports_from_two_reporters_exclude_the_listing`
- [x] `test_reports_older_than_7_days_do_not_count` and `test_two_reports_both_just_inside_7_days_exclude_the_listing`
- [x] `test_other_report_reasons_do_not_count`
- [x] `test_resolved_and_dismissed_reports_do_not_count` (decision 5)
- [x] `test_reports_without_a_reporter_key_never_exclude_a_listing` and
  `test_reports_for_one_listing_do_not_hide_another`
- [x] The `pg_trgm` threshold and its examples are in [requirements.md](requirements.md), "Threshold result".

### Task 3c: two typos (added after Task 3b; the word rule, decision 2)
- [x] `test_q_finds_a_name_with_two_typos` (10 queries, "Nigt Pharmcy" among them), in `test_search_repository.py`
- [x] `test_q_words_may_match_the_name_the_area_and_the_services` (7 queries such as "pharmcy ogui")
- [x] `test_the_word_rule_needs_every_word_to_match` and `test_the_word_rule_is_not_used_for_a_query_with_too_many_words`
- [x] Guards: `test_q_with_several_unrelated_words_finds_nothing` (19 queries) and
  `test_look_alike_words_do_not_match_more_than_before`
- [x] `test_split_query_words` (8 cases) and `test_two_typos_in_a_two_word_query_still_find_the_listing`, in
  `test_search_service.py`
- [x] The options (a lower threshold, each word alone, both rules together) were compared with real scores and are in
  [requirements.md](requirements.md), "Two typos: the options compared".

### Task 3: `tests/integration/test_search.py` (async client)
- [x] `test_search_needs_no_login` (200 with no token)
- [x] `test_search_returns_items_and_total_in_the_listing_summary_shape` (every `ListingSummary` field in the
  [api-spec](../backend/api-spec.md), phone as `+234...`)
- [x] `test_lat_without_lng_or_lng_without_lat_is_422` (2 cases)
- [x] `test_values_outside_the_spec_are_422` (12 cases: radius, limit, offset, lat, lng, long `q`, `category`,
  `service`, a bad boolean) and `test_the_largest_allowed_values_are_accepted`
- [x] `test_unknown_area_is_422_and_a_listed_area_works` and `test_unknown_category_and_service_return_an_empty_list`
- [x] `test_category_and_service_filters` and `test_open_24_hours_filter`
- [x] `test_open_now_uses_lagos_time` (the clock is replaced with 23:30 UTC; Lagos is already the next day)
- [x] `test_open_now_past_midnight_through_the_route` (01:30 open, 03:00 closed)
- [x] `test_search_without_location_sorts_by_name_and_distance_is_null`
- [x] `test_search_with_location_sorts_nearest_first` and `test_radius_km_limits_the_distance`
- [x] `test_limit_and_offset_page_the_results_and_total_stays`
- [x] `test_overdue_listing_appears_with_verification_due_true` (FR-08)
- [x] `test_flagged_listing_is_missing_from_the_results` (FR-22)
- [x] `test_a_listing_that_is_not_published_is_never_returned` (4 statuses)
- [x] `test_misspelled_q_finds_the_right_listing_and_an_unrelated_q_finds_nothing` (FR-04)
- [x] `test_a_blank_q_is_the_same_as_no_q` and `test_q_with_odd_characters_returns_200_and_keeps_the_data`
- [x] `test_sponsored_is_false_on_every_item`
- [x] `test_the_response_never_shows_internal_fields` and `test_the_real_clock_is_used_when_nothing_replaces_it`

### Task 3b: `tests/unit/test_demo_listings.py` and `tests/integration/test_demo_listings.py` (44 tests)
- [x] `test_every_demo_name_starts_with_demo_dash` (`DEMO – `)
- [x] `test_demo_slugs_are_fixed_unique_and_start_with_demo` (compared with a literal list, so a changed slug fails)
- [x] `test_demo_slugs_do_not_clash_with_the_main_seed` (found a real clash in the first draft)
- [x] `test_demo_phones_are_fictional` (each is `+234` then a zero, and none equals a number in the main seed)
- [x] `test_demo_data_has_no_user_or_password`
- [x] `test_every_demo_category_is_in_the_real_category_list` (no demo-only category)
- [x] `test_demo_listings_are_published_and_verified` and `test_demo_listings_cover_a_pharmacy_open_late_and_a_24_hour_one`
- [x] `test_seed_creates_the_demo_listings_with_phones_hours_and_services`
- [x] `test_seed_twice_creates_nothing_the_second_time` (same row counts)
- [x] `test_seed_does_not_overwrite_a_changed_demo_listing`
- [x] `test_seed_adds_a_missing_category_and_creates_no_user` and `test_seed_does_not_add_a_category_that_already_exists`
- [x] `test_demo_listings_are_published_and_not_overdue`, `test_seed_with_a_recent_now_marks_listings_verified_three_days_ago`
  and `test_every_demo_listing_has_one_audit_entry_without_a_user`
- [x] `test_demo_listings_are_found_by_search_and_by_a_misspelled_name` (the same check as "After the merge")
- [x] `test_cleanup_deletes_exactly_the_demo_slugs_and_their_rows` (counted per table)
- [x] `test_cleanup_keeps_a_real_listing_whose_name_starts_with_demo_dash` (same prefix, different slug)
- [x] `test_cleanup_keeps_other_listings_and_all_categories_and_users`
- [x] `test_cleanup_twice_is_safe_and_reports_zero_left` and `test_cleanup_on_an_empty_database_does_nothing`
- [x] `test_cleanup_is_one_transaction` (if the commit fails, nothing is deleted)
- [x] `test_nothing_is_done_without_the_flags`, `test_main_with_no_flags_does_not_even_open_the_database`,
  `test_only_the_exact_value_true_turns_a_flag_on` (10 cases), `test_true_turns_a_flag_on_and_no_value_means_off`,
  `test_any_value_other_than_true_does_nothing` and `test_the_flag_names_are_the_ones_in_the_spec`
- [x] `test_the_seed_flag_seeds_and_the_remove_flag_removes` and
  `test_when_both_flags_are_true_the_cleanup_runs_and_the_seed_does_not`
- [x] `test_a_failure_is_logged_and_does_not_crash_the_start`

### Router tags: `tests/unit/test_openapi_tags.py` (2 tests, written after the change, accepted by the owner)
- [x] `test_every_tag_starts_with_a_capital_letter` and
  `test_the_search_route_is_tagged_search_and_health_is_tagged_health`

## Review-focus edge cases

- [x] **UTC server.** Render runs in UTC. A moment of 23:30 UTC on Monday is 00:30 Tuesday in Lagos, and the answer
  follows Lagos (tested in `test_hours.py`, the service and the route). The only clock read is in
  `get_current_moment`, with a time zone.
- [x] **Hours past midnight.** A 22:00 to 06:00 shift is open at 23:00 and at 03:00. The 03:00 case comes from
  yesterday's row, including Sunday to Monday.
- [x] **24-hour listings.** `is_24_hours` listings are open at every minute, including 23:59:30 (the old 23:59 gap).
- [x] **Overdue is a label, not a filter.** An overdue published listing is returned with `verification_due: true`
  (also in the local smoke test: "Demo Day Pharmacy"). Nothing copied the spike's exclusion.
- [x] **No location.** The search works, `distance_km` is `null`, the sort is by name, and `radius_km` is ignored.
- [x] **Misspellings.** A misspelled query finds the right listing; an unrelated word finds nothing. Two typos work
  except in very short words (3 to 5 letters), a limit recorded in the requirements.
- [x] **Boundary times.** Exactly at `opens_at` is open; exactly at `closes_at` is closed.
- [x] **Flag boundary.** Exactly 2 distinct reporters is excluded; 1 is not. The 7-day edge is tested both sides.
- [x] **`sponsored`.** Always `false` in 5A; the sponsored slot is phase 12c.
- [x] **Layers.** The route only reads the request, calls `search_listings` and returns the schema. SQL is only in
  `search_repository.py` (and `listing_repository.py` for the demo cleanup). `hours.py`, `distance_in_km` and
  `split_query_words` are plain `def`; `search_listings` is `async def`.
- [x] **No N+1 queries.** One query for listings with their category, one for the primary phones and one for the
  hours, however many listings match.
- [x] **Money.** The search response has no money fields, so no `float` appears.
- [x] **Demo cleanup.** It deletes by the fixed slugs only (a "DEMO – " lookalike with another slug survives), in one
  transaction.

## Security checklist

- [x] The route has no login, and the response has no field that is not in `ListingSummary`: no `status`, `owner_id`,
  `created_by`, `reporter_key`, `reporter_phone` or `featured_until`
  (`test_the_response_never_shows_internal_fields`).
- [x] All query values reach SQL as bound parameters (SQLAlchemy expressions, no f-strings in the repositories);
  `q` with `'`, `%`, `_`, `;`, a backslash and non-ASCII letters returns normally and the table is intact.
- [x] `q`, `service` and `category` are limited to 100 characters (422 above), and the word rule to 6 words.
- [x] `reporter_key` is never returned and never logged. No raw IP or phone is stored by this feature.
- [x] `REPORTER_KEY_SECRET` is in `render.yaml` with `generateValue: true` and in `.env.example` as a blank. No real
  value is in any committed file, and `.env` is not tracked (`git ls-files` finds no `.env`).
- [x] `git grep -i reporter_key_secret` (outside the specs and LOG) finds it only in `config.py`, `security.py`,
  `render.yaml`, `.env.example` and the tests. `search_*` and the routes never read it.
- [x] Mutation checks on security code, each restored afterwards (`git status` clean):
  - `hash_reporter_key`: the `"reporter:"` prefix removed (2 tests failed), `jwt_secret` as the key (3 failed), a plain
    `sha256` (4 failed).
  - The startup check: the length check removed (5 failed), the default check removed (4 failed), the same-value check
    removed (1 failed).
  - The FR-22 rule: `2` changed to `3` (3 failed), the 7-day limit removed (1 failed), the `not_working` filter removed
    (5 failed), distinct keys changed to rows (1 failed).
  - The demo cleanup by name prefix instead of slug (1 failed). The rest of the feature is not security code.

## Smoke test

Done on the local stack on 2026-10-09 (PostgreSQL 18.6, the 28 published dev-seed listings).
- [x] `alembic downgrade -1` and `alembic upgrade head` ran without error; afterwards `pg_trgm` and
  `user_reports.reporter_key` exist and `alembic check` says "No new upgrade operations detected". The test database
  was dropped and rebuilt from empty by the next test run (104 tests passed).
- [x] `GET /search?lat=6.45&lng=7.5` lists the listings nearest first with `distance_km` (first: Demo Police
  Division 0.7 km). `open_now=true` returned 25 listings, all with `is_open_now` true.
- [x] `q=Demo Genral Hospitl` finds Demo General Hospital, `q=Nigt Pharmcy` finds Demo Night Pharmacy, and
  `GET /search?lat=6.45` gives 422.
- [x] `GET /docs` loads (200) and `/openapi.json` shows `GET /search` tagged `Search` with 11 query parameters and the
  `SearchResponse` of `ListingSummary` items.
- [x] Timing (NFR-02), 20 requests to `GET /search?lat=6.45&lng=7.5` on the seed data: **median 25 ms, slowest
  150 ms** (limit: 1 second). After the word rule: `q=pharmcy` median 16 ms, `q=Nigt Pharmcy` median 20 ms
  (slowest 28 ms), a four-word typo query with a location median 26 ms (slowest 45 ms), `q=airline ticket`
  median 19 ms. This is the small pilot data set on a laptop; the free Render service will be slower, and
  the first request after a sleep takes about a minute.
- [x] `docker compose exec backend pytest -q -W error`: 485 passed, no warning.

## After the merge (owner)

Render runs `alembic upgrade head` when the container starts (`backend/Dockerfile`), so the migration runs on deploy.
The production database blocks outside connections and the free plan has no shell, so we do not look inside it. The
checks use the deploy and the live API only.

Do the four steps in this order. In these steps, "the API" is `https://swifthealth-api.onrender.com`. Render's
screens may look a little different from the words below. Look for the same names (Environment, Save and deploy, Logs).
The free API goes to sleep when nobody uses it: the first page you open can take about a minute. Wait, then refresh.

**Step 1. Confirm `REPORTER_KEY_SECRET` exists.** The API will not start without it. A new variable in `render.yaml`
may not appear by itself (this happened with `CORS_ORIGINS`). Do this step **before** you merge if you can: adding the
variable first means the first deploy after the merge already has it. If a deploy fails for lack of it, Render keeps
the old version running, so the site stays up; add the variable and deploy again.
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
- [ ] In the `q` box type `Aftr Hours Pharmcy` (two words are spelled wrong on purpose). Leave the other boxes empty.
  Click **Execute**.
- [ ] Scroll down to **Server response**. The code must be `200`. In the body, `items` must contain one listing named
  `DEMO – After Hours Pharmacy`, and `"total": 1`.
- [ ] Now type `banana` in `q` and click **Execute** again. The body must be `{"items": [], "total": 0}`. This shows a
  wrong word finds nothing.
- [ ] Clear `q`, type `DEMO` and click **Execute**: `total` must be `4` (the four demo listings).
- [ ] Nothing else was opened: the database setting `ipAllowList` in `render.yaml` is still empty.

## Merge checklist

- [x] `pytest -q -W error` and `ruff check .` are clean (485 passed).
- [x] `backend.yml` is green on the pull request, on `postgres:18` (run 37919799371 on `92a95c0`; the run for the
  last commits is checked before the merge).
- [x] The migration works up, down and up again.
- [x] The spec ([api-spec.md](../backend/api-spec.md), [prd.md](../prd.md)), the [roadmap](../roadmap.md),
  [tech-stack.md](../tech-stack.md) and `LOG.md` are up to date, and [requirements.md](requirements.md) has the
  threshold result and the two-typo comparison.
- [x] The `LOG.md` reminders exist: the "thousands of listings" note, phase 9a (call `hash_reporter_key` when a report
  is created), phase 11a (clear `reporter_key` on resolve), the Render collation check and the phase 5B note.
- [ ] The "After the merge" steps above are done by the owner.
- [ ] The pull request stays a draft until every box above is ticked.
