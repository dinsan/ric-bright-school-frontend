# Lumina design system

How Lumina looks and behaves, and how to build screens that stay consistent. The living version is at
**http://localhost:3000/design** while `npm run dev` is running (it is not part of production builds): every token,
component and layout, in every theme and grade band.

| Where | What |
| --- | --- |
| `src/styles/tokens.css` | All tokens: palette, themes, grade bands, z-index, motion |
| `src/app/globals.css` | Tokens mapped to Tailwind utilities, variants, keyframes, base styles |
| `src/components/ui/` | Core components |
| `src/components/forms/` · `src/lib/forms/` | Form wiring, validation messages, server error mapping |
| `src/components/layout/` | Marketing, app and focus layouts |
| `src/components/theme/` · `src/lib/preferences.ts` | Theme and grade-band switching |
| `src/components/illustrations/` | Spot illustrations |
| `scripts/check-contrast.mjs` | `npm run tokens:check`: contrast of every colour pair in every theme |

## Principles

1. **A school notebook.** Graph paper, ink outlines, highlighter colours and "sticker" shadows. Friendly, never childish for older students.
2. **Readable first.** Lexend everywhere, body text never below 16px, plain words, short sentences.
3. **Big, forgiving targets.** Controls are 44px tall by default and 56px for Grades 1–5.
4. **Meaning never depends on colour alone.** Errors have an icon and text; states have labels.
5. **Same product at every age.** One set of components; the grade band changes size, density and decoration, not structure.
6. **Calm motion.** Short and purposeful, and gone when the user asks for reduced motion.

## Tokens

Components use **semantic tokens only** (`bg-surface`, `text-fg-muted`, `border-line`), never raw colours. Tailwind's
default palette is switched off in `globals.css`, so `bg-blue-500` does not exist: a theme can change every colour in
one place and nothing is left behind. Old colour names (`bg-white`, `text-ink`) also generate nothing, so search for them
if a colour seems to be missing.

### Colour

| Token | Use |
| --- | --- |
| `canvas` | Page background (with the graph-paper grid via `bg-graph-paper`) |
| `surface` / `surface-sunken` | Cards, inputs, menus / hover, muted areas, tracks |
| `fg` / `fg-muted` | Main text / secondary text, hints, placeholders |
| `line` / `line-subtle` | Control and card borders (3:1 or more) / decorative dividers |
| `link`, `focus` | Inline links; the focus ring |
| `primary` (+ `-hover`, `-fg`) | The main action on a screen, checked controls, progress |
| `accent` (+ `-fg`) | Highlighter yellow: current navigation item, highlights, avatars |
| `inverse` (+ `-fg`) | Selected chips, tooltips |
| `success`, `warning`, `danger` (+ `-fg`) | Solid status colours; `danger-text` for error text |
| `info-soft`, `success-soft`, `warning-soft`, `danger-soft` (+ `-fg`) | Alerts, badges, toasts |
| `band-elementary`, `band-middle`, `band-high` (+ `-fg`) | Grade colours (1–5 yellow, 6–8 green, 9–12 blue). The same in every theme so a grade is always recognisable |
| `scrim` | Behind dialogs and sheets |

#### Contrast (checked)

Every text pair must reach WCAG 2.2 AA (4.5:1; 3:1 for borders, focus rings and other UI parts). The high-contrast
theme aims for AAA (7:1 text, 4.5:1 UI). `npm run tokens:check` reads `tokens.css` and fails if any pair drops below
its minimum; run it (or `make check`) after changing a colour. Current values:

