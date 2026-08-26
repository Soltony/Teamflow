# Authentication

Authentication is implemented entirely inside this application. The external
`NIBTeam_AUTH` service is no longer contacted at runtime, and the settings that
pointed at it (`NEXT_PUBLIC_AUTH_API_BASE_URL`, `AUTH_API_BASE_URL`) have been
removed from `.env`.

## How it works

**Sign-in** is by phone number and password. `loginAction` in
`src/app/auth/actions.ts` looks the user up by their canonical phone number,
verifies the password, and issues a session.

**Sessions** are server-side rows in the `Session` table. The browser holds an
opaque 32-byte random token in an `httpOnly`, `SameSite=Lax`, `Secure` cookie
named `nibteam_session`; only the token's SHA-256 hash is stored, so a database
leak yields no usable sessions. Sessions expire after 7 days absolute or 15
minutes idle, and can be revoked — which is what makes a password change take
effect everywhere at once.

A stateless JWT was deliberately not used: it cannot be revoked, and "changing
a password signs you out on every device" is a requirement here.

**Authorization** happens in three places, in order of authority:

| Layer | File | What it does |
| --- | --- | --- |
| Middleware | `src/middleware.ts` | Edge runtime, so no database. Only checks that a session cookie *exists*, to bounce anonymous visitors before a page renders. Never rely on it alone. |
| Route guard | `src/components/protected-shell.tsx` | Runs on the server for every authenticated route. Resolves the session, forces a pending password change, and checks the permission that route requires. |
| Server actions | `requireUser()` / `requirePermission()` / `permit()` in `src/lib/auth/guard.ts` | The real boundary. Server Actions are public HTTP endpoints, so every action authenticates before touching data. |

Each route's `layout.tsx` names the permission it needs; the map is also in
`routePermissions` in `src/lib/permissions.ts`. The sidebar hides links a user
cannot use, but that is presentation only.

## Passwords

Hashes are in the ASP.NET Core Identity **v3** format — the same format the
legacy service wrote — so all 50 migrated credentials work unchanged and no one
had to reset their password.

    byte 0     0x01 format marker
    bytes 1-4  PRF (2 = HMAC-SHA512)
    bytes 5-8  iteration count
    bytes 9-12 salt length
    then       salt, then the derived subkey

Legacy hashes use 100,000 iterations. New and changed passwords use 210,000
(current OWASP guidance for PBKDF2-SHA512). Because the format carries its own
iteration count, an old hash is verified with its own parameters and then
**transparently re-hashed at the stronger setting on the next successful
sign-in** — no flag day, no forced reset.

`npm run auth:verify-hashes` checks this against an independent implementation
of the format and against the real migrated hashes.

## Account lifecycle

- **Creation** — administrators only, from Settings → Users. Public
  self-registration was removed along with the shared `Welcome2PMO` password.
  A one-time temporary password is generated and shown to the administrator
  once; the account is flagged `mustChangePassword`.
- **Password reset** — Settings → Users → Reset password generates a new
  temporary password, shows it once, and revokes every session for that
  account. Nothing is emailed, and no reset token ever reaches a browser.
- **Forced change** — while `mustChangePassword` is set, `ProtectedShell`
  redirects every route to `/change-password`.
- **Password change** — revokes *all* sessions including the current one, so
  the user signs in again with the new password.
- **Disable** — `setUserActive(id, false)` blocks sign-in and revokes sessions
  while keeping the user's history and project links. Prefer this to deletion.
- **Lockout** — 5 consecutive failures lock the account for 15 minutes. A
  password reset clears it.
- **Role change** — revokes the user's sessions, so a permission change applies
  immediately rather than at their next sign-in.

The last active administrator cannot be deleted, disabled, or stripped of the
Admin role, and no one can remove their own Admin role.

## Audit trail

