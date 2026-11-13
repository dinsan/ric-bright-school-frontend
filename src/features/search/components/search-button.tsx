"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { SearchDialog } from "./search-dialog";

const noSubscription = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Typing in a field: "/" is a character there, not a shortcut. */
function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

/**
 * Opens global search. Also from anywhere with Ctrl+K (⌘K on a Mac), or "/" when not typing in a field.
 * A real link to /search that script turns into the search dialog: before the page's JavaScript has
 * loaded (slow school networks) or without it, it still leads to a working search page.
 * `compact`: icon only (the name is still announced), for crowded top bars.
 */
export function SearchButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  // What had focus when search opened (this button, or wherever a shortcut was pressed): it gets focus back.
  const returnFocus = useRef<HTMLElement | null>(null);
  const openSearch = useCallback(() => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  // Known only in the browser: render the hint after hydration so server and client HTML agree.
  const mac = useSyncExternalStore(noSubscription, isMac, () => null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else openSearch();
      } else if (event.key === "/" && !open && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditable(event.target)) {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, openSearch]);

  const shortcut = mac === null ? null : mac ? "⌘K" : "Ctrl K";
  return (
    <>
      <a
        href="/search"
        onClick={(event) => {
          // New tab or window (Ctrl/⌘/Shift-click, middle click): let the browser open /search.
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          openSearch();
        }}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K /"
        className={cn(
          "inline-flex min-h-control-sm items-center gap-2 rounded-control border-2 border-line bg-surface px-2.5 text-small font-bold text-fg hover:bg-surface-sunken",
          className,
        )}
      >
        <Search aria-hidden className="size-4" />
        <span className={cn(compact ? "sr-only" : "max-sm:sr-only")}>Search</span>
        {shortcut && !compact && (
          <kbd aria-hidden className="hidden rounded border border-line-subtle px-1 font-sans text-caption text-fg-muted sm:inline">
            {shortcut}
          </kbd>
        )}
      </a>
      <SearchDialog open={open} onOpenChange={setOpen} returnFocusTo={returnFocus} />
    </>
  );
}
