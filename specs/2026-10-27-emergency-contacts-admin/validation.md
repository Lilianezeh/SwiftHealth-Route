# SwiftRescue contacts screen: validation

Requirements: [requirements.md](requirements.md). Plan: [plan.md](plan.md). UI spec 3.13; API spec section 5, "SwiftRescue contacts for staff".

## Results (2026-10-27)
- Backend: **2148 passed**, ruff clean. New: `test_emergency_contacts_admin.py` (13): 401 without a token, 403 for a verifier and a provider, 200 for an editor and an admin; the nine groups in the page's order and no 112; contacts of every status by name with status and phone; only the group's own category; at most 100 per group with the real total; a draft or hidden contact is absent from the public `/emergency` and present here; hiding one removes it from the public list, keeps it here, deletes nothing and writes the audit row with the reason; a new contact is a draft and not public; no sponsored flag.
- Frontend: 128 files, **2028 tests passed**, lint and `tsc` clean. New: `EmergencyContacts.test.tsx` (18): who may open it; the groups, counts, Add links, empty groups, contact cards, the error and Retry; Remove asks for a reason, then asks again, sends nothing before the answer, Cancel sends nothing, the call carries the token and the reason, the card turns to Hidden and loses Remove, the API's sentence is shown on a refusal; the staff bar link; no fetch or storage in the file. The new-listing editor selects the category of `?category=` (2 cases) without making it an unsaved change. The staff bar and route-list tests were updated.
- Real browser, **8 of 8** (`emergency-contacts.spec.ts`, 320, 360, 768 and 1024 px, faked API): nine groups, big targets, nothing sideways; Remove asks first and then hides the contact with the reason.
- **No phone number was added by me**: no seed, migration or fixture of the project changed; the tests use made-up numbers.
- **Render / Netlify:** nothing to change. No migration, no variable.
- Not checked by me: the whole road with the real database (add a draft, verify and publish it, see it in SwiftRescue, remove it); each step is tested on its own.
