# GET /meta and no location in the logs (Phase 5B-0): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-03, FR-05, US-05 or NFR-07. Tick a box only after the test exists and
passes. The "After the merge" boxes are for the owner and stay open until the merge.

## How to run

- Backend tests: `docker compose exec backend pytest -q` (and `-W error`)
- Backend lint: `docker compose exec backend ruff check .`

Result at the end of the feature: 627 tests passed with `-W error`, `ruff check .` clean (517 before Task 2, 559 before
Task 2b, 489 before this feature).

## Tests per task

### Task 1: `tests/integration/test_meta.py` and `tests/unit/test_meta_service.py`
- [x] `test_meta_needs_no_login` (200 with no token)
- [x] `test_meta_has_exactly_the_five_lists` (`areas`, `categories`, `services`, `blood_groups`, `report_reasons`)
- [x] `test_meta_areas_are_the_fixed_list_in_order` (equal to `settings.areas`)
- [x] `test_meta_categories_come_from_the_database_sorted_by_id` (created in a non-alphabetical order)
- [x] `test_meta_category_has_only_slug_name_and_is_emergency` (no id, no `recheck_days`, no `parent_id`)
- [x] `test_meta_emergency_flag_is_kept`
- [x] `test_meta_with_no_categories_gives_an_empty_list` (the other four lists are still filled)
- [x] `test_meta_services_are_the_distinct_names_sorted_without_regard_to_case`
- [x] `test_meta_services_list_a_name_once_when_listings_share_it`
- [x] `test_meta_services_count_names_that_differ_only_in_capitals_once`
- [x] `test_meta_services_only_come_from_published_listings` (draft, pending review, hidden and recheck-due add none)
- [x] `test_meta_services_leave_out_the_blood_groups` (rows `A+`... `O-` are not services; `Blood bank` stays)
- [x] `test_meta_services_skip_blank_names`
- [x] `test_meta_services_are_empty_when_there_are_none` and `test_meta_services_use_a_fixed_number_of_queries`
- [x] `test_meta_blood_groups_are_the_eight_groups_in_the_api_spec_order`
- [x] `test_meta_report_reasons_match_the_api_spec_in_order`
- [x] `test_meta_is_tagged_public_in_docs`
- [x] `test_get_meta_builds_the_answer_from_the_repositories` (unit, in `test_meta_service.py`)
- [x] The unit tests of `choose_service_names`: sorted without regard to case, a name listed twice counts once, blood
  groups left out (also in other case and with spaces), a name that only looks like a blood group stays, blank names
  skipped and spaces trimmed, an empty input, the input is not changed.

