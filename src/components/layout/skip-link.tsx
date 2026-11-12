/** First focusable element on every page: jumps past the header to the main content. */
export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only z-skip rounded-control border-2 border-line bg-surface px-4 py-2 font-bold text-fg shadow-sticker focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to main content
    </a>
  );
}
