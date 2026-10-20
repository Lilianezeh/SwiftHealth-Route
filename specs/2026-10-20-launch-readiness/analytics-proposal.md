# Anonymous analytics: a proposal for the owner to choose (roadmap 14c, not built)

Source: the "Analytics" section of [prd.md](../prd.md) and the reminder in `LOG.md` ("Later feature: privacy-friendly usage tracking", 2026-10-13).
**Nothing was built** because every way of keeping the events needs a decision that is yours: the project has exactly **9 tables** and "never add a table
without asking", and an outside tool is a new company that receives visitor data.

## What the PRD asks for

Anonymous events only, no personal profiles: searches (term, category, filters), listing views, Call taps, Directions taps, Emergency page opens, emergency list
shares and reports submitted. They feed the monthly numbers: monthly active users, calls and directions made, and the share of numbers that work at re-check.
The privacy rule of the project: **no position, no IP address and no phone number in any event**.

## Options

| | A. A tenth table `events` | B. Reuse `audit_entries` | C. A cookie-free outside tool (Cloudflare Web Analytics, GoatCounter or Umami) |
| --- | --- | --- | --- |
| What is stored | One row per event: kind, listing id (optional), category (optional), day, no user, no key | Rows with `action = "event:call"` etc. and no user | The tool keeps page views and, for some, custom events |
| Needs your approval | **Yes: a new table** (and a migration) | No new table, but it **mixes** the staff audit log (FR-38) with visitor events and would bury it | The tool, and a line in Privacy |
| Search terms | Can be kept or dropped (a typed term can hold personal data: I recommend keeping only the category and filters) | Same | The tool sees page addresses; our search addresses hold no position |
| Cost | Free | Free | Free tiers exist; check their terms |
| Risk | The table grows: needs a retention rule (for example daily counts, then delete rows) | The audit log becomes noisy and slower to read | Data leaves our servers; the monthly "numbers that work at re-check" still comes from our own data |

## Recommendation

**Option A, kept as daily counters, not as a stream of events:** one row per day, kind, listing and category with a count, created with an upsert. It holds no
user, no key, no position and no time of day, so there is nothing personal to leak or to delete, and the monthly numbers are a sum. It needs one table (your approval) and
about a day of work with tests: an endpoint `POST /events` (rate limited, one of a fixed list of kinds), a nightly-free design (no job needed), a dashboard card in phase 11's page.
If you will not add a table, **choose C for visits** and keep the call and directions numbers out for now: they are the only events that need our own data.

Whichever you choose, the Privacy page changes first (it must say exactly what is counted), and the Call, Directions, Share and report links gain one small request each
(which must not slow a call: send with `navigator.sendBeacon` after the tap).

**To decide:** A, B, C, or nothing for the MVP; and whether a search term may ever be kept.
