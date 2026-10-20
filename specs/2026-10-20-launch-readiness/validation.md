# Launch readiness (Phase 14): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] Import and export need the admin role (403 for others, 401 without a login)
- [ ] A cell that starts with `=`, `+`, `-`, `@` is neutralised on export
- [ ] The import cannot make more than 500 rows or read more than 1 MB; it creates drafts only
- [ ] No backup file is committed, printed or left outside `backups/`; the restore refuses the source database

## Merge checklist
- [ ] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green
- [ ] The owner read the release checklist, the runbook and the analytics proposal
- [ ] The pull request stays a draft until every box above is ticked.
