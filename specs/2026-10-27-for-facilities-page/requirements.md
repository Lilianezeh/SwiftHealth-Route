# The "For facilities" page: requirements

Requested by the owner on 2026-10-26: "a /for-facilities page (free listing, how verification works, Featured and its price from FEATURED_PRICE_NAIRA, how to claim, buttons to Sign up and List your facility, linked from the header)". Related: FR-23, FR-44, FR-45, FR-50, FR-51, NFR-10, NFR-12. UI spec 2.9b; API spec section 3 (`/meta`).

## What the page says

One `h1` "For facilities" and four `h2` sections: **Listing is free** (during launch), **How verification works** (a call and a visit, the verified date, checks again on a cycle, paying never buys the Verified label, a link to How we verify), **Featured** (first in matching searches with a Sponsored label for 30 days; only a published, verified listing; never in SwiftRescue; paying does not change verification; the price) and **How to claim your facility** (four steps). Then two buttons: **Sign up** and **List your facility**.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| F1 | The price comes from the API, not from the page: `GET /meta` gets `featured_price_naira` ("5000.00", from `FEATURED_PRICE_NAIRA`). It is public. | The page must never disagree with what a provider pays, and the owner named the setting. A price list is not a secret. A test checks that no amount is written in the page's source. |
| F2 | The header's and the Menu's **For facilities** link goes to `/for-facilities` (it went to `/list-your-facility`). The footer keeps "List your facility", and the home page section is unchanged. | "Linked from the header." The new page offers the old one as a button. |
| F3 | **Sign up** is a link only while `signup_open` is true; otherwise "Sign-up is not open yet." (also when the API cannot be reached). | Sign-up stays closed in production; a link to a page that cannot work is worse than none (as in the header, decision D16 of the accounts work). |
| F4 | When the price cannot be read, the price line is left out and the rest of the page stays. | The page is useful without the number; it must not show a wrong one. |
| F5 | The page is a server page. Only the price and the buttons are client parts. | Speed on slow connections (NFR-01); nothing else needs script. |

## Out of scope

Changing the price, the 30-day period or the Featured rules (see the Sponsored rules check); any change to the sign-up or the list-your-facility pages.
