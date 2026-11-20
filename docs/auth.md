# Accounts and sign-in

How Lumina handles sessions, sign-in for every role, account settings, families and admin tools. Everything
here runs in this app: Route Handlers in `src/app/api`, services in `src/server`, data in PostgreSQL. The
general architecture is in [`backend.md`](backend.md).

## Decision: how the browser holds the session (X-02)

**Context.** Lumina is used by children (FE-SEC-03: no tokens readable by JavaScript). Sessions must be
revocable: "sign out everywhere else", a password change, an admin turning an account off, and the list of
signed-in devices all need the server to end a session immediately.

**Decision.** Server-side sessions in PostgreSQL, referenced by an httpOnly cookie.

- Signing in creates a row in `sessions` and gives the browser a random 256-bit token in the `lumina_sid`
  cookie (httpOnly, SameSite=Lax, Secure on HTTPS). The database stores only the token's **SHA-256**, so a
  leaked database or backup doesn't hand out sessions.
- Every API request and every signed-in page looks the token up (one indexed query; once per request for
  pages, thanks to React `cache`). The session row knows the user, the device, the IP and when it expires.
- **Sliding expiry**: standard sessions last 30 days and are extended to 30 days again when used in their
  second half. Server Components can't set cookies, so the proxy (`src/proxy.ts`) renews the cookie's
  lifetime on page loads; the database row remains the authority.
- **Kinds**: `standard`; `shared_device` (picture sign-in with a family code on a shared device: 8 hours, not extended);
  `impersonation` (an admin viewing as someone: one hour, not extended, marked with the admin's id).
- **Ending sessions** deletes rows: sign out, "sign out everywhere else", a password change or reset (all
  other sessions), an admin turning an account off or changing its role (all sessions), deleting the account.
- **CSRF**: cookies are SameSite=Lax, and every state-changing API request must carry
  `X-Requested-With: lumina` and an `Origin` (or `Referer`) matching this site (`src/server/http/request.ts`).
  A cross-site form can't add the header; a cross-site `fetch` can't without a CORS preflight, which this
  app never approves. Forms use `method="post"`, so a submit before JavaScript loads never puts passwords in a URL.
- **Outages are not sign-outs**: when PostgreSQL is unreachable the API answers 503 and pages show
  "Try again"; cookies are kept.

**Consequences.** No tokens ever reach browser JavaScript or response bodies; revocation is immediate; one
database lookup per request (indexed, cheap). Replaces the earlier design in which a separate backend issued
access and refresh tokens that this app relayed.

| Cookie | httpOnly | What |
| --- | --- | --- |
| `lumina_sid` | yes | The session token (30 days, renewed while used) |
| `lumina_mfa` | yes | The two-step verification step between the password and the code, 10 minutes |
| `lumina_imp` | yes | The admin's own session token while viewing as someone else, 1 hour |
| `lumina_oauth` | yes | OAuth state binding the provider's answer to this browser, 10 minutes |
| `lumina_session` | **no** | The role (`parent`, …). Only for instant UI (header, redirects); never trusted for access |

## Where things are

| | |
| --- | --- |
| `src/features/auth/contract.ts` | Shared JSON types and paths (browser and server), `roleHome`, shared rules (password length, usernames, pictures) |
| `src/server/auth/session.ts`, `cookies.ts` | Sessions in the database; cookie names, lifetimes and writers |
| `src/server/auth/context.ts` | `requireAuth(request, roles)` for Route Handlers |
| `src/server/auth/current-user.ts` | `getCurrentUser`, `requireUser(roles)`, `isImpersonating` for Server Components |
| `src/server/auth/service.ts` | Sign-up, email verification, every sign-in method, password reset, email change confirmation |
| `src/server/auth/sign-in.ts` | After credentials: session or MFA step; lockouts |
| `src/server/auth/mfa.ts`, `totp.ts`, `tokens.ts`, `password.ts`, `crypto.ts` | Primitives (see Security below) |
| `src/server/oauth/` | Google / Microsoft / Apple |
| `src/server/accounts/`, `family/`, `admin/` | Account settings, children, administration |
| `src/proxy.ts` | Page guard: signed-out redirects (with `next`), signed-in visitors away from sign-in, cookie renewal |
| `src/app/auth/callback`, `src/app/auth/resume` | OAuth return; clearing a session that ended while a page was open |
| `src/app/(auth)/…`, `src/app/(app)/…` | Sign-in pages; signed-in areas (`/learn`, `/teach`, `/family`, `/admin`, `/account`) |

## Flows

- **Separate sign-in for students and parents.** `/sign-in` asks "Who's signing in?" and offers two doors
  (and a quiet link for staff). Each door only lets in its own kind of account (`portalRoles` in
  `src/features/auth/contract.ts`, checked by `assertPortal` in `src/server/auth/sign-in.ts`):

  | Page | Who | How |
  | --- | --- | --- |
  | `/sign-in/student` | students | username + password; or pictures (`/sign-in/pictures`) |
  | `/sign-in/parent` | parents and guardians | email + password, Google / Microsoft / Apple |
  | `/sign-in/staff` | admins | email + password, Google / Microsoft / Apple |

  The right password on the wrong page is refused with 403 `wrong_portal`; `details[0]` is
  `{ field: "portal", message: "student" | "parent" | "staff" }`, and the form shows "This is a parent
  account" with a button to the right page. Nobody is signed in, so nobody lands in the other side's area.
  Signed-out visitors of `/learn`, `/family` and `/admin` go straight to their area's page (`portalForPath`);
  `/account` (shared) goes to the chooser. After sign-in: the page asked for (`?next=`, same-site paths
  only) or the role's home (`/learn` or `/family`). Students get the reading level of their grade.
- **Email sign-in** (parent and staff pages): `POST /api/auth/login` with `{ email, password, portal }`;
  MFA step (authenticator or recovery code) when switched on; "Confirm your email first" with resend.
- **Students**: `/sign-in/student` (username + password, `POST /api/auth/login/username`, students only) or
  `/sign-in/pictures`: the parent's **family code** → "Who are you?" (that parent's children whose sign-in uses
  pictures) → tap 3 pictures (submits after the third; progress shown as dots, never the pictures; lock message
  after too many tries). `GET /api/auth/family/{code}` answers the roster, `POST /api/auth/login/pictures` takes
  `{ family_code, student_id, pictures }`; a child of another family, or a turned-off parent's code, doesn't work.
  A family's shared device can remember the code (`lumina:family-code`). Always in the Grades 1–5 look.
