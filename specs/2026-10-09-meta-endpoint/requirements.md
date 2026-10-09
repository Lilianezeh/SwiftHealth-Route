# GET /meta and no location in the logs (Phase 5B-0): requirements

What this small backend feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we
know it is done is in [validation.md](validation.md). It exists so the next feature, the
[search frontend](../2026-10-09-search-frontend/requirements.md), can be frontend-only.

## Requirements

- **FR-03:** the visitor can pick an area from a list when location permission is refused. The list comes from `GET /meta`.
- **FR-05:** the search filters (category, service, open now, open 24 hours, distance) need the category list and the
  list of services to pick from. **US-05:** search by service.
- **NFR-07:** collect as little personal data as possible. A visitor's position is sent to `GET /search` as `lat` and
  `lng`; our server logs must not keep it ([mission](../mission.md), "Collect as little personal data as possible").

Source of truth: [prd.md](../prd.md), [api-spec.md](../backend/api-spec.md) (`GET /meta`). Branch:
`feature/meta-endpoint`. Every commit and test references these IDs. This is roadmap [phase 5B-0](../roadmap.md).

Fit with the project: [mission.md](../mission.md) says a resident finds a facility near them without us keeping more
than we need, and [tech-stack.md](../tech-stack.md) fixes the layers (route, service, repository). It adds no table,
no library and no setting.

## In scope

- `GET /meta` exactly as in the api-spec: `areas`, `categories`, `services`, `blood_groups`, `report_reasons`. Public,
  no login. The `services` list was added on 2026-10-09 at the owner's request (decision 8).
- A log filter that replaces the values of `lat` and `lng` in the access log lines of `uvicorn.access`
  (decision 5), with tests.
- One shared rule for "the same service", used by `/meta` to merge names and by the `service` filter of `/search` to
  match them (decision 9), with tests that prove the two cannot drift apart.
- Spec notes (Task 0): the order of `categories`, where `blood_groups` come from, and the rule that logs never hold
  a position.

## Out of scope (planned elsewhere)

- The Find page, the results page and the filters that use `/meta`: [roadmap](../roadmap.md) phase 5B-1.
- `POST /facility-submissions`, the other TODO in `routes/public.py`: roadmap phase 10d.
- A `Cache-Control` header for `/meta`: not needed for the pilot (the answer is tiny). Revisit if traffic grows.
- Render's own request logs, which we do not control: see decision 6.

## Decisions

1. **The answer is built from fixed lists and the `categories` table.** `areas` are `settings.areas` in the order
   written in `core/config.py` (CLAUDE.md: areas are a fixed list, not a table). `categories` are all rows of the
   `categories` table, each with `slug`, `name` and `is_emergency` (the api-spec example). `report_reasons` are the
   values of the `ReportReason` enum in declared order, which is the api-spec order. `blood_groups` are a new constant
   `BLOOD_GROUPS` in `core/config.py` next to the areas (the eight groups of the api-spec). The seed keeps its own copy
   of the blood groups; we do not touch the seed here.
2. **Categories are sorted by `id`.** That is the order the seed creates them in: hospital, clinic, pharmacy,
   maternity, laboratory, then the emergency ones. It matches the five shortcuts of [FR-01](../prd.md) without a
   sort column. A real database that has other categories is sorted the same way. The frontend does not depend on it
   (it picks shortcuts by slug).
3. **Layers.** The route only calls the service and returns the schema. `meta_service.get_meta` is `async def`
   because it awaits the repository; the rest is plain data. A new `category_repository.list_all` is the only query.
   The schemas are `MetaCategory` and `MetaResponse` in `schemas/meta.py`.
4. **No login and no rate limit.** The api-spec lists `/meta` under public endpoints and puts a rate limit only on the
   report form. The answer holds no personal data.
