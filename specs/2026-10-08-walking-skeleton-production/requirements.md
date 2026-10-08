# Walking skeleton in production: requirements

What this feature must do and the decisions behind it. How we build it is in [plan.md](plan.md); how we know it is
done is in [validation.md](validation.md).

## Requirements

- **NFR-05:** Availability, with the Emergency page served from a CDN so it stays up if the server is down.
- **NFR-06:** HTTPS everywhere, staff two-factor login, hashed passwords, role-based access, rate limiting.

Source of truth: [prd.md](../prd.md). Branch: `feature/walking-skeleton-production`. Every commit and test references
NFR-05 or NFR-06. This is roadmap [phase 4](../roadmap.md). The health endpoint is specified in "GET /health" in
[api-spec.md](../backend/api-spec.md); it does not change.

Fit with the project: the mission says the MVP must work on low-cost phones on slow connections
([mission.md](../mission.md)), and nothing the public sees counts until it is live. This feature puts the stack
decided in [tech-stack.md](../tech-stack.md) (Netlify for the frontend, Render for the backend) into production with
nothing but the health check on it. It adds no table, no endpoint and no page.

## In scope

- Deploy the backend to Render (Docker, with a Render PostgreSQL database) and the frontend to Netlify.
- Keep the deploy settings in the repository: `render.yaml` and `netlify.toml`. Secrets stay in the dashboards.
- Start the production API with `APP_ENV=production` and a long random `JWT_SECRET`
  (the check already exists, see the [auth requirements](../2026-10-05-auth-and-roles/requirements.md), decision 12).
- Set `CORS_ORIGINS` to the Netlify address, and `NEXT_PUBLIC_API_URL` to the Render address.
- Settle `TRUSTED_PROXY_COUNT` and the proxy-header question from the "To do later" list in [LOG.md](../../LOG.md),
  using one real request through Render.
- Make the API accept the database address Render gives us (decision 4).
- Prove it with a smoke test: HTTPS on both sides, `/health` on Render, and the existing home page showing
  "connected".
- Remove the finished Render reminders from `LOG.md`, and add the free-plan reminders (decision 3).

## Out of scope (planned elsewhere)

- A new page. The existing home page already calls `/health` through `lib/api/` and shows the API status, so it is the
  minimal page. The real landing page is [roadmap](../roadmap.md) phase 13a.
- Daily backups and a tested restore (NFR-09): phase 14b. The free database has no backups (decision 3).
- Moving to paid Render plans, a custom domain and the release criteria: phase 14d.
- The nightly re-check job as a Render Cron Job: phase 11b.
- Real SMS sending through Termii: before the first real SMS, see "To do later" in [LOG.md](../../LOG.md).
- Paystack, Cloudinary and Resend keys: set when the phase that uses each one starts (phases 10 and 12).
- Serving the Emergency page from a CDN (the second half of NFR-05) is built with the page in phase 7d. Netlify
  already serves the frontend through its CDN, but this feature adds no emergency page to prove it.

## What the official documentation says

Checked on 2026-10-08 (Task 0 finished the list: health checks, secrets, the Netlify monorepo page and the client
address).

- **Netlify and Next.js:** the App Router works through the OpenNext adapter, which supports Next.js 13.5 and later.
  It is applied automatically, with no plugin and no `netlify.toml` needed
  ([Netlify Next.js overview](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)).
  We use Next.js 15.5.4.
- **Netlify build settings:** `netlify.toml` has `[build]` with `base`, `publish` and `command`. Paths in it are
  relative to the base directory. In a monorepo the file may live in a subdirectory, but then the base directory or
  package directory must be set so Netlify finds it. Environment variables need the "Builds" scope to be available
  during the build, and secrets belong in the Netlify dashboard, not in the repository
  ([Netlify file-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)).
