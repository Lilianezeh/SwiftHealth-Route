# Accounts, sign-up and facility ownership: requirements

**Status: APPROVED by the owner on 2026-10-24: "Yes", D1 yes, D2 yes, D3 hide, D4 yes, D5 yes, D6 to D16 as written; passwords changed (section 3, FR-56). Built phase by phase, one PR each; the status of each phase is in [plan.md](plan.md).**
The owner's answers of 2026-10-24 are recorded in section 5. Everything below that says "proposed" is now agreed.
How we build it: [plan.md](plan.md). Branch for this spec: `feature/accounts-and-ownership-spec` (from `main`; #44 is already merged there).
The requirement numbers below (FR-48 to FR-56, US-17 to US-21) are **proposed**; they go into `specs/prd.md` in Phase 1, after your "yes" (spec first, then code).

## 1. How it works today (read from the code and the migrations)

**Users and roles.** One table, `users`: `id`, `name`, `email` (unique), `phone` (optional, used only for the login SMS), `password_hash` (Argon2), `role`, `is_active`, `created_at`, `last_login_at`. The role is a native PostgreSQL enum with four values: `verifier`, `editor`, `admin`, `provider`. Visitors have no account. Nobody can sign themselves up: accounts are made by an admin (`POST /admin/users`), by the demo seed, or by the first-admin command at start-up. A password needs 10 characters (`MIN_PASSWORD_LENGTH` in `schemas/admin_user.py`, used by the bootstrap command too). Login is two steps: email + password, then a 6-digit code sent by SMS (Termii) at **every** login; the code is a signed 5-minute token, nothing is stored. The access token holds only the user id; the role and `is_active` are read from the database row on every request. Nothing confirms that an email or a phone number really belongs to the person: the admin types them.

**"List your facility".** `POST /facility-submissions` is open to anyone (rate-limited by IP). It creates a **draft** listing with `created_by = NULL` and **no link to any person**. The contact name and email the visitor typed are not put in the listing (they would be public once published): they go into one `audit_entries` row (`action` = "contact"), readable only by staff. So a submission is linked to nobody; only free text in the audit log says who sent it.

**How a provider is linked to a listing.** Only through `listings.owner_id` (one nullable user id): **one listing has at most one owner, and the code finds "the" listing of a provider with `get_by_owner_id`, so a provider has one listing.** An admin sets it with `PATCH /admin/users/{id}` and `listing_id` (the user must be a provider; a listing already owned by someone else is refused). The provider endpoints (`/provider/listing`) have no id in the path on purpose, so a provider cannot name another listing. There is no request, no approval step and no history of the link except the `user_update` audit row.

**What `test_listing_moves.py` covers.** Despite its name it tests **status moves**, not address moves: submit (draft → pending review, needs a passing call and a passing visit), publish (needs a passing check in the last 14 days, sets the check dates), hide (with a reason, kept in the audit `reference`), reopen (hidden → draft), who may do each (verifier only on their own draft, editor/admin for the rest, never a provider), 401/404 cases, and the whole road from draft to public and into search. **Nothing in the code changes a listing's address as a "move", and no test covers it.** An address change today is an ordinary field edit (`update_listing`), which writes one audit row.

**What the audit log records.** Table `audit_entries`: `user_id` (null for the nightly job and anonymous submissions), `listing_id` (null for account actions), `action`, `field_changed`, `old_value`, `new_value`, `reference`, `changed_at`. Written for: listing create, every changed field on update (old and new value; phones, hours and services as text; a password or phone change only as "changed"), every status move, verification checks, the nightly move to re-check, reports that are flagged or resolved, CSV import, Paystack payments (reference), the contact text of a submission, and `user_create` / `user_update` by an admin. **Not recorded:** logins, failed logins, who read what. **No endpoint lists the log**; staff see only a listing's latest submission contact.

**Other facts that matter.** `listings.status` is a native enum (`draft`, `pending_review`, `published`, `recheck_due`, `hidden`); `recheck_due` hides the listing from the public, while an overdue `published` one stays visible with `verification_due`. A provider's change of phones or hours sets `next_check_due` to now (visible, flagged), not `recheck_due`. There is no route that deletes a listing or a user. The header has "Find care", SwiftRescue and "For facilities" (to `/list-your-facility`); **there is no login link anywhere on the site** (PR #38, a footer link, was closed), so `/admin/login` is reachable only by typing the address. Resend with no key only logs a warning and sends nothing; Termii with no key logs the code to the console.

## 2. What the owner asked for

1. **Sign up and log in in the header**, next to "For facilities" (not in the footer). One sign-up page where the person chooses "Staff" or "Facility owner (provider)".
   - Email confirmed by a code sent by email (Resend) before the account works.
   - **Password rule (owner, 2026-10-24, replaces "8 for every account"):** at least **8 characters for providers**, at least **10 for staff and admin accounts (verifier, editor, admin: not weakened)**; very common passwords blocked **for everyone**.
   - Phone confirmed with a code, as today.
2. **Staff sign-ups start as "pending" with no access.** Only an admin approves them and chooses the role (editor or verifier), or rejects them.
3. **Providers** can, after sign-up, register a new facility or claim an existing listing. Staff phone the facility and approve the link before the provider can edit anything. An owner-facility link table: role owner/manager, status pending/approved/removed, approved_by, dates. Many owners per facility, many facilities per owner.
4. **Only people with an account can register a facility.** `/list-your-facility` asks visitors to sign up or log in first, and every submission is linked to the account that sent it. Searching, calling and SwiftRescue stay open to everyone, with no account.
5. **Facility and location:** a facility can have one or more branch listings. A **move** updates the address and keeps an address history (old, new, date, who) and puts the listing back to "needs re-check". A **closure** hides the listing but keeps the record. No deletes, no duplicates. How existing listings migrate safely.
6. **Account management:** edit profile, change password, forgot password by email, close my account. Admins: list accounts, see pending staff, last login, approve/reject, suspend/reactivate (never delete), and an activity log of who did what and when.
7. **Public visitors stay anonymous:** no location stored, no per-person tracking.

Constraints: **additive migrations only; all existing data kept.** Privacy page changes (NDPA 2023) listed, **a lawyer must review them**. Small phases, one PR each.

## 3. Proposed requirements

| ID | Requirement | Phase |
| --- | --- | --- |
| FR-48 | Anyone can sign up as Staff or Facility owner. The account works only after the **email** (code by Resend) and the **phone** (code by SMS) are confirmed. A code is 6 digits, valid 15 minutes (email) or 5 minutes (SMS), and attempts and resends are rate-limited. Sign-up never says whether an email is already registered. | 2, 3 |
| FR-49 | A staff sign-up is `pending`: it can confirm its email and phone and log in only to a page saying it waits. It has **no access** to any staff endpoint. An admin approves it with the role editor or verifier, or rejects it. Both are in the audit log; the person gets an email. | 3, 4 |
| FR-50 | A provider can **register a new facility** or **claim an existing listing**. Either creates an owner link with status `pending` (role owner or manager). A provider with no approved link can see the request and its state and can edit nothing. An editor or admin phones the facility, writes who they reached, and approves or rejects the link. | 6, 7 |
| FR-51 | `/list-your-facility` and its API need a logged-in, approved provider account. Visitors are sent to sign up or log in first and come back. Every submission is linked to the account that sent it (owner link + audit row), and the contact fields of the old form are taken from the account. Anonymous drafts already in the database stay as they are. Duplicates are caught before a new listing is made. | 7 |
| FR-52 | A listing can have a parent listing (a **branch** of a facility): one level only, no branch of a branch. | 8 |
| FR-53 | A **move** changes the address, area, landmark and pin, writes the old and new values with who and when (the address history), and puts the listing to `recheck_due` (see decision D3). A **closure** hides the listing, stores `closed_at` and the reason, and keeps every row. No listing and no account can be deleted through the API. | 8 |
| FR-54 | A logged-in person can edit their profile (name; email and phone only with a new code), change their password (current password needed), reset a forgotten password with a code sent by email, and close their account. | 5 |
| FR-55 | An admin sees all accounts (filter by role and state, last login), the pending staff, and can approve, reject, suspend and reactivate, never delete. An **activity log** lists who did what and when (filter by person, action, date). | 4 |
| FR-56 | One password rule for every way an account gets a password (sign-up, change, reset, admin create, bootstrap), in one function that takes the account type: **at least 8 characters for a provider, at least 10 for a verifier, editor or admin** (a staff sign-up too), at most 128, not on the list of very common passwords (everyone), not equal to the email. A provider who becomes staff (a role change by an admin) must be given a new password of 10 characters or more in the same request, so a short provider password never becomes a staff password. | 1 |
| NFR-07 (changed) | The Privacy page and the Terms describe the new account data, the codes, the processors and the rights; reviewed by a lawyer before sign-up is opened to the public (section 6). | 9 |
| NFR-06 (kept) | Staff and providers keep the SMS code at every login; the role and state are read from the database on every request; rate limits on every new public endpoint. | all |

| ID | User story (proposed) |
| --- | --- |
| US-17 | As a facility owner, I sign up, confirm my email and phone, and ask to link my facility, so that I can keep its details right. |
| US-18 | As an admin, I approve or reject staff sign-ups and choose their role, so that nobody gets access by signing up. |
| US-19 | As an editor, I phone a facility and approve its owner, so that only the real owner edits it. |
| US-20 | As an owner, I report that my facility moved or closed, so that people are not sent to the wrong place. |
| US-21 | As an account holder, I change my password, recover it, or close my account. |

## 4. Design in short (details in plan.md)

- **One new table, and only if you say yes (D1): `facility_owners`.** Everything else fits in the nine tables, so there are no more:
  - address history = rows of `audit_entries` (it already holds old value, new value, who, when);
  - email, phone and reset codes = signed tokens like today's login challenge (nothing stored);
  - activity log = a read endpoint over `audit_entries`;
  - closure = `listings.closed_at` (status stays `hidden`; no enum change); branch = `listings.parent_id`.
- **New columns on `users` (additive, nullable or with a default):** `email_verified_at`, `phone_verified_at`, `approval_status` (`pending` / `approved` / `rejected`, text), `signup_note`, `password_changed_at`, `closed_at`. **New on `listings`:** `parent_id`, `closed_at`, `closed_reason`. No enum value is added and no column is dropped or changed.
- **Where the checks live:** the one dependency that loads the user (`get_current_user`) refuses an account that is not `approved`, not `is_active`, or has an unconfirmed email or phone, so no endpoint can forget it. A test calls every protected route with a pending account.
- **Existing accounts:** the migration sets `approval_status = approved`, and `email_verified_at` and `phone_verified_at` to the migration time for every existing user (an admin typed those details, and the production admin must not be locked out). The first-admin command and the admin-create endpoint do the same for new accounts they make.
- **Existing `owner_id` values:** the migration copies each into `facility_owners` (role owner, status approved, `approved_by` empty, note "migrated from listings.owner_id"). The `owner_id` column stays untouched and is no longer read (dropping it would be a later, separate decision). A test proves every old owner is linked.

## 5. Decisions

**Answered by the owner on 2026-10-24: D1 yes, D2 yes, D3 hide, D4 yes, D5 yes** (the recommended column is what was chosen):

| # | Question | Recommended |
| --- | --- | --- |
| D1 | **A 10th table** `facility_owners` (CLAUDE.md: never add a table without asking). Alternative: keep one owner per listing in `owner_id`, which cannot do "many owners per facility" or manager roles. | Yes, one table |
| D2 | **Resend key missing.** `send_email` today silently sends nothing, which would leave every new account unable to confirm. Proposal: with no key, **development logs the code to the console** (like Termii); **production refuses sign-up** with "Sign-up is not open yet" (503) and the setting `SIGNUP_ENABLED` is off until you turn it on. **In production the email codes need a verified sending domain in Resend** (owner, 2026-10-24; options and costs in section 5b). Termii needs a live account, DND route and approved sender ID. | As written |
| D3 | **A move hides the listing** (`recheck_due`, like "needs re-check") until staff re-verify it, because a wrong address sends a person to the wrong place. Alternative: keep it visible with the "verification due" flag, as a change of phones or hours does today. | Hide |
| D4 | **Owner and manager.** Owner: edit and pay for featured. Manager: edit only, no payments. Who approves a link: editor or admin (verifiers may phone and write the note, not approve). | As written |
| D5 | **Branches inherit access.** An approved owner/manager of the main listing may edit its branches; a provider can add a branch only under a listing they hold an approved link to. Alternative: approve each branch separately (more staff phone calls). | Inherit |

**I will apply these unless you object:**

| # | Decision |
| --- | --- |
| D6 | The pending staff account keeps role `verifier` in the database (the lowest) **plus** `approval_status = pending`; the one dependency refuses it. No new enum value. |
| D7 | Closure is `status = hidden` + `closed_at` + reason, not a new status. A provider can close their own facility (immediate); only an editor/admin can reopen it (to draft). |
| D8 | An unverified sign-up older than 7 days is deleted by the nightly job (only if it has no other rows); no audit row is written for it until it is confirmed. This is the only deletion in the plan. |
| D9 | Closing my account **anonymises** it (name, email, phone, note replaced; id kept so the audit log stays correct) and removes its owner links; listings stay. The last active admin cannot close or suspend themselves. |
| D10 | A password change or reset makes older access tokens invalid (the token gets an issue time; the user row has `password_changed_at`). Suspension already works at once, because the state is read from the database. |
| D11 | The SMS code stays at **every** login, for providers too (FR-43 says "like staff"). Cost: one SMS per login of every provider and one per sign-up; I give no price because I have none from Termii. Alternative for later: an email code for providers. |
| D12 | Common passwords: a plain text file in the repository (the 10,000 most common passwords of the SecLists project, MIT licence, keeping the 2,087 that have 8 characters or more, because a shorter one fails the length rule anyway), no new package, **blocked for every account type**. Existing passwords are not checked retroactively; the rule applies the next time a password is set. The minimum length is 8 for providers and 10 for staff and admin (FR-56). |
| D13 | Forgot password: a 6-digit code by email (not a link), then the new password. The answer is the same whether the email exists or not. |
| D14 | After this plan, `POST /facility-submissions` answers 401 without an account. The `/provider/listing` routes become `/provider/listings` and `/provider/listings/{id}` (a provider may have many). |
| D15 | Duplicate check when registering a facility: the same normalised phone number on any listing, or a very similar name in the same area (the trigram extension already exists). A hit stops the registration and offers "claim this listing" for public ones; for a hidden, draft or closed one it says only "this facility is already registered, contact us" (no detail leaks). |
| D16 | Header: "Log in" and "Sign up" next to "For facilities"; on a phone they sit inside the Menu (SwiftRescue stays the red button, outside it). When logged in a small piece of script swaps them for "My account" without moving the layout. This adds a small client part to every page, including the home page (Lighthouse 73+ must still hold; the home performance test that says the slideshow is the only client part changes with it). |

### 5b. A verified sending domain for Resend: the options (research of 2026-10-24; nothing bought or set up)

Why: Resend sends only from a domain you own and have verified by adding DNS records to it; its documentation says sending needs a domain that is "not a shared or public domain". I could not find a page that says what its test sender `onboarding@resend.dev` may do (it is not described in the pages I read), so **I do not rely on it**: plan for a verified domain. The sign-up emails (confirmation, forgot password, approvals) cannot go to real people without one.

- **Resend's plan:** the **Free plan is enough to start**: 3,000 emails a month, **100 a day**, 3 domains (resend.com/pricing). The daily cap is the limit to watch: each sign-up, resend, reset and approval is one email. The next plan, Pro, is $20 a month for 50,000 emails.
- **Cheapest ways to get a domain** (prices are indicative, from comparison sites, and renewals are often higher than the first year, so check the registrar's page before buying):
  1. **A subdomain of a domain you already own** (for example `mail.yourdomain.com`): **free**. Resend's documentation recommends sending from a subdomain. You need access to that domain's DNS settings.
  2. **`.com.ng`** from a Nigerian registrar: one registrar (MokoHost, a self-published price) lists about **₦6,250 a year**, and `.ng` about ₦13,250. Local, paid in naira.
  3. **`.xyz`**: the cheapest first year (about $1 with a promotion at one registrar), **renewal about $11 to $14 a year** (Cloudflare Registrar sells at cost, about $11.20 for `.xyz`).
  4. **`.org`**: about $8 for the first year at some registrars, renewal about $13 to $20. **`.com`**: about $11 to $15 the first year, about $18 to renew.
- **Not possible:** the site's own address `swifthealth-ng.netlify.app` (you do not control the DNS of `netlify.app`, so the records cannot be added; this is my reading of how Resend verifies a domain, not a line I found in its docs). Do not buy a domain that looks like a bank or a government site.
- **My suggestion:** if you already own any domain, use a subdomain of it (free). If not, the cheapest sensible choice is one domain for the whole project that you also use later for the website and for staff email addresses; a `.com.ng` or `.org` keeps the name credible for a health directory. Cloudflare's DNS is free and its registrar charges no mark-up. The decision and the purchase are yours; I add no domain setting to the code (the sender address stays `RESEND_FROM_EMAIL`).
- **After you have a domain:** (1) add it in the Resend dashboard, (2) add the DNS records Resend shows (it lists them; I have not named them because the page I read did not), (3) wait for "verified", (4) set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in Render, (5) send yourself a test, (6) only then set `SIGNUP_ENABLED`.

### 5c. Added on 2026-10-24: the login code screen and an authenticator app (**approved by the owner on 2026-10-24: yes to FR-57 and FR-58, D17 yes, D18 yes (protect the secret), D19 yes**)

Two additions asked for by the owner, now approved. They are requirements FR-57 and FR-58 (in `specs/prd.md`). Phase 2b (FR-57) is built first, then Phase 2c (FR-58), each on its own branch from `main` after the previous one is merged. Two points were **changed from the first proposal when the answers were recorded**: (1) with no `TOTP_ENCRYPTION_KEY` the API **starts normally** and only the set-up of an authenticator app answers 503 (it used to say the API would refuse to start, which would have crashed a deploy that ran before the variable was added); (2) in development and in the tests a built-in, public development key is used, like the development secret of the reporter hash, and it is **never accepted outside development**.

**Where things are today (read from the code, 2026-10-24).**
- The login screen already has a "Resend code" button that appears after 60 seconds; it works by sending the email and password again, and the only limit is the general login limiter (10 calls per 15 minutes per client address). There is **no limit per account per hour**, so one account can be made to receive many SMS (each costs money).
- It shows "Sent to" and the number as `0*** *** 0001` (the server masks the middle with stars). There is **no "Start again"** link.
- **In production today the SMS is not really sent**: with no `TERMII_API_KEY` the code is written to the Render log, together with the masked phone. Staff can log in only by reading that log. Real sending needs a live Termii account, the DND route and an approved sender ID (CLAUDE.md), and each SMS costs money. This is the reason for the second addition.

**FR-57 (login code screen).** The second step of the login:
1. Shows where the code went, with the number mostly hidden: "Code sent to ••• ••• 4567" (only the last four digits).
2. A **"Send a new code"** button, disabled for **60 seconds** after each send, with the seconds counting down in text a screen reader can follow (no red, no moving effect). The server enforces the 60 seconds too (the code token carries its send time; too early answers 429 with the seconds left), so a script cannot skip the wait.
3. **A limit per account per hour: at most 5 codes** (the first one counts). The sixth answers 429 "Too many codes. Try again in N minutes." and the screen says so in the same words. The count is kept in memory per API instance, like the other limiters (it is forgotten when the API restarts, which is acceptable for a cost limit; it is not a security control). The existing per-address limiter stays.
4. A **"Start again"** link that goes back to the email and password step, forgets the code step and keeps the email in the field. The password is still never kept after use.
5. "Send a new code" no longer sends the password again: a new route `POST /auth/resend-code` takes the current, unexpired code token. After the token has expired (5 minutes) the person uses "Start again".
6. No other screen text changes. Tests: the 60 seconds (fake clock) in the browser and on the server, the sixth code refused, the masked number format, "Start again" keeps the email and drops the code. An older code is **not** cancelled when a new one is sent: it works until it expires (5 minutes at most), because codes are signed tokens and nothing is stored (the guess limits above still apply).

**FR-58 (authenticator app, "TOTP", free two-step login).** Staff, admin and providers can use an app such as Google Authenticator, Microsoft Authenticator or Aegis instead of an SMS code.
- **What it is:** the standard time-based one-time password (RFC 6238: SHA-1, 6 digits, 30 seconds, the settings every authenticator app assumes). It is written with the Python standard library (`hmac`, `hashlib`, `struct`, `base64`), about 30 lines, and tested against the RFC's own test values. **No backend package is added for the algorithm.**
- **Set up once, logged in** (`/account/security`, after Phase 5; before that, `/admin/security`): the person types their password again, the screen shows a **QR code** and the same key as text for typing by hand ("Can't scan? Type this key"), asks for the first 6-digit code from the app to prove it works, and only then switches it on and shows **10 backup codes once** (copy, print or download; each works once). The key is **not** switched on until that first code is right.
- **Login:** after the password, a person with the app switched on is asked for the app's code **and no SMS is sent** (nothing to pay). A backup code is accepted instead of an app code (they are 10 characters, so the two cannot be mixed up). A code is accepted for the current 30-second step and one step either side (clock drift), and **each step only once** (a copied code cannot be replayed).
- **SMS stays as the fallback**, for a person with no app and, when you set Termii up later, as "Use SMS instead" (shown only when `TERMII_API_KEY` is set and the phone is confirmed). With Termii still off, a person with the app never sees an SMS option and a person without the app keeps today's behaviour (the code in the Render log).
- **Brute force:** the same per-address limiter as the SMS code, plus **at most 10 wrong second-step codes per account per hour**, then the account's second step is locked for the rest of the hour (the password step still works; an admin is told by email when Resend is on).
- **Lost phone:** a backup code; else another admin resets the person's two-step (`POST /admin/users/{id}/reset-two-factor`, audited, never on yourself); else, for the **only** admin, a start-up step like the first admin: the variable `RESET_TWO_FACTOR_FOR_EMAIL` (you set it in Render, it is read once at start, then you delete it), logged as "two-factor reset for an account". Documented in the README.
- **What is stored** (new columns on `users`, additive, **no new table**): `totp_secret` (text), `totp_enabled_at`, `totp_last_step` (the last accepted 30-second step), `backup_code_hashes` (a JSON list of keyed hashes; a used code is removed). The secret is shown only during set-up and never again, never logged, never in an audit row (the audit says only "two-factor switched on / off / reset"), never returned by any endpoint.
- **Who must use it:** nobody is forced yet. It is offered at login to every account without it ("Set up the app: free, no SMS"), and admins are asked more firmly. **A later decision (yours) can make it required for staff and admin.**
- **Proposed phase:** after Phase 2 and the login screen, **before sign-up opens**: Phase 2b (login code screen, 1.5 days) and Phase 2c (authenticator app, 4 days), so that every account made from Phase 3 on can be free of SMS from its first login.

**The three questions and the owner's answers (2026-10-24: all yes, the recommended option):**

| # | Question | Recommended |
| --- | --- | --- |
| D17 | **A QR code needs a library.** CLAUDE.md says the stack does not change without asking. Option A: the small MIT npm package `qrcode`, loaded only on the set-up page (no weight on other pages). Option B: no QR, only the typed key and the `otpauth://` link (works in every app, but a typed key is slower and the owner asked for a QR). | A |
| D18 | **Protecting the secret in the database.** The secret must be readable by the server to check a code, so a copy of the database would hold it. Option A: encrypt it with a key kept outside the database (a new Render variable `TOTP_ENCRYPTION_KEY`, and the well-known `cryptography` package, Fernet). Option B: store it as it is (simpler, no package, no new variable; the database is already private and holds password hashes, but a leak would let someone make codes for everyone who set it up, if they also had the password). I will not write my own encryption. | A |
| D19 | **Email code for people who have neither the app nor SMS.** In production with Termii off, a new staff account (Phase 3 on) could never get a code. Option A: for an account with no app, send the code by **email** (Resend, free plan, once the sending domain is verified) when Termii is not set; the app is then offered at once. Option B: no email code (new staff must be given the app set-up by an admin, which needs a first login that cannot happen). | A |

**What changes on Render.**
- **Phase 2b (FR-57): nothing.** No variable, no package, no migration.
- **Phase 2c (FR-58):** a migration at deploy (additive: four columns), the `cryptography` package (in the image at build, nothing to do), and **one new variable, `TOTP_ENCRYPTION_KEY`**. Without it the API still starts and everything works as before; only "Set up an authenticator app" answers 503 "Not available yet", so **no secret is ever stored unprotected and the order of deploy and variable does not matter**. Add it **before you first want to switch the app on**, best **before you merge the Phase 2c pull request** so the first deploy already has it.
- **`RESET_TWO_FACTOR_FOR_EMAIL`** only when the only admin has lost the app and the backup codes; you delete it after one start.

**How to make the key on your laptop without it appearing in a file, a log or git (D18).** The key is 32 random bytes written in URL-safe base64, 44 characters (the form the `cryptography` package's Fernet uses). In a terminal on your laptop (WSL, Linux or Mac, anywhere that has `openssl`) this makes one and puts it **straight on the clipboard, with no newline, printing nothing**:

- **WSL on Windows:** `openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' | clip.exe`
- **Mac:** `openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' | pbcopy`
- **Linux with a desktop:** `openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n' | xclip -selection clipboard` (or `wl-copy` on Wayland)

Then, **in the Render dashboard**: the backend service, Environment, **Add Environment Variable**, name **`TOTP_ENCRYPTION_KEY`**, paste, Save (Render redeploys). Do **not** paste it into a chat, an issue, a pull request, `.env`, or any file. The shell stores the command (which holds no secret) and never the result. **Keep one copy in your password manager** (paste it there right after Render, before you copy anything else): if the key is lost, every stored authenticator secret becomes unreadable and each person has to set the app up again (backup codes and the SMS or email fallback still let them in); if it leaks, someone with a copy of the database could read the secrets (they would still need the password). Changing the key later is a planned job (every person sets up again), not a quick edit; the plan does not rotate it.

## 6. What the Privacy page and the Terms must change (NDPA 2023)

**I am not a lawyer. What follows is a list of what changes, not legal advice and not final wording. A lawyer must review the Privacy page and the Terms before sign-up opens to the public** (the PRD already says the terms are reviewed by a lawyer before launch, NFR-13). I cite no section numbers of the Act because I have not checked them.

- **New personal data:** name, email, phone, password (stored only as a hash), account state, role, confirmation times, last login, the sign-up note, and for owners the facility they are linked to and who approved it. The page today says "Staff and facility owners who have an account have a name, an email address and a phone number" and "a one-time code is sent by SMS at each login": it must now say that anyone can have an account and what is kept.
- **Purposes and lawful basis** for each use (running the account, security, verifying facility ownership, the activity log), as the lawyer words them.
- **Processors and transfers:** Resend (email), Termii (SMS), Cloudinary, Render and Netlify (hosting). Say who they are and that some are outside Nigeria; the lawyer decides what the Act requires for that.
- **Retention:** unverified sign-ups (7 days), closed accounts (anonymised), audit entries (kept; who and for how long), codes (not stored), owner-link records.
- **Rights and contact:** how a person asks for access, correction or closing, who answers, and how fast. Whether SwiftHealth Route must register with the Nigeria Data Protection Commission, and whether a data protection officer or an impact assessment is needed, is for the lawyer.
- **Staff and activity log:** staff are data subjects too; say that their actions are recorded and shown to admins.
- **The old text about the "List your facility" contact** (name and email kept in a staff-only audit entry) changes: the contact is now the account.
- **Kept true:** no location stored, no tracking of visitors, no cookies for visitors (the login is in the browser tab's `sessionStorage`), the report phone number optional and deleted when resolved. A test keeps these promises true (no analytics script, no cookie set by a visitor page, `/search` and SwiftRescue need no login).
- **The Terms** need rules for accounts: who may sign up, one person per account, keeping the password private, a false ownership claim, suspension, and that staff may phone a facility to check a claim.

## 7. Out of scope

Owner invites to other owners, an email code instead of the SMS code, social login, deleting accounts or listings, dropping `owner_id`, a new table other than `facility_owners`, paying for featured by a manager, any change to SwiftRescue, search or the home page except the header links, real SMS or email sending in tests (mocks only), changing Render, Netlify, Resend, Termii or Paystack settings (you do those).
