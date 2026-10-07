---
name: next-feature
description: Start the next SwiftHealth feature from specs/roadmap.md: find the next phase, branch from an up-to-date main, ask about the spec, create the feature folder with requirements.md, plan.md and validation.md, and mark the phase in progress. Use when I say "start the next feature".
---

# Start the next feature

Do the steps in order. This skill writes only the spec folder and the roadmap status, never code.

1. Find the phase. Read specs/roadmap.md and take the first numbered phase whose heading does not end in "Done".
   - If it says "In progress", stop. Tell me the phase and its feature folder and ask whether to continue it instead.
   - Ignore "After the MVP": those items are not phases.
   - If the phase looks bigger than about a day of work, ask me whether to split it before going on.
2. Prepare git.
   - Run `git status --short`. If there are uncommitted changes, stop and ask me what to do with them.
   - Tell me the current branch. If it has commits that are not on origin or not merged into main, say so and ask before switching.
   - Run `git fetch origin`, `git switch main`, `git pull --ff-only`. If the pull is not a fast-forward, stop and tell me.
   - Create `feature/<feature-name>` (kebab-case, from the phase name) with `git switch -c`. Touch no other branch.
3. Read before asking: specs/mission.md, specs/tech-stack.md, the phase's requirement IDs in specs/prd.md, its section in
   specs/backend/api-spec.md and specs/frontend/ui-spec.md, and specs/2026-10-05-auth-and-roles/ as the format example.
   If the spec is missing or seems wrong, say so and propose the spec change first (spec first, then code).
4. Before writing anything to disk, ask me with AskUserQuestion, grouped on the three files (one call, or two if needed):
   - requirements.md: scope, what is out of scope and which roadmap phase takes it, key decisions with real alternatives.
   - plan.md: how to split the work into tasks (each about a day, tests first, one commit per task), files to touch, order constraints.
   - validation.md: which edge cases, security checks and smoke test matter for this feature.
   Take the options from the roadmap and specs, recommend one, and do not ask what the spec already answers.
5. Create specs/YYYY-MM-DD-feature-name/ (today's date from `date +%F`, kebab-case name) with three files, following
   specs/2026-10-05-auth-and-roles/:
   - requirements.md: Requirements (IDs linked to prd.md, not copied), source-of-truth links, branch name, a line saying how it fits
     specs/mission.md and specs/tech-stack.md (linked), In scope, Out of scope (with the roadmap phase), numbered Decisions with reasons.
   - plan.md: links to the other two files, the rules (tests first, one commit per task, requirement IDs in every commit and test),
     a Files table, and numbered task groups ("### Task 0: ...") with unticked `- [ ]` steps. A task is ticked with its commit hash when done.
   - validation.md: How to run (commands from CLAUDE.md), tests per task with exact names, review-focus edge cases, security checklist,
     smoke test, and a merge checklist that ends with "The pull request stays a draft until every box above is ticked."
   Rules: every FR, NFR and US ID must exist in specs/prd.md; link requirement text, never copy it; never invent API fields, library
   APIs or legal claims; write plain full sentences; tick nothing.
6. Update specs/roadmap.md: set the phase heading to "In progress", add a "Feature folder:" line linking the three files (as Phase 2 does),
   and list the plan's tasks as "next".
7. Check: every link resolves, every ID exists in prd.md, `git status` shows only the new folder and roadmap.md.
8. Show me the full text of the three files and the roadmap diff. Do not commit and do not open a pull request until I ask.
   When I ask for a pull request, make it a draft.