- **Render free web service:** it spins down after 15 minutes without inbound traffic, takes about one minute to start
  again, and has 750 free instance hours per month
  ([Render free plans](https://render.com/docs/free)).
- **Render free PostgreSQL:** it expires 30 days after creation, gives 14 days to upgrade before the data is deleted,
  has 1 GB of storage, and has no backups ([Render free plans](https://render.com/docs/free)).
- **Render ports and TLS:** a web service must bind to `0.0.0.0` and should use the `PORT` variable, which defaults to
  `10000`. Render's load balancer ends TLS
  ([Render web services](https://render.com/docs/web-services)). Our `Dockerfile` already starts uvicorn on `${PORT:-8000}`.
- **Render Blueprint (`render.yaml`):** a Docker web service uses `runtime: docker`, `dockerfilePath`, `dockerContext`,
  `healthCheckPath` and `envVars`. A variable can come from the database with `fromDatabase` and
  `property: connectionString`, can be generated with `generateValue: true`, or can be left for us to type in the
  dashboard with `sync: false` ([Render Blueprint spec](https://render.com/docs/blueprint-spec)).
- **Proxy headers:** the FastAPI documentation says the server ignores `X-Forwarded-*` headers unless it is told which
  senders to trust with `--forwarded-allow-ips`, and that `"*"` lets any client fake them
  ([FastAPI, Behind a Proxy](https://fastapi.tiangolo.com/advanced/behind-a-proxy/)).
- **Render health checks:** a path check passes on any `2xx` or `3xx` answer within five seconds. A new deploy gets no
  traffic until its instances pass, and Render cancels the deploy after 15 minutes of failing. The page does not say
  how health checks work with the free plan's spin-down
  ([Render health checks](https://render.com/docs/health-checks)).
- **Render secrets:** the dashboard sets variables under the service's Environment tab, and Render's page warns not to
  commit secret values to `render.yaml`; declare the variable and fill the value in the dashboard
  ([Render environment variables](https://render.com/docs/configure-environment-variables)). That page does not say
  whether variables are encrypted at rest, so we make no claim about it.
- **Netlify monorepo:** a root-level `netlify.toml` with `base = "frontend"` under `[build]` is supported, and it
  overrides the dashboard setting. The publish directory is relative to the base directory
  ([Netlify monorepos](https://docs.netlify.com/build/configure-builds/monorepos/)). The pages do not list a publish
  directory for Next.js, and the Next.js overview says the adapter sets it, so we leave `publish` unset.
- **Client address on Render:** Render's own articles say traffic passes through Cloudflare and Render's load
  balancers, so the app sees a proxy address by default, and the real client is in `X-Forwarded-For`
  ([How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks)). A Render community
  thread reports that Render's proxy does not remove an `X-Forwarded-For` header sent by the client and only appends its
  own address, so the first entry can be faked
  ([community thread](https://community.render.com/t/accessing-client-ips-in-a-node-express-app/36282)). That is why
  our `get_client_ip` counts from the end of the list. For public web services Render's PocketBase guide also names a
  `CF-Connecting-IP` header
  ([Host PocketBase on Render](https://render.com/articles/host-pocketbase-on-render)). Which entry is the real client
  and how many proxies sit in front of us is not stated in the documentation, so Task 3 settles it with a real request
  and a forged header (decision 5). Nothing is guessed before that.

## Security update: Next.js and React (2026-10-08)

Netlify blocked the first deploy because `next` 15.5.4 and `react` and `react-dom` 19.1.1 are affected by
CVE-2025-55182 ("React2Shell", remote code execution in React Server Components). The same versions are also affected by
CVE-2025-55183 (source code exposure) and CVE-2025-55184 (denial of service), whose first fix was incomplete and was
completed as CVE-2025-67779. We upgraded on this branch, with exact versions in `frontend/package.json`:

| Package | Before | After | Why this version |
| --- | --- | --- | --- |
| `next` | 15.5.4 | 15.5.27 | Newest 15.5.x on npm. Next.js names 15.5.7 for CVE-2025-55182 and 15.5.9 for CVE-2025-55183, CVE-2025-55184 and CVE-2025-67779. 15.5.27 (September 30, 2026) also carries later 15.5.x security fixes. |
| `react`, `react-dom` | 19.1.1 | 19.1.9 | Newest 19.1.x on npm. The React blog says 19.1.2 fixes CVE-2025-55182 and 19.1.5 is the fix for the two later issues. 19.1.4 is not enough: the React blog calls it incomplete. |
| `eslint-config-next` | 15.5.4 | 15.5.27 | Pinned to the same version as `next`. |

I found no React advisory after December 2025 on the React blog. The newest 15.5.x and 19.1.x versions are taken from
the npm registry. Our code has no `"use server"` functions today, but the advisories say any App Router app is affected,
so the upgrade was required anyway. The app was never online with the old versions (Netlify blocked the deploy), so no
deployed secret needs rotating because of this.

Advisories:
- [Next.js: CVE-2025-66478 (tracks CVE-2025-55182)](https://nextjs.org/blog/CVE-2025-66478)
- [React: critical vulnerability in React Server Components (CVE-2025-55182)](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [Next.js: security update of December 11, 2025 (CVE-2025-55183, CVE-2025-55184, CVE-2025-67779)](https://nextjs.org/blog/security-update-2025-12-11)
- [React: denial of service and source code exposure in React Server Components](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components)
- [Next.js: September 2026 security release (15.5.27)](https://nextjs.org/blog/september-2026-security-release)

## Decisions

1. **Scope: deploy plus the Render reminders from `LOG.md`.** The alternative, deploy only, would leave
   `TRUSTED_PROXY_COUNT` unchecked until the rate limiter matters in production. The login rate limit depends on it
   ([NFR-06](../prd.md#non-functional-requirements)), so it is cheaper to settle it now, while the only request is ours.
2. **The existing home page is the minimal page.** `getHealth()` in `lib/api/client.ts` already calls `/health` and the
   home page shows "connected" or "not reachable". A new `/status` page would be extra code for the same proof.
3. **Start on the free Render plans, upgrade before launch.** It costs nothing while we build. The price is known and
   written down here so nobody is surprised: the API sleeps after 15 minutes, so the first visit can wait about a
   minute and the home page can show "not reachable" once; and the free database expires 30 days after creation and
   has no backups. That does not meet [NFR-05](../prd.md#non-functional-requirements) (99.5% uptime) or NFR-09 (daily
   backups). Both are fine for a skeleton with demo data and must be fixed before launch (phases 14b and 14d). The
   alternatives were paid plans from day one (more cost now, no benefit while there are no users) or a database outside
   Render (a new provider, which needs the owner's approval). Render allows only one active free database per workspace
   ([Render free plans](https://render.com/docs/free)). The first Blueprint run hit that limit because an older free
   database existed, and the owner suspended the old one. The database expires 30 days after creation: about
   2026-11-07 (confirm the exact date in the Render dashboard).
4. **The API accepts Render's database address as given.** Render's `connectionString` is a plain `postgresql://` address.
   Our engine needs the psycopg 3 driver, written `postgresql+psycopg://`, and SQLAlchemy would otherwise look for a
   different driver that is not installed. A small check in `core/config.py` rewrites the start of the address, with a
   test, so `render.yaml` can take the address straight from the database instead of someone retyping it in the dashboard.
   The alternative is to type `DATABASE_URL` by hand in the dashboard with the right prefix. That works but breaks
   silently the day the database is recreated. The owner chose the rewrite. Both forms are tested: `postgresql://`
   becomes `postgresql+psycopg://`, and `postgresql+psycopg://` stays as it is.
5. **`TRUSTED_PROXY_COUNT` is set from a real request, not from a guess. It is 3.** A count that is too high trusts an
   entry a visitor can fake; a count that is too low gives every visitor the same rate limit. We measured it on
   2026-10-08 with a temporary endpoint that returned the caller's own forwarding headers (added and removed on this
   branch, never merged). A plain request from a known address arrived as
   `x-forwarded-for: <client>, <Cloudflare address>, <Render load balancer address>`, with the socket address equal to
   the last entry. So there are three entries added by proxies, and the client is the third from the end. Two forged
   requests (`X-Forwarded-For: 1.2.3.4` and `1.2.3.4, 5.6.7.8`) arrived with the forged text still at the start of the
   list and the real client address still third from the end, so a visitor cannot change the address we count.
   A count of 1 or 2 would be wrong: the last two entries are Cloudflare and Render addresses that differed between
   requests (for example `172.68.247.13` and `172.70.243.251`), so many visitors would share a limit or one visitor
   would get several. Render also sent `cf-connecting-ip` and `true-client-ip` with the real address, but we keep our
   one rule (count from the end) so the code does not depend on one provider's header names. We kept our own
   `get_client_ip` instead of uvicorn's `--forwarded-allow-ips`: the FastAPI documentation says `"*"` trusts every sender,
   and the Cloudflare and Render addresses change, so a fixed allow-list is not practical. We did not test uvicorn's
   `--proxy-headers` on Render. Recount if Render changes its proxies or we add a custom domain.
6. **Config files in the repository.** `render.yaml` and `netlify.toml` are reviewed and reproducible. The alternative,
   dashboard-only, leaves nothing in git that records the settings. Secrets (`JWT_SECRET`, API keys) are never in these
   files: the Blueprint uses `generateValue: true` or `sync: false`, and Netlify variables are typed in the dashboard.
7. **The frontend reaches the API only through `lib/api/`.** The Netlify site gets `NEXT_PUBLIC_API_URL` and no
   `API_URL_INTERNAL`, so the server-side call falls back to the public address (see `client.ts`). `API_URL_INTERNAL`
   stays a Docker-only setting.
8. **I cannot create your Render or Netlify services.** You create the accounts and click through the dashboards using
   the checklist in [plan.md](plan.md), Task 3. I write the files, the tests and the checklist, and run the smoke test
   with you.
9. **`CORS_ORIGINS` is a plain value in `render.yaml`, not `sync: false`.** After the first Blueprint run the variable was
   missing and the owner added it by hand. The Blueprint documentation says Render asks for `sync: false` values "only
   during the initial Blueprint creation" and ignores them when an existing Blueprint is updated
   ([Render Blueprint spec](https://render.com/docs/blueprint-spec)). The first run failed on the free database limit, so
   the Blueprint was most likely applied a second time as an update; that is an inference, because the page does not say
   what happens when a prompt is skipped. Either way `sync: false` is meant for secrets, and a web address is not a
   secret. So the file now holds the value (`https://swifthealth-ng.netlify.app`). `JWT_SECRET` stays `generateValue:
   true`, and the file still holds no secret.
10. **`netlify.toml` declares the Next.js adapter and the publish directory.** After the first deploy the Netlify
    dashboard showed "Runtime" as "Not set", and the owner set it to Next.js and set the publish directory to
    `frontend/.next` by hand. Netlify's Next.js page says the adapter is applied automatically and never mentions a
    "Runtime" setting ([Netlify Next.js overview](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)),
    so we do not know why it was not detected; our guess is that detection looked at the repository root, where there is
    no `package.json`. Settings in `netlify.toml` override the dashboard
    ([Netlify file-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)), and the
    publish directory is relative to the base directory, so `publish = ".next"` with `base = "frontend"` means
    `frontend/.next`. The plugin snippet `[[plugins]] package = "@netlify/plugin-nextjs"` is the one the Netlify page
    shows for pinning the adapter. We use it without adding the package to `package.json`, so the version still updates
    on each build. **Tested on 2026-10-08:** the owner cleared the two dashboard overrides and redeployed, the deploy
    worked and the home page still says "connected". So `netlify.toml` is enough and the dashboard needs no overrides.
11. **`getHealth()` stops waiting after 8 seconds.** The cold-start test on 2026-10-08 showed that after the free API
    slept, the first site visit took 31 seconds and returned Netlify's "Inactivity Timeout" error page, because the
    home page waited for the API with no limit and Render needs about a minute to wake. The call now has an abort
    signal (`AbortSignal.timeout`) with an 8-second limit, so the page shows "not reachable" quickly. The aborted
    request still reaches Render and wakes the API, so a reload shows "connected". 8 seconds leaves room for a slow
    mobile connection and is far below the 31 seconds at which the page failed; we did not find a documented Netlify
    limit, so the number is based on that measurement only. The alternatives were to accept the error page until we
    leave the free plan, or to keep the API awake with a scheduled ping (extra moving part, and it uses up the 750 free
    hours). The real fix is the paid plan before launch (decision 3).
