# Formula library and calculator

> Moved verbatim from the README.

## Formula library and calculator

155 mathematics formulas for Grades 1 to 12 in 15 topics (number, fractions and percentages, ratios, money, algebra,
powers and logarithms, coordinates, angles and shapes, area, volume, trigonometry, statistics, probability, sequences,
calculus), each with its notation, what every letter means, steps, worked examples and related formulas; 134 of them
have a **calculator that works out any letter** and shows every step (rearranging the formula, putting the values in,
working it out), numerically when there is no exact formula (a loan's interest rate).

The library lives **inside its subject**, not as a section of its own: a student opens Mathematics and sees its courses
and its formulas, picks a topic or a formula, and works through it.

**Try it**: `/subjects/mathematics` → **All 155 formulas** (or a topic), then a formula, e.g.
`/subjects/mathematics/formulas/area-of-a-circle`: choose "radius", type an area, and see the working. Course pages
(`/courses/…` and a student's `/learn/courses/…`) link to their subject's formulas too.

| Part | Where |
| --- | --- |
| Pages | `/subjects/{subject}` (a "Formulas" section: the topics and the way in), `/subjects/{subject}/formulas` (the subject's formulas as a formula sheet, by topic; filters are a GET form that works without JavaScript), `/subjects/{subject}/formulas/{formula}` (the formula, letters, calculator, steps, worked examples, related; ISR, every 5 minutes). The old top-level `/formulas…` URLs redirect here |
| API | `GET /api/formulas?subject=&strand=&grade=&q=` (search like the site search: stemming, prefixes, typos, "grade 8" in the text), `GET /api/formulas/{subject}/{slug}`, `POST /api/formulas/{subject}/{slug}/calculate` `{ solve_for, values }` (60 per minute per IP) |
| Code | `src/features/formulas/` (shapes, the MathML allowlist, the calculator, MathML and library components), `src/server/formulas/` (service; `engine.ts`, the engine client) |
| Data | `formulas` (with `expression`, the equation the calculator solves), `formula_related`, `formula_skills`, `practice_strands` (topics); seeded from `scripts/data/formulas.json` (validated by `scripts/seed-formulas.ts`) |
| Engine | `services/formula-engine/`: a separate Python service (SymPy, NumPy, SciPy, FastAPI) with its own Dockerfile, tests and [README](../services/formula-engine/README.md), ready to move to its own repository |

Maths is drawn by the browser as **MathML**: the engine turns LaTeX into a MathML tree (JSON), the app checks it against
an allowlist and builds elements from it. No maths library in the app, and nothing from the engine is inserted as HTML.
Without the engine, pages still work (formulas as LaTeX text, worked examples with their stored answers) and the
calculator answers 503. Every worked example's answer was worked out independently; the engine's tests check it agrees.

Tests: `tests/api/formulas.test.ts` (listing, filters, search and typos, drafts, related both ways, worked examples,
without the engine, unsafe MathML refused, the calculator's errors mapped to fields, engine failures, CSRF, rate limit;
against a stand-in engine, `tests/support/formula-engine.ts`), `tests/components/formulas.test.tsx` (MathML,
the calculator: any letter, field errors and focus, unavailable, several answers), `tests/unit/formulas.test.ts`,
and the engine's pytest suite. Checked in Chromium at 360 px and 1280 px with axe: every formula page.