### Task 2: `tests/unit/test_logging_filters.py` (NFR-07; 42 tests)
- [x] `test_lat_and_lng_values_are_replaced` (`/search?lat=6.45&lng=7.5` becomes `lat=redacted&lng=redacted`)
- [x] `test_other_parameters_are_kept` (`open_now`, `category`, `q` and their values survive)
- [x] `test_lat_and_lng_are_redacted_in_any_position` (first, middle, last, and alone)
- [x] `test_the_names_are_matched_without_regard_to_case` (`LAT`, `Lng`)
- [x] `test_percent_encoded_names_are_redacted` (`%6Cat`, `l%61t`, `lat%3D6.45`)
- [x] `test_repeated_parameters_are_all_redacted`
- [x] `test_empty_and_odd_values_are_redacted` (`lat=`, `lat=abc`, `lat=6.45%2C7.5`)
- [x] `test_similar_names_are_left_alone` (`latitude`, `plat`, `flat`, `lng2`, and a `q=lat=1` value)
- [x] `test_a_path_without_a_position_is_unchanged` and `test_a_parameter_without_a_value_is_unchanged`
- [x] `test_the_record_is_never_dropped` (the filter returns true)
- [x] `test_the_filter_rewrites_the_path_in_the_record`
- [x] `test_a_record_it_does_not_understand_is_passed_on_unchanged` and `test_a_record_with_no_text_at_all_is_passed_on`
- [x] `test_the_formatted_log_line_holds_no_position` (the full line, as uvicorn's own formatter prints it)
- [x] `test_the_filter_is_attached_to_uvicorn_access_after_the_app_is_imported`
- [x] `test_installing_twice_attaches_the_filter_once`
- [x] `test_a_real_uvicorn_request_writes_no_position_to_the_access_log` (a real server started inside the test)

### Task 2b: one rule for "the same service" (FR-05, US-05; decision 9)
`tests/unit/test_service_names.py`:
- [x] `test_the_rule_trims_joins_spaces_removes_hyphens_and_lowers_case` (`X-ray`, `x-ray`, ` X-ray `, `Xray`, `XRAY`,
  `X-RAY`... all become `xray`)
- [x] `test_spaces_are_joined_but_never_removed` (`Pap  Smear` becomes `pap smear`; tabs and new lines count as spaces)
- [x] `test_names_that_are_different_services_stay_different` (`X ray` against `Xray`, `Ultrasound` against `X-ray`, `A+`)
- [x] `test_the_rule_gives_the_same_answer_when_applied_twice`
- [x] `test_a_name_of_only_hyphens_and_spaces_becomes_empty`
- [x] `test_accented_capitals_are_lowered` (`CONSULTATION GÉNÉRALE`)

`tests/integration/test_service_names_sql.py` (the real database):
- [x] `test_the_sql_expression_gives_the_same_result_as_the_python_function` (36 strings, including empty, tabs, new
  lines, many spaces, hyphens at the ends and accented capitals)
- [x] `test_the_sql_expression_works_on_a_table_column`

`tests/integration/test_search_repository.py` and `test_search.py`:
- [x] `test_service_filter_finds_every_spelling_of_the_picked_service` (`X-ray` finds listings saved as `x-ray`,
  ` X-ray `, `Xray`, `X-RAY`)
- [x] `test_service_filter_with_a_typed_variant_finds_the_same_listings` (`xray`, `  x-RAY `)
- [x] `test_service_filter_still_misses_other_services` (`Ultrasound`, `X ray`)
- [x] `test_service_filter_with_only_hyphens_or_spaces_matches_nothing`
- [x] `test_service_filter_does_not_return_a_listing_twice` (a listing with three spellings of the same service)
- [x] `test_search_service_filter_finds_xray_through_the_route` (HTTP: `/search?service=X-ray`)

`tests/integration/test_meta.py`, `tests/unit/test_meta_service.py`:
- [x] `test_meta_merges_xray_and_x_ray` (4 sets of spellings: one entry)
- [x] `test_meta_shows_the_first_spelling_in_plain_order_for_a_merged_service` and
  `test_meta_keeps_services_that_differ_by_a_space_apart`
- [x] `test_names_that_differ_only_in_hyphens_count_once`, `test_the_first_spelling_in_plain_order_is_shown`,
  `test_the_label_has_one_space_between_words_and_none_at_the_ends`, `test_names_that_differ_by_a_space_stay_apart` and
  `test_an_all_capitals_spelling_wins_when_it_is_first_in_plain_order` (the quirk, written down on purpose)

No drift (`tests/integration/test_service_filter_matches_meta.py`):
- [x] `test_every_meta_choice_finds_exactly_the_listings_whose_service_it_stands_for` (against a hand-written table of
  spellings, so neither rule judges itself)
- [x] `test_nothing_outside_core_service_names_compares_service_names` (the old `lower(Service.name)` pattern is gone
  from `backend/app`, and both users import the shared module)

## Review-focus edge cases

- [x] **Layers.** The route has no query and no rule; `meta_service` calls `category_repository.list_all` and
  `service_repository.list_public_names`; the service-name rule is in `core/service_names.py` only.
- [x] **No new table, library or setting.** `git diff --stat origin/main` shows no model, migration, requirement or
  setting change (`BLOOD_GROUPS` is a constant next to the areas).
- [x] **Other places a position could be logged.** Nothing else in `backend/app` logs a request URL or the query
  parameters (`git grep -n "logging\|logger"` shows only the Termii logger, which masks the phone number, and the new filter).
- [x] **The filter never breaks logging.** It returns true on every path, including the one that catches an error.
- [x] **Services of unpublished listings** never appear in `/meta`.
- [x] **The `service` filter fix.** `X-ray` now finds `Xray` and ` x-ray `, which the old `lower(name) = lower(text)`
  missed (15 of the new tests failed before the change).

## Security checklist

- [x] Mutation checks on the privacy filter, then restored (`git status` clean): `lng` not redacted (17 tests failed),
  a case-sensitive name match (3), `latitude` redacted too (3), a filter that drops the record (9), and the filter not
  installed from `main.py` (1).
- [x] No secrets in the commits; no `.env` change; no new environment variable (nothing to add by hand in Render).
- [x] `/meta` returns no personal data and nothing that is not in the api-spec (five lists, categories with three fields).
- [x] The position is not in the access log: shown in the smoke test below.

## Smoke test

Done on the local stack on 2026-10-09 (PostgreSQL 18.6, the 28 published dev-seed listings).
- [x] `GET http://127.0.0.1:8000/meta` shows 10 areas, 12 categories (hospital, clinic, pharmacy, maternity, laboratory,
  then the emergency ones: the seed order), 11 services, 8 blood groups and 6 report reasons. `services` has no blood
  group and `Blood bank` is there.
- [x] `GET /docs` loads (200) and `/openapi.json` tags `GET /meta` as **Public**.
- [x] `GET /search?lat=6.4512&lng=7.5033&open_now=true` on the dev stack: the API log (`docker compose logs backend`)
  reads `GET /search?lat=redacted&lng=redacted&open_now=true HTTP/1.1" 200 OK`, and the answer still used the real position
  (`distance_km` 0.7 for the nearest place).
- [x] `GET /search?service=Xray&lat=6.4512&lng=7.5033` found 3 listings (the three that offer `X-ray` in the seed).
- [x] Timing: 20 requests to `GET /meta`: median 12 ms, slowest 31 ms.
- [x] `pytest -q -W error`: 627 passed, no warning. `ruff check .` clean.

## After the merge (owner)

Render deploys `main` by itself. No new variable is needed, so there is nothing to add by hand in the dashboard.
The free API sleeps when idle: the first page can take about a minute. Wait, then refresh. In these steps "the API" is
`https://swifthealth-api.onrender.com`. Do the three steps in this order.

**Step 1. Check that the deploy is live and `/meta` works.**
- [x] Open <https://dashboard.render.com>, click the service `swifthealth-api`, open **Events**. The newest deploy must
  say **Live**. If it says **Failed**, open **Logs** and tell the developer the last red line.
- [x] Open <https://swifthealth-api.onrender.com/meta> in your browser. You see a page of text with `areas` (ten names),
  `categories` (at least pharmacy, clinic and laboratory, added by the demo listings), `services` (the demo listings'
  services: Blood test, Consultation, Malaria test, Prescription filling, Ultrasound, X-ray), `blood_groups` (eight)
  and `report_reasons` (six).

**Step 2. Make a live search with a location.** This is the request whose log line you will look at in Step 3.
- [x] Open <https://swifthealth-api.onrender.com/docs>. Find the group named **Search** and click the row `GET /search`.
  Click **Try it out**.
- [x] In the `q` box type `DEMO`. In `lat` type `6.45` and in `lng` type `7.5`. Leave the other boxes empty. Click
  **Execute**.
- [x] Scroll down to **Server response**. The code must be `200`, and the listings in the body must have a
  `distance_km` number (this shows the position was really used).
- [x] Also try the service pick: clear `q`, type `Xray` in `service` and click **Execute**. You should see the demo
  listing that offers `X-ray` (the lab).

**Step 3. Check Render's Logs for `lat=redacted`.** This is the privacy check: the position must not be stored in our log.
- [x] In Render, on the service `swifthealth-api`, click **Logs** in the left menu. Wait a few seconds for the newest
  lines to appear (the log is not instant).
- [x] Find the line for your search. Type `search` in the log filter box, or scroll to the newest lines. It looks like
  `GET /search?q=DEMO&lat=redacted&lng=redacted HTTP/1.1" 200 OK`.
- [x] The words `lat=redacted&lng=redacted` must be there, and **`6.45` and `7.5` must not appear** anywhere in that line.
  If you see `lat=6.45`, tell the developer straight away and do not use the "near me" feature on the live site until it
  is fixed.
- Note (not a check): Render shows only our own service output on the free plan. If you ever upgrade to a Pro workspace, Render can also
  show its own "request logs" with the full address; before that upgrade the developer must check what they hold (a note
  is in `LOG.md`).

## Merge checklist

- [x] `pytest -q -W error` and `ruff check .` are clean (627 passed).
- [x] `backend.yml` is green on the pull request and `frontend.yml` does not run: no file under `frontend/` changed
  (see the result of `gh pr checks` in the pull request).
- [x] The api-spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date (the service rule, the `/meta` list, the
  controlled list of service names for phase 10b).
- [x] The "After the merge" steps above are done by the owner (2026-10-09; reported to Claude, who cannot see the
  Render dashboard): the deploy is Live, `/meta` shows the lists, a live search with lat 6.45 and lng 7.5 gave
  distances, `service=Xray` found the X-ray listing, and Render's Logs show `lat=redacted&lng=redacted` with no real
  numbers.
- [x] The pull request stayed a draft until the checks above were done, then it was merged (PR #10, merge commit
  `b79f280`).
