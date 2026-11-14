"use client";

import { ArrowRight, BookOpen, CornerDownLeft, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { DialogOverlay } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { SEARCH_SUGGESTIONS, searchPageHref } from "../constants";
import { useInstantSearch } from "../hooks";
import type { SearchHit } from "../types";
import { Highlight } from "./highlight";

/**
 * Global search, command-palette style: results appear while typing, grouped into courses and lessons.
 * Built as the ARIA combobox pattern: focus stays in the input, arrow keys move through the options
 * (aria-activedescendant), Enter opens one, Escape closes the dialog and focus returns to the trigger.
 * Result counts are announced. The full results page (/search) works without JavaScript.
 */

type Option = { key: string; href: string; hit?: SearchHit };

export function SearchDialog({
  open,
  onOpenChange,
  returnFocusTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes back to on close: what had focus when search was opened (Radix only knows its own trigger). */
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { data, terms, searchable, pending, error, query } = useInstantSearch(input, { enabled: open });
  const ids = useId();

  const options: Option[] = [
    ...(data?.courses ?? []).map((hit) => ({ key: `course-${hit.id}`, href: hit.url, hit })),
    ...(data?.lessons ?? []).map((hit) => ({ key: `lesson-${hit.id}`, href: hit.url, hit })),
    ...(searchable && data && data.courses.length + data.lessons.length > 0 ? [{ key: "all", href: searchPageHref(query) }] : []),
  ];
  // The highlighted option: the one chosen with the arrows or the mouse, else the first.
  const activeIndex = Math.max(0, options.findIndex((option) => option.key === activeKey));
  const active = options[activeIndex];
  const optionId = (key: string) => `${ids}-option-${key}`;

  // When the results overflow, the arrows keep the highlighted option in view ("nearest": no jumps).
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeKey) return;
    resultsRef.current?.querySelector(`[id="${CSS.escape(optionId(activeKey))}"]`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is stable for a given render id
  }, [activeKey]);

  // Leaving for a result: the destination takes focus (a targeted lesson), not the Search button.
  const navigating = useRef(false);
  const go = (href: string) => {
    navigating.current = true;
    onOpenChange(false);
    const url = new URL(href, window.location.href);
    // A lesson on the page already open: a plain hash change scrolls to it (router.push wouldn't).
    if (url.hash && url.pathname === window.location.pathname) window.location.assign(url.hash);
    else router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveKey(options[(activeIndex + step + options.length) % options.length]!.key);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active) go(active.href);
      else if (input.trim()) go(searchPageHref(input.trim()));
    }
  };

  const total = (data?.courses.length ?? 0) + (data?.lessons.length ?? 0);
  const announcement = !searchable
    ? ""
    : pending && !data
      ? "Searching"
      : error
        ? "Search isn't working right now"
        : data && total === 0
          ? "No results"
          : data
            ? `${pluralize(data.courses.length, "course")} and ${pluralize(data.lessons.length, "lesson")}${data.approximate ? ", close matches" : ""}`
            : "";

  const renderOption = (option: Option) => {
    const selected = option.key === active?.key;
    const { hit } = option;
    return (
      <li
        key={option.key}
        id={optionId(option.key)}
        role="option"
        aria-selected={selected}
        onMouseMove={() => setActiveKey(option.key)}
        onClick={() => go(option.href)}
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-control border-2 px-3 py-2.5",
          selected ? "border-line bg-surface-sunken" : "border-transparent",
        )}
      >
        {hit ? (
          <>
            <span aria-hidden className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-control border-2 border-line bg-accent text-accent-fg">
              {hit.kind === "course" ? <BookOpen className="size-4" /> : <FileText className="size-4" />}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-bold wrap-break-word">
                <Highlight text={hit.title} terms={terms} />
              </span>
              <span className="line-clamp-2 text-small text-fg-muted">
                {hit.kind === "lesson" && hit.course ? `Lesson in ${hit.course.title} · ` : ""}
                Grade {hit.grade_level} · {hit.subject.name}
                {hit.duration_minutes ? ` · ${hit.duration_minutes} min` : ""}
              </span>
            </span>
          </>
        ) : (
          <span className="flex flex-1 items-center gap-2 py-1 font-bold">
            <ArrowRight aria-hidden className="size-4" />
            See all results for &ldquo;{query}&rdquo;
          </span>
        )}
        {selected && <CornerDownLeft aria-hidden className="mt-1.5 size-4 shrink-0 text-fg-muted" />}
      </li>
    );
  };

  const groups: Array<{ id: string; label: string; options: Option[] }> = [
    { id: "courses", label: "Courses", options: options.filter((option) => option.hit?.kind === "course") },
    { id: "lessons", label: "Lessons", options: options.filter((option) => option.hit?.kind === "lesson") },
  ];
  const seeAll = options.find((option) => option.key === "all");

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setInput("");
          setActiveKey(null);
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (navigating.current) {
              navigating.current = false;
              event.preventDefault();
              return;
            }
            const target = returnFocusTo?.current;
            if (target?.isConnected) {
              event.preventDefault();
              target.focus();
            }
          }}
          className={cn(
            "fixed top-[8dvh] left-1/2 z-modal flex max-h-[84dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col",
            "rounded-card border-2 border-line bg-surface text-fg shadow-sticker-lg",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search courses and lessons</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b-2 border-line px-4">
            <Search aria-hidden className="size-5 shrink-0 text-fg-muted" />
            <input
              type="text"
              role="combobox"
              aria-label="Search courses and lessons"
              aria-expanded={options.length > 0}
              aria-controls={`${ids}-listbox`}
              aria-autocomplete="list"
              aria-activedescendant={active ? optionId(active.key) : undefined}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="Search courses and lessons"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setActiveKey(null);
              }}
              onKeyDown={onKeyDown}
              className="h-14 min-w-0 flex-1 bg-transparent text-lead outline-none placeholder:text-fg-muted"
            />
            {pending && <Spinner label="Searching" className="size-5" />}
            <DialogPrimitive.Close className="rounded-control border-2 border-line-subtle px-2 py-0.5 text-small font-bold text-fg-muted hover:bg-surface-sunken">
              Esc<span className="sr-only"> (close search)</span>
            </DialogPrimitive.Close>
          </div>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>

          {/*
            The results can overflow on small screens, so the scroll container is itself reachable with
            the keyboard (tabIndex=0: Tab from the input, then the arrow keys scroll natively), as a named
            region. The combobox pattern is untouched: focus normally stays in the input and
            aria-activedescendant points at the highlighted option (FE-PUB-13).
          */}
          <div
            ref={resultsRef}
            role="region"
            aria-label="Search results"
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto p-3 focus-visible:-outline-offset-2"
          >
            <ul id={`${ids}-listbox`} role="listbox" aria-label="Search results" className={cn("grid gap-4", options.length === 0 && "hidden")}>
              {groups
                .filter((group) => group.options.length > 0)
                .map((group) => (
                  <li key={group.id} role="presentation">
                    <ul role="group" aria-labelledby={`${ids}-${group.id}`} className="grid gap-1">
                      <li role="presentation" id={`${ids}-${group.id}`} className="px-3 pb-1 text-small font-bold text-fg-muted">
                        {group.label}
                      </li>
                      {group.options.map(renderOption)}
                    </ul>
                  </li>
                ))}
              {seeAll && (
                <li role="presentation">
                  <ul role="group" aria-label="More" className="grid">
                    {renderOption(seeAll)}
                  </ul>
                </li>
              )}
            </ul>

            {data?.approximate && options.length > 0 && (
              <p className="px-3 pt-3 text-small text-fg-muted">
                No exact matches, so these are close matches. Check the spelling?
                {data.suggestion && (
                  <>
                    {" "}
                    Did you mean{" "}
                    <button
                      type="button"
                      onClick={() => setInput(data.suggestion!)}
                      className="font-bold underline underline-offset-4 hover:no-underline"
                    >
                      {data.suggestion}
                    </button>
                    ?
                  </>
                )}
              </p>
            )}

            {!searchable && (
              <div className="grid gap-3 px-3 py-2">
                <p className="text-small text-fg-muted">Search every course and lesson by title, topic, subject or grade. Try:</p>
                <ul className="flex flex-wrap gap-2">
                  {SEARCH_SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => setInput(suggestion)}
                        className="rounded-control border-2 border-line bg-surface px-3 py-1 text-small font-bold hover:bg-surface-sunken"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searchable && data && total === 0 && !pending && (
              <div className="grid gap-1 px-3 py-4 text-center">
                <p className="font-bold">No courses or lessons match &ldquo;{query}&rdquo;</p>
                <p className="text-small text-fg-muted">Check the spelling, try fewer words, or browse all courses.</p>
              </div>
            )}

            {error && !data && (
              <p role="alert" className="px-3 py-4 text-center text-small">
                Search isn&apos;t working right now. Try again in a moment.
              </p>
            )}
          </div>

          <div aria-hidden className="hidden items-center gap-4 border-t-2 border-line-subtle px-4 py-2 text-caption text-fg-muted sm:flex">
            <span>↑ ↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
