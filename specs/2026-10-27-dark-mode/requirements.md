# Dark mode: requirements

Requested by the owner on 2026-10-26: "Dark mode last: follow the system setting by default, a Light/Dark/System button in the header and menu, no flash on load, colour tokens with Tailwind 4's dark variant, WCAG AA in both modes, the 112 card stays clearly red, the logo and photos and credits readable, the Security QR code stays dark on white, every page covered." Related: NFR-10 (contrast, readable text), FR-02 (the header), FR-06. UI spec: "Dark mode" under "Design tokens".

## What it is

- **Default: the system.** No choice is kept; the page is dark when the device says so.
- **A Theme button** cycles Light, Dark, System: an icon in the header bar from tablet width, a row with the words "Theme: System" in the phone Menu. It says the choice in words for a screen reader.
- **No flash.** Three lines of script in the `<head>` set `data-theme` on `<html>` before the first paint; a `prefers-color-scheme` rule gives the same colours when script is off.
- **Tokens, not classes.** The role tokens change value under `data-theme="dark"`; every class that uses them follows. Tailwind's `dark:` variant (declared on `data-theme`) is used once, for the outline button's hover edge.

## Decisions

| # | Decision | Why |
| --- | --- | --- |
| M1 | Two kinds of token. **Role tokens change** (page, surface, ink, ink-soft, line, forest, the tints, the label colours, whatsapp-dark, alert). **Constant tokens never change** (pine, pine-dark, accent, sky, sky-pale, paper, amber, on-amber, snow, emergency). | The header, hero, buttons, logo and red buttons then look the same in both modes with no per-component work, and a text-on-colour pair cannot be broken by a switch. |
| M2 | `bg-white` became `bg-surface` everywhere (108 places in 66 files), `bg-forest` became `bg-pine` (four bars with white text), the page is `bg-page`, red text and the 112 card's border are `alert`. A source test refuses `bg-white`, `bg-forest`, `bg-paper`, `text-emergency` and the pairs that would be unreadable in one mode. | Honest names: white is not "a card", and forest is the text blue. The test keeps a new component from bringing the old names back. |
| M3 | **The 112 card stays clearly red**: a red border (`alert`, brighter in the dark) on a dark card, and the same red Call 112 button with white text (constant). The header's SwiftRescue button is the same red in both modes. | Your rule; the button is a constant, the border is the only part that is lighter. |
| M4 | **The map keeps its light tiles** in both modes; its pin and position dot are constant blues, its popups and credit follow the surface and ink tokens. | A dark map would need another tile provider (new outside service, possibly paid): not decided here. |
| M5 | **Photos and the logo are untouched.** The home slideshow sits under the dark section tint, with its controls and credit on dark cards. The logo has constant colours on the blue bar. | "Logo and photos and credits readable": checked in screenshots and by contrast tests. |
| M6 | **The Security QR code is made by the library as black on white with a white frame** and is never themed (no colour option, no `dark:`, no filter). A test reads the library's own defaults. | A QR code inverted or tinted may not scan. |
| M7 | The choice is kept in the browser only (`localStorage` key `swifthealth.theme`, "light" or "dark"; System removes it). Privacy now says so. | Without it every page would forget. It is a preference, not an identifier, and it is never sent. |
| M8 | The browser's address-bar colour (`themeColor`) stays the header blue in both modes. | The header is the same blue in both modes. |
| M9 | A new token `snow` (a white that stays white) is used by the white button on blue bands (hero, Find page). The Find page's first button became that button (it was the outline button). | The outline button would turn dark on the blue band in the dark mode; the white one keeps the look of the home page. |

## Out of scope

A dark map; a per-user theme on the server; dark photos; changing the light colours (they are unchanged, and tested).
