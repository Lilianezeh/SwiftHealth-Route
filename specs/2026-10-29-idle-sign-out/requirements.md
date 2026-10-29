# Automatic sign-out after no activity

Requirements: **NFR-06** (sessions and tokens), **NFR-10** (accessibility; WCAG 2.2.1 Timing Adjustable), **FR-30** (login).
Written 2026-10-29 from the owner's request. Contracts: `specs/backend/api-spec.md` (`POST /auth/keep-alive`, `expires_in`), `specs/frontend/ui-spec.md` 3.1a.

## What the owner asked for
- Admins are signed out after **5 minutes** with no activity; other logged-in accounts (editors, verifiers, providers) after **15 minutes**.
- One minute before, an accessible warning "You'll be signed out in 60 seconds" with a **"Stay signed in"** button; then sign out, clear the session and go to `/log-in` with a short message.
- Activity = clicks, typing, scrolling, **in any open tab**.
- The **server must also refuse** sessions that have been idle longer than the limit.
- Both limits are **settings**.

## How it works
1. **Server (the part that cannot be bypassed).** The login token (JWT) now lives only as long as the idle limit of the account's role, not 12 hours. `POST /auth/keep-alive` gives a fresh token while the person is active; a token that is not renewed simply expires, and the API answers 401. The token still holds no role: the length is chosen when it is made, from the role in the database at that moment (login, password change, every renewal). The whole session is still capped at `JWT_MINUTES` (12 hours) by a start-of-session claim (`sts`) that every renewal passes on.
2. **Settings.** `IDLE_MINUTES_ADMIN` (default 5) and `IDLE_MINUTES_OTHER` (default 15), each at least 2 (the warning comes 60 seconds before the end). The API tells the browser the limit in `expires_in` at login and at every renewal, so the browser has no copy of the numbers except a fallback for a session saved before this change.
3. **Browser.** One client part in the root layout watches the clock once a second, shows the warning, signs out, and renews the token while the person acts (at most once a minute). The moment of the last click/key/scroll/touch is one number in `localStorage`, shared by every tab; the token stays in `sessionStorage` per tab (decision C2 of the staff screens is kept: **no token in `localStorage`**).

## Why it is built this way
- **No new table, no new column, nothing stored on the server.** "The server refuses an idle session" is done by the token's own expiry plus renewals. This keeps the 10 tables as they are. The cost: the server's idea of "idle" is the time since the last *renewal*, and renewals are sent at most once a minute, so the server may allow up to about a minute more than the browser's own timer, never less than the limit counted from the last renewal.
- **The role chooses only the length.** A demoted or promoted account gets the right length at its next renewal (at most a minute of activity later); the role check on every request is unchanged.
- **Clock, not counters.** The browser compares real timestamps, so a sleeping laptop, a throttled background tab or a slow device sign out at the right moment.

## Decisions
These numbers belong to this feature (LOG.md has its own short list, I1 to I4, for you to review).

| ID | Decision |
| --- | --- |
| I1 | A 401 from a renewal signs the person out (the server counted the session as idle); any other failure (502, no network) is ignored, so a sleeping API cannot sign anyone out. |
| I2 | While the warning shows, only the **Stay signed in** button counts as activity in this tab. A stray scroll or click must not hide the warning; activity in *another* tab does (the person is there). |
| I3 | Sessions made before this change have a 12-hour token and no `idle_seconds`. The browser uses the default limit of the role (same numbers as the settings' defaults); the server still honours the old token until it expires or is renewed (the first renewal gives the short one). |
| I4 | `expires_in` of the login and of `POST /account/password` is now the idle limit (it was the whole session, 43200). Nothing else read it. |
| I5 | Two tabs of one browser have two sessions (`sessionStorage` is per tab) but one idle clock: activity in either keeps both alive, and both sign out together. |
| I6 | If `localStorage` is blocked (private mode) each tab counts its own activity only. |
| I7 | Out of scope: remembering what was typed in a form before sign-out (a person away for 5 minutes loses an unsaved form); a "remember me" option; changing the 12-hour cap. Tell me if you want any of them. |

## Not changed
Public pages need no login and are never affected. Visitors who are not logged in see nothing: the component draws nothing and listens to nothing.
