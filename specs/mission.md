# SwiftHealth: mission

Why we are building this and the rules we never break. Requirements are in [prd.md](prd.md); this page only
points to them.

## Mission

SwiftHealth is a verified directory of health facilities and emergency contacts. A resident finds a facility
that is open now, near them, and calls it or gets directions in one tap. Staff verify every listing, so people
can trust what they see. SwiftRescue is the emergency section of the app and the emergency button on every page.

## Where we start

We launch in Enugu. Which pilot area comes first is still undecided (see "Open questions" in
[prd.md](prd.md#open-questions)). Nothing in names or code is tied to Enugu only, so another city can be
added later without renaming anything.

## MVP release goal

Residents in the pilot area can find an open facility or emergency contact and call it or get directions in
under a minute, and every listing shown has been verified within its re-check cycle. The full launch checklist
is in "Release criteria" in [prd.md](prd.md#release-criteria).

## Principles we never break

- **Only published, verified listings are public.** Every listing shows when it was last verified
  (US-07, FR-08, NFR-08).
- **112 always comes first in SwiftRescue, and nothing paid appears there.** No sponsored or featured
  placement in the emergency section (FR-14, FR-19, FR-45).
- **No medical advice.** SwiftHealth is a directory: no diagnosis, no treatment advice, disclaimers on every
  listing and on the emergency page (FR-13, FR-26, NFR-13).
- **SwiftRescue does not dispatch help.** It connects people to emergency contacts and never promises a
  response (FR-26).
- **Collect as little personal data as possible.** The reporter's phone number is optional and deleted when
  the report is resolved. A shared location is never stored (FR-24, NFR-07).
- **Every listing change is recorded.** Who changed what, and when (FR-38).

## Out of scope for the MVP

Public user accounts, patient reviews, a native Android app, appointment and lab booking, pharmacy stock and
delivery, a donor registry, Igbo language, USSD, and any diagnosis or symptom checking. The full list, and what
comes in later phases, is in "Out of scope for the MVP" in [prd.md](prd.md#out-of-scope-for-the-mvp).
