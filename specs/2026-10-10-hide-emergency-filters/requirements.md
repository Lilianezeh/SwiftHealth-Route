# Hide the emergency categories in the Filters sheet (small frontend PR): requirements

What this small frontend change must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it
is done is in [validation.md](validation.md). It follows the
[categories migration](../2026-10-10-reference-categories/requirements.md): production now has all 12 categories, and the
Filters sheet would list the 7 emergency ones next to the 5 everyday ones.

## Requirements

- **FR-05:** the search filters include the category. The list comes from `GET /meta`.
- **FR-15:** SwiftRescue groups the emergency contacts (Ambulance, Fire, Police, 24-hour emergency units, Roadside assistance,
  Security, Blood banks). They have their own section, [`/emergency`](../frontend/ui-spec.md) (phase 7), and Blood has its own page.
- **FR-01:** the Find page shortcuts are Hospitals, Clinics, Pharmacies, Maternity and Labs, in that order.
- **NFR-10:** the sheet must stay clear: five choices read faster than twelve, on a small phone.

Source of truth: [ui-spec.md](../frontend/ui-spec.md) (2.3, item 1), [prd.md](../prd.md), [api-spec.md](../backend/api-spec.md)
(`GET /meta`). Branch: `feature/hide-emergency-filters`. Every commit and test references these IDs.

Fit with the project: [mission.md](../mission.md) wants a resident to find care quickly, and [tech-stack.md](../tech-stack.md) is
unchanged. No new package, no backend change, no new setting.

## In scope

- `FiltersDialog` offers only categories with `is_emergency: false`, in the order of the Find shortcuts, then any other
  everyday category in the order `GET /meta` gives (owner's decisions, 2026-10-10).
- A category that is already selected from a shared link stays in the list, with its real name, and stays selected, even
  when it is an emergency category (owner's decision). It is shown only while it is selected.
- UI spec 2.3 item 1 says so (Task 0).

## Out of scope (planned elsewhere)

- `GET /meta` keeps returning all 12 categories with `is_emergency`: the phase 10 listing editor needs them, and the
  api-spec says so. No backend change.
- The Find page shortcuts (a fixed list, already five) and `/search` itself, which still accepts any category slug.
- SwiftRescue and the Blood page: phases 7 and 8.

## Decisions

1. **Filter on `is_emergency`, not on a list of slugs.** A new everyday category added later (for example by the phase 10
   editor) shows up in the sheet by itself, and a new emergency category stays out of it.
2. **Order: the Find shortcut order, then the rest.** The shortcut order is `CATEGORY_SHORTCUTS` in `config/search.ts`
   (Hospital, Clinic, Pharmacy, Maternity, Laboratory). Production's ids give Clinic, Pharmacy, Laboratory, Hospital, Maternity,
   which would not match the Find page. Categories that are not in that list follow in the order `GET /meta` gives. The sort
   is stable, so two unknown categories keep their `/meta` order.
3. **A selected emergency category stays visible.** A shared link such as `/search?category=ambulance` still filters the
   results. If the sheet then said "Any category" it would be wrong about what is applied, so the selected category stays in
   the list with its real name ("Ambulance", looked up in `GET /meta`), after the everyday ones, and Apply keeps it in the
   address. "Already selected" means the category that is applied now (the one in the address), not what the visitor is
   choosing inside the open sheet. So when the visitor applies another category, the emergency one leaves the list the next
   time the sheet is opened, and closing the sheet without applying keeps it. If a slug is not in
   `GET /meta` at all, the sheet shows the slug as before.
4. **Hiding is a display choice, not a rule.** Nothing stops `/search` from filtering by an emergency category; only the sheet
   does not offer it.
