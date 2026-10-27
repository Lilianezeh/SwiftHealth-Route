# Dark mode: plan

Requirements: [requirements.md](requirements.md). Spec first (`ui-spec.md`, "Dark mode"), then tests, then code.

1. Tests first: `darkMode.test.ts` (the dark blocks, every pair at 4.5:1 and every edge at 3:1, the light mode unchanged), `darkModeSource.test.ts` (no class on the wrong side of a role; header, layout, 112 card, logo, QR, map, chart), `theme.test.ts` (the choice, the script against the app code for every choice), `ThemeToggle.test.tsx`; `design-tokens.test.ts` reads the `@theme` block only.
2. Tokens: `globals.css` (four new tokens and `snow`, `@custom-variant dark`, the two dark blocks, `color-scheme`, the body); the 66 files from `bg-white` to `bg-surface`; `bg-forest` to `bg-pine`; `alert`, `on-amber`; `buttonStyles` (secondary `dark:` edge, onDark `snow`); map and chart.
3. Behaviour: `lib/theme/theme.ts`, `lib/theme/themeScript.ts` (in the root layout's head), `ThemeToggle` in the header bar and the Menu.
4. Existing tests that named the old classes were updated to the new names (listed in validation.md).
5. Real browser: screenshots in both modes of the main pages, a Lighthouse run in both modes, and the existing browser suite.