5. **Positions are redacted in the access log, not the whole query string.** Checked on 2026-10-09 in the running dev
   stack: uvicorn writes `GET /search?lat=6.4512&lng=7.5033&open_now=true HTTP/1.1` to the log, so Render's log (the
   service output) would keep every visitor's position. The fix is a `logging.Filter` on the `uvicorn.access` logger
   that rewrites the request path in each record so that the values of `lat` and `lng` become `redacted`
   (`/search?lat=redacted&lng=redacted&open_now=true`). Rules: the match is on the parameter name, case-insensitive,
   also when the name is percent-encoded, in any position and when repeated; similar names such as `latitude` are left
   alone; the filter never drops a record and never raises (a record it does not understand is passed on unchanged).
   Alternatives: turn the access log off (we would lose status codes and timing, which we need for NFR-02), or cut
   the whole query string (we would lose `open_now`, `category` and the other filters that help to debug). The filter
   is installed once when `app.main` is imported. uvicorn sets up its loggers before it imports the app, so the filter
   is attached to the live logger.
6. **What we cannot fix from the code.** Render's documentation says a Pro workspace or higher also shows HTTP
   request logs, with the "Requested URL" and no setting to redact it (checked 2026-10-09,
   [Render logging](https://render.com/docs/logging)); it does not say whether the query string is included. Our
   service is on the free plan. Before the Render upgrade (roadmap phase 14d) check what those logs hold. If they hold
   `lat` and `lng`, the position must be sent another way, for example in the body of a POST. This is written in
   `LOG.md`. The browser calls the API directly, so Netlify never sees the position.
8. **`services` are the distinct names from the services table, public ones only.** Owner's decision, so the
   `service` filter of the results page is a pick-from-list: `GET /search` matches the exact name (without regard to case),
   and a visitor cannot guess exact names. Rules, all in the api-spec: only services of **published** listings (a draft
   listing's services must not leak, the same trust rule as search); one entry per name, with names that differ only in
   capitals counted once (the alphabetically first spelling is kept); sorted alphabetically without regard to case; and
   **the blood groups are left out**, because CLAUDE.md stores blood groups as service rows (`A+`, `O-`...), and they
   already have their own list, `blood_groups`. The rule that removes them is a business rule, so it lives in
   `meta_service` (it compares with `BLOOD_GROUPS`), while the query lives in a new `service_repository`. Empty or blank
   names are skipped. The list grows with the data; with thousands of services we would cache it (not needed for the pilot).
9. **One rule decides "the same service", for `/meta` and for `/search` (owner's request, 2026-10-09).** The pick-from-list
   would silently miss listings if the list merged names one way and the filter matched another. The rule: two names are
   the same service when they are equal after (1) taking the spaces off both ends, (2) joining runs of white space into
   one space, (3) removing hyphens, and (4) lower-casing. So `X-ray`, `x-ray`, ` X-ray ` and `Xray` are one service; `X ray`
   (a space) is another, and so is `Ultrasound`. Hyphens are ignored the same way as in the `q` match (`xray` finds `X-ray`).
   It lives in one module, `core/service_names.py`, with two parts that must agree: `normalise_service_name(name)`
   (Python, used by `meta_service` to merge) and `normalised_service_name_expression(column)` (the same steps as SQL, used
   by `search_repository` to match), and a test compares them on many strings in the real database. When the filter text
   normalises to nothing (`-`, spaces), nothing matches. The old filter, `lower(name) = lower(text)`, missed `Xray`,
   `X-ray` with spaces around it and `x-ray` typed with a hyphen the other way, so this is a fix to `/search` as well.
   The `/meta` label shown for a service is the first spelling in plain alphabetical order, cleaned to one space between
   words and none at the ends. Limits: `Pap-smear` and `Pap smear` stay two services (the hyphen is removed, the space is
   not); and because capitals sort before small letters, an all-capitals spelling (`X-RAY`) is shown when it exists
   next to `X-ray`. The owner kept this simple label rule (2026-10-09). The real fix is in
   [phase 10b](../roadmap.md): staff pick services from a controlled list of names instead of typing them, which also
   ends `X ray` against `Xray` (see `LOG.md`).
   **Found while writing the tests:** the old filter (`lower(name) = lower(text)`) really did miss `Xray` and ` x-ray `
   when `X-ray` was picked, so this is a fix to `/search`, not only a safeguard.
10. **Frontend consequence.** Because the position is only ever a query parameter of one API call (and never in the
   address of a page), the access log is the only place on our side where it could land. After this feature it does
   not.
