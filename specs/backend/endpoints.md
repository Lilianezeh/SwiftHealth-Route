# API endpoints (summary)

Full details for every endpoint are in [api-spec.md](api-spec.md). This is a quick index.

| Method | Path | Who |
| --- | --- | --- |
| GET | /health, /meta | Public |
| GET | /search | Public |
| GET | /listings/{slug} | Public |
| GET | /emergency | Public |
| GET | /blood/banks, /blood/donation-centres | Public |
| POST | /reports, /facility-submissions | Public (rate limited) |
| POST | /auth/login, /auth/verify-code | Staff, provider |
| GET | /auth/me | Logged in |
| GET, POST | /listings | Staff |
| GET | /listings/id/{id} | Staff |
| PATCH | /listings/{id} | Verifier (own drafts), editor, admin |
| GET, POST | /listings/{id}/checks | Staff |
| POST | /listings/{id}/submit, /publish, /hide, /reopen | By role (see spec) |
| GET | /reports · PATCH /reports/{id} | Editor, admin |
| GET, PATCH | /provider/listing | Provider |
| POST | /payments/featured · GET /payments/verify/{reference} | Provider |
| POST | /payments/webhook | Paystack (signed) |
| POST | /uploads/sign | Staff |
| GET | /dashboard/stats | Editor, admin |
| GET, POST, PATCH | /admin/users | Admin |
| POST | /admin/import · GET /admin/export | Admin |
