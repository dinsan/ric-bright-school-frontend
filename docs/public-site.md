# Public site: home page, SEO and the legal pages

The pages anyone can see without an account, how search engines and social networks see them, and how to keep
the legal texts true. Phase 4 in `TODO.md` (FE-PUB-01, FE-PUB-02, FE-PUB-04).

| Page | File | Rendering |
| --- | --- | --- |
| `/` | `src/app/(marketing)/page.tsx` | Static, refreshed from the database every 5 minutes (ISR) |
| `/courses` | `src/app/(marketing)/courses/page.tsx` | Static shell; results load in the browser from `/api/courses` |
| `/courses/{slug}` | `src/app/(marketing)/courses/[slug]/page.tsx` | Rendered on first visit, cached, refreshed at most once a minute |
| `/grades/{1-12}`, `/subjects/{slug}` | `src/app/(marketing)/grades/[grade]/page.tsx`, `…/subjects/[slug]/page.tsx` | Rendered on first visit, cached, refreshed every 5 minutes |
| `/pricing` | `src/app/(marketing)/pricing/page.tsx` | Static, refreshed every 5 minutes; refreshed at once when an admin changes a price |
| `/search?q=` | `src/app/(marketing)/search/page.tsx` | Rendered per request; `noindex, follow` |
| `/privacy`, `/terms`, `/cookies`, `/safety`, `/contact` | `src/app/(marketing)/…/page.tsx`, texts in `src/features/legal/content/` | Static |
| `/sitemap.xml`, `/robots.txt` | `src/app/sitemap.ts`, `src/app/robots.ts` | Sitemap on request; robots static |
| Share images | `src/app/opengraph-image.tsx`, `src/app/(marketing)/courses/[slug]/opengraph-image.tsx` | Site image static; course images on first request, cached |

## Home page

In order: the grade picker (still the first thing a visitor sees, with the real number of courses), subjects
(from the database: courses per subject and the grades they cover, linking to the filtered course list), how it
works, a working sample lesson, sections for parents and for teachers (with sign-up links that choose the role),
the safety promises, questions and answers, and a closing call to action.

- **Real content only.** The numbers and subjects come from published courses (`catalogOverview()` in
  `src/server/catalog/service.ts`). A subject appears once it has a published course.
- **Builds without a database.** During `next build` the catalog is read only if `DATABASE_URL` is set and
  reachable (`withBuildFallback`, `src/server/build-phase.ts`); otherwise the page is built without the subject
  section, which appears at the first refresh after deployment.
- **The sample lesson** (`src/features/marketing/components/lesson-preview.tsx`) is a small client component in the
  shape real lessons will take (explain, try, feedback, done). Keyboard-operable, focus moves to each step's
  heading, feedback is announced, fractions are read as words. Replace it with a real lesson once the lesson
  player exists (FE-STU-03).
- **Claims must be true today.** The FAQ, audience and safety sections describe only what the product does now
  (for example "no chat", "no adverts", "class code and three pictures"). Features that don't exist yet are labelled
  as coming ("Coming next: your classes…"). Check these texts when a feature changes.

## Grade and subject pages (FE-PUB-03)

`/grades/4` and `/subjects/mathematics` are the main organic entry points: a parent searching "grade 4 online
courses" lands on a server-rendered page, not a filtered client view. Grade pages group the grade's published
courses by subject (with a strip linking the other eleven grades); subject pages group the subject's courses by
grade band, with links to the grade pages. Both are in the sitemap (all twelve grades always; subjects once they
have a published course), carry `CollectionPage` + `ItemList` structured data, and render an empty state rather
than 404 when a grade has no courses yet (unknown grades and subjects are 404). The home grade picker, the home
subject cards and the course page breadcrumb link to them.

## Prices (FE-PUB-07)

Every course has one price in cents (`courses.price_cents`, 0 = free; the currency is site-wide,
`COURSE_CURRENCY` in `src/lib/format.ts`). It shows as a badge on course cards, a "Price" fact and an `Offer`
in the JSON-LD on course pages, and drives `/pricing`, whose numbers (free and paid counts, price ranges per
subject) come from the database — nothing invented. There are no subscription plans or checkout yet, and the
page says so; a plan comparison arrives with billing (BE-BILL-01).

Admins set prices on `/admin/courses` (search, status filter, inline editor per course). The change is recorded
in `audit_events` (`admin.course_price_updated`) and the affected cached pages are revalidated immediately
(`revalidatePath` from the PATCH handler), so the public price never lags more than a moment.

## A child's data (FE-PUB-11)

Under My children, a parent can download a copy of everything Lumina stores about a child
(`GET /api/me/children/{id}/data`, a JSON file whose name never carries the child's name) and delete the child's
account (`DELETE /api/me/children/{id}`, confirm dialog with the data download offered first). Deletion cascades
(sessions, sign-in methods, guardianships, class memberships); the audit log records only the child's id, never
the name. The privacy policy points parents here. The export includes the child's learning (courses, lessons, time per day,
Phase 5) and must grow with every new kind of data about children (BE-APP-10).

## Search

Global search across courses and lessons (FE-PUB-06), in every header: the public one and the signed-in top bar.

- **Instant**: a command-palette dialog (`src/features/search/components/search-dialog.tsx`) opened by the
  Search link, Ctrl+K / ⌘K, or "/" (when not typing in a field). Results appear while typing (debounced 150 ms,
  previous results kept while the next load, stale requests cancelled), grouped into Courses and Lessons, with the
  matching words marked. Suggestions before anything is typed; "See all results" leads to `/search`.
