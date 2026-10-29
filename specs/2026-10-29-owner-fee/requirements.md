# Owner fee: ₦10,000 a month to claim and manage a listing (SPEC ONLY)

**Status: APPROVED by the owner on 2026-10-29: "Yes ... with your recommendations on Q1-Q10, including Q8 (paid_until column)". Built on branch `feature/owner-fee`. Nothing is live and nothing is paid: Paystack test mode only.** The answers are the recommended ones in section 7: Q1 monthly payment with reminders (no automatic charge), Q2 calendar month, Q3 grace 7 days, Q4 no refund of a paid month on cancel, Q5 staff may remove a link `lapsed` for 12 months, Q6 each person who edits pays their own fee, Q7 a free first month for existing links, Q8 the `paid_until` column, Q9 PRD rows added (FR-59 to FR-64) but **no page wording about the fee is changed until the lawyer has answered L1 to L8**, Q10 automatic refund on rejection.
Written 2026-10-29 from the owner's request. Paystack **test mode only**, as in FR-44. The contracts are in `specs/backend/api-spec.md` (section 8, "Owner fee") and `specs/frontend/ui-spec.md` (4.2c).

**What differs from the proposal below (found while building):** (a) `ending` is a link status of its own (an owner who cancels keeps editing to the end of the paid month; the nightly job then removes the link). (b) "Q5" is a staff power that already exists (remove a link); no new button. (c) The nightly job needs one more repository secret, `PAYSTACK_SECRET_KEY` (a **test** key), only to ask Paystack again for a refund it did not accept; without it the refund stays "pending" and nothing else is affected. (d) A staff-made owner link (admin screen) starts with the same free first month. (e) A receipt shows the facility, the day paid, the day covered and our reference; the amount is in the email (the audit log keeps no amount).

Related: FR-44, FR-45, FR-46 (featured payments), FR-50, FR-51 (register or claim, staff approval), FR-19 (nothing sponsored in SwiftRescue), FR-48 (sign-up),
`specs/2026-10-20-providers-payments/` (how Paystack is used today), `specs/2026-10-23-accounts-and-facility-ownership/` (owner links), the "Open questions" of `prd.md`
(*"Price of a basic listing? Free during launch ... Paying never buys the verified badge"*).

## 1. What the owner asked for

- **Listing a facility stays free.** Staff can still add any facility, with or without an owner.
- A **facility owner pays ₦10,000 per month** (the amount comes from a setting, `OWNER_FEE_NAIRA`) through Paystack (TEST) **to claim and manage** a listing.
- The **claim goes to staff only after the first payment is confirmed.**
- **Staff sign-up stays free.**
- Propose: monthly renewal, what happens when a month is not paid, a short grace period, refunds when staff reject a claim, receipts, cancelling, what the Terms and the "For facilities" page must say (flag for the lawyer), and how **Featured** fits.

## 2. What exists today (so the proposal is small)

- A provider account registers a facility or claims one (`POST /provider/facilities`, `POST /provider/claims`). That creates a `facility_owners` row with status `pending`; staff phone the facility and approve (`approved`) or remove it. Only an `approved` link lets the provider edit (`listings.owner_id` / the link).
- A provider with an approved link can pay for a **Featured** 30-day placement (`FEATURED_PRICE_NAIRA`, placeholder ₦5,000.00): `POST /payments/featured`, the signed Paystack webhook, idempotent by reference, recorded as an `audit_entries` row (action `payment`, reference = our Paystack reference). **No payments table.** Test keys only; a live key is refused.
- The pages say "Listing is free during our launch" (home, "List your facility", PRD open question).

## 3. The proposal

### 3.1 The words, so nobody is confused
- **Listing** = being in the directory, found, called, verified by staff. **Free, always.** Paying never buys, speeds up or keeps the verified badge (kept from the PRD).
- **Managing** = an owner's tools: edit the listing's details and hours, add photos, mark moves or closures, branches, see their requests, and (optionally) buy Featured. **This is what ₦10,000 a month pays for.** The page text must say exactly that (section 6).

### 3.2 The flow for a new owner
1. A provider (account already confirmed, FR-48) chooses **Register a facility** or **Claim a facility** on `/list-your-facility`. The existing checks run **first** (duplicate-name check of D15, one open request per person and facility), so nobody pays for a request that would be refused for a technical reason.
2. The request is saved with link status **`awaiting_payment`** (new value of the plain-text `facility_owners.status`, no enum migration). It is **not** in the staff queue and shows nothing to staff.
3. The page shows the fee ("₦10,000.00 per month", from the setting, as a string `"10000.00"`) and a **Pay** button: `POST /payments/owner-fee` (provider only, for their own `awaiting_payment` link) starts a Paystack transaction (amount in kobo `int(amount * 100)`, reference `SO-<link id>-<unix seconds>`, as `SH-...` is for Featured) and returns the Paystack address; the provider pays with a test card.
4. **Only the signed Paystack webhook confirms** (same rules as FR-44: HMAC SHA-512 of the raw body, constant-time compare, a repeated webhook applies once, an audit entry with the reference). The browser's "payment complete" page only asks our API whether the webhook arrived.
5. On confirmation: the link becomes **`pending`** (now in the staff queue, "Owner requests"), `paid_until` is set (section 3.3), the audit log records the payment, a receipt email is sent (3.6).
6. Staff phone the facility and **approve or reject** as today. Approve: the owner can manage. Reject: automatic refund (3.5).
- **A facility that staff added themselves** has no owner and costs nothing; an owner who later claims it follows this same flow.
- **Several owners / managers of one facility:** each person who wants editing pays their own ₦10,000 (decision question Q6).

