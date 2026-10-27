# SwiftRescue contacts screen: plan

Requirements: [requirements.md](requirements.md). Tests first.

1. Spec: `api-spec.md` section 5 ("SwiftRescue contacts for staff") and `ui-spec.md` 3.13.
2. Backend: `GET /staff/emergency-contacts` (`schemas/emergency_admin.py`, `services/emergency_admin_service.py`, `api/routes/emergency_admin.py`), a read-only view over the staff listing list for each of the nine groups; tests in `test_emergency_contacts_admin.py`.
3. Frontend: `components/admin/EmergencyContacts.tsx` and the page `/admin/emergency-contacts`; the staff bar link; `lib/api/staff.ts` `listEmergencyContacts`; the new-listing editor reads `?category=`; tests `EmergencyContacts.test.tsx`, the editor, staff bar and route-list tests.
4. Real browser: `emergency-contacts.spec.ts` at 320, 360, 768 and 1024 px with a faked API.
