/**
 * A link to a policy from a consent checkbox. Opens in a new tab, so the half-filled form stays; says so
 * for screen readers.
 */
export function PolicyLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="font-bold text-link underline underline-offset-4">
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