### 3.3 What is stored (no new table)
The 10 tables stay. Two small additions to **`facility_owners`** (an existing table: a migration, which is why I ask first):
- `paid_until` (timestamp with time zone, nullable): the end of the paid month. Editing is allowed while `now <= paid_until + grace`.
- link `status` values gain `awaiting_payment` and `lapsed` (plain text, no migration for the values).
Every payment is also an **`audit_entries`** row with the Paystack reference (FR-46), as for Featured. *Alternative with no migration:* derive "paid until" from the newest payment audit entry of the link. It works but every edit check would scan the audit log; I recommend the column. **Needs the owner's yes** (CLAUDE.md: the schema is fixed).

### 3.4 Monthly renewal, and what happens if a month is not paid
**Options**
- **A. Paystack subscription** (a Paystack *plan* and *subscription*; the card is charged automatically). The owner pays once and it renews. More moving parts (plan creation in the dashboard, subscription webhooks, failed-card handling, cancellation through Paystack), and an automatic charge needs clear wording in the Terms (lawyer). I would **check Paystack's current Plans and Subscriptions documentation before building** and not guess field names.
- **B. One payment a month, with reminders** (recommended for the pilot). Nothing is charged automatically. A nightly job (the GitHub Actions schedule already added in `specs/2026-10-28-nightly-jobs/`, one more module) emails the owner at **7, 3 and 1 days before** `paid_until` with a **Pay for next month** button (the same `POST /payments/owner-fee`). Paying adds one month to `paid_until` (from the old `paid_until` if it has not passed, else from today, so an early payment loses nothing). It uses code we already have, no stored card, no automatic charge, easy to test in test mode; the cost is that an owner must remember to pay, which the reminders and the grace period soften.
- Either way, the **period is one calendar month** (the same day next month; if it does not exist, the last day of the month), not "30 days", so the fee and the month agree (question Q2).

**If a month is not paid**
1. **Grace: 7 days** after `paid_until` (setting `OWNER_FEE_GRACE_DAYS`, default 7). Editing still works; the owner page shows a clear banner and the reminder emails continue.
2. After the grace period the link becomes **`lapsed`**: the owner **loses editing** (the "Edit my facility" screens become read-only with "Your monthly fee is unpaid. Pay to edit again" and the Pay button) and the Featured purchase is blocked.
3. **The listing is not touched:** it stays public, free, with its verification status, and the re-check cycle continues. Nothing is deleted or hidden. A lapsed owner can still **see** their listing and their history and can pay at any time: paying sets the link back to `approved` with a new `paid_until`, **without a new staff approval** (staff already verified this person), and without any new phone check.
4. If a link stays `lapsed` for a long time (question Q5, suggested 12 months) staff may remove it, as they can remove any link today.
5. **Featured already paid** keeps running to its end (the owner paid for those 30 days); a lapsed owner cannot buy a new one.

### 3.5 Refunds, rejection and cancelling
- **Staff reject a claim** (or the facility denies knowing the person): the first payment is **refunded in full**, automatically, through Paystack's refund feature (test mode first). The link becomes `removed`, the owner is told by email, and the audit log records `refund` with the original reference. If the refund call fails it is retried by the nightly job and shown to the admin as "refund pending", never silently dropped. *I would read Paystack's refund documentation before building; I do not state field names here.*
- **Staff approve:** no refund of that month.
- **Owner cancels** ("Stop managing this facility"): no more reminders, access until `paid_until`, then the link ends (`removed`, by the owner). **No refund for the month already paid** (question Q4: say if you want a short money-back window, for example 7 days from the first payment). The listing stays public and free. The owner can come back by paying and, if the link was removed, by asking again (a new staff approval).
- **Payment taken but webhook not arrived:** the link stays `awaiting_payment` and the page offers "I have paid, check again"; an admin can see unmatched payments in the audit log by reference. Never a double charge to resolve it: a repeated reference is applied once.

### 3.6 Receipts
- On every confirmed payment an **email receipt** (Resend, sent by us): facility name, amount `₦10,000.00`, date, the period it covers (from → to), the Paystack reference. A **"Payments" list** on the owner's page shows the same rows (from the audit log). Paystack also keeps its own record in its dashboard.
- **No tax invoice or VAT wording** is invented here. Whether a receipt must be a tax invoice, and whether VAT or other tax applies to this fee, is a question for the lawyer or accountant (flag L6).