- **Family code**: a parent makes one under My children (`GET` / `POST /api/me/family-code`): 6 characters
  without look-alikes, unique, upper-case; making a new one stops the old one at once. Not while an admin views as
  the parent. Only parent accounts can have one (a database CHECK; an admin changing the role clears it).
- **Sign up** (`/sign-up`): **parents only**, then "check your email"; `/verify-email?token=` confirms and
  signs in (unless the account already uses two-step verification). Students get their accounts from a
  parent (My children). A `role` in the request is ignored. With Google / Microsoft / Apple, sign-up makes a
  parent account and the provider must confirm the email address.
- **Passwords**: `/forgot-password` always gives the same answer (no account enumeration);
  `/reset-password?token=` sets a new password, signs out every device and confirms the email.
- **Account** (`/account`, `/account/security`): profile, language, time zone, display
  settings, parent link code (students), password, email change (`/confirm-email?token=`), two-step
  verification (QR drawn locally, recovery codes shown once, regenerate, turn off), linked Google / Microsoft
  / Apple accounts, sessions (sign out one / all others), delete account (not for students).
- **Families** (`/family`, `/family/children`): add a child (parental consent, recorded), choose how the
  child signs in (username + password, or username + 3 pictures with the family code), the family code, link a
  student account with the code the student makes, switch the active child from the top bar. A child's goals
  and controls: [`parent-experience.md`](parent-experience.md).
- **Admin** (`/admin/users`): search (URL state), role changes (student, parent, admin), turn accounts off/on,
  reset MFA, view as a user (banner, "Stop viewing" restores the admin session; admins can't view as
  admins or act on themselves). Every action is written to `audit_events`.
- **Session ends** (signed out elsewhere, expired, turned off): pages go through `/auth/resume`, which
  clears the cookies and sends the person to sign-in and back; client requests that get 401 check
  `/api/session` first, then do the same.

