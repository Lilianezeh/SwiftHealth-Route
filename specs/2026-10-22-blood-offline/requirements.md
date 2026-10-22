# /blood works offline after one visit: requirements

Find blood opens with no network after one visit, the same way SwiftRescue does: the saved page and the saved blood bank numbers, with the date they were saved.
Branch: `feature/blood-offline`, from `main`, as a separate pull request from [blood-only-on-blood-page](../2026-10-22-blood-only-on-blood-page/requirements.md) (owner's request of 2026-10-22).
How we build it: [plan.md](plan.md). Tests: [validation.md](validation.md).

## Requirements

[prd.md](../prd.md): **US-15** (find the nearest blood bank and which blood groups it usually supplies), **FR-27** (the list, with Call, Directions and the note "Stock changes daily; call to confirm before you go"),
**NFR-03** (works offline where it matters most), **NFR-07** (no position stored or sent anywhere it should not be), **NFR-10** (text 16 px or more, tap targets 48 px or more).
Pattern to follow: [SwiftRescue offline](../2026-10-17-swiftrescue/requirements.md) (FR-17, decisions A5 and A6). Frontend only: no API, table or package.

## What it does

1. **After one visit** to `/blood` with a network, the page and the files it needs are kept by the same service worker as `/emergency` (`public/sw.js`, one more page path).
2. **The blood bank list is saved by the page** in the browser (`localStorage`, key `swiftrescue-saved-blood-banks`) with the date it was saved: names, area, address, phone, hours note, the blood groups and the date
   they were confirmed, and the stock note. **No distance and no position**, whatever the visitor had allowed.
3. **With no network** (a network failure or a timeout, never an error answer of the API) and a saved copy, `/blood` shows the saved list under the notice
   **"Offline — showing saved blood banks from 22 Oct 2026"**. Call works (a `tel:` link); the blood group chips still filter the saved list.
4. With no network and no saved copy, the page shows the standard error with Retry, as now.

## Assumed owner decisions

| # | Decision I made | Alternative |
| --- | --- | --- |
| N1 | **Only `/blood` is kept**, not `/blood/donate`: you asked for the blood bank numbers. The "Donate blood" tab needs the network (a visitor offline who taps it gets the browser's offline page). | Keep both pages and the donation centres |
| N2 | **What is saved:** the first 100 blood banks (the most the API gives in one answer), in the order of a request with no position (A to Z, then id), taken from a request with **no position and no blood group**. If the visitor's list was asked that way, its answer is saved as it is (the first 20); otherwise one extra quiet request makes the copy (limit 100). The copy is saved again on every visit that loads. | Save only what is on screen |
| N3 | **Offline, the page cannot do what needs the network:** no "Show blood banks near me", no distances, no Load more (it says how many are saved), no Report a problem (the link works once online; it is left out offline to avoid a dead end). The blood group chips work on the saved list. | Show them disabled |
| N4 | **The date is the date it was saved** ("from 22 Oct 2026", Lagos time), the same wording as SwiftRescue. The line "Stock changes daily; call to confirm before you go." stays on every card; a saved list may be old, so the notice is the first thing under the chips. | None |
| N5 | **The saved copy is only used after a network failure or timeout.** An error answer of the API (500, 404) shows the standard error with Retry, not old data, exactly as SwiftRescue does. | Fall back for any error |
| N6 | **One service worker, one cache, one file.** `sw.js` keeps the paths `/emergency` and `/blood`, only without a query, as before; it still never keeps an API answer or anything with `lat` or `lng`. The cache name stays `swiftrescue-v1`. | A second worker |
| N7 | The registration component moves from `components/emergency/` to `components/offline/` and takes the page path, because two pages now use it. | Copy it |