| Foreground | Background | Used for | light (min 4.5/3) | dark (min 4.5/3) | contrast (min 7/4.5) |
| --- | --- | --- | --- | --- | --- |
| `fg` | `canvas` | Body text on the page (text) | 16.07 | 16.58 | 21.00 |
| `fg` | `surface` | Text on cards, inputs, menus (text) | 17.08 | 14.99 | 21.00 |
| `fg` | `surface-sunken` | Text on hover / muted areas (text) | 14.93 | 12.95 | 17.62 |
| `fg-muted` | `canvas` | Secondary text on the page (text) | 6.82 | 9.17 | 15.13 |
| `fg-muted` | `surface` | Secondary text, hints, placeholders (text) | 7.25 | 8.29 | 15.13 |
| `fg-muted` | `surface-sunken` | Secondary text on muted areas (text) | 6.33 | 7.17 | 12.69 |
| `link` | `canvas` | Links on the page (text) | 7.52 | 8.91 | 12.32 |
| `link` | `surface` | Links on cards (text) | 7.99 | 8.05 | 12.32 |
| `primary-fg` | `primary` | Primary button label (text) | 6.37 | 6.59 | 12.32 |
| `accent-fg` | `accent` | Highlighter / marker label (text) | 11.83 | 11.83 | 14.54 |
| `inverse-fg` | `inverse` | Selected chips, tooltips (text) | 16.07 | 16.58 | 21.00 |
| `success-fg` | `success` | Success badge / solid (text) | 5.34 | 7.32 | 8.97 |
| `warning-fg` | `warning` | Warning badge / solid (text) | 7.29 | 10.43 | 14.54 |
| `danger-fg` | `danger` | Danger button label (text) | 5.29 | 7.43 | 8.53 |
| `info-soft-fg` | `info-soft` | Info alert text (text) | 8.83 | 8.82 | 12.72 |
| `success-soft-fg` | `success-soft` | Success alert text (text) | 5.89 | 9.68 | 10.88 |
| `warning-soft-fg` | `warning-soft` | Warning alert text (text) | 6.77 | 10.28 | 11.07 |
| `danger-soft-fg` | `danger-soft` | Danger alert text (text) | 6.35 | 9.49 | 9.48 |
| `danger-text` | `surface` | Field error message on cards (text) | 7.45 | 8.29 | 8.53 |
| `danger-text` | `canvas` | Field error message on the page (text) | 7.01 | 9.17 | 8.53 |
| `band-elementary-fg` | `band-elementary` | Grades 1–5 tile (text) | 11.83 | 11.83 | 14.54 |
| `band-middle-fg` | `band-middle` | Grades 6–8 tile (text) | 5.34 | 5.34 | 8.97 |
| `band-high-fg` | `band-high` | Grades 9–12 tile (text) | 6.37 | 6.37 | 12.32 |
| `line` | `canvas` | Borders of controls on the page (ui) | 16.07 | 6.75 | 21.00 |
| `line` | `surface` | Borders of controls on cards (ui) | 17.08 | 6.10 | 21.00 |
| `focus` | `canvas` | Focus ring on the page (ui) | 5.99 | 12.84 | 21.00 |
| `focus` | `surface` | Focus ring on cards (ui) | 6.37 | 11.61 | 21.00 |
| `primary` | `canvas` | Primary button against the page (ui) | 5.99 | 6.59 | 12.32 |
| `primary` | `surface` | Checked checkbox / switch / progress fill (ui) | 6.37 | 5.95 | 12.32 |
| `danger` | `surface` | Invalid field border (ui) | 5.29 | 6.66 | 8.53 |
| `line` | `surface-sunken` | Unchecked switch track border (ui) | 14.93 | 5.27 | 17.62 |

The colour section of `/design` also measures these ratios live in the browser for the current theme.

### Typography

One family, **Lexend** (self-hosted, `src/app/fonts/`), designed for reading proficiency. Use the semantic sizes; each
carries its line height, and the headline sizes carry their weight and letter spacing. Sizes depend on the grade band.

| Class | Grades 1–5 | Grades 6–8 (default) | Grades 9–12 | Use |
| --- | --- | --- | --- | --- |
| `text-display` | 44–72px | 40–64px | 36–56px | One per page at most: landing hero |
| `text-title` | 36–52px | 32–48px | 28–40px | Page titles (h1) |
| `text-heading` | 26px | 22px | 20px | Section headings, dialog titles |
| `text-lead` | 22px | 20px | 18px | Intro paragraphs, card titles (`CardTitle`) |
| `text-body` | 18px | 16px | 16px | Everything else |
| `text-control` | 18px | 16px | 16px | Text in buttons and inputs (never below 16px: iOS zooms in otherwise) |
| `text-small` | 16px | 14px | 14px | Labels, hints, metadata |
| `text-caption` | 15px | 13px | 13px | Badges, fine print |

Display and title scale fluidly with the screen width (`clamp`). Headline weight is 900, and 800 for Grades 9–12
(calmer). Keep line length under about 70 characters (`max-w-2xl` for body text).

### Spacing

Tailwind's 4px scale (`p-4` = 16px) plus named tokens that follow the grade band:

