# Light is the default theme: plan

Requirements: [requirements.md](requirements.md). Tests first.

1. Tests (red first)
   - `tests/unit/theme.test.ts`: nothing kept is Light; `system` is kept; anything else is Light; the script gives Light on a dark device unless `system` or `dark` is kept; the script and `applyTheme` agree for every choice.
   - `tests/unit/ThemeToggle.test.tsx`: the first state is Light ("Colour theme: Light. Change to Dark."), the cycle is Dark, System, Light, each choice is kept, looking at the page keeps nothing.
   - `tests/unit/darkMode.test.ts`: the dark values exist once, under `data-theme="dark"`; the CSS rules have no `prefers-color-scheme` and no `:root:not([data-theme])`; `:root` says `color-scheme: light`.
   - `tests/end-to-end/dark-mode.spec.ts`: a dark device with nothing chosen gets the light page (paper background, `color-scheme: light`, nothing kept); System chosen on a dark device gets Dark; the button and the Menu row start on Light; the width, 112 card and overflow checks choose Dark with the button's key.
2. Code
   - `src/lib/theme/theme.ts`: `readChoice` (Light by default), `saveChoice` (keeps all three).
   - `src/lib/theme/themeScript.ts`: Dark only for `dark`, or for `system` on a dark device.
   - `src/components/layout/ThemeToggle.tsx`: the first render is Light.
   - `src/styles/globals.css`: `color-scheme: light`; the `prefers-color-scheme` block is removed.
3. Docs: `specs/frontend/ui-spec.md` "Dark mode"; this folder; `LOG.md` once, at the end.
