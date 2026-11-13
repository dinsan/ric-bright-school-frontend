"use client";

import { useEffect } from "react";

/**
 * Highlights and focuses the lesson named in the URL (#lesson-…) in a course outline. CSS :target does
 * this on a full page load, but not after client-side navigation (search results, links within the
 * app), which doesn't update :target. Focus also takes keyboard and screen-reader users straight there.
 */
export function LessonTarget() {
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("[data-targeted]").forEach((element) => element.removeAttribute("data-targeted"));
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("lesson-")) return;
      const element = document.getElementById(id);
      if (!element) return;
      element.setAttribute("data-targeted", "true");
      element.focus();
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);
  return null;
}
