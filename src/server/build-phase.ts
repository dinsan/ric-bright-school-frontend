import "server-only";

import { PHASE_PRODUCTION_BUILD } from "next/constants";

/** True while `next build` prerenders pages. */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;
}

/**
 * Data for pages that are prerendered at build time and then regenerated (ISR), like the home page.
 * Builds must not need a database (Docker builds have none), so during `next build`:
 * - with DATABASE_URL set and reachable, the real data is used;
 * - otherwise `fallback` is used, and the page gets its data at its first regeneration
 *   (`revalidate` seconds after the build).
 * At run time errors are not swallowed: a failed regeneration keeps serving the previous version.
 */
export async function withBuildFallback<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  if (!isBuildPhase()) return load();
  if (!process.env.DATABASE_URL) return fallback;
  try {
    return await load();
  } catch (error) {
    console.warn(`[build] database not reachable, prerendering without catalog data: ${error instanceof Error ? error.message : error}`);
    return fallback;
  }
}
