# Lumina web app

The web frontend of Lumina, a learning platform for Grades 1 to 12. It shows the course catalog: a grade picker on the home page, a searchable course list, and a page per course.

| | |
| --- | --- |
| Stack | Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, TanStack Query |
| UI | Design system on Radix primitives, react-hook-form + zod, lucide icons, Lexend |
| Tooling | ESLint, Docker, Makefile |

The app reads all its data from the **Lumina API**, which lives in the backend project and is not part of this repository. Pages still open without it, but the course list, course pages and sign-in show an error until the API is reachable.

Accounts (sign-in for students, parents, teachers and admins, account settings, families, admin tools) go through this app's server, which keeps the session in secure cookies: see [`docs/auth.md`](docs/auth.md).

## Prerequisites

- **Node.js 22 LTS** (20.9 or newer works) with npm
- **Docker** with Docker Compose v2, only if you want to run the app in a container
- The **Lumina API**, running at `http://localhost:8000` by default. Its CORS settings must allow `http://localhost:3000`, the address you open the app on.

## Quick start (local development, hot reload)

```bash
npm ci            # or: make install
npm run dev       # or: make dev
```

Open http://localhost:3000.

The app expects the API at `http://localhost:8000`. If yours runs somewhere else, create `.env.local` and edit it, then restart `npm run dev`:

```bash
cp .env.example .env.local
```

## Run with Docker

```bash
docker compose up --build     # or: make up
```

Open http://localhost:3000. Stop it with `docker compose down` (or `make down`).

By default the container talks to an API running **on your machine** at port 8000. To use a different API, set the two variables when you start it (the first one is baked in at build time, so keep `--build`):

```bash
NEXT_PUBLIC_API_URL=https://api.example.com API_URL=https://api.example.com docker compose up --build
```

Port 3000 already taken? Run `WEB_PORT=3001 APP_URL=http://localhost:3001 docker compose up --build` and open http://localhost:3001. If you do that, also allow `http://localhost:3001` in the API's CORS settings.

Without Compose:

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 -t lumina-web .
docker run --rm -p 3000:3000 --add-host=host.docker.internal:host-gateway \
  -e API_URL=http://host.docker.internal:8000 lumina-web
```

## Configuration

| Variable | When it is read | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | At **build** time (inlined into the browser bundle) | `http://localhost:8000` | API address your **browser** uses. Changing it needs a rebuild (`docker compose up --build`, or restart `npm run dev`). |
| `API_URL` | At **run** time, on the server | value of `NEXT_PUBLIC_API_URL` | API address used by the server: server-side rendering and **all account requests** (sign-in, settings). In Docker, `localhost` means the container itself, so Compose sets this to `http://host.docker.internal:8000`. |
| `API_PREFIX` | At run time, on the server | `/api/v1` | Path prefix of the API's account endpoints. |
| `APP_URL` | At run time, on the server | taken from the request | This site's public address (for example `https://lumina.example`), used for redirects and the Google / Microsoft / Apple sign-in callback. Set it in production. |
| `COOKIE_SECURE` | At run time, on the server | `true` on HTTPS | Force secure session cookies on or off. |

Locally, put these in `.env.local` (see `.env.example`). With Docker, pass them as shown above. Env files are never copied into the image.

## Commands

| npm | make | What it does |
| --- | --- | --- |
| `npm ci` | `make install` | Install dependencies exactly as locked |
| `npm run dev` | `make dev` | Development server with hot reload on :3000 |
| `npm run lint` | `make lint` | ESLint |
| `npm run typecheck` | `make typecheck` | TypeScript, no output |
| `npm run build` | `make build` | Production build (standalone output, as used by Docker) |
| `npm run tokens:check` | `make tokens` | Check the contrast of every colour pair in every theme (WCAG) |
| | `make check` | Lint, type-check, contrast check and build. Run before pushing. |
| | `make up` / `make down` / `make logs` | Start, stop and follow the Docker container |

## Design system

Tokens, components, layouts, themes and the age-appropriate "grade band" presentation are documented in
[`docs/design.md`](docs/design.md). While `npm run dev` is running, open **http://localhost:3000/design** to see
everything live, switch theme (light, dark, high contrast) and reading level (Grades 1–5, 6–8, 9–12), and try the
layouts and a working form. That page exists in development only. The behaviour each component must keep is listed
in [`docs/component-test-plan.md`](docs/component-test-plan.md).

## Troubleshooting

