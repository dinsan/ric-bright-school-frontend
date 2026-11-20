# API overview

> The areas of `/api`, moved from the README. Per-endpoint rules: [`backend.md`](backend.md), [`auth.md`](auth.md), and the feature documents linked below.

## API

This app's own API, under `/api`. Request and response types are shared with the browser code in `src/features/auth/contract.ts`, `src/features/catalog/types.ts`, `src/features/learn/contract.ts`, `src/features/family/contract.ts` and `src/features/goals/contract.ts`. Errors use one envelope, `{"error": {"code", "message", "details", "request_id"}}`; `details[].field` (e.g. `body.email`) puts a message next to that form field.

| Area | Endpoints |
| --- | --- |
| Catalog (public) | `GET /api/courses` (`grade_level`, `subject`, `q`, `limit`, `offset`), `GET /api/courses/slug/{slug}`, `GET /api/subjects` |
| Search (public) | `GET /api/search?q=…&limit=5&grade=&subject=`: courses and lessons, instant (prefix) matching, synonyms (maths/math), typo tolerance with "did you mean", grades ("grade 4") |
| Sign-in and sign-up | `/api/auth/*`: register (parents only), verify email, login (email with its `portal`: parent or staff; username, students only; MFA step; pictures with a family code), family roster, OAuth, logout, password reset, email change confirmation — see [`auth.md`](auth.md) |
| Own account | `/api/session`, `/api/me/*`: profile, password, email, sessions, two-step verification, linked accounts, children (add, link, sign-in, delete, data copy), link codes, the family code (`/api/me/family-code`) |
| Parents | `/api/me/children/overview`, `/api/me/children/{id}/progress`, `/report` (PDF), `/controls`, `/goals` (and `/goals/{goal_id}`, `/goals/options`): the dashboard, a child's learning, the learning report, parental controls and goals — see [Parent experience](parent-experience.md) |
| Learning (students) | `/api/learn/*`: enrolments, course progress, lessons, progress reports, summary, goals (their parents set), recommendations, learning paths, review and practice, quizzes, learning-time controls, badges, certificates (PDF) — see [Student experience](student-experience.md) |
| Administration | `/api/admin/users/*`, `/api/admin/courses/*` (course prices), `/api/impersonation` |
| Operations | `GET /api/health` (200 when the database answers) |

The full list with rules for each endpoint is in [`docs/auth.md`](auth.md) and [`docs/backend.md`](backend.md).
