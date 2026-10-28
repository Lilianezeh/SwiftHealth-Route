# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## Unattended run (started 2026-10-17): phases, pull requests and what to check

The owner asked for all remaining phases in one run, as stacked draft pull requests, each branching from the one before. Merge them in the order
of the table, from the top; after each merge, change the base of the next one to `main` (GitHub offers it). `Assumed decisions` point to the
"Assumed owner decisions" table of each phase's `requirements.md`: overrule any of them by telling me.

| Order | Phase | PR | Branch (base) | Preview | Check on your phone | Assumed decisions |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Step A: CORS for deploy previews | #24, merged 2026-10-17 | `fix/cors-netlify-previews` (main) | | Previews can call the API | |
| 1 | 7 SwiftRescue | #25 | `feature/swiftrescue` (main) | https://deploy-preview-25--swifthealth-ng.netlify.app (talks to the production API: the emergency data shows only after the merge, see the note below) | `/emergency`: 112 first and red; Call 112; Share emergency list opens WhatsApp with the text; Share my location asks, then offers WhatsApp or SMS; after one visit, airplane mode and reload still shows the page and the saved contacts. Production has no real emergency contacts yet, so the preview shows the "still adding" line | A1 to A10 in `specs/2026-10-17-swiftrescue/requirements.md` |
| 2 | 9 Reports | #26 | `feature/reports` (`feature/swiftrescue`) | https://deploy-preview-26--swifthealth-ng.netlify.app (if Netlify builds previews for a PR whose base is not `main`; after #25 is merged and the base is changed to `main` it will) | A listing page, "Report a problem with this listing", pick a reason, Send: "Thank you. We'll check this listing."; try a bad phone number; the "Report a problem" link on SwiftRescue contacts. Needs the merge for the API part. Staff alerts need `RESEND_API_KEY` and the new `RESEND_FROM_EMAIL` on Render (not set: nothing is sent) | B1 to B8 in `specs/2026-10-20-reports/requirements.md` |
| 3 | 10 Staff screens and List your facility | #27 | `feature/staff-screens` (`feature/reports`) | https://deploy-preview-27--swifthealth-ng.netlify.app (only if Netlify builds previews for a PR whose base is not `main`) | `/list-your-facility`: send the form; `/admin/login`: log in with a staff account (code in the API log without a Termii key), add a draft, log a call and a visit, submit, publish as an editor, find it in the search; as admin add a user in `/admin/staff`; a verifier cannot publish or edit another's draft. Photos and SMS need their keys | C1 to C15 in `specs/2026-10-20-staff-screens/requirements.md` |
| 4 | 13 Information pages and polish | #28 | `feature/info-pages` (`feature/staff-screens`) | https://deploy-preview-28--swifthealth-ng.netlify.app (only if Netlify builds previews for a PR whose base is not `main`; the static pages need no API) | Open About, How we verify, Privacy, Terms and Contact from the footer and read every sentence (tell me what is wrong); press Tab on any page: "Skip to main content" shows first. **Decide:** who reviews Privacy and Terms, and what contact address to show | D1 to D7 in `specs/2026-10-20-info-pages/requirements.md` (D1: the legal pages are statements, not legal text) |
| 5 | 14 Launch readiness | #29 (and **#30**, a one-line-of-work PR to `main` with only the Render database comparison, so you can read it early) | `feature/launch-readiness` (`feature/info-pages`) | https://deploy-preview-29--swifthealth-ng.netlify.app (only if Netlify builds previews for a PR whose base is not `main`) | As admin open `/admin/import-export`: import a small CSV (the columns are on the page), download both CSVs and open them in a spreadsheet (a name starting with `=` must show as text). Read `release-checklist.md`, `runbook-backups.md` and `analytics-proposal.md` and **choose the analytics option**. This PR also holds the Render database comparison (read it before 1 November) | E1 to E6 in `specs/2026-10-20-launch-readiness/requirements.md` |
| 6 | 8 Blood | #31 | `feature/blood` (`feature/launch-readiness`) | https://deploy-preview-31--swifthealth-ng.netlify.app (only if Netlify builds previews for a PR whose base is not `main`; the lists need the merged API) | `/blood`: tap a blood group, "Show blood banks near me", Call and Directions; `/blood/donate`: open "Donation hours". **Decide F3:** the donor guidance text is not written, who supplies it (your medical advisor)? | F1 to F9 in `specs/2026-10-20-blood/requirements.md` (F3: no medical wording from me) |
| 7 | 11 Reports queue and dashboard | #32 | `feature/reports-queue-dashboard` (`feature/blood`) | https://deploy-preview-32--swifthealth-ng.netlify.app (only if Netlify builds previews for a PR whose base is not `main`; needs the merged API) | Log in as editor or admin: the dashboard at `/admin`, `/admin/reports` (Resolve and Dismiss), `/admin/recheck`. Run `docker compose exec backend python -m app.jobs.recheck` and read its one line. **Decide H4:** how the nightly job is run (no schedule exists; a Render Cron Job is paid) | H1 to H8 in `specs/2026-10-20-reports-queue/requirements.md` (H1: no "assign"; H4: no schedule) |
| 8 | 12 Providers and featured listings (Paystack TEST mode only) | #33 | `feature/providers-payments` (`feature/reports-queue-dashboard`) | https://deploy-preview-33--swifthealth-ng.netlify.app (only if Netlify builds previews for a PR whose base is not `main`; needs the merged API) | As a provider (made in `/admin/staff` and linked to a published listing): `/provider`, `/provider/edit` (change a phone: the listing stays visible and goes to the top of the re-check list), `/provider/featured` (Pay with Paystack with a TEST key and a test card), then `/provider/payment-complete`; in `/search` the one featured listing is first with "Sponsored". **Check the Paystack calls once against the Paystack test dashboard** | I1 to I13 in `specs/2026-10-20-providers-payments/requirements.md` (I2: provider edits go live at once; I11: no rotation of featured listings) |

**Note on previews:** a Netlify preview calls the production API. A phase with a new endpoint therefore shows an error on its preview until that
phase is merged and Render has redeployed (the pages say so and keep 112 and the other static parts). To see a phase fully before merging, run
its branch locally (`git switch <branch>`, `docker compose up --build`). Because the phases are stacked, merge in table order and check
production after each merge.

### Production results for #60 to #69 (merged 2026-10-27)

All ten pull requests are merged **into `main`**: each PR's base was `main`, and each has its own merge commit on `origin/main` (none went into an old branch). Frontend CI is green for every merge commit, including the head of `main`, `e2ff7b6`. Backend CI is green through `a5cb760`; the backend workflow only runs when `backend/**` changes, and #69 (dark mode) changed no backend file, so there is no backend run for `e2ff7b6`.

**Suites on `main` at `e2ff7b6`** (run on 2026-10-27 on one laptop; the browser run had one worker and nothing else running):
- Backend: `ruff check .` clean, **2148 passed**.
- Frontend: `tsc` and lint clean, **132 files, 2128 tests passed**.
- Real browser (Playwright): **368 passed, 27 failed, 4 skipped**. The failures were real, not load. Two were bugs in the app: the header bar was 3 px too wide at exactly 768 px (so the listing page scrolled sideways), and the photo credit on the home page moved when the Pause button appeared (CLS 0.0027). The rest were specs that did not answer newer calls, or a dev container without the `qrcode` package. All of it is fixed in draft PR #70 (`fix/browser-suite-on-main`): the full browser suite on that branch is **395 passed, 4 skipped, 0 failed**, and the frontend has 2131 tests (3 new). Merge #70 and `main` has the green result; until then `main` itself still has the 27 failing browser cases.

**Render:** three of the ten pull requests carry a migration, and all are additive (a new table, new columns; nothing is deleted or rewritten): #61 `7d1c4b9e5a32` (the 10th table, `facility_owners`), #63 `b8a1c3d5e7f9` (moves and closures), #64 `c9d2e4f6a8b0` (branches). The container runs `alembic upgrade head` at start-up. **I have not seen the Render logs or the production `alembic_version`**, so I cannot say "migration applied" from the logs. What I saw from outside: after the merges the API's `/openapi.json` lists the new routes, and a public listing read (`/listings/demo-diagnostic-laboratory-uwani`) answers 200 with the new `branch_of` field. A missing column would make that read answer 500. Please look for the three migration lines in the Render deploy log of the last deploy and tell me if one is missing.

"Read-only check" means GET requests to the live API and site on 2026-10-27 (nothing written, no setting changed, no login). "Live check on the phone" is what Lilian does by hand: **pending, Lilian checking on phone** for every row.

| PR | What | Merged (UTC) | Read-only check of production | Live check on the phone |
| --- | --- | --- | --- | --- |
| #60 | Accounts phase 5: self-service (My account, change password, email and phone, two-step, close account) | 11:02 | `/account` and `/forgot-password` pages 200; API `/account`, `/account/password`, `/account/email/start`, `/account/two-factor` in `/openapi.json`; `GET /account` 401 without a token | pending, Lilian checking on phone |
| #61 | Phase 6: owner links (10th table), owner requests screen, My facilities | 11:09 | API `/provider/listings` 401 and `/provider/claimable` 401 without a token (the routes exist and are protected); migration `7d1c4b9e5a32` (see Render above) | pending, Lilian checking on phone |
| #62 | Phase 7: register or claim a facility | 11:50 | `/list-your-facility` 200; `/meta` says `signup_open: false` (sign-up stays closed, as decided) | pending, Lilian checking on phone |
| #63 | Phase 8: move or close a facility, address history | 11:50 | public listing read 200 (needs the new columns); migration `b8a1c3d5e7f9` (see Render above) | pending, Lilian checking on phone |
| #64 | Phase 8b: branches of a facility | 11:51 | public listing read 200 with `branch_of: null`; search 200; migration `c9d2e4f6a8b0` (see Render above) | pending, Lilian checking on phone |
| #65 | Phase 9: Privacy and Terms drafts, anonymity tests | 11:52 | `/privacy` and `/terms` 200; the Privacy page says it was not reviewed by a lawyer | pending, Lilian checking on phone (a lawyer still has to read both texts before launch) |
| #66 | Sponsored rules check | 11:52 | docs and rules only; `/emergency` 200 with 112 first. No migration | pending, Lilian checking on phone |
| #67 | `/for-facilities` page | 11:54 | `/for-facilities` 200 and in `/sitemap.xml`; `/meta` returns `featured_price_naira: "5000.00"` (a string, as the rules say) | pending, Lilian checking on phone |
| #68 | SwiftRescue contacts screen | 11:57 | `/admin/emergency-contacts` page 200; `GET /staff/emergency-contacts` 401 without a token | pending, Lilian checking on phone (adding a real contact needs an editor login; not done) |
| #69 | Dark mode | 11:57 | production home page carries the theme script (`swifthealth.theme`), `data-theme` and the Theme button | pending, Lilian checking on phone (switch the phone to dark and look at the home page, `/find` and `/emergency`) |

Also seen: `/meta`, `/emergency` and a search answered 200 in under a second; the first call, `/health`, took 53 seconds because the free Render service was asleep (the same cold start as before). Not checked by me: any logged-in screen, a real Paystack test payment, an email or SMS, the nightly job, the Render deploy log, the production Lighthouse score (Accessibility 100 on 15 pages in both modes was measured locally on the dark-mode branch, not on production).

### Production results for #25 to #33 (merged 2026-10-21)

