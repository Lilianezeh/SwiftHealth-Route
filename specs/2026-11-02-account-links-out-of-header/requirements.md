# Requirements: Log in and Sign up out of the public header

Branch `feature/header-without-account-links`. Status: **built (2026-11-02); draft pull request.** The owner's request of 2026-11-02: move
sign-up and log-in out of the public header so visitors do not think they need an account.

## What this covers

| ID | Requirement (from specs/prd.md) | Priority |
| --- | --- | --- |
| FR-02 | The header: SwiftRescue on every page, in the bar | Must |
| FR-48 | Sign up (staff and facility owners) | Must |
| FR-49 | Staff sign-ups are approved by an admin | Must |
| US-13 | The site is usable without an account; the home page stays light | Must |
| NFR-01 | Small and fast (the header no longer asks the API anything) | Must |
| NFR-10 | 16 px text, 48 px targets, tidy at 320 px, readable in Light and Dark | Must |

## What the owner asked, and what was done

1. **Header, logged out: only SwiftRescue, For facilities and the theme button.** Log in and Sign up are removed from the bar and from the
   phone Menu. When logged in, **My account** stays. (On every page except the home page "Find care" is also in the bar, as before: the
   request was to remove Log in and Sign up, and on the home page the bar is exactly the three things above. See "For the owner".)
2. **`/for-facilities`:** the buttons **"Sign up as a facility owner"** (only while sign-up is open) and **"Log in"**, near the top and again at
   the end. The sign-up page opened from here starts with **Facility owner already chosen** (`/sign-up?as=owner`). "List your facility" stays
   at the end.
3. **Footer:** a small **"Staff portal"** link (the last footer link) to the new page **`/staff-portal`**, which has **"Log in"** and **"Sign up as
   staff"** (only while sign-up is open). The staff sign-up starts with **Staff already chosen** (`/sign-up?as=staff`) and says that an
   admin must approve it.
4. **`/log-in` keeps its address**, so bookmarks still work (and `/admin/login` still redirects to it).
5. **The home page keeps "Free to use · No sign-up needed".**

## Rules

- `?as=owner` means a facility owner account, `?as=staff` a staff account; any other value, a list of values or none means no choice and the
  sign-up page asks as before (`lib/account/signupKind.ts`). Nothing about the choice is kept in the browser.
- The sign-up button is a link only while `signup_open` is true (`GET /meta`); otherwise "Sign-up is not open yet." takes its place, as before.
- `/staff-portal` is **not indexed**, and is **not** in the header, the Menu or the sitemap.
- The header no longer asks `GET /meta` (it needed it only to decide about Sign up): one request less on every page.
- No new table, column, route of the API, package or setting.

## For the owner (small choices of mine)

- **"Find care"** is still in the bar on the pages other than the home page, as before; you listed only SwiftRescue, For facilities and the
  theme button for the logged-out header, which is exactly the home page. Say if you want "Find care" out of the bar everywhere.
- A person who logs in sees **My account** appear in the bar (a small change of the bar). Before, room was kept so nothing moved; that cost
  every visitor an empty gap in the bar for something only the few with an account see.
- The **login page** still has its own "No account yet? Sign up." line under the first step (`/sign-up` with the question). It is on the page for
  people who chose to log in, not in the header; say if you want it changed too.