`AuthEvent` records sign-ins and failures, sign-outs, password changes and
resets, lockouts, account enable/disable, session revocations, and denied
permission checks. Failed sign-ins for an unknown phone number are recorded
against `subject` so the attempt is still visible.

## The migration from NIBTeam_AUTH

Both systems used the identity provider's user id as their primary key, so the
two datasets line up on `id` with no remapping.

| | Count |
| --- | --- |
| Accounts in the legacy `TeamAuthDb` | 50 |
| Matched to an existing local user (all by id) | 38 |
| Staged in `PendingUser` for first sign-in | 12 |
| Rejected | 0 |

The 12 staged accounts had never signed in to this application, so no local
`User` row ever existed for them — the old `syncUser` created one on first
contact. `loginAction` does the same: on their first successful sign-in the
`User` is created with the legacy id, and the staging row is deleted.

Nothing else about any user was touched. Names, emails, roles, divisions, and
every project relationship are unchanged; role assignments went from 43 to 43.

### Re-running the import

```bash
npx tsx scripts/extract-auth-dump.mjs "path/to/TeamAuthDb b.sql"   # refresh the JSON
npm run auth:import                                               # dry run, prints the plan
npm run auth:import -- --apply                                    # commit
```

The import is idempotent and will not overwrite a password already set in this
system unless you pass `--force`. `scripts/data/legacy-auth-users.json` holds
password hashes: it is a credential file, not ordinary source, and should not
be distributed more widely than the database itself.

## Database changes

`prisma/migrations/20260822000000_add_local_authentication` adds:

- `User.passwordHash`, `mustChangePassword`, `isActive`, `passwordChangedAt`,
  `lastLoginAt`, `failedLoginAttempts`, `lockedUntil`, and a unique constraint
  on `phoneNumber` (sign-in looks up by it).
- `Session`, `AuthEvent`, `PendingUser` tables.
- `Payment.decidedById` / `decidedAt`, so a payment approval records who
  approved it and when.

The five pre-existing migration folders were empty — the history was recorded
in `_prisma_migrations` but no `migration.sql` files existed, which is why the
build used `prisma db push`. They were replaced by a single
`00000000000000_baseline` holding the pre-authentication schema. The build now
runs `prisma migrate deploy`, and a fresh database can be built from the two
migrations alone.

## Phone numbers

Numbers are stored and matched in canonical local form (`0` + 9 digits).
`normalizePhoneNumber` in `src/lib/auth/phone.ts` accepts `0912345678`,
`+251912345678`, `251912345678`, `00251912345678`, `912345678`, and spaced
variants, so sign-in works however the number is typed.

## Tests

Run a production build first — the tests read server-action ids out of it.

```bash
npx next build
npx next start -p 3399

npm run auth:verify-hashes                        # hash format compatibility
npm run auth:test -- http://localhost:3399        # sign-in, sessions, permissions
npm run auth:test-authz -- http://localhost:3399  # action-layer authorization
npm run auth:test-admin                           # admin flows, data integrity
npm run auth:cleanup-tests                        # remove the 07xxxxxxxx test accounts
```

The tests create accounts on `07xxxxxxxx` numbers, which no real account uses,
and remove them afterwards.

## Known limitations

- **HTTPS is required in production.** The session cookie is issued with
  `Secure` when `NODE_ENV=production`, so it will not be sent over plain HTTP.
- **No self-service password reset.** There is no SMS or SMTP gateway available
  to this system, and the legacy service had none either — its "forgot
  password" returned the reset code in the API response. Resets are
  administrator-issued. Adding an emailed flow needs mail server details.
- **Read-path permission failures surface as a generic error.** Actions that
  return data throw on refusal, and Next hides error text in production. The
  route guard blocks these pages first, so a legitimate user does not hit it.
- `typescript.ignoreBuildErrors` is still `true` in `next.config.ts`. The
  authentication code typechecks cleanly, but roughly 190 pre-existing type
  errors elsewhere have to be cleared before the flag can be turned off.
