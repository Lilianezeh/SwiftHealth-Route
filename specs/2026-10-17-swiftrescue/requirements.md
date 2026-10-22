# SwiftRescue, the emergency section (Phase 7): requirements

What `GET /emergency` and the `/emergency` page must do, and the decisions behind it. How we build it is in [plan.md](plan.md);
how we know it is done is in [validation.md](validation.md). Branch: `feature/swiftrescue`. This phase was built in one run
without waiting for the owner between phases (the owner's instruction of 2026-10-17); every decision I had to make alone is
listed in "Assumed owner decisions" so the owner can overrule it.

## Requirements

[prd.md](../prd.md): **US-04** (emergency button on every page, already done), **US-09** (share the list on WhatsApp), **US-14**
(share my location), **FR-14** (112 first and always), **FR-15** (contacts in groups), **FR-16** (name, area, distance, Call,
last-verified date), **FR-17** and **NFR-03** (cached for offline use after the first visit), **FR-18** (share the list),
**FR-19** (no sponsored placement), **FR-24** (share my location, never stored), **FR-25** (nearby 24-hour pharmacies),
**FR-26** (the SwiftRescue sentence), **NFR-01** (3G weight and speed), **NFR-07** (location never stored or logged), **NFR-10**
(48 px targets, 16 px text). FR-20 (the "Report a problem" link on every contact) is phase 9 and adds its link to the cards built here.

Source of truth: [api-spec.md](../backend/api-spec.md) ("GET /emergency", the trust rules) and
[ui-spec.md](../frontend/ui-spec.md) (2.5). Fit with the project: [mission.md](../mission.md) puts the emergency path first;
[tech-stack.md](../tech-stack.md) is unchanged. No new table, no new Python or npm package.

## In scope

- **7a, backend:** `GET /emergency` with the shape of the api-spec; one national line; seven groups in the fixed order; the 24-hour pharmacies.
- **7b, page:** `/emergency` with the 112 card, the groups, the pharmacies and the disclaimer, in the standard states.
- **7c, sharing:** Share emergency list (WhatsApp and SMS links) and Share my location (WhatsApp and SMS links).
- **7d, offline:** a service worker that keeps the page and its files, and a saved copy of the contacts, so `/emergency` works with no network after one visit.
- **7e, nearby pharmacies:** the "24-hour pharmacies nearby" section, nearest first.
- An installable manifest (192 and 512 px icons), because NFR-03 says "installable web app".

## Out of scope

- The "Report a problem" link on each contact: phase 9 (FR-20).
- Find blood and Donate blood pages: phase 8. The "Blood banks" group here is only the contacts of the `blood-bank` category.
- A map on SwiftRescue, ambulance dispatch, any health advice (CLAUDE.md: no medical advice anywhere).

## Decisions made with the spec (no owner choice needed)

1. 112 is a constant of the API (`national_line`), not a database row, so it is present even with an empty database (FR-14). The page also
   hard-codes the 112 card in its own HTML, so it shows with no network and before any request (FR-14, NFR-03).
2. Sponsored placement never appears: every item has `sponsored: false`, even when a listing has `featured_until` in the future (FR-19).
3. The same trust rules as `/search`: only published listings, overdue ones stay with `verification_due: true`, and a listing flagged by FR-22 is left out.

## Assumed owner decisions

Made by Claude Code in the unattended run of 2026-10-17. Each says what I picked, the alternative, and what to say if you disagree.

| # | Decision I made | Alternative |
| --- | --- | --- |
| A1 | The API returns **all seven groups every time**, in order, some with an empty `contacts` list. The page hides empty groups and, when every group is empty, says "We are still adding verified contacts. In danger, call 112." **Changed 2026-10-22 (owner): Ambulance and Fire are always shown, even when empty; see `specs/2026-10-22-swiftrescue-order/`.** | Leave empty groups out of the answer |
| A2 | A listing that FR-22 flags is **left out** of SwiftRescue, as it is in search (the report flow moves it to `recheck_due` anyway). | Keep it with a warning, because in an emergency a maybe-working number may beat none |
| A3 | `pharmacies_24h` has **no distance limit**: nearest ten, or the first ten by name without a position. **Removed 2026-10-22 (owner): FR-25 and `pharmacies_24h` are gone; see `specs/2026-10-22-swiftrescue-order/` (K6).** | A 10 km limit like search |
| A4 | `GET /emergency` fills `hours_note` and `is_open_now` like search (the api-spec said "null until built"). | Keep `null` |
| A5 | **Offline copy:** the page keeps the last answer **fetched without a position** in `localStorage` and shows it when the network fails, with "Offline — showing saved contacts from [date]". When there is a position, a second request adds the distances; the saved copy never holds a position or a distance. | Save the answer with distances (it would reveal the neighbourhood), or never save |
| A6 | **Service worker** `public/sw.js`, scope `/`: network first for `/emergency`, cache first for `/_next/static/` files; on the first visit the page tells it which files it loaded so they are kept at once. It is registered only on `/emergency`. | A library such as Workbox (a new package; CLAUDE.md says ask first) |
| A7 | **Share my location** uses the phone's exact position for that one tap, keeps it in memory only (not in `sessionStorage`, an address or a request to our API) and shows two links, "Send on WhatsApp" and "Send by SMS", with a Google Maps link `https://www.google.com/maps?q=<lat>,<lng>` in the message. | Round the position like the search does (not useful to a rescuer) or use the share sheet only |
| A8 | **Share emergency list** is two links, "Share on WhatsApp" and "Share by SMS", with a plain-text list: 112 first, then each group with name and number in the reading format (0803 123 4567), and the page address. It works without a loaded list: then it shares 112 only. | One button that opens the phone's share sheet |
| A9 | The manifest gets two PNG icons made from `icon.svg` (192 and 512 px, blue pin) so Chrome can offer "Install". | No icons (not installable) |
| A10 | The contact card is a new compact card (name, area and distance, `VerifiedDate`, Call); the 24-hour pharmacies reuse `ListingCard`. | One card for both |

## What the owner should check on a phone

Open `/emergency` on the preview: 112 first and red; Call 112 opens the dialler; the groups; Share emergency list opens WhatsApp with the text;
Share my location asks permission and then offers WhatsApp or SMS; switch on airplane mode after one visit and reload `/emergency`: the page and the saved contacts still show.
