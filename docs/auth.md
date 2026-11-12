# Accounts and sign-in

How the web app connects to the backend's accounts API: sessions, sign-in for every role, account
settings, families and admin tools.

> **Status: built against an assumed contract.** The backend's endpoint list was available, but not the
> request and response shapes, and the classroom sign-in endpoints were not in the list. Everything
> assumed is in one file, `src/features/auth/contract.ts`, marked `ASSUMED`, and in the checklist
> below. Confirm it against the backend's `/openapi.json` before release (TODO: FE-AUTH-11).

## Decision: how the browser holds the session (closes X-02)

**Context.** The backend issues an access token and a refresh token (`/auth/login`, `/auth/refresh`,
`/auth/oauth/exchange` …). Tokens readable by JavaScript can be stolen by any script injection, and this
app is used by children (FE-SEC-03: no tokens in `localStorage`).

**Decision.** A backend-for-frontend (BFF) inside this Next.js app:

- The browser only talks to this site. `/api/<path>` is a gateway to `<API_URL><API_PREFIX>/<path>`
  (`src/app/api/[...path]/route.ts`, `src/lib/server/bff.ts`).
- When **any** backend response contains `access_token` + `refresh_token`, the gateway stores them in
  **httpOnly, SameSite=Lax** cookies (`Secure` on HTTPS) and removes them from the body. The browser gets
  `{ signed_in: true, user }` instead. The MFA step token is kept the same way.
- The gateway adds `Authorization: Bearer …` to every backend call, refreshes once when the access token
  is missing or rejected, and never lets the browser call `/auth/refresh`.