### 3.7 How Featured fits
- **Featured stays a separate, optional extra** (₦5,000.00 a month placeholder, `FEATURED_PRICE_NAIRA`), bought by an owner whose link is `approved` **and not lapsed**. The two fees add up; nothing is bundled.
- All FR-45 rules stay: at most one featured listing first in matching search results, labelled "Sponsored", **never in SwiftRescue or the blood pages** (FR-19), and **paying never buys the verified badge**. The owner fee does not touch ranking at all: an owner who pays ₦10,000 is not ranked higher than one who does not.
- If the owner later wants one price: a bundle ("manage + featured") is possible but is a product decision; not proposed.

### 3.8 Staff, providers who already exist
- **Staff sign-up stays free**; the fee applies only to the `provider` role claiming or registering a facility. Verifier, editor and admin accounts never pay.
- **Existing approved owner links** (demo and pilot data): proposed to be **grandfathered with a free first month from the launch of the fee** (`paid_until` = launch date + 1 month), then they follow the monthly rule. Question Q7.

## 4. API and screens (to be written into api-spec and ui-spec after the "yes")
- New: `POST /payments/owner-fee` (start), `GET /payments/owner-fee/{reference}` (status, like `verify`), the **same** `POST /payments/webhook` handling a second reference shape (`SO-...`), `POST /owner/links/{id}/cancel`, `GET /provider/payments`. Staff: "Owner requests" shows only paid requests; a **reject** action refunds.
- Settings: `OWNER_FEE_NAIRA` (Decimal, default `10000.00`; JSON string), `OWNER_FEE_GRACE_DAYS` (7), `OWNER_FEE_REMINDER_DAYS` (`7,3,1`).
- Nightly job (one more module in the existing schedule): reminders, `lapsed` after the grace period, pending refunds. Money is `Decimal`, sent to Paystack as `int(amount * 100)` kobo.
- Screens: pay step on "List your facility" (after the form), a **Fee** card on "My facilities" (paid until, Pay, Cancel), the payments list, the staff reject-with-refund button, texts per section 6.

## 5. Rules kept (and tests to write first, after the "yes")
No live key ever (a `sk_live_` key is refused, as today); only a signed webhook confirms; a repeated webhook applies once; the amount comes from the setting, never from the browser; a provider can pay only for their own link; the claim reaches staff only after the confirmed payment; a lapsed link cannot edit but the listing is unchanged; staff and visitors are never charged; nothing sponsored in SwiftRescue; no medical advice. The test list is in [plan.md](plan.md).

## 6. What the Terms and the "For facilities" page must say: FLAG FOR THE LAWYER
These are drafts of the **facts** to be reviewed; I make no legal claim (CLAUDE.md). Today's Terms/Privacy are unreviewed drafts.
- **L1 What is free and what is paid:** being listed, found, called and verified is free; the fee is for the owner's management tools only; paying does not affect verification or ranking.
- **L2 Price, period and tax:** ₦10,000 per calendar month (amount may change with notice), whether the price includes tax, receipts.
- **L3 Renewal:** with option B, "we do not charge your card automatically; we remind you"; with option A, the exact automatic-renewal and cancellation terms (consumer-law requirements).
- **L4 Non-payment:** grace period, loss of editing, listing stays public and free, how to restore.
- **L5 Refunds and cancelling:** full refund if staff reject the claim; no refund of the month already paid (or the window the owner chooses); how to cancel.
- **L6 Personal data:** the payment reference and email receipts (Privacy page); Paystack is a processor; what we keep and for how long (NDPA 2023).
- **L7 Staff may refuse** a claim after phoning the facility; what we check; the owner confirms they are authorised to represent the facility.
- **L8** The home page, "List your facility" and "For facilities" currently say "Listing is free during our launch": the wording must change to *listing is free; managing costs ₦10,000 a month* (checked against the PRD open question).

## 7. Questions for the owner (my recommendation first)
- **Q1 Renewal:** A (Paystack subscription) or **B (monthly payment with reminders, recommended for the pilot)**?
- **Q2 Month:** **calendar month (recommended)** or 30 days?
- **Q3 Grace:** **7 days (recommended)**, or other?
- **Q4 Cancelling:** **no refund of the month already paid (recommended)**, or a 7-day money-back window after the first payment?
- **Q5 Long lapse:** may staff remove a link that has been `lapsed` for **12 months (recommended)**?
- **Q6 Several owners:** **each person who wants to edit pays their own fee (recommended; simplest)**, or one fee per facility shared?
- **Q7 Existing owners:** **free first month after the fee starts (recommended)**, or pay at once, or free forever?
- **Q8 Schema:** may I add `paid_until` to `facility_owners` (a migration, still 10 tables)? **Recommended: yes.**
- **Q9 PRD:** may I add the requirement rows (FR-59 to FR-6x) and change the "free during launch" sentence after the lawyer's answer? (I will not change any page text before then.)
- **Q10 Refund on rejection:** automatic (recommended) or staff presses a Refund button?