| What you see | Likely cause and fix |
| --- | --- |
| Course list says "Courses did not load" | The browser cannot reach the API. Check it is running at `NEXT_PUBLIC_API_URL`, and that its CORS settings allow the address you opened the app on. |
| Course page says "This page did not load", but the course list works (Docker) | The server inside the container cannot reach the API. Check `API_URL`; it must be an address reachable from the container, not `localhost`. |
| Changed `NEXT_PUBLIC_API_URL` but nothing changed | It is baked in at build time. Restart `npm run dev`, or rebuild with `docker compose up --build`. |
| "Lumina can't reach its servers" when signing in, or signed-in pages show "This page did not load" | The **server** can't reach the API: check `API_URL` (and `API_PREFIX`). Sign-in requests go through this app's server, not the browser. |
| Google / Microsoft / Apple sign-in returns to the wrong address | Set `APP_URL` to the address people use, and allow `<APP_URL>/auth/callback` as a redirect in the API's OAuth settings. |
| `Port 3000 is already in use` | Stop the other process, run `npm run dev -- -p 3001`, or use `WEB_PORT=3001` with Docker. Then also allow the new address in the API's CORS settings. |

## API used by this app

| Method | Path | Used for |
| --- | --- | --- |
| GET | `/api/v1/courses` | Course list: `grade_level`, `subject`, `q`, `limit`, `offset` |
| GET | `/api/v1/courses/slug/{slug}` | Course page |
| GET | `/api/v1/subjects` | Subject filter |
| | `/api/v1/auth/*`, `/api/v1/me/*`, `/api/v1/admin/*` | Accounts, through this app's server; full list and assumed shapes in [`docs/auth.md`](docs/auth.md) |

Errors use one envelope, `{"error": {"code", "message", "details", "request_id"}}`, which the API client turns into a typed `ApiError`.

## Project structure

Feature-based: routes stay thin, and each business area owns its code.

```
src/
├── app/
│   ├── (marketing)/         public pages (home, courses) in the marketing layout
│   ├── (auth)/              sign-in (email, student, class code + pictures), sign-up, password and email links
│   ├── (app)/               signed-in areas: learn, teach, family, admin, account
│   ├── api/                 gateway to the API for signed-in requests (keeps tokens server-side)
│   ├── auth/                OAuth callback, session recovery
│   ├── (dev)/design/        design system reference, development only
│   └── layout.tsx …         root layout, providers, fonts, global styles, not-found and error
├── proxy.ts                 runs before pages: refreshes sessions, guards signed-in areas
├── features/
│   ├── catalog/             api, hooks, types, URL state, components
│   ├── auth/                accounts API contract, sign-in flows, session hooks
│   ├── account/ · family/ · admin/   account settings, children, user administration
│   └── design-system/       the /design reference page
├── components/
│   ├── ui/                  core components (Button, FormField, Dialog, Toast, …)
│   ├── forms/               Form, useZodForm, FormErrorSummary, SubmitButton
│   ├── layout/              marketing, app and focus layouts, header, footer
│   ├── theme/               theme and reading-level switches
│   ├── illustrations/       spot illustrations
│   └── feedback/            page-level error and not-found views
├── styles/tokens.css        design tokens: colours per theme, grade bands, z-index, motion
├── lib/                     API client, gateway client (bff), env, preferences, forms, cn, formatting
│   └── server/              server-only: session cookies, gateway
└── hooks/ · config/         shared hooks; site and per-role navigation config
```

## Decisions worth knowing

- **Rendering**: the home page and the course list shell are static. The course page is rendered on the server (revalidated every 60 seconds) for SEO and fast first paint, and shows a skeleton (`loading.tsx`) while it loads.
- **Unknown courses**: because the course page streams its loading state, a missing course shows the not-found page with HTTP status 200 and a `noindex` tag (Next.js behaviour when streaming). Search engines drop it; monitoring that counts 404s will not see it.
- **URL state**: course search filters live in the URL, so filtered views are shareable and the back button works.
- **Errors**: one API client turns the backend's error envelope into a typed `ApiError`. The error page logs the error and shows its reference (`digest`) to quote to support. "Try again" re-fetches the page.
- **Design tokens only**: components use semantic colours (`bg-surface`, `text-fg-muted`); Tailwind's default palette is switched off so a theme can change everything in one place. Contrast is checked by `npm run tokens:check`.
- **Themes and reading level**: light, dark and high contrast, plus a grade band (Grades 1–5, 6–8, 9–12) that changes text size, target size and density. Both are remembered on the device and applied by a small inline script before the page paints, so there is no flash.
- **Sessions**: tokens from the API never reach browser JavaScript. This app's server stores them in httpOnly cookies and forwards account requests with them ([`docs/auth.md`](docs/auth.md)).
- **Font**: Lexend, chosen for legibility for young readers, is self-hosted from `src/app/fonts/` through `next/font/local` (SIL OFL 1.1). Builds do not need internet access to Google Fonts.
- **Class names**: `cn()` combines `clsx` and `tailwind-merge`, so a class passed in by the caller overrides a conflicting default (for example `shadow-none` over `shadow-sticker`).
- **Footer year**: fixed at build time, so static and server-rendered pages always agree.

## Roadmap

The task-by-task plan, with priorities, sizes and acceptance criteria, is in [`TODO.md`](TODO.md).