All nine pull requests are merged **into `main`** (each PR's base was `main`, and each branch tip is an ancestor of `main`). Backend CI and Frontend
CI are green on `main` at `57f6208` (the merge of #33). No pull request changed `backend/alembic/`, `backend/app/models/`, `render.yaml` or the
Dockerfile: no migration was added, so `alembic upgrade head` at start-up had nothing new to run, and nothing was deleted or rewritten.

"Read-only check" means GET requests to the live API and site on 2026-10-21 (nothing written, no setting changed). "Live check on the phone" is
what Lilian does by hand; it is **pending, Lilian checking on phone** for every row.

| PR | Phase | Merged (UTC) | Read-only check of production | Live check on the phone |
| --- | --- | --- | --- | --- |
| #25 | 7 SwiftRescue | 06:11 | `/emergency` page 200; API `/emergency` 200 with the 7 groups, 0 contacts, 1 pharmacy in the 24-hour list | pending, Lilian checking on phone |
| #26 | 9 Reports | 06:31 | `/report/<slug>` route builds; API `/reports` 401 without a token (the public `POST /reports` was not called: it writes) | pending, Lilian checking on phone |
| #27 | 10 Staff screens, List your facility | 06:33 | `/admin/login`, `/list-your-facility` 200; API `/listings`, `/admin/users`, `/uploads/sign`, `/facility-submissions` in `/openapi.json` | pending, Lilian checking on phone |
| #28 | 13 Info pages | 06:34 | `/about`, `/how-we-verify`, `/privacy`, `/terms`, `/contact`, `/robots.txt`, `/sitemap.xml` all 200 | pending, Lilian checking on phone |
| #29 | 14 Launch readiness | 06:36 | `/admin/import-export` page; API `/admin/import`, `/admin/export` in `/openapi.json` | pending, Lilian checking on phone |
| #30 | Render database note | 08:02 | docs only, nothing to check | not needed |
| #31 | 8 Blood | 08:11 | `/blood`, `/blood/donate` 200; API `/blood/banks`, `/blood/donation-centres` 200 with total 0 (no blood banks yet, so the "none found" sentences show) | pending, Lilian checking on phone |
| #32 | 11 Reports queue, dashboard | 08:12 | `/admin`, `/admin/reports`, `/admin/recheck` 200; API `/dashboard/stats`, `/reports` 401 without a token | pending, Lilian checking on phone (the nightly job was not run) |
| #33 | 12 Providers, featured (Paystack TEST) | 08:14 | `/provider`, `/provider/edit`, `/provider/featured`, `/provider/payment-complete` 200; API `/provider/listing`, `/payments/verify/...` 401 without a token; `/payments/featured`, `/payments/webhook` in `/openapi.json`; `/search` has 0 sponsored items | pending, Lilian checking on phone (no Paystack key is set yet) |

Also seen: the API answered `/health`, `/meta` and `/search` with 200 in under 2 seconds, and a Netlify preview address is allowed by CORS. Production
holds 4 demo listings, **no users**, no blood banks, no donation centres and no emergency contacts, so the empty states are what a visitor sees until
staff add and publish real facilities. The staff screens with data, a report, a payment, the CSV import and the nightly job are **not checked yet**.

**Correction to the first-admin step.** `render.yaml` sets the database `ipAllowList: []` (no outside connections), so the `docker compose run ...
bootstrap_admin` command in `release-checklist.md` step 3 could not reach the production database from a laptop. **Decided 2026-10-21: option (b).**
The container now runs `python -m app.bootstrap_admin --at-startup` before the API, only when the four `BOOTSTRAP_ADMIN_*` variables are set in
Render (like the demo-listings step). You set them, let the service restart, read `first admin created` in the Render logs, and delete them. The
new steps are in `release-checklist.md` step 3; the feature folder is `specs/2026-10-21-bootstrap-admin-at-startup/`.

Housekeeping in the same pull request: `test-results/` (Playwright's output, one stray tracked file) is removed from git and ignored.

## Decisions to review

Normal design decisions that came up in the long run of 2026-10-27 (accounts phases 5 to 9, the business features, dark mode). I chose the
recommended option and went on, as asked. Overrule any of them by telling me; each says where it lives.

| # | Where | Decision | Why |
| --- | --- | --- | --- |
| P5-1 | Phase 5, `/account/*` code routes | A wrong or expired code is **400**, not 401 (the public `reset-password` keeps 401). | The staff screens log a person out on 401, so a typo in a code would have logged them out. |
| P5-2 | Phase 5, forgot password | One page `/forgot-password` holds both steps (email, then code and new password); `/reset-password` redirects to it. No link is emailed, only a 6-digit code. | A code in the email cannot leak in a web address or a referrer (the same reasoning as the sign-up codes); one page is simpler to keep correct. |
| P5-3 | Phase 5, closing | Closing also ends every login token (it sets `password_changed_at`), so an old token gets 401, not "closed". The closed email becomes `closed-{id}@closed.invalid`, which frees the real address for a new sign-up. | A closed person's data must go (NDPA); freeing the address is what "close" means to the person. |
| P5-4 | Phase 5, new email or phone | Starting a change is not a "resend", so there is no 60-second wait; the 5 codes an hour per account still apply. | The wait only makes sense for a code the person did not get. |
| P5-5 | Phase 5, forgot password | The email send time differs a little between a known and an unknown email (the answer is identical). Not hidden further. | Hiding it needs a background queue; the 3-an-hour limit per email counts both. Written as a known limit in api-spec 4d. |
| P6-1 | Phase 6, `listings.owner_id` | The code no longer reads it; the access is the approved link only (the migration copies every old owner, the seed makes the demo provider's link). The old admin option `listing_id` still sets `owner_id` too and keeps its 409 for an owner_id held by another person, and also makes the approved link. | The plan said so; keeping the column untouched keeps the audit history and the tests of Phase 10 true. |
| P6-2 | Phase 6, reject | A rejected request becomes `removed` (there is no fourth state), with the staff member and the time; the person can ask again and the same row goes back to `pending`. | The plan has three states only. |
| P6-3 | Phase 6, removing a link | `POST /staff/owner-requests/{id}/remove` exists in the API but has no button yet; the queue screen handles pending requests only. | The plan asks for the queue screen; a list of approved links for removal is a small later screen. |
| P6-4 | Phase 6, many facilities | The provider's old single-facility screens (`/provider`, Edit, Get featured) keep working on the first approved link; "My facilities" lists all and links Edit to the chosen one (`?listing=`). Paying for Featured works on the first approved **owner** link. | Smallest change that keeps every existing screen and test; a facility picker for payments is a later screen. |
| P7-1 | Phase 7, the person's reason | A claim's reason (and a new facility's notes) is kept in the link's `note` while it waits; the staff member's own note replaces it when they decide. The audit row holds no reason. | No new column or table; staff see it in the queue as "Their reason". The words are lost after the decision, which also keeps personal text from piling up. |
| P7-2 | Phase 7, claim search path | `GET /provider/claimable?q=` instead of `/listings/claimable`. It needs a provider login. | `/listings/{listing_id}` is a staff route and would catch the word "claimable"; a login keeps strangers from listing every facility name. Spec updated first. |
| P7-3 | Phase 7, what can be claimed | Published and re-check-due listings can be claimed, and the duplicate check offers the same two. Draft and hidden ones answer only "already registered, contact us". | A lapsed listing is exactly one an owner may come back for; hidden ones must not leak. |
| P7-4 | Phase 7, duplicate name rule | Trigram `similarity` of 0.6 or more in the same area (`DUPLICATE_NAME_SIMILARITY`). Example: "Example Clinic" and "Example Clinic Ltd" (0.79) match, "Good Life Pharmacy" and "Good Health Pharmacy" (0.54) do not. | High on purpose: a wrong stop only sends the person to claim or contact us; a missed duplicate is caught by staff when they phone. The number is one constant to change. |
| P7-5 | Phase 7, coming back after login | Only the Log in button of `/list-your-facility` carries `?next=/list-your-facility`; only that one address is accepted, and only for a provider. Sign-up does not carry it (it ends on the "waiting" page and the person logs in later). | A free-form `next` is an open redirect. Remembering across the whole sign-up road needs storage the privacy page would have to name. |
| P7-6 | Phase 7, old form | `POST /facility-submissions` answers 401 without reading the body; its old code and tests are removed. Drafts already in the database are untouched. | D14. |
| P8-1 | Phase 8a, who may move | Editors, admins and a provider with an approved link (owner or manager). A verifier may not, not even on their own draft. | The plan lists these three; a verifier works on drafts through the editor. |
| P8-2 | Phase 8a, status after a move | Only a published listing becomes `recheck_due`. A draft, pending or hidden one keeps its status; a `recheck_due` one stays and is due now. A move must change the address, area or landmark (the pin alone is not a move: 400 "Nothing changed."). | `recheck_due` is the "was public, must be checked again" state; a draft was never public. A pin-only change is an ordinary edit. |
| P8-3 | Phase 8a, the pin | An owner's or manager's move always puts the pin back to the default centre (any pin they send is ignored) and the staff detail shows the existing "pin is still the default" warning. An editor's or admin's move uses the pin they send, else leaves it. | A pin at the old address would send people to the wrong place; only staff can check the real one. The flag is a warning in the editor, not a block on publishing (as before). |
| P8-4 | Phase 8a, address history | The history lists address, area and landmark (the plan said address). A provider sees no staff names. | An address is those three together. Names of staff are not for providers. |
| P8-5 | Phase 8a, who may close | Editors, admins and an approved **owner**; a manager gets 403. The provider page always shows the close form and says "Only the owner of a facility can close it." on a refusal. | The provider screen does not know the person's role on the link; the API is the judge. |
| P8-6 | Phase 8a, alerts | When a provider moves or closes a facility, editors and admins get an email with the name only (no SMS). Staff moves send nothing. | Staff already know what they did. |
| P8-7 | Phase 8a, no status added | A closed facility is `hidden` plus `closed_at` and `closed_reason`; reopen clears both and puts it back to draft. | Additive migration, no enum change (the owner asked for no deletes and no new values). |
| P8-8 | Phase 8b, "same family" | A branch must have the same category as its main facility. | The project has no category families; "same category" is the plain reading and is one line to loosen in `branch_rules`. |
| P8-9 | Phase 8b, access inherits | An approved link on the main facility gives the same rights on its branches (edit, move, history; close only for an owner link). A link on a branch gives nothing on the main facility. "My facilities", `/provider/listing` and paying for Featured use the person's own links only. | D5, one way. A branch is paid for through a link of its own, not through the main facility. |
| P8-10 | Phase 8b, a new branch | It has no owner link of its own (access is inherited), `created_by` empty, the main facility's category, the default pin; the optional notes go to the staff-only "submission details". The new-branch duplicate check compares only phone and address inside the facility. | Same as the old open form and the plan; nothing about the person is copied into the listing. |
| P8-11 | Phase 8b, the public | `branch_of` is shown only while the main facility is published (a hidden main facility's name is never leaked). The main page lists published branches only. SwiftRescue and blood lists do not fill `branch_of`. | Trust rules: the public sees only published listings. |
| P8-12 | Phase 8b, staff screen | A small "Branch of a bigger facility?" part with the main facility's number typed in, not a search. | Staff can read the number in the editor address; a search box can come with a later screen. |
| P9-1 | Phase 9, Privacy and Terms | Both pages are plain statements of what the product does, still marked "not reviewed by a lawyer". No legal claim, no section numbers; the questions for the lawyer (basis for each use, retention, transfers abroad, rights and answer times, registration, the Terms for accounts) are in validation.md, not in the pages. | Your rule: legal text is marked, and I cite no law I have not checked. |
| P9-2 | Phase 9, the clean-up job | The Privacy page says an unfinished sign-up "is removed by a clean-up job" after 7 days. **No schedule exists for `purge_signups` (nor for the re-check job).** Scheduling is on the owner's list before sign-up opens. | The page must not promise what no timer does; the sentence is true once the job runs nightly. |
| P9-3 | Phase 9, audit records | The page says activity records "are kept", with no end date. | There is no deletion path today; a retention period is the lawyer's decision. |
| P9-4 | Phase 9, anonymity tests | The tests read the source (no cookie, no analytics, `credentials: "omit"`, public pages without the staff gate) and probe the API (no `Set-Cookie`). The API's CORS answers `Access-Control-Allow-Credentials: true` for the allowed site; I left it, because the browser code sends no cookies and no cookie is ever set. | Changing CORS is outside this change and could break the previews; worth a look later. |
| S1 | Sponsored rules, "verified" | To start a payment and to take the sponsored slot a listing must be published, have a verification date and not be overdue for its re-check. An overdue listing stays visible with "Verification due" but is never sponsored. | Before this, a published listing with no verification date or an overdue one could pay and go first. Paying must not buy a place that verification has not earned. |
| S2 | Sponsored rules, a late payment | A payment confirmed for a listing that is no longer eligible is still recorded (audit entry and `featured_until`) but shows nothing until the listing is eligible again. | The money was taken; the webhook must not refuse a real payment. Refunds are outside this change. |
| S3 | Sponsored rules, the screens | "My facility" and "Get featured" say "Only a verified listing can be featured." before the person pays, with the same sentence as the API. | The refusal should not come after the click. |
| M1 | Dark mode, tokens | Role tokens change in the dark (page, surface, ink, ink-soft, line, forest, the tints, label colours, alert); constant tokens never do (pine, pine-dark, accent, sky, paper, amber, on-amber, snow, emergency). `bg-white` is now `bg-surface` everywhere; `bg-forest` is `bg-pine`. A source test keeps the old names out. | The blue bars, hero, buttons, logo and red buttons look the same in both modes; no per-component dark rules. |
| M2 | Dark mode, the 112 card | A red border (lighter red in the dark) on a dark card, and the same red Call 112 button with white text in both modes. | "Stays clearly red". |
| M3 | Dark mode, the map | The map tiles stay light in both modes (the pin and dot are constant blues; popups and credit follow the theme). | A dark map needs another tile provider (a new outside service, maybe paid): your decision, not mine. |
| M4 | Dark mode, the choice | Light and Dark are kept in the browser (`localStorage` key `swifthealth.theme`); System keeps nothing. The Privacy page says so. | Without it every page would forget. |
| M5 | Dark mode, the Find page | The first button of the Find page's blue band is now the white (`snow`) button of the home hero, not the outline button. | The outline button turned dark on the blue band in the dark mode. |
| M6 | Dark mode, the header at 768 px | The header's links already wrapped onto two lines at 768 px before this work ("Find care", "For facilities", "Log in"); the Theme icon fits at the right edge and does not make it worse. I left the wrapping as it was. | Not part of this change; a separate small fix if you want it. |
| E1 | SwiftRescue contacts screen, who | Editors and admins (the "review" area), not only admins. | Editors already publish, hide and reopen listings; one line to make it admin only. |
| E2 | SwiftRescue contacts screen, Remove | Remove is hiding, with a reason and a question; nothing is deleted and Edit stays on the card. | "No deletes"; and a closed contact must leave the public list at once. |
| E3 | SwiftRescue contacts screen, Add | Opens the normal new-listing editor with the group's category chosen. A new contact is a draft and appears in SwiftRescue only after it is verified and published. | The trust rule applies to every listing, SwiftRescue included. |
| E5 | SwiftRescue contacts screen, data | I added no phone number anywhere (seed, migration, tests use made-up numbers). | Your rule. |
| F1 | For facilities, the price | `GET /meta` now carries `featured_price_naira` (public, a string like "5000.00", from `FEATURED_PRICE_NAIRA`); the page reads it and writes no amount itself. | The page cannot disagree with what a provider pays. |
| F2 | For facilities, the header | The header and Menu link **For facilities** goes to `/for-facilities` (it went to `/list-your-facility`); the page has a **List your facility** button. The footer is unchanged. | "Linked from the header." |
| F3 | For facilities, Sign up | The Sign up button shows only while `signup_open` is true; otherwise "Sign-up is not open yet." | Sign-up stays closed in production. |
| H1 | Hero slideshow, the credit | **The "Designed by Magnific" credit moved to the footer (2026-10-28).** It is gone from every photo (the hero, the ambulance and fire photos of /emergency, the old slideshow behind Find by type); the footer of every page has one line at the bottom right, "Photos: Designed by Magnific", linking to www.magnific.com (16 px, 48 px to tap, the `forest` link colour). | "Remove every credit from the photos themselves... add ONE line in the site-wide footer, bottom right." |
| H2 | Hero slideshow, the controls | Previous, Next, Pause/Play and six dots are round buttons with a dark fill and a **white edge** over the photo (a fill that stands out from a bright photo, an edge that stands out from a dark one). Up to 479 px they take two rows (the dots, then the buttons) hanging 16 px below the band, so they never cover a face; from 480 px one row at the bottom left. Pause is an icon button (no word) so the row fits at 320 px. **The fill is the new `control` token (a dark teal-navy, `#0e3a4f` in Light and `#0a1628` in Dark), not the brand blue:** with the brand blue, a mid-tone pixel (a light teal) was too dark for the white edge and too light for the blue fill, and a real browser measured 2.4:1 for the edge of the Previous button. With the darker fill, the white edge or the fill is at least 3:1 against every grey level (a unit test checks all 256 in both modes), and the browser test passes on all six photos. | 48 px targets, six dots and three buttons need 432 px: they cannot be one row at 320 px. |
| H3 | Hero slideshow, focus points | Each photo has two focus points (`focus` under 1024 px, `focusWide` from it), worked out by maths from where each face is (a face box per photo in `tests/unit/heroSlides.test.ts`) at 320, 360, 375, 390, 414, 430, 600, 767, 768 px and at 1024 to 1920 px. I did **not** require the whole face at the widest tablet widths, 769 to 1023 px: the band is only 288 px high there while a face grows with the screen. Measured with the real focus points, the nurse and the doctor in the maternity photo are whole all the way to 1023 px; the patient's chin is cut by up to 30 px from about 950 px, and the top of the laboratory and pharmacist faces (forehead, hair) by 1 to 5 px from about 1000 px. Tell me if those widths matter. | You named 320, 360, 768 and 1280 px. |
| H4 | Hero slideshow, speed | The stethoscope is drawn by the server exactly as before (eager, high priority, the small file for phones). The other photos are added 200 ms after the page has loaded, one ahead of their turn (or when asked for by hand); under reduce motion none is asked for until a button is pressed. **I cannot run the live PageSpeed before the site is deployed**: I report Lighthouse (mobile preset) on a production build here; the live number (90 or more) is yours to check after the deploy. | "Live PageSpeed mobile must stay 90 or more." |
| H5 | Hero slideshow, the address bar | `theme-color` is `#1b6f93` in Light and navy `#0a1628` in Dark, set by the Theme button and by the head script (it follows your choice, not the device). `#0a1628` is the navy of the Dark header and hero in the navy dark mode (#73, merged on 2026-10-28), so the address bar matches the Dark header. | "Make the browser address-bar colour navy in Dark mode." |
| H6 | Hero slideshow, Find by type | The section is plain again: the light-blue band, a plain `forest` heading, the five tiles exactly as they are now (the bigger cards with a line each). The photo files stay in `public/images/backdrop/` because the hero uses them, so no file was deleted; removed: `BackdropSlideshow.tsx`, its tests, the old `home-photos.spec.ts`, the `.section-lazy` CSS and `BACKDROP_STRENGTH`. | "Back to the plain section... hero4 and everything else stay." |
| N1 | Navy dark mode (Option A), buttons | In the dark mode the button blue (`pine`) is `#2b6fc4`, not the header navy: a darker blue made the buttons fade into the page (their edge was 1.8:1 to 2.1:1; `#2b6fc4` gives 3.5:1 on a card and 3.9:1 on the near-black page). The header, Menu and bands use a separate navy token, `bar` `#0a1628`. | You asked for 3:1 on button edges, and for royal blue only on the accents. |
| N6 | Navy dark mode, the hero photo | After seeing it dimmed, you asked for the hero photo to be **exactly as bright in the dark mode as in the light mode**: the dark-only brightness filter (60%) and the near-black tint over the photo are removed. The shade under the header (the veil, 85%, solid for 4.5 rem) stays, so Log in, For facilities and the Theme button stay readable over the bright photo (measured again on the real pixels, both modes). A browser test compares the photo's pixels in both modes at 360, 768 and 1280 px (largest difference 2 of 255, mean under 0.5). The hero has one photo; the "Find by type" slideshow photos keep their section tint (a role token, `pine-100` at 40%), which I did not touch. | "In dark mode the stethoscope (and any later hero slideshow photo) must look exactly as bright as in Light mode... Nothing else changes." |
| N5 | Darker navy dark mode (option (a)) | After "make it darker" you chose, from two screenshots, **(a) near-black navy** over pure black: page `#060d18`, cards `#0d1a2e`, hero `#0a1628` to `#0d1d36` (the photo tint of that version was removed again the next day: see N6). To make the section under the hero read as one page with the hero, that section and the owners section use a new token `band` (white in the light mode, so nothing changes there; the hero's `#0a1628` in the dark mode). | "The section under the hero must match the hero, so it reads as one page." |
| N2 | Navy dark mode, the header over the hero photo | Measured on the real pixels, three things failed in the **light mode too**, so I changed them in both modes: the red SwiftRescue button has a 2 px white edge (its red against the veil was 1.01:1); the phone Menu button's edge is solid cream (2.75:1 before); the veil under the header is 85% and solid for 4.5 rem (it was 80% and 3 rem; white text over a white sheet of the photo measured 3.8:1 to 4.3:1). SwiftRescue keeps its width. | "Stay clearly visible on every part of the photo in both modes (WCAG AA, 3:1 for the button edge)". These are the only light-mode visual changes. |
| N3 | Navy dark mode, 360 px | The home header is 11 px too wide at 360 px on this machine's fallback font (the Menu button ends at 371 px). It is the same with and without this change, so I left it and skipped that one check at 360 and 320 px. | It is the known fallback-font problem already in this log. Tell me if you want it fixed. |
| N4 | Navy dark mode, Lighthouse | Accessibility is 100 on 15 pages in both modes. The home page also lists the unscored axe rule `label-content-name-mismatch` on the five "Find by type" tiles (named by the type word, described by the line under it): it is the existing markup and it does not change the score; left as it is. | Pre-existing, weight 0. |
| D1 | Neon move, the Render database | **The Render database (`swifthealth-db`) stays untouched until it expires (about 2026-11-07). It is not deleted, not emptied, not changed.** `render.yaml` keeps its `databases:` block (the Blueprint spec does not say what removing it would do), now marked "not used, kept as the way back". It is the rollback: one variable on the API service points back to it. Only after it has expired is its block removed, in a small pull request. | "The Render database stays untouched until it expires (no delete)." |
| D2 | Neon move, two addresses | `DATABASE_URL` (Neon's **pooled** address, for the API) and `DATABASE_URL_DIRECT` (the **direct** one, for Alembic and for `pg_dump`) are secrets set by hand in the Render dashboard (`sync: false`); no address or host is in the repository. Why two: the pooler (PgBouncer, transaction mode) is right for many short requests and wrong for migrations (Neon's own advice); without `DATABASE_URL_DIRECT` Alembic uses `DATABASE_URL`, so local development and the tests need nothing new. | "The right URL form for our driver; pooled vs direct URL for the app and for alembic." |
| D3 | Neon move, the app's settings | The app adds `sslmode=require` to a `.neon.tech` address that lacks it, accepts `postgres://`, tells psycopg 3 not to prepare statements on the server (a transaction pooler cannot keep them: after 8 repeated queries the server holds 0 prepared statements, tested), waits up to 15 s to connect (a free Neon database wakes from sleep in about a second), tests each connection before use and keeps none longer than 240 s. These options apply to every address, local and Render too. A small cost: no server-side prepared statements. | "Anything the app needs for Neon." |
| D4 | Neon move, the dump | The runbook restores a **full** `pg_dump` (custom format, no owner, no privileges, no comments) and compares the row counts of the 10 tables and `alembic_version`. I also tried "build the tables with the app's own migrations, then copy only the data": it **fails** (the migrations insert the categories, and listings and categories refer to themselves), so it is not offered. A Postgres 18 dump restored into a Postgres 17 database in my rehearsal; nothing older was tried, so create the Neon project on 17 or 18. | The rehearsal on throw-away containers. |
| D5 | Neon move, order of the switch | Dump, restore and compare first; **merge the pull request after that** (Render then puts the empty allow list back on the Render database, which would cut the owner's temporary address); then set the two variables in the dashboard. By Render's documentation, a `sync: false` variable is ignored when an existing Blueprint is updated, so the merge alone should not change the live database; I could not test that on the owner's account (the runbook says what to look at, and how to go back). | "When to merge the PR." |
| D6 | Neon move, done | **The production database is now on Neon (done by the owner on 2026-10-28; reported to me, I did not see Neon or Render).** Pull request #75 is merged; `DATABASE_URL` (Neon's pooled address) and `DATABASE_URL_DIRECT` (the direct one) are set on the Render API service; the row counts matched table by table; and a test edit raised `audit_entries` on Neon from 8 to 13, which shows the live API writes to Neon. **The Render database (`swifthealth-db`) is left untouched until it expires (about 2026-11-07): not deleted, not emptied, not changed.** Until then it is the way back (point `DATABASE_URL` at it again, as in the runbook). After the expiry there is no way back, so the old block in `render.yaml` is removed in a small pull request after that date. | Done as D1 asked. The one date to remember is 2026-11-07. |

## To do later

### The Render database expires about 2026-11-07: free options compared (written 2026-10-20, nothing in production was changed)
What the database holds today is **demo data only**, so nothing real is lost if it lapses. Facts below come from the providers' own pages, read on
2026-10-20 (links at the end); prices and limits change, so confirm them on the day you decide.

| Option | Cost | Limits that matter to us | Effort and risk |
| --- | --- | --- | --- |
| **A. Do nothing special: let it lapse and make a new free Render database** | $0 | Free Render Postgres expires 30 days after creation, then 14 days to upgrade, then it is deleted; 1 GB; **no backups**; one free database per workspace. | About 10 minutes: create it from `render.yaml`, set `DATABASE_URL`, redeploy (the demo step seeds again). The API is down meanwhile. Repeats every 30 days. Fine for demo data, **not for real data**. |
| **B. Move to Neon Free** | $0 | 1 GB storage, 100 compute-hours a month, **no expiry stated**, compute suspends after 5 minutes idle (a cold start on top of the API's own), instant restore only for the last 6 hours, 1 manual snapshot. | About 1 hour: new project, `pg_trgm` and the migrations, change `DATABASE_URL` on Render by hand. Another company holds the data; the region (Frankfurt like Render's?) and the Postgres version (we use 18) must be confirmed. No daily backups beyond 6 hours. |
| **C. Move to Supabase Free** | $0 | 500 MB, **pauses after 7 days idle** (a pilot with few visitors would pause), no automatic backups, 2 active projects. | Similar to B, but the pausing makes the site fail for a whole week of silence. Not recommended. |
| **D. Upgrade the Render database to the cheapest paid plan** | about $7 a month (a third-party figure; **confirm on render.com/pricing**) plus $0.30 per GB beyond the included storage | Same platform and region as the API, no expiry, Render's docs say paid databases get **point-in-time recovery**; the retention window needs confirming. | 5 minutes in the dashboard, **no code change**. This is a paid action: only you can do it. |

**Recommendation.** Until launch, choose **A** (or do nothing and accept a short outage): the data is demo data and it costs nothing. **Before real
data goes in (the launch), choose D**: it is the only option here with backups that Render itself keeps, it needs no code change and no new company
holds the data, and the daily backups of NFR-09 then rest on Render's recovery, plus our own `pg_dump` script and tested restore from phase 14b.
Choose **B** only if you need to stay free beyond launch, and then add our `pg_dump` script as a nightly job somewhere free (cron on your laptop is not enough).
**Update 2026-10-28: the owner chose B and is moving to Neon** (the runbook is `specs/2026-10-28-neon-database/runbook.md`; the draft pull request prepares the app and `render.yaml`; nothing in Render or Neon was changed by me). **The Render database stays untouched until it expires (about 2026-11-07): it is not deleted** (decision D1 in "Decisions to review"). It is the way back if the move fails; after the expiry date there is no way back to it.
**Update 2026-10-28, later the same day: the move is complete** (decision D6). The Render database is still untouched; it is not deleted. After about 2026-11-07 a small pull request removes its block from `render.yaml`.
Whatever you choose, run the restore test of phase 14b first. Sources: <https://render.com/docs/free>, <https://neon.com/docs/introduction/plans>,
<https://supabase.com/pricing>, <https://render.com/docs/postgresql-refresh> (the $7 figure is from a third-party guide, not Render's pricing page).

Open reminders. Each says when it is due. Remove a line once it is done.

### Pre-launch checklist
Things the owner must do before real visitors use the site.
- [ ] **Have a lawyer review Privacy and Terms, and give a contact address (NFR-13, FR-23)** (unattended run, 2026-10-20). `/privacy` and `/terms` are plain
  statements of what the product does, with the visible notice "It has not yet been reviewed by a lawyer"; they make no legal claim. `/contact` shows
  no address until `contactEmail` in `frontend/src/config/site.ts` is set. Also: the Privacy sentence "your phone number is deleted when the report
  is closed" is true only once the reports queue of phase 11 is merged; and the page must say what the anonymous analytics of phase 14c collect
  when they are switched on. Details: `specs/2026-10-20-info-pages/requirements.md`, decisions D1 and D2.
- [ ] **Payments: lawyer wording and the Paystack steps (FR-44)** (unattended run, 2026-10-20). Phase 12 takes Paystack **test** payments only; the code
  refuses a live key. Before any real payment: (1) Privacy and Terms need your lawyer's wording about payments (they say nothing about them, because
  that is legal text); (2) on Render set `PAYSTACK_SECRET_KEY` to a test key and `FEATURED_PRICE_NAIRA` to the real price; (3) in the Paystack **test**
  dashboard set the webhook URL to `<Render address>/payments/webhook`; (4) pay once with a Paystack test card and read `/provider/payment-complete`;
  (5) a live key would need a new decision from you and a code change. The Paystack calls were tested with a mock transport only.
  Details: `specs/2026-10-20-providers-payments/requirements.md`.
- [ ] **Read the WhatsApp brand terms (NFR-13)** (owner, 2026-10-15). Not read yet. The WhatsApp button uses the owner's downloaded WhatsApp glyph, only
  scaled (<https://www.whatsappbrand.com/>, which redirects to Meta's brand resource page). Read the live terms, check that the button's look
  (white button, dark green border, the glyph) and the words in `specs/2026-10-13-listing-page/requirements.md` D2 and the comments in
  `frontend/scripts/make-whatsapp-glyph.mjs` and `frontend/tests/unit/whatsappGlyph.test.ts` agree with them, and change the button if they do not.
  Deferred box in `specs/2026-10-13-listing-page/validation.md` (Security and privacy checklist).
- [ ] **Read Magnific's licence and attribution terms, and decide the hospital banner (NFR-13)** (owner, 2026-10-15). The type banners use Magnific photos
  with the credit "Designed by Magnific" (link <https://www.magnific.com>). Magnific's pages answered 403 to my tools, so I could not quote them: read
  <https://www.magnific.com/ai/docs/licenses-attribution> and <https://www.magnific.com/ai/docs/usage-rights-general-rules> in a browser, plus the licence
  file of each photo, especially for people shown in a health setting. Until then the hospital banner is off (`approved: false`,
  `specs/2026-10-15-find-by-type/requirements.md` D6). Also keep the download records (see "keep a record of where the home page photos come from").

- **Render collation provider (before the production `pg_trgm` check):** PostgreSQL 18 release notes say `pg_trgm`
  behaviour can change on clusters whose default collation provider is not libc. Local and CI use the image default
  (libc). Confirm that Render's database also uses libc, or reindex the `pg_trgm` indexes after any change.
- **Render Blueprint is on manual sync:** a new variable in `render.yaml` does NOT reach the service by itself, and
  changing `render.yaml` does not redeploy through the Blueprint. Add every new variable by hand in the dashboard
  (Environment, **+ Add Environment Variable**) and deploy. Seen twice: `CORS_ORIGINS` in phase 4, and
  `REPORTER_KEY_SECRET`, `SEED_DEMO_LISTINGS` and `REMOVE_DEMO_LISTINGS` in phase 5A (all three now in the dashboard).
  Still to add by hand: any variable a later phase adds (Paystack, Resend, Cloudinary, Termii keys). Keep `render.yaml` as
  the written record, and update the dashboard to match whenever it changes.
- **Phase 10b, a controlled list of service names (the real fix for service spellings):** services are free text today,
  so the same service can be saved as `X-ray`, `x-ray`, `Xray` or `X ray`. `GET /meta` and the `service` filter of
  `/search` already treat the first three as one service (phase 5B-0, `core/service_names.py`), and `/meta` shows the
  first spelling in plain alphabetical order (an all-capitals `X-RAY` would win over `X-ray`). `X ray` (with a space) is
  still a different service. The keeper decision (owner, 2026-10-09): keep that simple label rule, and in the phase 10
  listing editor let staff **pick** services from a controlled list of names instead of typing them. That removes
  `X ray` against `Xray`, the label quirk and typos at the source. It needs a place for the list (an admin-managed list,
  or the distinct names in use), which is a data-model question for the owner: the project has exactly 9 tables, so
  adding a table needs approval. The UI spec (3.4, "Services and fees") changes first.
- **Small backend PR after phase 5B-1: the next opening or closing time on the card.** Figma shows "Closes 9:00 PM" and
  "Opens 7:30 AM tomorrow" on each card. `ListingSummary` has no opening hours today (they are in `ListingDetail`, phase 6),
  so the card shows only the badge (owner's decision, 2026-10-09: keep it that way for now). Plan: `GET /search` returns a
  short text for the next change, for example "Closes 9:00 PM" or "Opens 7:30 AM tomorrow", computed in
  `search_service` with `services/hours.py` in Africa/Lagos time (the code that already decides open now), then the card
  shows it. The api-spec (`ListingSummary` gets a new field) and the UI spec change first; tests first, including past
  midnight, 24-hour places, closed days and the week wrapping. Then the frontend shows it in one line under the labels.
  **Backend done 2026-10-10 (PR #17, checked in production):** branch `feature/next-open-close-time`, folder `specs/2026-10-10-next-open-close-time/`. The
  field is `hours_note`, a ready-made text from the server (owner's decision). Owner's wording changes: full day names ("Opens
  Monday 7:30 AM"), "Closes at midnight" and "Opens at midnight" (never "12:00 AM"), and `null` when a listing has no hours
  recorded. The card change is the next small frontend PR: **done 2026-10-10 (PR #18, checked on the live site)**, branch
  `feature/hours-note-on-card`, folder `specs/2026-10-10-hours-note-on-card/` (owner's decisions: a grey `Clock` line under the address, nothing shown when
  `hours_note` is `null`).
- **Idea (owner, 2026-10-10): refresh the results when the tab is reopened after a long time.** The results, the "Open now"
  badge and `hours_note` are fixed at the moment they load, so a page left open overnight can still say "Opens 8:00 AM
  tomorrow" when it is already that morning. Idea: when the tab becomes visible again (the `visibilitychange` event) after,
  say, 30 minutes, load the results again (keep the filters and the page the visitor is on, or at least the first page). Decide
  the time limit, whether to keep "Load more" pages, and whether a small "Updated" notice is needed. A small frontend PR with
  its own spec, tests first; not part of the card change.
- **Idea (owner, 2026-10-11): a "Search this area" button on the map.** After the visitor moves the map, a button searches
  again for the part of the map on screen. Left out of phase 5B-2 on purpose: the API has no search by map area (it has
  `lat`, `lng` and `radius_km`), so it needs an api-spec change first (a bounding box, or the map centre and a radius), and
  the centre of the map must still never go into the address (NFR-07). Its own spec, tests first.
- **Before launch: review the map tile provider (owner, 2026-10-11).** Phase 5B-2 loads tiles from the public OpenStreetMap
  server, `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Read the OpenStreetMap tile usage policy
  (<https://operations.osmfoundation.org/policies/tiles/>) against our expected traffic and decide whether to keep it or move
  to another tile provider, which may have a cost and an API key. The address is in one place, `frontend/src/config/map.ts`,
  and the credit stays visible whichever provider is used (the new provider's own credit text). Due: before the public launch.
- **Before launch: say on the Privacy page that the map loads tiles from OpenStreetMap (owner, 2026-10-11).** When someone
  opens the map, their browser asks OpenStreetMap's servers for map tiles, so that service can see the visitor's IP address
  and which part of the map they look at. SwiftHealth does not send the visitor's position to it, does not put the map
  centre, zoom or position in an address and does not store them. The Privacy page (`/privacy`, "Coming soon") is part of
  NFR-07; write this in it, and have the final wording checked with the rest of the policy (NFR-13). Due: with the Privacy
  page, before launch.
- **After the Render upgrade: server-rendered listing pages for Google (owner's decision, 2026-10-11).** The listing page
  (phase 6b) loads its data in the browser, like `/search`, because the free API can take about a minute to wake and Netlify
  gives up on a server page after about 30 seconds. So Google cannot read the listing text yet (NFR-12, a Should). Once the API
  answers at once, render `/listing/[slug]` on the server, with a title and description per listing, and keep the browser
  load as the fallback. Needs its own spec, tests first.
- **Watch: a frontend test that failed once in a full run (seen 2026-10-11, home redesign branch).**
  `tests/unit/NearbySuggestions.test.tsx`, "asks for one open pharmacy and one 24-hour place, both with the position", failed
  (the output showed about 3.3 s for it) in one run of the whole frontend suite. It passed when run alone, and in every full run
  after it (574, 582 and 584 tests). The error text was not captured, so the cause is not known; the guess is timing under load
  (Docker on a laptop; the test limit is already 20 s). Nothing was changed in that test or in `NearbySuggestions`. If it fails
  again: copy the full error text and which other tests were running, run the file alone and then the full suite twice, and
  look for a timer or a shared state between tests (`vi.useFakeTimers`, `sessionStorage`, the `fetch` stub) before raising a
  limit. Remove this note after about 10 full runs with no failure.
- **Reminder: `hours_note` is English only (owner's decision, 2026-10-10).** "Closes", "Opens", "tomorrow", the day names and
  "midnight" are written in the backend code (`services/hours.py`). If SwiftHealth ever adds another language, this text needs
  translating, and at that point reconsider sending the time as data and formatting it on the frontend. Revisit before any
  second language is planned.
- **Small backend PR after phase 5B-1: all the spec categories in every database (found in the phone test, 2026-10-10).**
  The Filters sheet in production lists only Clinic, Pharmacy and Laboratory, because production has only the categories
  that the demo listings needed (`seed/demo_listings.py` adds just those). Categories are reference data, so every database
  needs all twelve of `seed_data.CATEGORIES` (the five everyday ones and the seven emergency ones), whatever listings it has.
  Plan (owner's idea, accepted): an idempotent Alembic data migration that inserts each missing category with
  `INSERT ... ON CONFLICT (slug) DO NOTHING`, with the same `is_emergency` and `recheck_days` values as the seed (14 days for
  emergency, 45 for the rest, FR-33), and never updates or deletes a row or touches `listings`. Safe to run twice. A seed
  script is not enough, because the production seed is flag-driven and does not run on deploy. Tests first (empty table, a
  table with three categories, a second run changes nothing, a renamed row stays as it is). **In progress (2026-10-10):**
  branch `feature/reference-categories`, folder `specs/2026-10-10-reference-categories/`. The recheck days come from FR-33
  in the PRD (14 and 45); nothing new.
- **Small frontend PR after the categories PR: hide the emergency categories in the Filters sheet (owner's decision,
  2026-10-10).** `GET /meta` keeps returning all 12 categories with `is_emergency` (the phase 10 editor needs them); the
  public Filters sheet (`FiltersDialog`) shows only the 5 everyday ones, because SwiftRescue (`/emergency`) groups the
  emergency categories and Blood has its own page. A shared link such as `/search?category=ambulance` must keep working
  (`/search` still accepts any slug) and keep showing a readable label for it. **Done 2026-10-10 (PR #16, checked on the live
  site):** folder `specs/2026-10-10-hide-emergency-filters/`. Owner's decisions: the list follows the
  Find shortcut order (Hospital, Clinic, Pharmacy, Maternity, Laboratory) with anything else after it, and an emergency
  category stays visible, with its real name, only while it is the one selected from a link.
- **Done 2026-10-10: all spec categories in every database (PR #15).** The migration ran in Render's log, production
  `GET /meta` returns 12 categories, the search total is still 4, and Hospital and Maternity show in Filters.
- **Decided on 2026-10-09 (Figma work, phase 5B-1):** (1) the focus ring is `forest` on light backgrounds and `paper` on a
  `forest` background (class `on-dark`), both well over 3:1; (2) `lucide-react`, exact version, one icon per import,
  decorative and always beside a label; (3) the card has no hours line until the backend PR above; (4) small text and links
  use `forest`, because the old green `pine` on `paper` was 4.4:1.
- **Decided on 2026-10-10 (colour change):** the green palette became blue. `forest` and `pine` are `#1B6F93`, `pine-dark`
  `#134F6A` is for hover and press, `accent` `#1A9FD2` is decoration only (the line under the header; 3:1 on white, so
  never behind text). Open, closed, amber and emergency colours, `paper`, `ink`, `ink-soft` and `line` did not change; the
  two light tints became light blues. The token names `forest` and `pine` were kept so no component had to change. Main
  blue is 5.6:1 on white and 5.1:1 on `paper`, so it now passes for small text on both.
- **`npm audit` in the frontend shows 11 findings (2 critical, 7 high, 2 moderate), the same before and after phase 5B-1's
  test packages (checked 2026-10-09):** the critical ones are `vitest` and `tinypool` (dev-only test runner; the fix is
  vitest 5, a major upgrade); the high ones are the `eslint-config-next` chain (`braces`, `micromatch`, `fast-glob`; dev-only),
  `postcss` inside `next`, and `sharp` (libvips CVEs; used by Next's image optimisation, which we do not use yet); `next`
  itself is moderate (the suggested fix is Next 16, a major upgrade, and `next` is pinned on purpose since React2Shell).
  None blocks the pilot. Review before launch (roadmap 13c or 14d) and plan the vitest 5 and Next upgrades as their own chores.
- **npm 11 install-scripts warning (Node 24 chore):** with Node 24 (npm 11.19) `npm install` warns that the install
  scripts of `esbuild`, `sharp` and `unrs-resolver` are "not yet covered by allowScripts" and suggests
  `npm install-scripts approve <package>`. Nothing is blocked today (lint, typecheck, tests and `next build` all pass).
  Watch for the day npm enforces it; then approve those three packages in `package.json`.
- **Node.js versions (check the schedule each autumn):** Node 20, which we run (frontend Dockerfile, `netlify.toml`, the
  frontend CI), reached end of life on 2026-04-30 (official [release schedule](https://github.com/nodejs/Release/blob/main/schedule.json),
  checked 2026-10-09). A chore moves the frontend to Node 24 (Active LTS until 2026-10-20, Maintenance LTS until
  2028-04-30). Node 22 ends 2027-04-30. Node 26 becomes LTS on 2026-10-28: move to it in 2027, well before 2028-04-30.
  Done after the Node 24 chore (PR #12, 2026-10-09): Netlify's deploy log shows Node 24.x and no `NODE_VERSION`
  override is set in the dashboard.
- **After the Render upgrade (phase 14d), results without JavaScript:** phase 5B-1 loads search results in the browser
  (45 s limit, because the free API takes up to a minute to wake and Netlify gives up on a server page after about
  30 s). That needs JavaScript, and Opera Mini's extreme mode, common in Nigeria, runs very little of it. NFR-04 names
  Opera Mini, while the PRD and the UI spec say nothing about no-JavaScript. When the API no longer sleeps, revisit
  server rendering for `/search` (the Find page search box is already a plain form, so it reaches `/search`).
- **Before the Render upgrade (phase 14d), position in Render's request logs:** the documentation says a Pro
  workspace or higher also keeps HTTP request logs with the "Requested URL", with no setting to redact it, and it does
  not say whether the query string is included ([Render logging](https://render.com/docs/logging)). Our own access log
  redacts `lat` and `lng` (phase 5B-0), but this one is Render's. Check what it holds before upgrading. If it holds the
  position, send it another way (for example in a POST body) and update the api-spec.
- **Phase 14d, release criteria:** the PRD asks for all Must requirements to pass on a low-cost Android phone on 3G.
  Phase 5B-1 gets an early check on the owner's own Android phone (deploy preview); the full check stays here.
- **Phase 5B, the Find page (5d):** offer category buttons (Hospitals, Clinics, Pharmacies, Maternity, Labs, as in
  FR-01) and nearby suggestions (for example the closest open pharmacy and the closest open 24-hour facility, from
  `GET /search` with the visitor's location), so a visitor can start without typing. Typing is hard on a phone and
  the search is tolerant of typos, but not of every typo (see the next item).
- **Search, typos in very short words (decide with real search logs):** a typo in a word of 3 to 5 letters can drop
  below the match line (uwni, hors, nigth; the scores are in the search `requirements.md`). A lower threshold cannot fix
  it without false matches ("pharaoh" scores the same as "nigth"). An edit-distance check per word (`levenshtein()` in
  the PostgreSQL `fuzzystrmatch` extension) would, but it is a new extension, so it needs the owner's approval.
- **Search, if listings grow into the thousands (after launch):** `search_service` computes distance and open-now in
  Python over every published listing that passes the SQL filters, and the `q` match scans the published listings
  with `word_similarity()` (no index). Add a bounding-box pre-filter or move distance into SQL, switch `q` to the `<%`
  operator with GIN `gin_trgm_ops` indexes on `listings.name` and `services.name`, and re-time `GET /search`
  (NFR-02: under 1 second).
- **Phase 9a, reports:** when a report is created, set `reporter_key = hash_reporter_key(phone or client IP)` (built in
  phase 5A). Never store the raw IP.
- **Phase 11a, resolving a report:** clear `reporter_key` as well as `reporter_phone` (NDPA; api-spec `PATCH` resolve rule).
- **Before launch, Render free plans (roadmap phases 14b and 14d):** the free API sleeps after 15 minutes idle (about
  a minute to wake). The free database expires 30 days after creation, about **2026-11-07** (confirm the exact date in
  the Render dashboard; Render allows 14 more days to upgrade, then deletes it) and has no backups. Upgrade both
  before launch. If the database lapses before then, recreate it from `render.yaml` and the data is only demo data.
- **Proxy count, recheck if Render changes:** `TRUSTED_PROXY_COUNT=3` on Render (client, Cloudflare, Render load
  balancer). Measured on 2026-10-08; see decision 5 in the phase 4 requirements. Recount after adding a custom domain
  or if Render changes its proxies, with a temporary endpoint that echoes `X-Forwarded-For`, and remove it afterwards.
- **Before the first real SMS (Termii):** activate the DND route on the account, get the sender ID approved, and set
  `TERMII_BASE_URL` from the dashboard (Settings, API token tab). Termii has no sandbox, so every real send costs
  balance. Also decide at the Render deploy whether to add a startup warning (lifespan) when no key is set; for now
  each no-key send logs a WARNING.
- **Auth, if the risk matters:** a challenge token plus its code can be used again until the token expires (5
  minutes), because the code is never stored (api-spec section 4). A one-time-use rule would need a small store.
  Also: Swagger's Authorize button does not work with our two-step login (`OAuth2PasswordBearer` only reads the
  header); test the API with the `Authorization: Bearer` header.
- **Rate limiter, if traffic grows:** sweep old IPs. An IP that stops calling keeps its list of timestamps in memory
  until it calls again (`core/rate_limit.py`).
- **CI path filters:** seen in PR #5: `Frontend CI` did not run on backend-only commits, so that direction works. Once
  the PR also changed `frontend/`, both workflows ran on every push, because a pull request is judged on its whole
  diff, not one commit. To see `Backend CI` skipped, use a pull request that changes only `frontend/`.
- **Brand renamed to SwiftHealth Route; check the CAC business name search before buying a domain or printing anything.** (Owner,
  2026-10-13.) The name is in one file, `frontend/src/config/brand.ts`; SwiftRescue stays as the emergency name. The repo, the
  folders and the Netlify address keep their old names.
- **Consider the layout check in CI (later).** `frontend/tests/end-to-end/home-layout.spec.ts` (Playwright, `npm run test:e2e`)
  measures the home page in a real browser at 320 to 1100 px. It is not in the pull request check on purpose (owner, 2026-10-13):
  the check has no browser, and adding one means an install step and a built site to open (slower). Revisit when more screens
  have a layout worth guarding; the Alpine container needs `apk add chromium` and `CHROMIUM_PATH=/usr/bin/chromium`.
- **Home page Total Blocking Time is red (1,300 ms): investigate after the listing page.** (Owner, 2026-10-13.) PR #21 is merged. On the
  live site (Incognito, Lighthouse mobile) the scores are Performance 73 (the preview before the speed work: 37), Accessibility 100,
  Best Practices 100, SEO 92; FCP 1.1 s, LCP 1.4 s, CLS 0.004, Speed Index 4.2 s, Total Blocking Time 1,300 ms (red). The record is
  in `specs/2026-10-11-home-redesign/validation.md`. Lighthouse's clues to follow: JavaScript execution 1.9 s; main-thread work
  4.7 s; 15 long tasks; forced reflow; document request latency (about 540 ms of estimated savings); legacy JavaScript 11 KiB; and
  the "Powered by Netlify" badge on the live site. About 101 kB of the JavaScript is the Next.js and React runtime, which cannot be
  removed. Needs its own small spec and a before and after measurement.
- **Later feature: privacy-friendly usage tracking (owner, 2026-10-13).** Three parts. (1) Visit analytics with a cookie-free
  tool: compare Cloudflare Web Analytics, GoatCounter and Umami; no Google Analytics. (2) Our own daily counts of searches and of
  Call, WhatsApp and Directions taps per listing, with no IP address, no location and no personal data. (3) Update the Privacy page
  to explain all of it. What the PRD already says: `specs/prd.md`, section "Analytics", asks for anonymous events only (searches
  with term, category and filters, listing views, Call taps, Directions taps, Emergency page opens, emergency list shares, reports
  submitted) and the roadmap lists it as phase 14c. It does not cover WhatsApp taps (FR-47 came later), a visit analytics tool, daily
  counts per listing, or what the Privacy page must say; and storing a search term can hold personal data, so decide in the spec
  whether to keep the term at all (NFR-07). Needs its own spec, tests first.
- **A new home page photo needs a new file name (owner's performance fix, 2026-10-13).** `netlify.toml` now caches `/images/*` for a
  year (`immutable`), because the photos were revalidated on every visit and Lighthouse scored 37 on mobile. A photo replaced under
  the same name would stay in visitors' caches, so change the `target` in `scripts/optimize-home-images.mjs` and the `src` in
  `src/config/home.ts` together. Check the header on the next deploy preview (`curl -I`).
- **The layout checks depend on the browser's fallback font (seen 2026-10-13).** `tests/end-to-end/home-layout.spec.ts` passes in the
  Alpine container's Chromium, but with Ubuntu's Chromium and DejaVu Sans (a wide font) the header is up to 27 px too wide between
  344 and 370 px and the 320 x 568 first screen needs 21 px more. The old build fails the same way, so it is the font, not a change.
  Real phones use their own system font (narrower). Decide later whether to design for the wider font (for example show the word
  "SwiftHealth" only from 372 px) or to pin a font in the check.
- **Phase 10 idea: photos on the facility owner sign-up and the login page (owner, 2026-10-13).** On the owner sign-up page, show a
  photo that matches the facility type the owner picks: Hospital = `hospital.jpg`, Clinic = `clinic.jpg`, Maternity =
  `maternity.jpg`, Pharmacy = `pharmacy.jpg`, Laboratory = `laboratory.jpg` (originals in
  `/mnt/c/Users/Lilian/Desktop/IMAGES/`). The photo swaps when the type changes and only the chosen photo downloads (one `<img>`
  whose `src` changes, not five loaded and hidden). The login page shows `hero.jpg`. None of these photos appear on the home page,
  and the Magnific credit appears on those pages only. Needs its own spec, tests first, and the licence terms of the Magnific
  photos checked first (NFR-13); WebP files made with `scripts/optimize-home-images.mjs`-style budgets.
- **Next feature after the listing page: "Find by type and home page wording" (owner, 2026-10-13). Not started: it needs its own spec in
  `specs/<date>-find-by-type/`, tests first, and a go-ahead on the plan.** Roadmap entry: "Find by type and home page wording".
  1. Rename the home section "Browse by type" to **"Find by type"**.
  2. A type tile shows **only** that type. Checked on 2026-10-13: the tile goes to `/search?category=<slug>` and the API filters on the exact
     slug, so no other type comes back (live check: hospital 4, clinic 2, maternity 2, pharmacy 6, laboratory 2, each only its own type).
  3. **A type word typed in the search box applies that type's filter.** Proposed words for Nigerian usage (all lower case, plural and
     spacing ignored; the whole query must be the type word, so "pharmacy ogui" stays a text search): *pharmacy*: pharmacy, pharmacies, chemist,
     chemists, chemist shop, drug store, drugstore, patent medicine, PPMV; *hospital*: hospital, hospitals, general hospital, teaching
     hospital, medical centre, medical center; *clinic*: clinic, clinics, health centre, health center, PHC, primary health centre,
     dispensary; *maternity*: maternity, maternity home, maternity centre, maternity center, midwife; *laboratory*: lab, labs, laboratory,
     laboratories, medical lab, diagnostic, diagnostics, diagnostic centre, diagnostic center. Not mapped on purpose: ambulance, police,
     fire and blood (they belong to SwiftRescue and the Blood page). The owner reviews the list; typos stay with the existing fuzzy text search.
  4. **A slim photo banner for the chosen type** at the top of the results, with a heading like "Pharmacies near you". Photos: the owner's
     Magnific files in `/mnt/c/Users/Lilian/Desktop/IMAGES/` (`hospital.jpg`, `clinic.jpg`, `maternity.jpg`, `pharmacy.jpg`,
     `laboratory.jpg`), converted with `scripts/optimize-home-images.mjs` to about 40 KB or less each, with alt text; only the chosen type's photo
     downloads. The required **"Designed by Magnific" credit with its link** shows under the banner, on the search page only, and only while a
     Magnific photo is showing. The photo list and the credit live in **one config file**, so Unsplash photos can replace them later; a replaced
     photo gets a **new file name** (the photos are cached for a year, `netlify.toml`). No readable brand names and no identifiable patients.
  5. **"Why" section:** the heading "Benefits" becomes **"Why SwiftHealth Route"** (the name comes from `config/brand.ts`) and the four cards read:
     "Verified information" / "Our team checks each listing before it goes live and re-checks it regularly."; "See what's open now" / "Find places
     open right now, including late-night and 24-hour services."; "Built for mobile data" / "Light pages built for a weak connection.";
     "Your location stays private" / "Your location is used only to show places near you. We don't store it." (Checked: the position is kept in the
     browser tab and sent to the API for each search; the API does not store it and scrubs `lat` and `lng` from its logs, api-spec "Privacy (NFR-07)".)
  6. **Facility owners section:** heading "Own or manage a healthcare facility?"; text "List your facility on SwiftHealth Route so people nearby can
     find you, call you and get directions. Listing is free during our launch, and every listing is checked by our team before it goes live."; the
     button stays "List your facility" (the page behind it is still "Coming soon", phase 10). "Free during launch" is the owner's decision, now in
     `specs/prd.md` (Open questions).
  7. **Hero and Overview:** hero heading "Find care that's open now, near you."; hero text "Verified hospitals, clinics, pharmacies and labs, with phone
     numbers, opening hours and directions."; the button "Find care near me" and the small line "Free to use · No sign-up needed" stay. Overview
     heading "What is SwiftHealth Route?"; text "SwiftHealth Route is a healthcare directory built for Nigeria. Find hospitals, clinics, maternity homes,
     pharmacies and laboratories near you, see which are open right now, and call or get directions in one tap. Our team checks every listing before it
     goes live and re-checks it regularly." ("Built for Nigeria" stays, the owner's decision.) The page's meta description is updated to match.
  8. **Empty search results (today and proposed).** Today `SearchStatus` says "No matches. Try removing a filter or widening the distance." (and the
     nearby cards say "No open pharmacy found nearby. Try a wider search."). Proposed: keep that first line when a filter is on, say "No places found
     near you yet." when there is no filter, and add a second line in both cases: **"We're starting in Enugu and adding more places soon."** (the search
     page may name the city; the home page does not). The owner confirms the exact words in the spec.
  9. Check that every new headline, line and card fits at **320, 360 and 768 px** without being cut off (the real-browser check).
  10. **The "Near you" section on `/find` must not show the same place twice (owner, 2026-10-13).** Seen on the live site: "DEMO – Always Open
     Pharmacy" was both "Closest open pharmacy" and "Closest open 24-hour place". Today the two cards in `NearbySuggestions` load on their own, each
     asking for `limit=1`, so neither knows what the other shows. Wanted: when both slots would show the same listing, the second slot shows the **next closest
     different 24-hour place** (so that card asks for `limit=2` and takes the first listing that is not the pharmacy card's; or the parent compares the two
     answers); if there is no other 24-hour place, show **one card with both labels** ("Closest open pharmacy" and "Closest open 24-hour place", spanning
     both columns) instead of two identical cards. Tests first: (a) two different answers show two cards; (b) the same listing first in both shows the
     second 24-hour listing in the second slot; (c) the same listing and no second one shows a single card with both labels; (d) the second card never
     shows a listing that the first one shows; (e) a failure or an empty answer in one card does not change the other; no position in any address.
  11. **A chosen type must be clearly visible on the results page (owner, 2026-10-14).** The owner tested the live site: tapping the Pharmacy tile
     correctly showed only the 2 pharmacies, but the page said only "Search results", so it looked unfiltered. Wanted, whenever a type is chosen
     (from a tile or from a typed type word, point 3): (a) the heading changes from "Search results" to the type's own words, e.g. **"Pharmacies near
     you"** (with the photo banner of point 4); (b) a visible **"Pharmacy ✕" chip under the search box** shows the active filter, and one tap on it
     removes the filter (the page then goes back to "Search results" and all types). The chip is at least 48 px high with 16 px text, the ✕ is an
     icon hidden from screen readers and the chip's name says "Remove the Pharmacy filter"; the heading and the chip come from the same category
     in the address, so they never disagree. Tests first: tile -> heading and chip; typed word -> the same; chip tap -> filter gone, heading back
     to "Search results", the other filters (open now, distance, area) kept; no chip and the plain heading when no type is chosen; the chip's
     position is not in any address beyond what the search already sends (NFR-07). Real-browser check at 320, 360 and 768 px.
- **Overview sentence to add back, and one to change (owner, 2026-10-13).** (a) The sentence "If a number doesn't work, you can tell us so we can fix it."
  was taken out of the Overview because the report form is still a "Coming soon" page: add it back when the report form is live (roadmap **Phase 9a**,
  `POST /reports` and the form, FR-20 and FR-21). (b) When the WhatsApp button is live (the listing page), change "call or get directions in one tap" in
  the Overview to "call, chat on WhatsApp or get directions in one tap".
- **Decide pricing (owner, 2026-10-13).** Basic listing free during launch. Paying never buys the verified badge. Featured listings follow FR-44 and FR-45:
  at most one, clearly labelled Sponsored, never in SwiftRescue (FR-19). Possible paid extras later: more photos, a monthly call and visit report. (The
  free-during-launch part is recorded in `specs/prd.md`, Open questions. The featured price is still the open placeholder of ₦5,000.00 per month.)
- **Before public launch: remove or clearly mark the demo listings, so every live "verified" claim is true (owner, 2026-10-13).** Already planned in part:
  roadmap **14d** removes them at the end (`REMOVE_DEMO_LISTINGS=true` on Render, redeploy, confirm `/search?q=DEMO` returns 0, set it back to `false`).
  Not planned: anything before then. The live site shows 4 fictional demo listings today next to the home page's words about verified listings, so
  either remove them earlier or add a visible "Demo" mark to every demo listing (card, page and map popup) until 14d. Decide with the owner.
- **Replace two Magnific photos before the "Find by type" feature (owner, 2026-10-13).** `hospital.jpg` shows a patient in a hospital bed with her face clearly
  visible (and is a tall 9:16 portrait, hard to crop into a slim banner); `maternity.jpg` is a doctor consultation with a pill bottle, not a maternity scene.
  `pharmacy.jpg` is optional to replace (its hands look slightly unnatural, so it may be AI-generated). `clinic.jpg` and `laboratory.jpg` are fine
  (no patients, no readable brand names at preview size). A replacement gets a new file name.
- **Idea: a small WhatsApp button on the search result cards (owner, 2026-10-13).** Not in the listing page phase. It needs the API to say whether a
  card's primary number is a WhatsApp number (`primary_phone_is_whatsapp` on `ListingSummary`, filled by the query that fills `primary_phone`; search, emergency
  and blood results share the shape) and an icon-only 48 px button after Call and Directions (the official glyph, accessible name "WhatsApp <name>").
  The map popups would stay as they are. Needs its own small phase, backend and frontend, tests first.

## Day 1 — 2026-10-04
- **Built:** Repo skeleton, Docker Compose, spike for open-now + nearest search.
- **Broke / fixed:** [ ]
- **Learned:** [ ]
- **AI use:** [ ]
- **Tomorrow:** [ ]

## Day 2 — 2026-10-05
- **Built:** First Alembic migration for all 9 tables (proved with upgrade, downgrade, upgrade).
  Demo seed data: 12 categories, 4 users (one per role), 30 fictional listings across all 10 areas,
  with phones, hours, services, blood groups, verification checks and audit entries. Safe to run twice.
  4 repository files (category, user, listing, audit). 28 tests passing, ruff clean.
- **Specs:** Fixed FR-33 label on publish; set re-check cycles (14 / 45 days); removed "groups needed"
  from donation centres (moved to Phase 3).
- **Broke / fixed:** passlib crashed with bcrypt 5.0.0; fixed by pinning bcrypt 4.0.1.
  Alembic couldn't import the app; fixed with prepend_sys_path in alembic.ini.
- **Learned:** [write this in your own words, e.g. what a migration is, why the seed never overwrites]
- **AI use:** Claude Code planned and wrote the migration, seed, repositories and tests;
  I reviewed the plan, chose the options, and approved each file.
- **Tomorrow:** Auth and roles (login, one-time code, JWT, role and ownership checks).

## Day 5 — 2026-10-08
- **Built:** Phase 3. Passwords are hashed with pwdlib (Argon2id) instead of passlib and bcrypt. Dev database reset
  with Alembic and re-seeded. 212 tests passing with `-W error`, ruff clean, no `crypt` warning.
- **Broke / fixed:** Smoke test first failed with 401 because my script used the test-fixture email domain, not the
  seed one. Not a code bug.
- **Learned:** [write this in your own words, e.g. why pwdlib raises on an unknown hash instead of returning False]
- **AI use:** Claude Code checked the pwdlib behaviour in the container, wrote the tests first, then the change;
  I approved the spec and the go-ahead for all three tasks.
- Tested login myself with curl: login → code from console → verify-code → /auth/me all worked;
  no token, wrong password, unknown email and wrong code all gave 401 as expected.
- **Security (Phase 4):** Netlify blocked the first deploy for CVE-2025-55182 (React2Shell). Upgraded `next` to
  15.5.27 and `react` and `react-dom` to 19.1.9, pinned exactly. 19.1.4 was not enough, because it is incomplete for
  CVE-2025-55183 and CVE-2025-55184. Advisories: [Next.js](https://nextjs.org/blog/CVE-2025-66478),
  [React](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components),
  [Next.js, December 11](https://nextjs.org/blog/security-update-2025-12-11),
  [React, December 11](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components).
  Details are in the Phase 4 `requirements.md`.
- **Phase 4:** API live on Render (https://swifthealth-api.onrender.com), site live on Netlify
  (https://swifthealth-ng.netlify.app), home page says "connected". Added the database address rewrite
  (`postgresql://` to `postgresql+psycopg://`) and `render.yaml` and `netlify.toml`. `TRUSTED_PROXY_COUNT` is 3,
  measured with a temporary endpoint (removed). The login rate limit held in production against forged
  `X-Forwarded-For` headers (10 attempts 401, the 11th 429). Production has no users, so a full login was not tested there.
- **Phase 4, problems:** the free-database limit stopped the first Blueprint run; `CORS_ORIGINS` was then missing
  because Render asks for `sync: false` values only at first creation (now a plain value in `render.yaml`); Netlify
  showed "Runtime: Not set" (now declared in `netlify.toml`; proven by redeploying with the dashboard overrides cleared).
- **Phase 4, cold start:** the first test failed. After 16 idle minutes the first Netlify visit returned an
  "Inactivity Timeout" error page after 31 s, because `getHealth()` had no time limit while the free Render API wakes
  (about a minute). Fixed with an 8-second limit (tests first). Second test after 21+ idle minutes: the first visit took
  11.7 s and showed "not reachable" on a normal page; the next visit showed "connected".
- **Tomorrow:** Phase 5, search (5a: `hours.py`, open now in Africa/Lagos time).

## Day 6 — 2026-10-09
- **Built:** Phase 5A, the search backend (draft PR #7). `hours.py` (open now in Lagos time, hours past midnight, 24-hour
  listings), `search_service` and `search_repository` (nearest first, overdue listings labelled `verification_due`,
  listings reported "not working" by 2 different reporters in 7 days hidden, misspelling-tolerant `q` with `pg_trgm`),
  `GET /search`. Also: `REPORTER_KEY_SECRET` and the keyed `hash_reporter_key` (so we never store a raw IP or phone to
  count reporters), PostgreSQL 18 locally and in CI like Render, flag-driven DEMO listings for production with an
  exact-slug cleanup, capitalised router tags, and a word rule for queries with two typos. 485 tests passing with
  `-W error` (242 before), ruff clean, CI green on `postgres:18`.
- **Timing (NFR-02):** `GET /search` on the 28 seed listings, 20 requests: median 25 ms, slowest 150 ms.
- **Broke / fixed:** my first two DEMO names produced the same slugs as the main seed, so the cleanup would have deleted
  main-seed listings in the dev database (a test caught it; renamed). "Nigt Pharmcy" scored 0.50 and found nothing:
  lowering the threshold added false matches ("banana" 0 to 4 listings), matching each word alone lost queries that
  worked, matching the whole query or every word fixed it with no false matches. One commit went in with a lint error
  and was amended before pushing. Claude edited files with `sed` and a Python script twice, against the rule to use
  the Edit tool; corrected after it was pointed out. Later the same day a small commit (the `search_text` rename,
  `ef9c010`) was pushed straight to `main` instead of a branch, because the working copy had been switched to `main`
  before the commit and the branch was not checked. The change was tested and CI stayed green, so it was left.
  Fixed for the future by a `pre-push` hook that refuses pushes to `main` (`scripts/hooks/pre-push`, install with
  `git config core.hooksPath scripts/hooks`) and a rule to check `git branch --show-current` before every commit and push.
- **Still open:** typos in very short words (3 to 5 letters) are not matched, see "To do later". The owner does the
  Render steps after the merge (`validation.md`, "After the merge").
- **Phase 5B-0 (draft PR, `GET /meta`):** `GET /meta` (areas, categories, services, blood groups, report reasons), the
  access log shows `lat=redacted&lng=redacted` (uvicorn was logging the full position), and one shared rule for "the same
  service" so that picking `X-ray` from `/meta` also finds `Xray` and ` x-ray ` (the old `service` filter missed them; tests
  written first showed it). 627 tests passing. The Node 20 end of life (2026-04-30) is a separate chore before 5B-1.
- **Learned:** [write this in your own words, e.g. what a trigram is and why a score of 0.50 is not enough]
- **AI use:** Claude Code compared the options with real scores, wrote the tests first and the code; I chose the
  options, approved the plan and decided what to keep out of scope.

- To do (after building): rename project to "SwiftHealth Route" and update the tagline (currently "Emergency, Hospital & Pharmacy Finder"). Before renaming, check that the name is free on Play Store and App Store, plus the domain, social handles and CAC business name. Then update app title, README, specs, pitch decks, project docs and the Netlify/Render names.

- To do: lint-on-edit hook uses the wrong ESLint for frontend files (no node_modules on host, so npx fetches ESLint 10, which can't read our config). Real lint (npm run lint in Docker, plus Frontend CI) still works. Fix later, probably by running ESLint inside the frontend container.

- Proposed (not final): product name "SwiftHealth Route", tagline "Hospitals, pharmacies and emergency help, open near you." The rename is pending a CAC business-name check and a trademark check (together with the Play Store, App Store, domain and social handle checks above). Do not rename anything until those checks pass; then apply it in the rename chore after 5B-1.

- **In progress (2026-10-11): the home page redesign with photos**, branch `feature/home-redesign`, folder `specs/2026-10-11-home-redesign/`: the hero, the category tiles, the new header and footer. Simplified on 2026-10-12 after the owner's review of the preview: two photos only (the hero and the owner photo), icon tiles instead of photo cards, no SwiftRescue photo band, no About part, no red button in the hero, and no city named on the page. Still to do, in phase 7: pictures on `/emergency` itself. They must not slow `/emergency`, which has to work offline (NFR-03).
- **Before launch: keep a record of where the home page photos come from (owner, 2026-10-12).** The first photos came from Magnific's free collection (ten were downloaded, two used) and the footer credited Magnific. On 2026-10-12 the owner replaced them with Unsplash photos and removed the credit. After a second round the page uses `hero3.jpg` (hero: stethoscope and blood pressure gauge) and `hero4.jpg` (facility owners: health worker with a blister pack); `owner2.jpg` and the first `hero4` crop are no longer used. The owner removed the credit, because the owner states that these photos need no attribution. Keep the page of each photo (the link, the photographer's name, the date) in one place, and have the licence terms of both sources checked with the rest of the legal review (NFR-13). We do not state here what either licence allows. The Magnific files are no longer on the site.
- **Home page buttons and "Coming soon" pages (2026-10-11; the home page has only the header's red button since 2026-10-12: "Emergency help" and "Open SwiftRescue" were removed).** The red header button goes to `/emergency`. The owner added a minimal page there in the home redesign (a red "Call 112" button and one line), until the full phase 7 page; 112 was checked against NCC pages (see `specs/2026-10-11-home-redesign/requirements.md`, decision 18). "List your facility" goes to `/list-your-facility` (phase 10) and "About" is phase 13b: both still say "Coming soon". The minimal page also carries the sentence of FR-26 ("SwiftRescue connects you to emergency contacts; it does not dispatch or guarantee an emergency response. In danger, call 112."), added at the owner's request (2026-10-12).

## Day 7 — 2026-10-10
- **Built:** Phase 5B-1, the Find page (`/find`) and the results page (`/search`), frontend only (branch
  `feature/search-frontend`). Search box, category shortcuts, "Open now near me", two "near you" cards that load on their
  own, `/blood` "Coming soon"; on `/search` the filters sheet (a native `<dialog>`), Load more, and the slow-API states
  (skeleton, "The service is waking up" after 5 s, error and Retry after 45 s). Location is asked only after a tap, once per
  tab, kept in `sessionStorage` rounded to 3 decimals and never put in an address. Also: `lucide-react` icons (decorative,
  beside text), the focus ring (forest, or paper on the forest header), and the blue palette (owner's colour change).
  342 tests passing, lint and typecheck clean. First Load JS: `/find` 114 kB, `/search` 115 kB.
- **Broke / fixed:** a pasted colour-change request arrived inside pasted text twice; Claude did not apply it until the
  owner typed the instruction in plain text. A test that passed alone timed out in the full run (slow laptop in Docker), so
  the test limit is now 20 s. A button test matched `bg-pine` inside `hover:bg-pine-50`; the pattern was made exact.
- **Still open:** the DevTools and phone smoke tests (owner), the small backend PR for "Closes 9:00 PM", the rename to
  "SwiftHealth Route" (pending CAC and trademark checks), the photo refresh of the home page (after 5B-2).
- **Learned:** [write this in your own words]
- **AI use:** Claude Code wrote the tests first and then the code for each task; I chose the design rules, approved the
  plan, the icon package and the colour change, and decided what to keep out of scope.

## Day 8 — 2026-10-11
- **Built:** Phase 5B-2, the map view on `/search` (FR-07), frontend only (branch `feature/map-view`, **done: merged as PR
  #19, `d4c1a94`**). `?view=map` and a
  List | Map toggle that adds a history entry (Back from the map returns to the list); plain Leaflet with OpenStreetMap
  tiles and the credit; a blue pin drawn in code; a dark dot for the visitor's position; popups with Call and Directions;
  pins reachable with the keyboard. The list stays the default and complete, and the address never holds a position,
  centre or zoom (NFR-07). `leaflet` 1.9.4 and `@types/leaflet` 1.9.22 are pinned exactly and `react-leaflet` is removed (it
  was already in `package.json` with `^` ranges, unused). 507 tests passing (100 new), lint and typecheck clean. First Load
  JS: `/search` 118 kB (115 kB before); the map is a separate 148 kB chunk, loaded only when it is shown.
- **Broke / fixed:** the first default map centre Claude picked was not in central Enugu; the owner gave the Holy Ghost
  Cathedral (6.4361, 7.4881) and it is now set, with a test. A test could not open a popup with Enter, because Leaflet reads the
  deprecated `keyCode` and the test tool does not send it, so Enter and Space are handled on `keydown`. Leaflet's own styles
  would turn the white text of the Call button blue and start at 12 px text; `map.css` overrides them (checked as rule text
  only: jsdom draws no CSS, so the smoke test must look at it).
- **Smoke test (owner, preview of PR #19, laptop and Honor phone): all passed.** Both pins framed together, popups with Call
  (white on blue) and Directions, large zoom and close buttons, readable credit, Back and Forward between List and Map, keyboard
  Tab, Enter and Esc on the pins, the map files loaded only after tapping Map (laptop, Chrome throttled to 3G, cache disabled,
  on Wi-Fi through the phone's hotspot), 320 px with no page-level sideways scroll; on the phone (mobile data) pinch zoom, Call
  opens the dialler, Directions opens Google Maps. The backend `CORS_ORIGINS` was changed for this test and is back to the live
  site only.
- **Still open:** the three reminders in "To do later" (Search this area, the tile provider review, tiles on the Privacy
  page); the home page photo refresh is now free to start.
- **Learned:** Never trust a coordinate without checking it: the default map centre was 6 km off, and I caught it by checking it in Google Maps and picking Holy Ghost Cathedral myself. I also learned that a big library like a map can load only when someone taps for it, so people on slow data who just want the list don't pay for it.
- **AI use:** Claude Code wrote the spec first, then the tests and the code for each task; I chose the pin and dot design,
  the keyboard rules, the history entry for the toggle and the default centre, and decided what to keep out of scope.
- **Tomorrow:** phase 6, the listing page (`GET /listings/{slug}` and the Call and Directions page, US-02, US-03, US-06,
  US-07), or the home page photo refresh; the owner chooses.

## Day 8, part 2 — 2026-10-11
- **Built:** Phase 6a, `GET /listings/{slug}` (backend only; branch `feature/listing-detail-api`, **done: merged as PR #20,
  `6fdb5fa`**). A published listing with its phones (the primary first), 7 opening-hours entries (`HH:MM`; a day with no hours
  is closed), services with fees as 2-decimal strings, the fixed disclaimer, `hours_note`, `is_open_now` and
  `verification_due`; anything not published and any unknown slug give the same 404 "Listing not found". New field
  `recently_reported_not_working`: a listing that 2 different reporters called "not working" in 7 days is hidden from search
  but still opens from its link, so the page can warn. New column `phone_numbers.is_whatsapp` (default false, with a migration
  that is safe on filled tables; the seed and demo data never set it), and a new requirement FR-47 (Should), the WhatsApp
  button of phase 6b. One shared `is_verification_due` rule for search and the listing page. 769 backend tests passing, ruff
  clean; Backend CI green.
- **Broke / fixed:** the first full-suite run never started, because I wrote its output to a scratch folder of an old session
  that no longer existed. Two test runs at the same time shared the test database, which caused 2 failures and very slow runs;
  from then on only one test process at a time (the same tests passed alone). Docker Desktop's WSL integration was off for a
  while, so no test could run until the owner turned it back on. WhatsApp was first written into FR-10 and then moved to its own
  FR-47 on the owner's instruction (FR-10 has its original wording). An older test said the categories revision was the only
  migration head; it now checks that the history has one head.
- **Production (owner):** Render ran the migration; `/listings/<slug>` returned the listing with `is_whatsapp` false on every
  phone, 7 `opening_hours` entries, `recently_reported_not_working` false and an `hours_note`; `/listings/does-not-exist`
  returned 404 "Listing not found"; the search total is still 4; `/docs` lists `GET /listings/{slug}`.
- **Still open:** phase 6b, the listing page (the owner's decisions for it are in
  `specs/2026-10-11-listing-detail-api/requirements.md`); the "Search this area", tile provider and Privacy page reminders; the
  `wa.me` link format still has to be checked on WhatsApp's own help page before 6b builds it; server-rendered listing pages
  for Google (after the Render upgrade).
- **Learned:** When tests fail for strange reasons, check the setup first. Docker had switched off, and two test runs at once broke each other, but the code was fine.
- **AI use:** Claude Code wrote the spec first, then the tests and the code for each task; I chose the WhatsApp flag and its
  rules (default false, never set by the seed), FR-47 as its own requirement, that a reported listing stays reachable with a
  warning, the one shared rule for "verification due", and the decisions for the page (12-hour times, fee wording, the
  notice, the new Directions icon).
- **Tomorrow:** phase 6b, the listing page (`feature/listing-page`): spec first, then tests, then the page.

## Day 9 — 2026-10-13 and 2026-10-14
- **Built:**
  - **PR #21 (home page redesign) merged and live.** Lighthouse mobile on the live site, from the owner's own run: Performance 73, Accessibility 100,
    Best Practices 100, SEO 92 (the preview before the speed work: 37).
  - **Rename to SwiftHealth Route, with a new logo.** The name lives in one file, `frontend/src/config/brand.ts`; the repo, the folders and the Netlify
    address keep the old name.
  - **Docker as user 1000 for the frontend and the backend** (`5d907fa`, `95f4380`), so files the containers write belong to the owner, not root. The
    backend setting is in `docker-compose.yml` only, because Render builds the backend Dockerfile.
  - **The listing page, phase 6b (draft PR #22, branch `feature/listing-page`).** Call and WhatsApp (white button, the owner's glyph, only for numbers
    marked as WhatsApp), the Directions road-sign icon at 24 px, 12-hour hours with "Today", fees, the amber "reported" note, entrance photo, Share via
    WhatsApp and Copy link, and a friendly "Listing not found". After the owner's review: Call and WhatsApp the same 56 px height, phone numbers shown
    in local format (0803 123 4567) with the main number as a line under the buttons, the Verified badge fitting its content, "Ask for price" when a
    service has no fee, and the page's own JavaScript target set to 9 kB (8.58 kB built; First Load 115 kB). A local, development-only fictional
    fixture (`python -m seed.whatsapp_fixture`) shows the cases the demo data hides on purpose. 833 frontend and 790 backend tests passing; real-browser
    checks 23 of 23; Frontend CI and Backend CI green.
  - **The "Find by type and home page wording" plan is recorded** (this file, "To do later", items 1 to 11, and the roadmap), not built. The latest
    item: a chosen type must be clearly visible on the results page, with a "Pharmacies near you" heading and a removable "Pharmacy ✕" chip.
- **Broke / fixed:** the owner tested on the laptop with the repo on `main`, so the old code showed and the new work did not; checking the branch
  first fixed it. The browser-test libraries kept in the session scratch folder were gone the next day and had to be downloaded again. `gh pr edit`
  fails on this repo (a Projects classic warning), so the pull request text is changed through `gh api`. Pasted messages are not acted on until the
  owner types "yes, apply it".
- **Owner's checks (all passed, 2026-10-15):** Honor phone on the preview (diamond icon on the cards and the page, the main number line in local
  format, Copy link pastes only `/listing/<slug>`, Share via WhatsApp opens WhatsApp with the link, `/listing/nothing-here` shows "Listing not
  found", demo listings show no WhatsApp button as designed) and the laptop (WhatsApp in Option A beside Call at the same height, "Front desk · 0000
  000 0951", the compact Verified badge, "Ask for price", "Today", fee styles, amber note). The boxes of `specs/2026-10-13-listing-page/validation.md`
  and `plan.md` are ticked, except one box deferred to pre-launch: the WhatsApp brand terms (NFR-13), now in "Pre-launch checklist" at the top.
- **Production (owner, 2026-10-15): PR #22 is merged (`53ab2ca`) and live.** Checked on the live site, all passed: the diamond Directions icon on
  the search cards and listing pages, the main number line in local format, Copy link and Share via WhatsApp, the "SwiftHealth Route" disclaimer
  (after the Render redeploy), and `/listing/nothing-here` showing "Listing not found". The preview address was removed from `CORS_ORIGINS` on
  Render. Results are in `specs/2026-10-13-listing-page/validation.md`.
- **Still open:** the home page Total Blocking Time (1,300 ms); the WhatsApp brand terms (NFR-13) in "Pre-launch checklist".
- **Learned:** Before testing on my laptop, check which branch I'm on, because I was testing old code on main. Demo data can hide features on purpose (no WhatsApp on fake numbers). And always measure first: Lighthouse showed my photos were already small and the code was the slow part.
- **AI use:** Claude Code wrote the specs first, then the tests and the code; I chose the WhatsApp button's look, the local phone format, "Ask for
  price", the 9 kB target, the Find by type wording and the chip, and I checked the preview on my own phone.
- **Tomorrow:** the next feature, "Find by type and home page wording" (spec and plan first; branch `feature/find-by-type`).

## Day 10 — 2026-10-22 and 2026-10-23
- **Built (four pull requests merged, each spec first, tests first, then the code):**
  - **#37 SwiftRescue order.** Ambulance and Fire are always shown first, with "No contacts added yet. In danger, call 112." when empty. A "Need blood
    urgently?" link card goes to `/blood`. The 24-hour pharmacies are gone from the page, the API answer (`pharmacies_24h`) and the saved offline copy
    (FR-25 struck out of the PRD). Pharmacies are still found with search.
  - **#39 Blood banks only on `/blood`.** `GET /emergency` has six groups and no blood bank group; an older API answer or an older saved copy that still has
    one is ignored in one place (`lib/emergency/groups.ts`). I merged #39 by mistake into `feature/swiftrescue-order` instead of `main`, so it reached
    `main` through two more pull requests (#41 and #42); nothing was lost.
  - **#40 `/blood` works offline after one visit.** The service worker keeps `/emergency` and `/blood`; the page saves the last blood banks (without a
    position) and shows "Offline — showing saved blood banks from <date>". Checked in a real browser on a production build with the network off.
  - **#43 SwiftRescue groups.** New headings ("Fire service", "Hospital emergency (24 hours)", "Road accidents"), five groups always shown (Ambulance, Fire
    service, Police, Hospital emergency, Road accidents), Security and three new groups shown only with a contact (Disaster and flooding, Sexual and
    gender-based violence support, Mental health crisis support). One additive migration (`c3d71e9b5a20`): three new category rows, and the display names of
    three rows renamed (guarded, ids and slugs kept; the downgrade restores the names and deletes nothing). No phone number or contact was added: staff add
    them. The headings are also kept in the frontend by slug, so an old API answer or saved copy shows the new ones. Backend 1409 and frontend 1517 tests
    passing; real-browser checks 28 of 28; the migration was also run up, down and up on the local PostgreSQL.
  - **#38 (footer login link) was closed**: the login link moves to the header in the accounts work.
- **Broke / fixed:** I believed #37 and #38 were merged before they were (GitHub showed them open), so the order of the work was checked against GitHub
  each time. Pages built on a branch that was not `main` showed stale code in the development container until the branch was switched. The full test
  suite is slow when the laptop is busy: a few staff-page tests time out in a full run and pass alone, so a failure is re-run alone before it is believed.
- **Owner's checks (2026-10-23):** production `/emergency` looks right after #43.
- **Still open:** the Render database expires about 2026-11-07 (see "To do later"; since 2026-10-28 the API no longer uses it, decision D6); the home page photos (draft PR, `feature/home-photos`).
- **Learned:** A pull request stacked on another branch must be pointed at `main` before it is merged, or it only joins the other branch. Check what is
  really in `main` (`git log origin/main`) before saying a change is merged.
- **AI use:** Claude Code wrote the specs, the tests and the code for all four pull requests and ran the checks; I chose the order of the groups, the new
  names (also for the database rows), the three new groups, "no phone numbers added by the code", and the merge order, and I checked production.
- **Tomorrow:** the home page photos in the sections (How we verify and SwiftRescue as new parts, fade and slide on scroll, the two SwiftRescue photos),
  Lighthouse before and after, then my own Lighthouse run on the preview.

## Day 11 — 2026-10-23 and 2026-10-24
- **Built:** the home page "Find by type" slideshow was polished (bigger cards with a line each, content in the lower part, 800 and 1600 px photos,
  a light blue tint, a Pause icon, a gentle lift) and **#44 is merged into `main`**. The accounts, sign-up and facility ownership spec was written
  (`specs/2026-10-23-accounts-and-facility-ownership/`, nine phases, one PR each) and approved with my answers.
- **Measured (PageSpeed Insights, mobile, production, after #44, 24 Oct 2026):** **Performance 100, Accessibility 100, Best Practices 100,
  SEO 100.** (Before the work, my own Lighthouse gave 73 and 100; the laptop runs in the PR were only a guide.)
- **Decisions:** one new table, `facility_owners` (the 10th, my yes); a move hides the listing until staff re-check it; passwords are 8 characters
  minimum for providers and 10 for staff and admin, and very common passwords are blocked for everyone; email codes need a verified sending domain in Resend
  (options and prices are in section 5b of the requirements; I buy and set up nothing yet).
- **AI use:** Claude Code read the code and wrote the spec and, from Phase 1, the tests and code; I chose the answers D1 to D5, the password rule and what
  to do about the Resend domain.

## Day 12 — 2026-10-26 and 2026-10-27
- **Built (all as stacked draft pull requests, nothing merged; the table of PR numbers is in the last chat message and in each PR):** accounts Phases 5
  to 9 (#60 to #65: my account and password reset; the 10th table with owner links and their staff screen; register or claim a facility with a duplicate
  check; moves, closures and branches with address history; Privacy and Terms drafts and the anonymity tests), the Sponsored rules check (#66), the "For
  facilities" page (#67), the SwiftRescue contacts screen (#68) and dark mode (#69).
- **Found by the checks:** a featured listing that was never verified or was overdue could pay and take the sponsored slot (fixed, S1); `/search` and
  `/blood` scored 98 in Lighthouse Accessibility ("heading order", in both modes; fixed); the Privacy page promises that unfinished sign-ups are removed
  after 7 days but **no timer runs that job yet** (your step, in validation.md of the accounts feature); my own Theme button had a second `role="status"`
  that broke nine browser tests (fixed).
- **Not finished:** the real-browser suite (Playwright) for dark mode: a full run had 67 failures under a very busy machine, one real (fixed), and my re-run
  was stopped for low memory. Please re-run it (how: `specs/2026-10-27-dark-mode/validation.md`). The whole accounts road with a real database and a real
  browser was also not run end to end.
- **Decisions:** the lists "Decisions to review" above (P5 to P9, S1 to S3, F1 to F3, E1 to E5, M1 to M6); the ones that need you are the legal ones (lawyer
  for Privacy and Terms), the schedule of the clean-up job, and whether a dark map is worth another tile provider.
- **AI use:** Claude Code wrote the specs, tests and code of all of the above from the plan you approved, ran the test suites and Lighthouse, and looked at
  screenshots; I did not run, approve or merge anything, and added no phone number or personal data.
