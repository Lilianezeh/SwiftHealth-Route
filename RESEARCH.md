# RESEARCH.md — SwiftHealth

> The user, market and technical research behind SwiftHealth's design. Keep it updated as we learn more.
> Replace every `[ ]` placeholder with real findings. Do not invent quotes, prices or numbers.

**Author:** [Name]
**Last updated:** [YYYY-MM-DD]

---

## 1. The problem in one sentence

People in Enugu lose critical time finding care because health and emergency contact information is scattered, outdated and unverified.

*(Update this sentence after the interviews if what you hear changes it.)*

---

## 2. User evidence

Two conversations with real people in the domain. Aim for one **provider-side** person and one **resident-side** person.

### Interview 1 — Provider side

| Field | Answer |
| --- | --- |
| Role | [e.g. Pharmacist / pharmacy attendant / clinic receptionist] |
| Location (area only) | [e.g. New Haven, Enugu] |
| Date | [YYYY-MM-DD] |
| How we spoke | [In person / phone] |
| Consent | Agreed to be quoted without their name: [Yes/No] |

**Questions asked**

1. How do new patients usually find out about your facility?
2. How often does your phone number, opening hours or price list change? Who do you tell when it does?
3. Have you ever had patients arrive when you were closed, or call a number that no longer works?
4. Are you listed on Google Maps or anywhere else? Is that information correct?
5. Would you share your opening hours, services and price ranges publicly? Why or why not?
6. Would you pay to appear higher in a trusted directory? Roughly how much per month would feel fair?

**What they said (summary)**

- [Key point 1]
- [Key point 2]
- [Key point 3]

**What surprised me**

[One or two sentences on what you did not expect.]

**Checkable artefact**

[e.g. Photo of the pharmacy's opening-hours sign or price board]
File: `docs/research/interview1_artefact.jpg`

---

### Interview 2 — Resident side

| Field | Answer |
| --- | --- |
| Role | [e.g. Parent / student / nurse / commercial driver] |
| Location (area only) | [e.g. Independence Layout, Enugu] |
| Date | [YYYY-MM-DD] |
| How we spoke | [In person / phone] |
| Consent | Agreed to be quoted without their name: [Yes/No] |

**Questions asked**

1. Tell me about the last time you or someone close to you needed care urgently. What happened?
2. How did you find where to go and which number to call?
3. Did any number fail to work, or any place turn out to be closed?
4. Where do you keep emergency numbers today (phone contacts, WhatsApp, paper)?
5. What would you need to see to trust a number or listing in an app?
6. What phone do you use, and how do you usually pay for data?

**What they said (summary)**

- [Key point 1]
- [Key point 2]
- [Key point 3]

**What surprised me**

[One or two sentences.]

**Checkable artefact**

[e.g. Redacted screenshot of a WhatsApp group "emergency numbers" broadcast, or of their phone contacts list of hospitals]
File: `docs/research/interview2_artefact.png`

> Redact all personal names and private phone numbers before committing any image.

---

## 3. Market: competitors and workarounds

| | Competitor / workaround 1 | Competitor / workaround 2 |
| --- | --- | --- |
| Name | Google Maps (business listings) | WhatsApp groups and forwarded contact lists |
| What it is | General map with facility listings added by owners or the public | Informal sharing of hospital, ambulance and police numbers |
| What it charges | [Check: free for users; free for businesses to list] | [Free] |
| What it does well | [e.g. Location and directions; widely installed] | [e.g. Fast; trusted because it comes from people you know] |
| What it misses | [From your research: e.g. numbers and hours not verified, no fee information, no emergency grouping] | [e.g. No way to know if a number still works; lost in chat history; not searchable] |
| Evidence | [Screenshot of an Enugu facility listing with wrong hours or a dead number] | [Your Interview 2 artefact] |

*(Optional: if you find a Nigerian health directory or booking app, add it as a third column with its real pricing from its website.)*

**Our gap:** [One sentence, e.g. "Nobody verifies and re-checks local health contacts, and nobody shows when they were last checked."]

---

## 4. Three cited sources

Each source must be official (law, regulator, standard or official documentation) and change the design.

| # | Source | Link | How it changes the design |
| --- | --- | --- | --- |
| 1 | Nigeria Data Protection Act 2023 (Nigeria Data Protection Commission) | [Official link] | We collect minimal personal data: reporters' phone numbers are optional and deleted once the report is resolved, and we publish a privacy policy. |
| 2 | Nigerian Communications Commission (NCC) information on the 112 national emergency number | [Official link] | 112 is always shown first on the Emergency page and is never replaced by paid or sponsored contacts. |
| 3 | [Pharmacists Council of Nigeria premises register OR Enugu State Ministry of Health facility list] | [Official link] | Verification starts from the official register, and listings are matched to registered premises before publishing. |

*(Alternatives if one is hard to find: WCAG 2.2 accessibility guidelines → large tap targets and contrast; Paystack webhook documentation → verify the signature header before trusting any payment.)*

---

## 5. Technical spike

**Riskiest part:** the "open now, nearest first" search. It must handle Lagos time (WAT), opening hours that run past midnight (e.g. 20:00–02:00), distance from the user, and hiding flagged or overdue listings.

**Spike file:** [`spikes/open_now_nearest.py`](spikes/open_now_nearest.py) (50 lines)

**How to run:** `python spikes/open_now_nearest.py`

**What it proves**

- A pharmacy open 20:00–02:00 counts as open at 01:30 and closed at 03:00.
- Results are sorted by true distance from the user.
- Flagged and overdue listings never appear.

**Result:** [Paste the output, e.g. "Spike passed: past-midnight hours, distance order and trust filter all work."]

**What I learned that changes the build:** [e.g. "Hours that cross midnight must be checked against yesterday's row too, so the `opening_hours` table keeps one row per day with closes allowed to be earlier than opens."]

---

## 6. Three design decisions

Each decision must point to a finding above.

| # | Decision | Because of (finding) |
| --- | --- | --- |
| 1 | Show a "last verified" date on every listing and re-check numbers on a fixed cycle | [Interview 2 / WhatsApp artefact: people forward numbers without knowing if they still work] |
| 2 | Show fees as a dated range labelled "estimate", never a single price | [Interview 1: prices change often / facility unwilling to publish exact prices] |
| 3 | Build a lightweight, installable web app with an offline Emergency page instead of a native app first | [Interview 2: low-cost phone, limited data] + [Source 2: 112 must be reachable at all times] |

*(Replace the reasons with what your interviews actually showed. If a finding contradicts a decision, change the decision.)*

---

## 7. Paper design (linked)

- ERD (9 tables): `docs/erd.png`
- Endpoint list: `specs/backend/endpoints.md`
- Screen sketches: `docs/screens/`

---

## Research checklist

- [ ] Two interviews with role, date, questions and surprise
- [ ] One checkable artefact per interview, redacted
- [ ] Two competitors or workarounds with price and gaps
- [ ] Three official sources, each with its design effect
- [ ] Spike in `/spikes`, 50 lines or fewer, runs and passes
- [ ] Three design decisions, each tied to a finding
- [ ] ERD and screens in `docs/`, endpoints in `specs/`