- **Accessible**: the ARIA combobox pattern: focus stays in the input, ↑/↓ move through the options
  (`aria-activedescendant`), Enter opens one, Escape closes and focus returns to where it was. Result counts
  are announced. Checked with axe at 360 px and 1280 px, light and dark.
- **Works without JavaScript**: the Search link is a real link to `/search`, a server-rendered page with a plain
  GET form and result links. The home page's `WebSite` structured data points search engines at it.
- **Lessons land in their course**: lesson results link to `/courses/{course}#lesson-{slug}`; the course page now
  lists its lessons (the course outline), and the targeted lesson is highlighted and focused, also after
  client-side navigation (`lesson-target.tsx`).
- **Small screens**: the dialog's results can overflow, so the scroll area is a focusable named region (Tab from
  the box, arrow keys scroll) and the arrows keep the highlighted option in view; the combobox pattern is
  untouched (FE-PUB-13, checked with axe at 360 × 740, dark).
- **Follow-ups built** (FE-PUB-12): spelling synonyms (maths/math, colour/color), a grade and subject filter on
  `/search` (plain selects in the GET form, no JavaScript needed), and "Did you mean …?" on close matches, in the
  dialog and on the page. Still open: indexing lesson content (needs FE-STU-03) and swapped letters in short
  words ("pyhton").
- How matching works (prefixes, stemming, typos, grades): `docs/backend.md`, Search.

## SEO

- **Public address**: `SITE_URL`, set at build time (`next.config.ts`, inlined as `siteConfig.url`). Every canonical
  URL, the sitemap, robots.txt and the share images use it. A build that points at localhost, or has
  `SITE_NOINDEX=true`, is kept out of search engines entirely: every page is `noindex, nofollow` and robots.txt
  disallows everything. The build prints a warning when a production build points at localhost.
- **Per page**: `pageMetadata({ title, description, path })` (`src/lib/seo.ts`) gives the title, description,
  canonical URL, and matching Open Graph and Twitter cards. Next.js replaces a parent's `openGraph` with the page's,
  so the helper names the site share image itself; pages whose folder has its own `opengraph-image` (course pages)
  pass `ownImage: true`.
- **Canonical URLs**: `/courses?grade=4` and other filtered views point to `/courses` (dedicated grade and subject
  pages are FE-PUB-03).
- **Structured data** (schema.org, `<JsonLd>`): `EducationalOrganization` and `WebSite` (with the course search) on
  the home page, `Course` on each course page. `jsonLdString` escapes `<`, so text from the database can't break out
  of the script tag. Check changes with Google's Rich Results Test.
- **Share images**: drawn with `next/og` in the notebook style (`src/components/seo/og-card.tsx`), 1200×630, with
  static Lexend instances in `src/app/fonts/og/` (next/og can't read the variable font). Colours are the light
  theme's token values, repeated because next/og has no CSS variables.
- **Not indexed**: signed-in areas, sign-in pages, one-time links (`/verify-email`, `/reset-password`,
  `/confirm-email`), the API, `/auth/*`, `/design`.

## Legal and trust pages

The texts are TypeScript (`src/features/legal/content/*.tsx`), rendered by `LegalPage`: title, last-updated date,
a draft notice while unreviewed, a summary in plain words, a table of contents and the sections. The privacy policy
and the safety page start with a version for children in the Grades 1–5 presentation (`KidsSummary`:
`data-band="elementary"`, bigger text, an icon per sentence).

- **Written from the code.** Durations and names come from the constants the code uses (session lifetimes,
  link lifetimes, lockout counts, cookie names). Change the code and the policy follows.
- **The cookie table can't drift.** `src/features/legal/device-storage.ts` describes every cookie and localStorage
  key; `tests/unit/legal.test.tsx` fails if the code has one the policy doesn't describe. New browser storage must
  use a constant in `COOKIE` (`src/server/auth/cookies.ts`) or `STORAGE_KEYS` (`src/lib/storage-keys.ts`).
- **What the code can't know** is in `src/config/legal.ts`: the operating company, postal address, data location,
  governing law, regulator, contact addresses, service providers, backup and log retention, response times.
  Values marked "to be confirmed" are shown as such.
- **Draft until reviewed.** While `legalConfig.reviewed` is `false`, every legal page and the contact page show
  "This is a draft". After a lawyer's review: update the texts and `legal.ts`, set `reviewed: true`, and bump
  `documents.<page>.updated` (also used as the sitemap's `lastmod`).
- **Material changes** to the privacy policy must be emailed to users before they apply (the policy says so).
- **No cookie banner** is needed while Lumina only uses strictly necessary storage. Adding analytics or anything
  else optional means a consent banner first (FE-PUB-08) and an entry in the cookie policy.

Consent: the sign-up form and "Add a child" link to `/terms` and `/privacy` (new tab, so the form isn't lost).

## Checking

`npm test` covers the sitemap (published courses only), robots.txt, the catalog overview numbers, the metadata
helper, JSON-LD escaping, the cookie policy's completeness and every legal page's structure (one h1, table of
contents links that land, last-updated date, no empty values). In a browser, every public page was checked at 360 px
and 1280 px with axe (no violations) and without horizontal scrolling.