## Rules the server enforces

1. **No account enumeration.** Sign-up answers 202 whether or not the email is taken (an existing account's
   owner gets a "you already have an account" email instead); resend and forgot-password always answer 202.
   Sign-in answers the same 401 for unknown emails and wrong passwords, with the same timing (a dummy
   argon2 check), and only says "confirm your email" (403 `email_not_verified`) or "turned off"
   (403 `account_disabled`) after a correct password.
2. **Lockouts.** 10 wrong passwords in a row lock the account for 15 minutes (429 `too_many_attempts`);
   5 wrong picture sets lock picture sign-in (423 `account_locked`, "ask a grown-up"); 5 wrong codes end
   the MFA step. Per-IP rate limits on top (sign-in, family codes, emails, link codes).
3. **One-time links** (email verification 48 h, password reset 1 h, email change 24 h, parent link code
   7 days) are stored hashed and consumed atomically: a link works once, even under concurrent requests.
   Only the newest link of each kind works.
4. **Two-step verification.** TOTP (RFC 6238, ±1 step drift); a code's time step is recorded, so the same
   code can't be used twice. Secrets are encrypted at rest (AES-256-GCM, key derived from `AUTH_SECRET`).
   10 recovery codes, stored hashed, each works once. Adults only.
5. **Sensitive changes need the password**: password change (`body.current_password`), email change and
   account deletion (`body.password`); limited to 10 tries per 15 minutes.
6. **While an admin views as someone**, credentials can't be changed (password, email, two-step
   verification, linked accounts, account deletion): 403 `impersonation_restricted`.
7. **OAuth** never links to an existing account just because the email matches (that would let whoever
   controls the provider account take the Lumina account). Linking is done from Sign-in and security while
   signed in. Signing in names the page it started from (`portal=parent|staff`, kept in the OAuth state);
   an account that belongs elsewhere goes back with `?error=wrong_portal_parent|wrong_portal_staff`. Problems
   go back to that page: an unlinked identity to `/sign-in/parent?error=oauth_no_account`; sign-up with an
   email that already has an account to `?error=oauth_email_taken`; the MFA step to `?step=mfa`.
9. **Separate doors** (see Flows): email sign-in needs `portal`; the account's role must belong to it, checked
   only after the password (or the provider) proved who it is, so a wrong page reveals nothing to someone
   guessing.
8. **Field errors** come as `details[].field` = `body.<field>` (e.g. `body.email`, `body.current_password`,
   `body.username`, `body.code`), and the forms show them next to the field.

## Social sign-in setup

Set the keys of each provider (README, Configuration) and register `<APP_URL>/auth/callback` as its
redirect URI. The server uses the authorization code flow with PKCE (Google, Microsoft), a state bound to
the browser by a cookie, and a nonce; the ID token is fetched directly from the provider over TLS and its
issuer, audience, expiry and nonce are checked. Apple answers with a cross-site form POST, which the
callback turns into a same-site GET (so the SameSite=Lax cookies come along). Microsoft work accounts'
email counts as confirmed only with the `xms_edov` optional claim (personal Microsoft accounts always).

## Testing

`npm test` runs the API integration tests in `tests/api` against a real PostgreSQL database: sign-up and
verification (including enumeration-safety), sign-in for every method, lockouts, CSRF refusal, password
reset, MFA with replay and recovery codes, sessions (list, end one, end others, after a password change),
email change, families, link codes, admin actions and impersonation, the catalog, and the error envelope.
`tests/api/oauth.test.ts` runs the OAuth round trip with only the provider's token endpoint stubbed (PKCE,
state bound to the cookie, nonce, sign-up with a role, no takeover of an existing email, linking, unlinking,
the MFA step, Apple's form POST). `tests/unit` covers TOTP (RFC 6238 test vectors), secret encryption, OAuth
claim checks and redirect safety.
The browser flows (sign-up from the emailed link, picture sign-in, MFA setup and sign-in, impersonation)
were exercised end to end in Chromium against the production build; they should become Playwright tests
(FE-OPS-04). OAuth has not yet been run against the real Google, Microsoft and Apple services (BE-APP-05).
