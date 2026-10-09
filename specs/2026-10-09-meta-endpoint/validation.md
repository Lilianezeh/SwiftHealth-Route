# GET /meta and no location in the logs (Phase 5B-0): validation

How we know the feature is really done. What we build is in [requirements.md](requirements.md); the tasks are in
[plan.md](plan.md). Every test below proves FR-03, FR-05 or NFR-07. Tick a box only after the test exists and passes.

## How to run

- Backend tests: `docker compose exec backend pytest -q` (and `-W error`)
- Backend lint: `docker compose exec backend ruff check .`

## Tests per task

### Task 1: `tests/integration/test_meta.py` and `tests/unit/test_meta_service.py`
- [ ] `test_meta_needs_no_login` (200 with no token)
- [ ] `test_meta_has_exactly_the_five_lists` (`areas`, `categories`, `services`, `blood_groups`, `report_reasons`)
- [ ] `test_meta_areas_are_the_fixed_list_in_order` (equal to `settings.areas`)
- [ ] `test_meta_categories_come_from_the_database_sorted_by_id` (created in a non-alphabetical order)
- [ ] `test_meta_category_has_only_slug_name_and_is_emergency` (no id, no `recheck_days`, no `parent_id`)
- [ ] `test_meta_emergency_flag_is_kept`
- [ ] `test_meta_with_no_categories_gives_an_empty_list` (the other three lists are still full)
- [ ] `test_meta_services_are_the_distinct_names_sorted_without_regard_to_case` (`X-ray`, `Consultation`, `malaria test`...)
- [ ] `test_meta_services_list_a_name_once_when_listings_share_it`
- [ ] `test_meta_services_count_names_that_differ_only_in_capitals_once` (the alphabetically first spelling is kept)
- [ ] `test_meta_services_only_come_from_published_listings` (draft, pending review, hidden and recheck-due listings add none)
- [ ] `test_meta_services_leave_out_the_blood_groups` (rows `A+`... `O-` are not services; `Blood bank` stays)
- [ ] `test_meta_services_skip_blank_names`
- [ ] `test_meta_services_are_empty_when_there_are_none` and `test_meta_services_use_a_fixed_number_of_queries` (not one per listing)
- [ ] `test_meta_blood_groups_are_the_eight_groups_in_the_api_spec_order`
- [ ] `test_meta_report_reasons_match_the_api_spec_in_order`
- [ ] `test_meta_is_tagged_public_in_docs`
- [ ] `test_get_meta_service_builds_the_answer_from_the_repository` (unit, in `test_meta_service.py`)

### Task 2: `tests/unit/test_logging_filters.py` (NFR-07)
- [ ] `test_lat_and_lng_values_are_replaced` (`/search?lat=6.45&lng=7.5` becomes `lat=redacted&lng=redacted`)
- [ ] `test_other_parameters_are_kept` (`open_now`, `category`, `q` and their values survive)
- [ ] `test_lat_and_lng_are_redacted_in_any_position` (first, middle, last, and alone)
- [ ] `test_the_names_are_matched_without_regard_to_case` (`LAT`, `Lng`)
- [ ] `test_percent_encoded_names_are_redacted` (`%6Cat=6.45`)
- [ ] `test_repeated_parameters_are_all_redacted`
- [ ] `test_empty_and_odd_values_are_redacted` (`lat=`, `lat=abc`, `lat=6.45%2C7.5`)
- [ ] `test_similar_names_are_left_alone` (`latitude`, `plat`, `flat`, `lng2`, and a `q=lat=1` value)
- [ ] `test_a_path_without_a_query_is_unchanged`
- [ ] `test_the_record_is_never_dropped` (the filter returns true)
- [ ] `test_a_record_it_does_not_understand_is_passed_on_unchanged` (other arguments, no arguments, not a string)
- [ ] `test_the_formatted_log_line_holds_no_position` (the full line, as uvicorn prints it)
- [ ] `test_the_filter_is_attached_to_uvicorn_access_after_the_app_is_imported`
- [ ] `test_installing_twice_attaches_the_filter_once`

## Review-focus edge cases

- [ ] **Layers.** The route has no query and no rule; `meta_service` is the only caller of `list_all`.
- [ ] **No new table, library or setting.** `git diff --stat` shows none.
- [ ] **Other places a position could be logged.** Nothing else in `backend/app` logs a request URL or the query
  parameters (`git grep -n "logging\|logger"` shows only the Termii logger, which masks the phone number).
- [ ] **The filter never breaks logging.** A broken filter must not stop the API from writing logs or answering.

## Security checklist

- [ ] Mutation checks on the filter, then restored (`git status` clean): `lng` not redacted, a case-sensitive match, a
  filter that drops the record, `latitude` redacted too; each fails at least one test.
- [ ] No secrets in the commits; no `.env` change; no new environment variable (nothing to add by hand in Render).
- [ ] `/meta` returns no personal data and nothing that is not in the api-spec.

## Smoke test

- [ ] `GET http://127.0.0.1:8000/meta` shows the five lists; the categories match the seed order; `services` has no
  `A+`, `O-` or other blood group, and `Blood bank` is there.
- [ ] `GET /docs` shows `GET /meta` under **Public**.
- [ ] A request to `GET /search?lat=6.4512&lng=7.5033&open_now=true` on the dev stack: the API log line (docker compose
  logs backend) reads `lat=redacted&lng=redacted&open_now=true`, and the answer to the caller still uses the real
  position (distances are present).
- [ ] `pytest -q -W error` and `ruff check .` are clean.

## After the merge (owner)

Render deploys `main` by itself. No new variable is needed, so there is nothing to add by hand in the dashboard.
The free API sleeps when idle: the first page can take about a minute.
- [ ] Open <https://swifthealth-api.onrender.com/meta> in your browser. You see a page of text with `areas`
  (ten names), `categories` (the categories that exist in production: at least pharmacy, clinic and laboratory, added
  by the demo listings), `services` (the demo listings' services: Blood test, Consultation, Malaria test, Prescription
  filling, Ultrasound, X-ray), `blood_groups` (eight) and `report_reasons` (six).
- [ ] Open <https://swifthealth-api.onrender.com/docs>, group **Search**, `GET /search`, **Try it out**. Type `DEMO`
  in `q`, and type `6.45` in `lat` and `7.5` in `lng`. Click **Execute**. The answer has `distance_km` values.
- [ ] In Render, open the service `swifthealth-api`, then **Logs**. Find the line for that request. It must read
  `GET /search?q=DEMO&lat=redacted&lng=redacted ...`. If you see `lat=6.45`, tell the developer: do not use the
  location feature on the live site until it is fixed.

## Merge checklist

- [ ] `pytest -q -W error` and `ruff check .` are clean.
- [ ] `backend.yml` is green on the pull request; `frontend.yml` does not run (no file under `frontend/` changed).
- [ ] The api-spec, the [roadmap](../roadmap.md) and `LOG.md` are up to date.
- [ ] The pull request stays a draft until every box above is ticked.
