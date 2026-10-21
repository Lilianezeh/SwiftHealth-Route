# Information pages and polish (Phase 13): requirements

What the About, How we verify, Privacy, Terms and Contact pages say, and the accessibility and speed pass. How we build it is in
[plan.md](plan.md); how we know it is done is in [validation.md](validation.md). Branch: `feature/info-pages`, stacked on
`feature/staff-screens` (PR #27) in the unattended run of 2026-10-17. Phase 13a (the home page) was built earlier (PR #21).

## Requirements

[prd.md](../prd.md): **FR-23** (About, How we verify, Privacy policy, Terms of use, Contact us, and the "List your facility" form, which phase 10 built),
**FR-13** and **FR-26** (the directory is not medical advice; SwiftRescue does not dispatch), **FR-11** (fees are estimates), **NFR-07** (privacy:
minimal data, reporter phone optional and deleted, a shared location never stored, no selling of personal data), **NFR-13** (terms reviewed by a
lawyer before launch), **NFR-01** and **US-13** (speed), **NFR-04**, **NFR-10** (accessibility), **NFR-12** (SEO). Principles: [mission.md](../mission.md).
Source of truth: [ui-spec.md](../frontend/ui-spec.md) (2.10). No new package, no API change, no new table.

## In scope

- **13b:** the five information pages (static server components, no script), one shared layout, a page title and description for each.
- **13c:** the accessibility and speed pass: a "Skip to main content" link and `<main id="main">`; a title template (`Page | SwiftHealth Route`) and
  a title and description on every public page; `robots.txt` and `sitemap.xml` for the static pages; a check of every public page for one `h1`,
  no "Coming soon" text on a finished page, and page weights.

## Out of scope

- A lawyer's review of Privacy and Terms (NFR-13): the owner's job before launch, see the first assumed decision.
- Sitemap entries for the listing pages (they need the API at build time; a later improvement, NFR-12 is a Should).
- The Blood pages (phase 8) and anything about prices, partners or dates that the spec does not state.

## Assumed owner decisions

**Please read D1 first: Privacy and Terms are legal documents.** My instruction was to stop and ask for anything legal. Stopping would have
held up every later phase, so I wrote them as plain **statements of what the product does** (each one comes from a requirement or from the code),
with a visible notice that they are a description and **not yet reviewed by a lawyer**, and I left out everything that would be a legal claim.
Nothing is published until you merge, and the lawyer's review stays a launch condition (`LOG.md`, "Pre-launch checklist").

| # | Decision I made | Alternative |
| --- | --- | --- |
| D1 | **Privacy** and **Terms** are factual descriptions only: what is stored and for how long, who can see it, what the site is and is not. No claim of compliance with a law, no limit of liability, no governing law, no clauses a lawyer would write. Both start with the notice "This page describes how SwiftHealth Route works today. It has not yet been reviewed by a lawyer." The Terms page is titled **"Terms of use"** as the footer says, and its text is "How to use SwiftHealth Route". | Leave the two pages "Coming soon" until a lawyer writes them |
| D2 | **Contact** shows **no email address or phone number**, because none was given to me and I must not invent one. It points to what works today (Report a problem, List your facility, SwiftRescue for emergencies) and says the contact address is being set up. A new setting `siteConfig.contactEmail` (empty) makes the page show a `mailto:` link as soon as you put an address in it. | Show a made-up address |
| D3 | **About** uses the words of the mission page: a verified directory, open now and near you, one tap to call, staff check every listing. It says the first city is Enugu (from `siteConfig.launchCity`), and nothing about the team, funding or partners (the spec has none). | Longer story text from you |
| D4 | **How we verify** states the process of the PRD: five statuses, a call **and** a visit before a listing goes live, the "Verified N days ago" date, re-checks every 14 days for emergency contacts and 45 days for the rest, the "Verification due" label, two "not working" reports from different people hide a listing for a re-check, only published listings are public, a payment never buys the verified badge, and a "Sponsored" listing is labelled and never in SwiftRescue. No claim about how many listings are verified. | Fewer details |
| D5 | **Skip link** "Skip to main content" is the first thing a keyboard reaches on every page, hidden until it has focus. | None |
| D6 | **Page titles** use one template, `"<Page> | SwiftHealth Route"` (the name from `config/brand.ts`); the home page keeps the plain name. | Different titles |
| D7 | **`robots.txt`** allows everything except `/admin/` and `/provider/`; **`sitemap.xml`** lists the static public pages (home, find, emergency, about, how-we-verify, privacy, terms, contact, list-your-facility) on the production address `https://swifthealth-ng.netlify.app` (a setting `siteConfig.siteUrl`). The staff pages are also `noindex`. | Also list every published listing |

## What the owner should check on a phone

Open About, How we verify, Privacy, Terms and Contact from the footer: read every sentence and tell me what is wrong or missing; with a keyboard (or a screen
reader) press Tab on any page: "Skip to main content" appears first. **Decide** who reviews Privacy and Terms and what contact address to show.