| Token | Value | Use |
| --- | --- | --- |
| `gutter` | 20px | Page side padding (`px-gutter`) |
| `card` | 24 / 20 / 16px | Padding inside cards, dialogs, sheets (`p-card`) |
| `stack` | 24 / 20 / 16px | Gap between form fields (`gap-stack`) |
| `control`, `control-sm`, `control-lg` | 56 / 44 / 40px (md) | Heights of buttons and inputs (`h-control`) |
| `control-x` | 20 / 16 / 14px | Horizontal padding in buttons |
| `check` | 28 / 24 / 20px | Checkbox and radio size |
| `icon` | 24 / 20 / 18px | Icons inside controls |

### Radius and shadow

| Token | Grades 1–5 | 6–8 | 9–12 | Use |
| --- | --- | --- | --- | --- |
| `rounded-control` | 14px | 8px | 6px | Buttons, inputs, chips |
| `rounded-card` | 20px | 12px | 8px | Cards, dialogs, menus |
| `rounded-full` | | | | Avatars, badges, switches |
| `shadow-sticker` | 4px | 3px | 2px | Cards, buttons, menus |
| `shadow-sticker-lg` | 7px | 6px | 4px | Dialogs, sheets, hover lift |

The sticker shadow is a hard offset in the theme's shadow colour. Flat cards (`<Card variant="flat">`) are for cards
inside cards and dense lists.

### Layers (z-index)

Never use raw numbers. Menus and tooltips sit above dialogs so they work inside them.

| Class | Value | Use |
| --- | --- | --- |
| `z-raised` | 10 | Content that overlaps its neighbours |
| `z-sticky` | 100 | Sticky headers and footers |
| `z-overlay` | 400 | Dialog / sheet scrim |
| `z-modal` | 410 | Dialogs, sheets |
| `z-popover` | 500 | Dropdown menus |
| `z-toast` | 600 | Toasts |
| `z-tooltip` | 700 | Tooltips |
| `z-skip` | 800 | The skip link |

### Motion

| Token | Value | Use |
| --- | --- | --- |
| `duration-fast` | 120ms | Hover, press, colour changes |
| `duration-base` | 200ms | Default transitions, fades, menus |
| `duration-slow` | 320ms | Sheets, progress fill |
| `ease-standard` / `ease-enter` / `ease-exit` | | Default / things appearing / things leaving |
| `ease-playful` | | Small bounce for Grades 1–5; standard otherwise |

Reusable animations: `animate-fade-in/out`, `animate-pop-in/out` (menus, dialogs), `animate-slide-in/out-{left,right,bottom}`
(sheets, toasts), `animate-celebrate` (finishing a lesson or course), and the progress bar fill.

Guidelines:

- Motion explains a change (something opened, moved or finished). Never decorate with it.
- Keep it short: under 320ms, except celebrations (600ms, once).
- No flashing, no parallax, no autoplaying loops.
- **Reduced motion** (`prefers-reduced-motion: reduce`): every animation and transition finishes instantly
  (see the end of `globals.css`). The one exception is the spinner, marked `data-essential-motion`, which keeps
  turning slowly because a frozen spinner looks broken.

## Themes

Four choices: **Match my device** (default), **Light**, **Dark**, **High contrast**.

- Stored in `localStorage` and applied by an inline script in `<head>` before first paint, so there is no flash
  of the wrong theme (`src/lib/preferences.ts`). It sets `data-theme` on `<html>`.
- "Match my device" follows `prefers-color-scheme`, and picks high contrast when the OS asks for more contrast
  (`prefers-contrast: more`) in light mode. It updates live when the OS setting changes, and across tabs.
- In code: `const { theme, resolvedTheme, setTheme } = usePreferences()`. UI: `<ThemeSwitcher />` (menu for headers)
  and `<ThemeSettings />` (radio group for settings screens).
- Works when storage is blocked (some private modes): the choice then lasts for the visit. The browser UI colour
  (`theme-color`) follows the chosen theme.
- Windows High Contrast (`forced-colors`) is respected: custom checkboxes, radios and switches fall back to native
  controls, and focus is always an outline.
- Adding a theme: add a `[data-theme="name"]` block to `tokens.css` that sets every semantic colour, add it to
  `THEME_PREFERENCES`, the script's allow-list, and `MIN` in `scripts/check-contrast.mjs`.

