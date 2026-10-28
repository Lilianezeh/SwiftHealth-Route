# Moving the production database from Render to Neon: runbook

For the owner. It takes about an hour. Every command below was rehearsed on 2026-10-28 between two throw-away Postgres containers on a laptop (dump, restore, row counts, a restore into a Postgres 17 target, a deliberate difference that the comparison caught). The Render and Neon parts, the buttons in the two dashboards, are described from their documentation and may be named a little differently: if a button is not where this says, trust the screen and tell me.

## Rules for the whole move
- **You never paste an address or a password into the chat, into a file, or into a command you can see.** The terminal commands read them with `read -rsp`: the text is not shown and does not enter your command history. Dashboard to dashboard (Neon to Render) you copy and paste with the mouse. I never ask for them.
- **The Render database is not touched, not changed and not deleted.** It keeps the old data until it expires (about 2026-11-07, check the date in the Render dashboard). That is your way back.
- **The dump file holds personal data** (emails, phone numbers, password hashes). It stays in the private folder `~/neon-move` (only you can open it) and you delete it at the end.
- Work in one terminal window. If you close it, the variables are gone, which is good; start again from step 0.

## What you need
- Docker running (the commands use the `postgres:18` image, the same major version as the Render database; step 2 checks it).
- The Neon project. **Create it with Postgres 17 or 18** (the newest it offers). I tested a Postgres 18 dump into a Postgres 17 database and it worked; I did not test anything older, so do not choose 16 or lower. Region: the one closest to Frankfurt that Neon offers (Render's database and API are in Frankfurt).
- Your pull request ("Neon database") ready, not merged. It is a draft until you say so.
- A quiet moment. Writes made on the site between the dump (step 3) and the switch (step 6) are lost, so do steps 3 to 6 in one sitting. The site holds demo data today, so the risk is small.

## Step 0. A private folder, and the two addresses

Copy the Render address from the dashboard: your database (`swifthealth-db`) > **Connect** > **External**. Copy the Neon address from the Neon dashboard: your project > **Connect**, **Connection pooling switched OFF**, the right database and role: this is the **direct** address, the host has no `-pooler`.

```bash
mkdir -p ~/neon-move && chmod 700 ~/neon-move && cd ~/neon-move
export PG_IMAGE=postgres:18
read -rsp "Render EXTERNAL database URL (paste, then Enter): " RENDER_URL; echo
read -rsp "Neon DIRECT database URL (paste, then Enter): " NEON_DIRECT_URL; echo
export RENDER_URL NEON_DIRECT_URL
```

Check that you pasted the right two, without showing a password (this prints only the host name):

```bash
host() { printf '%s\n' "${!1}" | sed -E 's#^[a-z+]+://[^@]*@##; s#[/?].*##'; }
host RENDER_URL        # expect: dpg-....frankfurt-postgres.render.com  (ends in .render.com)
host NEON_DIRECT_URL   # expect: ep-....neon.tech  and NO "-pooler" in it
case "$(host NEON_DIRECT_URL)" in *-pooler*) echo "STOP: that is the POOLED address; copy the direct one";; esac
```

If the Render host is only `dpg-xxxx-a` (no `.render.com`), you copied the *Internal* address: it cannot be reached from your laptop. Copy the *External* one.

## Step 1 (a). Let your laptop reach the Render database (you click this)

The Render database refuses all outside connections (`ipAllowList: []` in `render.yaml`). Allow your address for a while:

1. Find your public address (it is not a secret): `curl -s https://ifconfig.me; echo`
2. Render dashboard > **swifthealth-db** > the **Networking** or **Access Control** section (the inbound IP allow list) > **Add** a rule: the address from step 1 followed by `/32` (if the address contains colons it is IPv6: use `/128`), description `temporary: Neon move`. Save.

**Do not merge the pull request yet.** Merging makes Render sync `render.yaml`, which puts the empty allow list back and cuts your connection in the middle of the move.

## Step 2. Look before you copy (nothing is changed)

```bash
docker run --rm -e RENDER_URL "$PG_IMAGE" sh -c 'psql "$RENDER_URL" -Atc "show server_version"'
docker run --rm -e RENDER_URL "$PG_IMAGE" sh -c 'psql "$RENDER_URL" -Atc "select extname from pg_extension order by 1"'
docker run --rm -e NEON_DIRECT_URL "$PG_IMAGE" sh -c 'psql "$NEON_DIRECT_URL" -Atc "show server_version"'
```

- First line: the Render version. It should start with `18`. If it starts with another number, run `export PG_IMAGE=postgres:<that number>` and repeat. The image must be the **same major version or newer** than the server you dump from, or `pg_dump` refuses.
- Second: the extensions. Expect exactly `pg_trgm` and `plpgsql`. If there is another one, stop and tell me.
- Third: the Neon version, `17` or `18`.

If a command says it cannot connect to Render: the allow-list rule of step 1 is not saved yet, or your address changed (a new `curl` shows it).

## Step 3 (b). Dump the Render database to a file

```bash
docker run --rm -e RENDER_URL --user "$(id -u):$(id -g)" -v "$PWD:/dump" "$PG_IMAGE" \
  sh -c 'pg_dump "$RENDER_URL" --format=custom --no-owner --no-privileges --no-comments --file=/dump/render.dump'
chmod 600 render.dump && ls -l render.dump
```

It ends in a few seconds with a file of a few hundred kilobytes (it was 47 kB for the development database). `--no-owner --no-privileges` leave out the Render user names, which do not exist on Neon; `--no-comments` leaves out comments on extensions, which a normal Neon user may not set.

## Step 4 (c). Restore the file into Neon

First the `pg_trgm` extension (search needs it; the migrations create it with `IF NOT EXISTS`, and Neon allows it):

```bash
docker run --rm -e NEON_DIRECT_URL "$PG_IMAGE" sh -c 'psql "$NEON_DIRECT_URL" -Atc "CREATE EXTENSION IF NOT EXISTS pg_trgm"'
```

Then the restore, all or nothing (`--single-transaction --exit-on-error`: if anything fails, nothing is written). `--clean --if-exists` makes it safe to run again over a half-filled database:

```bash
docker run --rm -e NEON_DIRECT_URL --user "$(id -u):$(id -g)" -v "$PWD:/dump" "$PG_IMAGE" \
  sh -c 'pg_restore --dbname="$NEON_DIRECT_URL" --no-owner --no-privileges --no-comments --clean --if-exists --exit-on-error --single-transaction /dump/render.dump'
echo "restore exit code: $?"
```

Expect `restore exit code: 0` and no text before it. If there is an error, copy the error **text** to me (it does not contain your password; check before you send), and do not go on.

Check the tables are there and the migrations agree (this uses the repository, run it from the repository folder):

```bash
docker run --rm -e NEON_DIRECT_URL "$PG_IMAGE" sh -c "psql \"\$NEON_DIRECT_URL\" -Atc \"select count(*) from information_schema.tables where table_schema='public'\""   # expect 11
cd ~/projects/SwiftHealth && DATABASE_URL="$NEON_DIRECT_URL" docker compose run --rm --no-deps -e DATABASE_URL backend alembic current; cd ~/neon-move   # expect: ... (head)
```

(11 = the 10 tables of the app and `alembic_version`. If your repository is somewhere else, change the folder in the second line.)

## Step 5 (d). Compare the row counts, table by table

```bash
TABLES="alembic_version users categories listings phone_numbers opening_hours services verification_checks user_reports audit_entries facility_owners"
counts() {
  local query="" table
  for table in $TABLES; do query="${query}${query:+ UNION ALL }SELECT '$table' AS name, count(*) AS rows FROM $table"; done
  docker run --rm -e "$1" "$PG_IMAGE" sh -c "psql \"\$$1\" -At -F ' : ' -c \"SELECT * FROM ($query) AS t ORDER BY name\""
}
counts RENDER_URL > render-counts.txt
counts NEON_DIRECT_URL > neon-counts.txt
if diff render-counts.txt neon-counts.txt; then echo "SAME: every table has the same number of rows"; fi
cat neon-counts.txt
```

You want the line `SAME: ...` and nothing printed by `diff` before it. A difference is shown as two lines for the table (`<` Render, `>` Neon). Likely cause: someone used the site between the dump and the count. Repeat steps 3 to 5 (the restore replaces everything). If the difference stays, stop and tell me.

## Step 6 (e). Switch the site to Neon

Do this right after step 5, in this order.

**6.1 Merge the pull request.** Make it ready for review, check that its tests are green, merge. Render notices `render.yaml` changed, syncs, and deploys the new version of the API. What it changes in `render.yaml`: `DATABASE_URL` is a secret set by hand (`sync: false`) instead of a link to the Render database, and `DATABASE_URL_DIRECT` is new. Render's Blueprint documentation says it ignores `sync: false` variables when it updates an existing Blueprint, so the API should keep using the Render database for now (I could not test this on your Render account). The new code also works with the Render database, so this deploy should change nothing visible. If the deploy fails, Render keeps the old version running; if the site then shows errors about the database, the variable was removed: go straight on to 6.2, which sets it. It also puts the empty allow list back on the Render database, which removes your temporary address (you no longer need it). Wait until the service shows **Live** and `curl -s https://swifthealth-api.onrender.com/health` answers (the first call can take up to a minute: the free API sleeps).

**6.2 Point the API at Neon.** Render dashboard > **swifthealth-api** > **Environment**:
1. Edit `DATABASE_URL`: replace the value with Neon's **pooled** address. In the Neon dashboard: **Connect**, **Connection pooling ON** (the host has `-pooler`), copy, paste in Render. If Render shows it as a link to the database, replace it with the pasted text.
2. Add a variable `DATABASE_URL_DIRECT`: Neon's **direct** address (pooling OFF), copied and pasted the same way.
3. **Save, rebuild and deploy** (the button is named a little differently in places).

Why two: the API uses the pooled address (Neon's connection pooler, many short connections), and the migrations that run when the API starts use the direct one (Neon advises it). The app handles both: it adds `sslmode=require` if it is missing and turns off the server-side prepared statements that a pooler cannot keep.

**6.3 Watch the logs** of the service (Render > swifthealth-api > **Logs**) until the deploy is live. Good signs: `Context impl PostgresqlImpl`, **no** `Running upgrade` line (the database is already up to date), `Application startup complete`. Bad signs: `password authentication failed`, `SSL`, `timeout`, `no pg_hba.conf entry`, a Python traceback. If you see one: **roll back** (below).

**6.4 Check that the variable stayed.** After the deploy, look at Environment again: `DATABASE_URL` must still show a Neon host (`...neon.tech`), not a link to `swifthealth-db`. Look at it again after any later change to `render.yaml`.

## Step 7 (f). Check the live site, then close the door on Render

```bash
curl -s https://swifthealth-api.onrender.com/health; echo
curl -s https://swifthealth-api.onrender.com/meta | head -c 200; echo
curl -s "https://swifthealth-api.onrender.com/search?lat=6.45&lng=7.5" | head -c 300; echo
```

Expect `{"status":"ok"}`, the areas in `/meta`, and listings in `/search` (the same ones as before). In a browser, open https://swifthealth-ng.netlify.app : the home page, **Find**, one listing, **SwiftRescue** (112 first). Log in as the admin and open the listings list. Then confirm that **writing** works with one harmless change on a demo listing: edit its landmark, save, and put the old text back (each save writes an audit entry). In the Neon dashboard open **Monitoring**: you should see connections. The first visit after a quiet period is slower: Neon's free database goes to sleep after 5 minutes and wakes in about a second, on top of the free API's own wake-up.

Then:
1. **Remove your address from the Render database allow list** (Render > swifthealth-db > Networking). If step 6.1 already put the empty list back, there is nothing to remove: check that the list is empty.
2. Clean up the terminal:
   ```bash
   cd ~/neon-move && shred -u render.dump render-counts.txt neon-counts.txt
   unset RENDER_URL NEON_DIRECT_URL PG_IMAGE
   cd ~ && rmdir ~/neon-move
   ```
3. **Do not delete the Render database or the Render service's old settings.** Leave `swifthealth-db` alone until it expires. After it has expired, send me a message: a small pull request removes its block from `render.yaml`, so that a later sync does not try to create it again.

## If something goes wrong: the way back

**Before step 6.2:** nothing on Render changed except your temporary allow-list entry. Remove that entry and stop. The Neon database can stay half-filled or be emptied; the next try replaces it.

**After step 6.2** (the site fails or behaves wrongly):
1. Render > **swifthealth-api** > **Environment**.
2. **Delete the variable `DATABASE_URL_DIRECT`.** This matters: while it is there, the migrations at start-up would still run against Neon.
3. Set `DATABASE_URL` back to the Render database's **internal** address: Render > swifthealth-db > **Connect** > **Internal** (copy, paste). That is the address that starts with `postgresql://` and has a host like `dpg-...-a` with no `.render.com`.
4. Save and deploy. The site is back on the Render database, with all the data it had before. Nothing was lost on the Render side, because it was never changed.
5. Data written to Neon after step 6.2 is not on Render. For demo data this does not matter. If it does, take it back with the same commands of steps 3 to 5 with the two addresses swapped (and your address allowed on Render again).

**If the pull request is the problem** (not the database): on GitHub open the merged pull request and press **Revert**, merge the revert. Render syncs `render.yaml` again and links `DATABASE_URL` to the Render database as before.

**The window closes** when the Render database expires (about 2026-11-07; the dashboard shows the exact date). After that the Render database is deleted by Render and there is no way back to it: be sure the site works on Neon, and that you have a backup of Neon (see below), before that day.

## After the move (not part of the move)
- **Backups.** A free Neon database keeps only a short history (it was 6 hours when I looked on 2026-10-20; check the Neon page **Backup & Restore**). That is not the daily backup of requirement NFR-09. The existing script `scripts/backup-db.sh` and `specs/2026-10-20-launch-readiness/runbook-backups.md` take a `pg_dump` of the production address; use the **direct** address for it. Where a nightly run lives is still your decision.
- **Free plan limits** (storage, compute hours, sleeping after 5 minutes) are in the comparison in `LOG.md` ("The Render database expires about 2026-11-07"); check them again on Neon's pages, they change.
- **Rotate the password** of the Neon role after the move if you pasted the address anywhere you are not sure about (Neon dashboard > Roles > reset password), then paste the two new addresses into Render again.
