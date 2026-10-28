# Light is the default theme: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md).

## Results (2026-10-27)
- Frontend: 132 files, **2132 tests** passed (one more than before); `tsc` and lint clean.
- Real browser: `dark-mode.spec.ts`, **33 of 33** passed. A dark device with nothing chosen gets the light page (paper background `rgb(246, 243, 236)`, `color-scheme: light`, `data-theme="light"` already at DOMContentLoaded, nothing in `localStorage`); the same device gets Dark once System is chosen; Dark kept with the button survives a reload; the button and the Menu row start on Light and cycle Dark, System, Light; the 112 card, the overflow and the 16 px checks run with Dark chosen through the button's key.
- Backend: not touched.
- No light-mode token value changed (`darkMode.test.ts` still compares the light tokens with the constant list).

## Existing tests changed on purpose
`theme.test.ts`, `ThemeToggle.test.tsx`, `darkMode.test.ts` and `dark-mode.spec.ts` used to say "a dark device gives a dark page" and "System keeps nothing". They now say the opposite, as the owner asked.

## Render / Netlify
Nothing to change. No migration, no variable.

## Not checked by me
- A real phone set to dark mode: open the site on it and it should be light. Press the sun/moon/screen button in the bar (or the Theme row in the Menu): Light, then Dark, then System.
- Someone who chose System before this change is Light until they press the button again.