## Grade bands (age-appropriate presentation)

One switch changes how the whole product feels for a student's age. Set by `data-band` on `<html>`:

| | Grades 1–5 (`elementary`) | Grades 6–8 (`middle`, default) | Grades 9–12 (`high`) |
| --- | --- | --- | --- |
| Text | Larger (18px body) | 16px body | 16px body, smaller headings, lighter headline weight |
| Targets | 56px controls, 28px checkboxes | 44px, 24px | 40px, 20px |
| Shape | Rounder, deeper shadows | Standard | Squarer, flatter shadows |
| Decoration | Graph paper, big illustrations, bouncy press | Graph paper, medium illustrations | No grid, no illustrations (an icon instead) |
| Density | Most space | Standard | Least space |

- Today it is a local setting (Display settings in the account menu, and `/design`). When student accounts exist,
  the profile drives it: `setGradeBand(gradeBandForGrade(profile.grade))`.
- Bands are tokens, so they also work on a subtree: `<div data-band="elementary">` makes just that part younger.
- Components need no band logic. If something must differ beyond tokens, use the `young:` and `older:` variants
  (for example `hidden older:block`), sparingly.
- Grades 9–12 still get 40px targets: well above the 24px minimum of WCAG 2.5.8.

## Components

All in `src/components/ui/`. Native elements are used where they are good enough (inputs, select, checkbox, radio,
switch): they work with screen readers, on phones and tablets, with `register` from react-hook-form, and without
JavaScript. Dialogs, sheets, menus, tabs, tooltips and toasts are built on **Radix** primitives (focus trapping,
keyboard support, ARIA) instead of from scratch.

| Component | Use it for | Notes |
| --- | --- | --- |
| `Button`, `ButtonLink` | Actions; links that look like buttons | `variant`: primary (one per screen), secondary, ghost, danger. `size`: sm, md, lg, icon (needs `aria-label`). `loading` keeps focus and blocks double submits. `asChild` to style another element; with `disabled`/`loading` the element becomes aria-disabled and unfocusable (no spinner). Long labels wrap (the button grows) instead of overflowing small screens |
| `Input`, `Textarea`, `Select` | Text and choices from a list | Always inside a `FormField`. `Select` is native on purpose; use its `placeholder` prop ("Choose a subject") instead of a hand-made empty option |
| `PasswordInput` | Passwords | Show/hide button; set `autoComplete` to `current-password` or `new-password` |
| `Label` | A field's name | `optional` adds "(optional)": mark the few optional fields, not the many required ones |
| `FormField` | Label + hint + control + error | Wires `id`, `aria-describedby`, `aria-invalid`, `required`. Inside a `Form`, pass `name` and the error is read from the form |
| `Checkbox` | Independent yes/no choices | Label beside the box; `description` for detail |
| `RadioGroup`, `Radio` | One choice from a few (2–6) | `legend` names the group; use `Select` for long lists |
| `Switch` | Settings that apply immediately | Use a Checkbox when the choice is saved on submit |
| `Badge` | Status and categories | Tones incl. grade bands. Not clickable |
| `Card` (+ Header, Title, Description, Content, Footer) | Grouped content | `interactive` + `asChild` for whole-card links. `CardTitle as="h2"` to fit the outline |
| `Avatar` | People | Initials fallback (also when the image fails). `decorative` when the name is already given nearby |
| `Tabs` | Views of the same thing | Not for navigation between pages |
| `Tooltip` | Short hints on hover/focus | Never essential information: touch screens cannot hover |
| `Dialog` | Decisions that block the task | `title` is required; main action last |
| `Sheet` | Mobile navigation, filters, details | `side`: left, right, bottom |
| `DropdownMenu` | Actions and options from a button | Radio and checkbox items available |
| `toast()` + `Toaster` | Confirmation after an action ("Saved") | Short; errors stay until dismissed; at most 3 on screen (older ones close, errors last). Never for something the user must act on |
| `Alert` | Messages within the page | `role="alert"` only when it appears in response to an action |
| `Progress` | Known progress | `label` required; `valueText` for "3 of 8 questions" |
| `Spinner` | Unknown wait | Prefer a `Skeleton` when the shape of the content is known |
| `Skeleton` | Content loading | Wrap in `role="status"` with an `aria-label` |
| `Breadcrumb` | Where a page sits | Last item is the current page |
| `Pagination` | Paged lists | Buttons at either end are aria-disabled, so focus is never lost. On change, move focus to the results heading and scroll to it, as the courses page does |
| `EmptyState` | No results, nothing yet, could not load, done | Illustration follows the grade band; `headingLevel={1}` when it is the whole page |

