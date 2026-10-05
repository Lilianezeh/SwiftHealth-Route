# LOG.md — SwiftHealth

One entry per day. Keep it short and honest.

## Day 1 — [2026-10-04]
- **Built:** Repo skeleton, Docker Compose, spike for open-now + nearest search.
- **Broke / fixed:** [ ]
- **Learned:** [ ]
- **Tomorrow:** [ ]

## Day 2 — 2026-10-05
- **Built:** First Alembic migration for all 9 tables (proved with upgrade, downgrade, upgrade).
  Demo seed data: 12 categories, 4 users (one per role), 30 fictional listings across all 10 areas,
  with phones, hours, services, blood groups, verification checks and audit entries. Safe to run twice.
  4 repository files (category, user, listing, audit). 28 tests passing, ruff clean.
- **Specs:** Fixed FR-33 label on publish; set re-check cycles (14 / 45 days); removed "groups needed"
  from donation centres (moved to Phase 3).
- **Broke / fixed:** passlib crashed with bcrypt 5.0.0; fixed by pinning bcrypt 4.0.1.
  Alembic couldn't import the app; fixed with prepend_sys_path in alembic.ini.
- **Learned:** [write this in your own words, e.g. what a migration is, why the seed never overwrites]
- **AI use:** Claude Code planned and wrote the migration, seed, repositories and tests;
  I reviewed the plan, chose the options, and approved each file.
- **To do later:** In the search feature, treat is_24_hours listings as always open (no 23:59 gap).
- **Tomorrow:** Auth and roles (login, one-time code, JWT, role and ownership checks).
