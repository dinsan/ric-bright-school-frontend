"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Counts the seconds a page is actually visible (a hidden tab or a locked screen doesn't count), for
 * "time spent" in lessons. `take()` returns the seconds counted since the last take and starts again,
 * so each progress report carries only new time and retries never double count.
 *
 * `onHide` runs when the page is hidden or closed (tab switch, app switch, navigation away) with the
 * untaken seconds: the place to send a last report with `keepalive`. It does not run for 0 seconds.
 */
export function useVisibleSeconds({ onHide }: { onHide?: (seconds: number) => void } = {}) {
  const counted = useRef(0);
  const visibleSince = useRef<number | null>(null);
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  const pause = useCallback(() => {
    if (visibleSince.current !== null) {
      counted.current += (performance.now() - visibleSince.current) / 1000;
      visibleSince.current = null;
    }
  }, []);

  const take = useCallback(() => {
    const running = visibleSince.current !== null;
    pause();
    const seconds = Math.floor(counted.current);
    counted.current -= seconds; // keep the fraction for next time
    if (running) visibleSince.current = performance.now();
    return seconds;
  }, [pause]);

  useEffect(() => {
    const flush = () => {
      const seconds = take();
      pause();
      if (seconds > 0) onHideRef.current?.(seconds);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") visibleSince.current ??= performance.now();
      else flush();
    };
    if (document.visibilityState === "visible") visibleSince.current = performance.now();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush(); // leaving the lesson inside the app (client-side navigation)
    };
  }, [pause, take]);

  return { take };
}
