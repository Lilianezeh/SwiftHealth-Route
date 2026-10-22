# Footer link "Staff and provider login": requirements

A small link in the site footer to the staff and provider login. Branch: `feature/footer-staff-login`, from `main`. Owner's request of 2026-10-22.
Tests: [validation.md](validation.md).

## Requirements

[prd.md](../prd.md): **FR-30** (staff and providers log in with a password and an SMS code), **FR-43** (a provider logs in like staff), **US-13** and **NFR-10** (works on a
small phone: links 48 px high, text 16 px or more). Source of truth: [ui-spec.md](../frontend/ui-spec.md) "Layout" (Footer) and 3.1. Frontend only: no API, table or package.

## What changes

- The footer gets one link, **Staff and provider login**, to `/admin/login`, on a line of its own under the six information links and above the "© 2026" line.
- Nothing else changes in the login: a **provider** lands on `/provider`, an **editor** or **admin** on the dashboard `/admin`, a **verifier** on `/admin/listings?mine=true`
  (decision C11 and phase 11/12). This was already true; it is now also checked in a real browser from the footer.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| L1 | The link is **not one of the six information links** (its own line, not in the "Footer" navigation), in the soft ink colour, underlined, 48 px high and 16 px text: it must be easy to tap but not shout at residents. | Put it in the list of links |
| L2 | **It is the only link to the login on the whole site** (not in the header or the Menu, not in the site settings). It is never prefetched, so an ordinary visit does not load the staff area. | Also in the Menu |
| L3 | The login page and the staff area stay `noindex` and out of the sitemap and `robots.txt` allows nothing new: the link does not make them findable by search engines. | None |
| L4 | **The header's width problem is not part of this change.** At 344 to 370 px the page header is a few pixels wider than the screen with this machine's fallback font (a known note in `LOG.md`); the footer itself fits at 320, 360, 768 and 1024 px. | Fix the header here |
