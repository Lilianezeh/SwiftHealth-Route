# Blood (Phase 8): validation

Requirements: [requirements.md](requirements.md). Tasks: [plan.md](plan.md).

## Results
Written at the end of the feature.

## Security and privacy checklist
- [ ] A visitor's position is used for the request only and is in no address, storage beyond the tab, or log (NFR-07)
- [ ] Nothing sponsored, and no unpublished or flagged listing, in either list (FR-19, trust rules)
- [ ] No medical text was written by me: the donor guidance is empty until the medical advisor supplies reviewed text

## Merge checklist
- [ ] Lint, typecheck, tests, build clean; numbers written above
- [ ] Both CIs green
- [ ] Real-browser checks at 320, 360, 768 and 1024 px pass
- [ ] **The owner decided who supplies the donor guidance (the medical advisor)**
- [ ] The pull request stays a draft until every box above is ticked.