- Server Components read the access token from the cookie (`getCurrentUser`, `requireUser`).
  `src/proxy.ts` refreshes an expired token before pages render (Server Components can't set cookies).
- CSRF: cookies are SameSite=Lax, and every state-changing gateway request must carry
  `X-Requested-With: lumina` and an `Origin` matching this site (`isSameSite`). Forms use `method="post"`,
  so a submit before JavaScript loads never puts passwords in a URL.

**Consequences.** Tokens never reach browser JavaScript; the public catalog still calls the API
directly. Every authenticated request makes one extra hop through the Next.js server. Sessions survive
backend outages: only a *rejected* refresh signs someone out, an *unavailable* backend shows "Try again".

| Cookie | httpOnly | What |
| --- | --- | --- |
| `lumina_at` | yes | Access token. Expires ~30 s before the token, so it is refreshed in time |
| `lumina_rt` | yes | Refresh token |
| `lumina_mfa` | yes | MFA step token, 10 minutes |
| `lumina_imp` | yes | The admin's own refresh token while viewing as someone else |
| `lumina_session` | **no** | The role (`parent`, …). Only for instant UI (header, redirects); never trusted for access |

## Configuration

| Variable | Default | What |
| --- | --- | --- |
| `API_URL` | `NEXT_PUBLIC_API_URL` | Where the server reaches the backend (also for the gateway) |
| `API_PREFIX` | `/api/v1` | Prefix of the accounts endpoints on the backend |
| `APP_URL` | from the `Host` header | This site's public URL, for redirects and the OAuth callback. **Set it in production** (behind a proxy the Host header may be internal; the standalone server otherwise reports `0.0.0.0`) |
| `COOKIE_SECURE` | by protocol | Force `Secure` cookies on (`true`) or off (`false`) |

The backend must send OAuth users back to `<APP_URL>/auth/callback` (the gateway passes it as
`redirect_uri`) and, if it restricts origins, allow this site's server to call it. Browsers no longer call
the accounts API directly, so no CORS is needed for it.

## Where things are

| | |
| --- | --- |
| `src/features/auth/contract.ts` | Paths, types, assumed shapes, `roleHome` |
| `src/lib/server/session.ts` | Cookies, refresh, `getCurrentUser`, `requireUser`, `publicOrigin` |
| `src/lib/server/bff.ts` | The gateway: forwarding, token capture, refresh, CSRF |
| `src/proxy.ts` | Page guard: refresh, signed-out redirects (with `next`), signed-in visitors away from sign-in |
| `src/app/auth/callback`, `src/app/auth/resume` | OAuth return; recovering a page whose token the backend refused |
| `src/app/api/session`, `…/auth/logout`, `…/impersonation`, `…/admin/users/[id]/impersonate` | Gateway routes owned by this app |
| `src/app/(auth)/…` | Sign-in (email, student username, class code + pictures), sign-up, verify email, forgot/reset password, confirm email change |
| `src/app/(app)/…` | Signed-in areas: `/learn` (students), `/teach`, `/family`, `/admin`, `/account` for everyone |
| `src/features/{auth,account,family,admin}` | API clients, hooks and screens per area |

## Flows

- **Sign in** (`/sign-in`): email + password for parents, teachers, admins; MFA step (authenticator or
  recovery code) when required; Google / Microsoft / Apple for the providers `/auth/oauth/providers` lists;
  "Confirm your email first" with resend. After sign-in: the page asked for (`?next=`, same-site paths
  only) or the role's home. Students get the reading level of their grade.
- **Students**: `/sign-in/student` (username + password) or `/sign-in/class`: class code → "Who are you?"
  → tap 3 pictures (submits after the third; progress shown as dots, never the pictures; lock message
  after too many tries). A classroom device can remember the class code. Always in the Grades 1–5 look.
- **Sign up** (`/sign-up`): parent or teacher, then "check your email"; `/verify-email?token=` confirms
  (and signs in if the backend returns tokens).
- **Passwords**: `/forgot-password` always gives the same answer (no account enumeration);
  `/reset-password?token=`.
- **Account** (`/account`, `/account/security`): profile, language, time zone, teacher profile,
  display settings, parent link code (students), password, email change (`/confirm-email?token=`),
  two-step verification (QR drawn locally, recovery codes shown once, regenerate, turn off), linked
  Google / Microsoft / Apple accounts, sessions (sign out one / all others), delete account.
- **Families** (`/family`, `/family/children`): add a child (parental consent), choose how the child
  signs in (username + password, or username + 3 pictures), link a student account with the code the
  student makes, switch the active child from the top bar.
- **Admin** (`/admin/users`): search (URL state), role changes, turn accounts off/on, verify teachers,
  reset MFA, view as a user (banner, "Stop viewing" restores the admin session; admins can't view as
  admins or act on themselves).
- **Session ends** (signed out elsewhere, refresh rejected): pages go through `/auth/resume`, which
  refreshes or clears cookies and sends the person to sign-in and back; client requests that get 401
  check `/api/session` first, then do the same.

## Contract checklist (confirm with the backend)

Everything here is assumed; the code to change is in `src/features/auth/contract.ts` unless noted.

1. **Prefix**: accounts endpoints live under `/api/v1` like the catalog (`API_PREFIX`).
2. **Tokens**: `{access_token, refresh_token, token_type, expires_in?, refresh_expires_in?}`; JWTs
   are fine (their `exp` is used when `expires_in` is missing). `/auth/refresh` takes
   `{refresh_token}` and rotates both tokens. `/auth/logout` takes `{refresh_token}` with the bearer token.
3. **MFA**: `/auth/login` answers `{mfa_required: true, mfa_token}`; `/auth/login/mfa` takes
   `{mfa_token, code}` where `code` is a TOTP or a recovery code.
4. **Errors** use the usual envelope; codes the UI reacts to: `email_not_verified` (403 on login),
   401 for wrong credentials, 423/429 for a locked picture sign-in, 404 for an unknown class code,
   `details[].field` for field errors (e.g. `body.email` on register, `body.current_password`).
5. **`GET /me`**: `id, role, display_name, email, username, email_verified, mfa_enabled, avatar_url,
   grade_level, language, timezone, teacher_profile{school_name, subjects[], grade_levels[], bio,
   verified}, active_child_id`. `PATCH /me` takes `display_name, language, timezone`.
   `DELETE /me` takes `{password?}`.
6. **Register** `{role: parent|teacher, display_name, email, password, accept_terms: true}`; verify
   `{token}` (may return tokens: then the person is signed in); resend `{email}`; forgot `{email}`;
   reset `{token, password}`; email change `{new_email, password}` then confirm `{token}`;
   password change `{current_password, new_password}`.
7. **OAuth**: start is a browser navigation to `/auth/oauth/{provider}/start?redirect_uri=…` (a 302, or
   JSON `{authorization_url}`); the backend returns to `redirect_uri?code=…` (the app adds `provider`,
   `intent`, `next` to it); `/auth/oauth/exchange` takes `{code}`; linking posts `{code}` to
   `/me/oauth/{provider}/link` (started with `intent=link`). Providers: `{providers: [...]}`.
8. **MFA setup**: `POST /me/mfa/totp` → `{secret, otpauth_uri}`; confirm `{code}` →
   `{recovery_codes}`; `DELETE /me/mfa/totp` and `POST /me/mfa/recovery-codes` take `{code}`.
9. **Sessions**: `[{id, current, device, ip_address, created_at, last_seen_at}]` (a raw user agent in
   `device` is shown as "Chrome on Windows").
10. **Children**: list `[{id, display_name, grade_level, username, sign_in_method}]`; create
    `{display_name, grade_level, parental_consent: true}`; sign-in setup
    `{method: "password", username, password}` or `{method: "pictures", username, pictures: [3 keys]}`;
    link `{code}`; active child `{child_id}`; student link code → `{code, expires_at}`.
11. **Classroom sign-in (not in the endpoint list)**: `GET /auth/class/{code}` →
    `{class_name, students[{id, display_name, avatar_url}], pictures?[keys]}` and
    `POST /auth/login/pictures` `{class_code, student_id, pictures: [3 keys, in order]}` → tokens.
    Picture keys: `cat dog star sun moon tree fish apple rocket flower bird car`
    (`src/features/auth/pictures.tsx`).
12. **Admin**: `GET /admin/users?q&role&limit&offset` → page envelope of
    `{id, role, display_name, email, username, is_active, email_verified, mfa_enabled,
    teacher_verified, created_at, last_login_at}`; `PATCH` `{role?, is_active?}`;
    teacher verification `{verified}`; impersonate → tokens.

## Testing

All flows were exercised end to end in Chromium against a mock backend implementing the checklist
above (sign-in for every role, MFA and recovery codes, picture sign-in with lockout, sign-up and email
verification, password reset, OAuth sign-in and linking, account settings, families, admin and
impersonation, refresh, sessions ended elsewhere, CSRF refusal, open-redirect refusal, no token ever in
a browser response), at 360 / 390 / 1280 px in light and dark, with no axe violations. The scenarios
should become Playwright tests with MSW (FE-OPS-04, FE-OPS-05).
