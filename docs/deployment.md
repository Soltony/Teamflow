# Deploying this release

This release changes the database in ways that move live data, and one step
cannot be undone. Read the whole of section 2 before you start.

Everything here assumes you have shell access to the application server and a
PostgreSQL client that can reach the production database.

---

## 1. Before the window

Do these days ahead, not on the night.

### 1.1 Run the preflight against production

Read-only. Every query is a `SELECT`; it changes nothing.

```bash
DATABASE_URL="postgresql://USER:PASSWORD@PROD_HOST:5432/DATABASE" \
  npm run deploy:preflight
```

It reports which migrations are pending, checks the data each one depends on,
and exits non-zero if something would abort the deploy. Fix anything marked
`BLOCK` before going further, and read every `WARN`.

The most likely blocker is a status value the enum conversion cannot accept —
for example a task whose status is `Archived`. The migration aborts and rolls
back cleanly if it meets one, so nothing is lost, but the deploy fails
half-way. Correct those rows first:

```sql
-- Find them
SELECT id, title, status FROM "Task"
WHERE upper(replace(trim(status), ' ', '_'))
      NOT IN ('TODO','IN_PROGRESS','PENDING_REVIEW','DONE','CANCELLED');

-- Decide what each one should be, then set it. Do not guess in bulk.
UPDATE "Task" SET status = 'CANCELLED' WHERE id = '...';
```

Record the row counts the preflight prints. You will compare them afterwards.

### 1.2 Decide where documents live

`DOCUMENT_STORAGE_ROOT` **must** be set in production, and must point at
storage that survives a redeploy.

The default is a folder inside the application directory. If your deployment
replaces that directory, every uploaded contract and signed minute is deleted
with it. Nothing under `public/` either — files served from there bypass the
authorization check entirely.

```bash
sudo mkdir -p /var/lib/nibteam/documents
sudo chown -R <app-user>:<app-group> /var/lib/nibteam/documents
sudo chmod 700 /var/lib/nibteam/documents
```

If documents already exist under the old default, move them across **before**
deploying, preserving the directory fan-out:

```bash
cp -a /path/to/app/.document-storage/. /var/lib/nibteam/documents/
```

### 1.3 Check the build machine can reach Google Fonts

The interface now loads Inter through `next/font`, which downloads the font
files **at build time** and serves them from your own origin. Nothing is
requested from Google at run time — but the machine running `next build` needs
outbound access to `fonts.googleapis.com` and `fonts.gstatic.com` once.

On a restricted network the build fails there. If that applies, say so and the
font can be vendored into the repository instead.

### 1.4 Fill in the environment

Copy `.env.example` to `.env` on the server and complete it. New in this
release:

| Variable | Notes |
|---|---|
| `DOCUMENT_STORAGE_ROOT` | Required. See 1.2. |
| `DOCUMENT_REQUIRE_SCAN` | `true` refuses all uploads while no malware scanner is configured. |
| `TRUST_PROXY_HEADERS` | `true` **only** if a proxy you control overwrites `X-Forwarded-For`. Wrong here defeats rate limiting. |
| `FRAME_ANCESTORS` | Leave unset unless the app is embedded in a portal. |

---

## 2. The window

### 2.1 Take a backup and verify it

Not optional. `20260823030000_reusable_teams` copies each team's project into a
new `ProjectTeam` table and then runs `ALTER TABLE "Team" DROP COLUMN
"projectId"`. Once that commits, the original column is gone; if the copy were
wrong, only this backup brings the association back.

```bash
pg_dump --format=custom --file=nibteam-pre-release.dump \
  "postgresql://USER:PASSWORD@PROD_HOST:5432/DATABASE"

# Prove the backup restores before relying on it.
createdb nibteam_restore_check
pg_restore --dbname=nibteam_restore_check nibteam-pre-release.dump
psql -d nibteam_restore_check -c 'SELECT count(*) FROM "Project";'
dropdb nibteam_restore_check
```

Back up the document storage directory too — it is not in the database.

```bash
tar -czf nibteam-documents-pre-release.tar.gz -C /var/lib/nibteam documents
```

### 2.2 Stop the application

```bash
# systemd
sudo systemctl stop nibteam

# or pm2
pm2 stop nibteam
```

Stopping first matters: the running instance holds the old Prisma client, and
the enum conversions take brief locks on `Task`, `Blocker` and `Payment`.

### 2.3 Deploy the code

```bash
cd /path/to/app
git fetch origin
git checkout <release-tag-or-commit>
npm ci
```

`npm ci` rather than `npm install` — it installs exactly the lockfile.

### 2.4 Run the migrations

`npm run build` runs `prisma migrate deploy && next build`. Run the migration
separately so a failure is unambiguous:

```bash
npx prisma migrate deploy
```

Expect ten migrations. If one fails it rolls back on its own; do **not** rerun
blindly — read the error, fix the data, run it again.

### 2.5 Build

```bash
npx prisma generate
npx next build
```

### 2.6 Check the data survived

```bash
npm run deploy:preflight
```

It should now say nothing is pending. Compare the row counts against what you
recorded in 1.1 — the migrations move data but must not lose any. Also confirm
the team links were rebuilt:

```sql
SELECT count(*) FROM "ProjectTeam";     -- expect the pre-deploy team count
SELECT count(*) FROM "Team";            -- unchanged
SELECT count(*) FROM "Blocker" WHERE title IS NULL;  -- expect 0
```

### 2.7 Start and verify

```bash
sudo systemctl start nibteam     # or: pm2 start nibteam
```

Then, by hand:

1. Sign in.
2. Open Projects — confirm projects and their teams appear.
3. Open a project's Documents tab and download an existing file.
4. Settings → Users → reset a test account's password and confirm the
   temporary password dialog **stays open** and shows the password.
5. Settings → check the new configuration tabs render.

---

## 3. Everyone must reload

The application registers a service worker, which keeps serving the JavaScript
it cached. After a deploy, a browser holding the old bundle can call a server
action that no longer exists and fail with `Failed to find Server Action`.

The configuration sets `skipWaiting` and `clientsClaim`, so the new worker takes
over on the next load — but tabs left open across the deploy need a hard reload.
Tell people to close and reopen the application, or press Ctrl+Shift+R.

---

## 4. If it goes wrong

### Migrations failed part-way

Each migration is one transaction, so the failed one left nothing behind.
Earlier ones did commit. Read the error, fix the data, and run
`npx prisma migrate deploy` again.

### The application starts but is broken

Roll the code back and restart. The database is forward-migrated, and the
previous release does **not** understand this schema — in particular
`Team.projectId` no longer exists, so the old code will fail on teams.

A code-only rollback is therefore **not** safe for this release. Restoring
means restoring the database too:

```bash
sudo systemctl stop nibteam
dropdb DATABASE && createdb DATABASE
pg_restore --dbname=DATABASE nibteam-pre-release.dump
git checkout <previous-release>
npm ci && npx prisma generate && npx next build
sudo systemctl start nibteam
```

Anything entered between the deploy and the rollback is lost. That is why the
window should be short and outside working hours.

### Someone is locked out

An administrator can reset a password from Settings → Users. If **no**
administrator can sign in, reset one directly:

```bash
npx tsx scripts/reset-admin-password.ts <phone-number>
```

---

## 5. After

- Delete the verification dump and the restore-check database.
- Keep `nibteam-pre-release.dump` until the release has run for a week.
- Visit Settings and set the session, lockout and password policy values to
  whatever the bank's security standard requires; the defaults are deliberately
  moderate.
