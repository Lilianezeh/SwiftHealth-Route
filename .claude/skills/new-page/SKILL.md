---
name: new-page
description: Build a Next.js page or component for SwiftHealth wired to the API, mobile-first and accessible. Use when I ask to build a screen (e.g. "build the Find blood page", "add the report form").
---

# Build a web page

1. Read the requirement (FR/US ID) and the screen's section in specs/frontend/ui-spec.md, then check the API endpoint
   it needs exists. If the spec is unclear or the endpoint is missing, stop and say so.
2. Propose a plan and wait for approval: route path, server vs client components, data fetched,
   states (loading, empty, error), and which shadcn/ui components to add.
3. Add shadcn/ui components only as needed: `npx shadcn@latest add <name>`.
4. Implement: page in frontend/src/app/... (thin), feature components in frontend/src/components/<feature>/,
   API calls in frontend/src/lib/api/ with types in frontend/src/types/ (no `any`).
5. Rules:
   - Mobile-first; tap targets at least 48px; body text 16px+; good contrast.
   - Call buttons use tel: links with +234 numbers; Directions open Google Maps.
   - Emergency pages: 112 first, no sponsored content, disclaimer visible.
   - Fees always labelled as estimates; listings show the last-verified date.
6. Add a Vitest unit test for any helper logic; add or update a Playwright test for main journeys.
7. Run `npm run lint && npm run typecheck && npm test` in frontend/ and report results.
8. Summarise what changed and what I should check on my phone.