Icons: **lucide-react** only, one consistent line set. Decorative icons are `aria-hidden` (the default); icon-only
buttons need an `aria-label`. Inside controls, icons take the `icon` size automatically.

Illustrations (`src/components/illustrations/`): `search`, `empty`, `error`, `celebrate`. Inline SVG drawn with token
colours (`fill-accent`, `stroke-line`), so they follow the theme. Add new ones in the same style: ink outline, offset
shadow, at most two highlighter colours, 200×160 viewBox.

## Forms

react-hook-form + zod. A form in full:

```tsx
const schema = z.object({
  name: fields.text("your name", { min: 2 }),
  email: fields.email(),
  grade: fields.choice(["1", "2", "3"], "a grade"),
  rules: fields.accept("agree to the class rules"),
});

function JoinClass() {
  const form = useZodForm(schema, { defaultValues: { name: "", email: "", rules: false } });
  return (
    <Form form={form} onSubmit={(values) => api.joinClass(values)}>
      <FormErrorSummary />
      <FormField name="name" label="Your name" required>
        <Input autoComplete="name" {...form.register("name")} />
      </FormField>
      …
      <Checkbox label="I agree to the class rules" {...form.register("rules")} />
      <SubmitButton>Join class</SubmitButton>
    </Form>
  );
}
```

- **When errors show:** when the form is submitted, then live while the user fixes them (`mode: "onSubmit"`,
  `reValidateMode: "onChange"`), and focus moves to the first problem. Not when leaving a field: an error appearing
  on blur pushes the button below it down, so the click that caused the blur misses it.
- **Messages** (`src/lib/forms/messages.ts`): say what to do, in plain words, without blame:
  "Enter your name.", "Use at least 8 characters.", "Enter an email address like name@example.com.".
  The `fields` helpers (`src/lib/forms/zod.ts`) build them in; a fallback map covers plain zod schemas.
- **Server errors:** if `onSubmit` throws the `ApiError` from the API client, `details[].field` entries are shown on the
  matching fields (FastAPI prefixes like `body.` are stripped) and the first one is focused. Anything else (unknown
  fields, 409 conflicts, 5xx, 429, network failures) appears in `FormErrorSummary`, which takes focus.
- **Submitting:** `SubmitButton` shows a spinner and ignores further clicks, without losing focus.

## Layouts

| Layout | Component | For |
| --- | --- | --- |
| Marketing | `MarketingShell` (`app/(marketing)/layout.tsx`) | Public pages: header with navigation and theme menu, graph paper, footer |
| App | `AppShell` | Signed-in areas. Sidebar on large screens, drawer on phones, theme and account menus. Navigation per role (student, teacher, parent, admin) from `src/config/navigation.ts` |
| Focus | `FocusShell` | Lessons and quizzes: no navigation or footer links, plain background, reading width, progress on top, one "Save and exit", previous/next kept in reach at the bottom |

Every layout starts with a "Skip to main content" link and has exactly one `<main id="main">`.

## Accessibility checklist (every screen)

- Keyboard only: everything reachable with Tab, operable with Enter/Space/arrows, focus always visible, no traps.
- Screen readers: one `h1`, headings in order, landmarks, every control named, state changes announced.
- Contrast: tokens only (then it is already checked).
- Targets: use `h-control` sizes; nothing interactive smaller than 24px.
- Works at 360px wide up to desktop, with no horizontal scrolling, in all three bands.
- Reduced motion, forced colours and 200% zoom all still work.
- Run axe on the page (the team's check: no violations) and look at `/design` in dark and high contrast.

## Changing the system

- **New colour:** add it to every theme block in `tokens.css`, map it in `globals.css`, add its pairs to
  `scripts/check-contrast.mjs`, run `npm run tokens:check`.
- **New named size** (type, spacing, radius, shadow, z-index): add it to `tokens.css` / `globals.css` **and** to
  `src/lib/cn.ts`, so `cn()` knows which classes conflict.
- **New component:** in `src/components/ui/`, tokens only, `cn()` for class merging, keyboard and screen reader tested,
  and added to `/design` in all its states.
