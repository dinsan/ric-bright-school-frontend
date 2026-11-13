# Component test plan

The behaviour every design-system component must keep. Each line was verified by hand in Chromium (mouse,
keyboard and screen-reader semantics) when the design system was reviewed. They are written so they can be
automated one-to-one: component tests with Vitest + Testing Library (FE-OPS-03) and browser flows with
Playwright (FE-OPS-04). **R** marks a bug that was found and fixed: keep a regression test for it.

Automated so far (`npm run test:unit`): Button, FormField, PasswordInput, Checkbox, Breadcrumb and Pagination in
`tests/components/design-system.test.tsx`; the Forms section in `tests/components/forms.test.tsx`; the Courses
lines in `tests/components/catalog.test.tsx`. The rest is tracked in FE-DS-11.

## Button

- Click fires `onClick`; `disabled` and `loading` buttons do not (mouse, Enter, Space).
- `loading`: stays focusable, `aria-busy="true"`, spinner hidden from assistive technology.
- **R** `asChild` + `disabled` (or `loading`) on a link: `aria-disabled="true"`, not in the tab order, does not navigate.
- `asChild` renders the child element (an `<a>`) with button styles.
- Icon-only button has an accessible name (`aria-label`).
- **R** A long label wraps inside the button on a 360px screen (Grades 1–5 sizes) instead of overflowing.

## PasswordInput

- Show/hide toggles the type between password and text; the toggle says which (`aria-pressed`, "Show/Hide password").

## FormField, Input, Textarea, Select

- Label targets the control (clicking the label focuses it); a custom `id` on FormField is used by both.
- Hint and error are both in `aria-describedby` (hint first); the control's own `aria-describedby` is kept.
- With `error`: `aria-invalid="true"`. With `required`: `required` attribute. Without `required`: none (filters are not required).
- `hideLabel` hides the label visually but it still names the control; `optional` adds "(optional)" to the name.
- Controlled and uncontrolled inputs both work.
- Read-only inputs look read-only; **R** a `<select>` does not (`:read-only` matches every select).
- **R** A select with a long option does not widen its container on a 360px screen.
- `Select placeholder`: shown first with value `""`, cannot be chosen again, counts as "nothing chosen" in validation.

## Checkbox, RadioGroup, Switch

- Checkbox: clicking the label and pressing Space toggle it; controlled works; disabled cannot change; check mark visible when checked; `error` sets `aria-invalid` and `aria-describedby`.
- RadioGroup: `role="radiogroup"` named by its legend; arrow keys move the selection and skip disabled options (wrapping); `error` sets `aria-invalid` + `aria-describedby` on the group.
- Switch: `role="switch"`; label click and Space toggle it; the thumb travels to the end of the track; disabled cannot change.
- All three show a visible focus outline; in forced-colors mode they fall back to native controls.

## Tabs

- Arrow keys move and select, skipping disabled tabs; Home and End go to the first and last tab.
- Each panel is named by its tab; Tab moves from the tab list into the panel.

## Tooltip

- Shows on hover and on keyboard focus (when no scroll happens); the trigger is described by it; Escape hides it.
- Known: Radix closes tooltips when the page scrolls; tooltips never hold essential information.

## Dialog and Sheet

- Opens from its trigger; controlled `open` / `onOpenChange` follow; focus moves inside and is trapped.
- Page scroll is locked; content outside is hidden from assistive technology.
- Escape and a click on the scrim close it; focus returns to the trigger.
- A native select, a dropdown menu (rendered above the dialog) and a button that raises a toast all work inside a dialog.
- A toast raised inside a dialog is announced, and its Dismiss button works without closing the dialog.
- Sheets dock to their edge (left, right, bottom), close with Escape and return focus.

## DropdownMenu

- Opens with click, Enter, Space and ArrowDown, focusing the first item; Escape closes and returns focus to the trigger.
- Arrow keys skip disabled items; Home/End; typing a letter jumps to the matching item.
- Enter selects and closes; checkbox and radio items update state and expose `aria-checked`.

## Toast

- Auto-dismisses after its duration; error toasts stay until dismissed; Dismiss button works; F8 moves focus to the notifications.
- At most three on screen: older ones close first, error toasts are kept while possible.
- **R** After a toast is dismissed with the mouse, the next toast still auto-dismisses (Radix pause not reset; see `toast.tsx`).

## Progress, Avatar, Breadcrumb, Pagination, EmptyState

- Progress clamps values below 0 and above max, survives `max={0}`, and speaks `valueText` when given.
- Avatar initials: first and last name ("Ada Byron Lovelace" → AL), single name, blank name (?), accented letters; a broken image falls back to initials; `decorative` hides it from assistive technology.
- Breadcrumb: the last item is the current page (`aria-current="page"`), never a link.
- **R** Pagination: reaching the last page with "Next" keeps keyboard focus on the button (aria-disabled, not disabled); unavailable buttons do nothing with mouse or keyboard.
- EmptyState: heading level follows `headingLevel`; illustration large for Grades 1–5, hidden (icon instead) for 9–12.

## Forms (react-hook-form + zod)

- No error before the first submit (typing or leaving a field shows nothing); after a submit, errors update live and clear once fixed.
- **R** Clicking a button right below a field that was just left is not swallowed by an error appearing (layout shift on blur).
- Number fields: below the minimum, decimals and empty each give their own message.
- Optional fields are still validated (maximum length).
- Empty submit: one message per field and focus on the first invalid field.
- A server error for a field (`details[].field`, `body.` prefix) shows on that field, is focused, and clears when the field is edited.
- A server 5xx / 409 / network failure shows in the form summary (`role="alert"`, focused) and clears on the next successful submit.
- Submitted values are typed and transformed (trimmed text, numbers, empty optional text removed).
- `reset()` clears text, number, select, radio and checkbox, and shows no errors.
- While sending, Enter in a field and further clicks do not submit again.
- **R** A submit before JavaScript has loaded never puts field values (passwords) in the URL: forms use `method="post"`.

## Preferences (theme and grade band)

- The remembered theme and band are applied before first paint (no flash); invalid stored values fall back to defaults.
- Changing the band changes control height (56 / 44 / 40px).
- **R** With storage blocked, a chosen theme and band still apply for the visit.
- **R** The page follows OS dark-mode changes and changes made in another tab, also on pages without a theme switcher.
- The browser `theme-color` follows the chosen theme, also after reload.

## Layouts and pages

- Skip link is the first Tab stop, becomes visible, and moves focus to `<main>`.
- App shell: the drawer lists the role's navigation with the current item marked; **R** it closes when the window grows to desktop.
- **R** Courses: a page number past the end (`?page=99`) says so and offers the last page, instead of "No courses yet".
- Every page: no horizontal scrolling at 360, 768 and 1280px in every theme and grade band; no axe violations (WCAG 2.2 AA + best practice).
